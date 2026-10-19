import { Directory, File } from 'expo-file-system';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

import { type Segment, SegmentStore } from './SegmentStore';

export const BUFFER_SECONDS = 30;
/** A new segment starts every SEGMENT_SECONDS… */
export const SEGMENT_SECONDS = 5;
/** …and each one lasts OVERLAP_SECONDS longer: consecutive segments overlap, so there is no gap. */
export const OVERLAP_SECONDS = 0.5;
/** Upper bound for finalizing the current segments when VAR is pressed. */
const FREEZE_TIMEOUT_MS = 2000;

export type BufferStats = {
  /** Seconds actually covered by the files on disk (capped at BUFFER_SECONDS). */
  bufferedS: number;
  /** Files on disk, including the segments being recorded. */
  filesOnDisk: number;
  deletedCount: number;
  totalMB: number;
  lastOverlapS?: number;
  errorCount: number;
};

type ActiveSegment = {
  startedAt?: number;
  /** Resolves once the recorder has actually started (or failed to). */
  started: Promise<void>;
  /** Resolves once the file is fully written (or recording failed). */
  finished: Promise<void>;
};

const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

function deleteFile(path: string) {
  try {
    const file = new File(toUri(path));
    if (file.exists) file.delete();
  } catch (e) {
    console.warn(`Could not delete ${path}`, e);
  }
}

function fileSize(path: string): number {
  try {
    return new File(toUri(path)).size ?? 0;
  } catch {
    return 0;
  }
}

/** Deletes videos left in the segment folder by a previous session (crash, app killed). */
function purgeStaleRecordings(currentPath: string) {
  try {
    const dir = new File(toUri(currentPath)).parentDirectory;
    for (const entry of new Directory(dir.uri).list()) {
      const isVideo = entry.name.endsWith('.mov') || entry.name.endsWith('.mp4');
      if (entry instanceof File && isVideo && !currentPath.endsWith(entry.name)) entry.delete();
    }
  } catch (e) {
    console.warn('Could not purge stale segments', e);
  }
}

/**
 * Records continuously into short overlapping segments, and deletes the ones that leave the
 * BUFFER_SECONDS window as recording goes. Nothing is kept in memory: everything is on disk.
 *
 * Lifecycle: `start()` → (`freeze()` for a replay → `discard()`) → `start()` again.
 */
export class RollingBuffer {
  private store = new SegmentStore(BUFFER_SECONDS * 1000);
  private active = new Map<Recorder, ActiveSegment>();
  private running = false;
  private purged = false;
  private errorCount = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly videoOutput: CameraVideoOutput) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.startSegment();
  }

  /** Stops scheduling new segments; the ones in progress finish on their own. Keeps the files. */
  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  /**
   * VAR: stops recording, waits until every segment in progress is written to disk, and returns
   * all segments (oldest first). Nothing is deleted until `discard()`.
   */
  async freeze(): Promise<Segment[]> {
    this.stop();
    const pending = [...this.active.entries()].map(async ([recorder, segment]) => {
      await segment.started;
      if (recorder.isRecording) await recorder.stopRecording().catch(() => {});
      await segment.finished;
    });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FREEZE_TIMEOUT_MS));
    await Promise.race([Promise.all(pending), timeout]);
    return [...this.store.list];
  }

  /** Deletes every segment on disk and cancels recordings in progress. */
  discard() {
    this.stop();
    for (const recorder of this.active.keys()) recorder.cancelRecording().catch(() => {});
    this.active.clear();
    for (const segment of this.store.clear()) deleteFile(segment.path);
  }

  getStats(): BufferStats {
    const now = Date.now();
    const starts = [
      ...this.store.list.map((s) => s.startedAt),
      ...[...this.active.values()].flatMap((s) => (s.startedAt != null ? [s.startedAt] : [])),
    ];
    const oldest = starts.length > 0 ? Math.min(...starts) : now;
    const overlapMs = this.store.lastOverlapMs;
    return {
      bufferedS: Math.min(BUFFER_SECONDS, (now - oldest) / 1000),
      filesOnDisk: this.store.list.length + this.active.size,
      deletedCount: this.store.deletedCount,
      totalMB: this.store.totalBytes / 1e6,
      lastOverlapS: overlapMs != null ? overlapMs / 1000 : undefined,
      errorCount: this.errorCount,
    };
  }

  private async startSegment() {
    if (!this.running) return;
    // Fixed cadence: schedule the next segment before awaiting this one's start, so start-up
    // latency does not accumulate and eat into the overlap.
    this.timer = setTimeout(() => this.startSegment(), SEGMENT_SECONDS * 1000);

    let recorder: Recorder;
    try {
      recorder = await this.videoOutput.createRecorder({ maxDuration: SEGMENT_SECONDS + OVERLAP_SECONDS });
    } catch (e) {
      this.errorCount += 1;
      console.warn('Could not create segment recorder', e);
      return;
    }
    if (!this.running) return;
    if (!this.purged) {
      this.purged = true;
      purgeStaleRecordings(recorder.filePath);
    }

    let markStarted!: () => void;
    let markFinished!: () => void;
    const segment: ActiveSegment = {
      started: new Promise((resolve) => (markStarted = resolve)),
      finished: new Promise((resolve) => (markFinished = resolve)),
    };
    this.active.set(recorder, segment);

    const onFinished = (path: string) => {
      const wasTracked = this.active.delete(recorder);
      if (!wasTracked) {
        deleteFile(path); // discarded while finishing
      } else {
        this.store.add({
          path,
          startedAt: segment.startedAt ?? Date.now(),
          endedAt: Date.now(),
          durationS: recorder.recordedDuration,
          sizeBytes: fileSize(path),
        });
        // While frozen for a replay, keep everything on disk.
        if (this.running) for (const expired of this.store.prune(Date.now())) deleteFile(expired.path);
      }
      markFinished();
    };
    const onError = (error: Error) => {
      this.active.delete(recorder);
      this.errorCount += 1;
      console.warn('Segment recording error', error);
      markFinished();
    };

    try {
      await recorder.startRecording(onFinished, onError);
      segment.startedAt = Date.now();
    } catch (e) {
      this.active.delete(recorder);
      this.errorCount += 1;
      console.warn('Could not start segment', e);
      markFinished();
    } finally {
      markStarted();
    }
  }
}

import type { CameraVideoOutput } from 'react-native-vision-camera';

import { type Clip, ClipQueue, type PointSnapshot } from './ClipQueue';
import type { PointEventSink } from './pointEvents';
import type { Segment } from './Segment';
import { deleteFile, SegmentRecorder } from './SegmentRecorder';

/** Finished points kept on disk, on top of the point being recorded. */
export const MAX_SAVED_POINTS = 2;
/** Safety limit: a point nobody validates only keeps its last MAX_POINT_SECONDS. */
export const MAX_POINT_SECONDS = 180;
const TRIM_EVERY_MS = 5000;

export type ClipStats = {
  recording: boolean;
  /** Seconds of video in the point being recorded. */
  currentS: number;
  currentTrimmed: boolean;
  savedCount: number;
  deletedCount: number;
  totalMB: number;
  lastOverlapS?: number;
  errorCount: number;
};

/** What VAR shows: the finished points (newest first) and what was filmed of the current one. */
export type ClipsForReplay = { finished: Clip[]; current: Clip };

const copy = (clip: Clip): Clip => ({ ...clip, segments: [...clip.segments] });

/**
 * One clip per point, on disk. Wires the camera files (SegmentRecorder) to the clip logic
 * (ClipQueue) and deletes the files the queue lets go. Point events are applied in order, since a
 * cut has to wait for the next file to start.
 */
export class ClipRecorder implements PointEventSink {
  private readonly queue: ClipQueue;
  private readonly recorder: SegmentRecorder;
  private chain: Promise<unknown> = Promise.resolve();
  private trimTimer: ReturnType<typeof setInterval> | undefined;

  constructor(videoOutput: CameraVideoOutput, maxSaved = MAX_SAVED_POINTS) {
    this.queue = new ClipQueue(maxSaved);
    this.recorder = new SegmentRecorder(videoOutput, (segment) => this.delete(this.queue.addSegment(segment)));
  }

  start() {
    this.enqueue(async () => {
      this.recorder.start();
      clearInterval(this.trimTimer);
      this.trimTimer = setInterval(
        () => this.delete(this.queue.trimCurrent(Date.now(), MAX_POINT_SECONDS)),
        TRIM_EVERY_MS,
      );
    });
  }

  /** Pause, replay, background: the files in progress are written, the point goes on afterwards. */
  stop(): Promise<void> {
    return this.enqueue(async () => {
      clearInterval(this.trimTimer);
      await this.recorder.stop();
    });
  }

  onPointEnded(point: PointSnapshot) {
    this.enqueue(async () => {
      const at = await this.recorder.cut();
      this.delete(this.queue.endPoint(at, point));
    });
  }

  onPointRetracted() {
    this.enqueue(async () => this.queue.retract());
  }

  /** VAR: stops recording, waits for every file to be written, and returns a copy of the clips. */
  async freeze(): Promise<ClipsForReplay> {
    await this.stop();
    return { finished: this.queue.finished.map(copy), current: copy(this.queue.current) };
  }

  /** End of the match: every file is deleted. */
  discard() {
    clearInterval(this.trimTimer);
    this.recorder.cancel();
    this.delete(this.queue.clear());
  }

  getStats(): ClipStats {
    const { current } = this.queue;
    const firstStart = current.segments[0]?.startedAt ?? this.recorder.currentStartedAt;
    const lastEnd = this.recorder.isRunning ? Date.now() : (current.segments.at(-1)?.endedAt ?? firstStart);
    return {
      recording: this.recorder.isRunning,
      currentS: firstStart != null && lastEnd != null ? Math.max(0, (lastEnd - firstStart) / 1000) : 0,
      currentTrimmed: current.trimmed,
      savedCount: this.queue.finished.length,
      deletedCount: this.queue.deletedCount,
      totalMB: this.queue.totalBytes / 1e6,
      lastOverlapS: this.recorder.lastOverlapMs != null ? this.recorder.lastOverlapMs / 1000 : undefined,
      errorCount: this.recorder.errorCount,
    };
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.chain.then(task, task);
    this.chain = next.catch((e) => console.warn('Clip task failed', e));
    return next;
  }

  private delete(segments: Segment[]) {
    for (const segment of segments) deleteFile(segment.path);
  }
}

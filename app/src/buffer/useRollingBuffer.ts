import { Directory, File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import type { CameraVideoOutput, Recorder } from 'react-native-vision-camera';

import { SegmentStore } from './SegmentStore';

export const BUFFER_SECONDS = 30;
/** A new segment starts every SEGMENT_SECONDS… */
export const SEGMENT_SECONDS = 5;
/** …and each one lasts OVERLAP_SECONDS longer: consecutive segments overlap, so there is no gap. */
export const OVERLAP_SECONDS = 0.5;

export type BufferStats = {
  /** Seconds actually covered by the files on disk (capped at BUFFER_SECONDS). */
  bufferedS: number;
  /** Files on disk, including the segment being recorded. */
  filesOnDisk: number;
  deletedCount: number;
  totalMB: number;
  lastOverlapS?: number;
  errorCount: number;
};

const EMPTY_STATS: BufferStats = { bufferedS: 0, filesOnDisk: 0, deletedCount: 0, totalMB: 0, errorCount: 0 };

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
 */
export function useRollingBuffer(videoOutput: CameraVideoOutput, enabled: boolean): BufferStats {
  const [stats, setStats] = useState<BufferStats>(EMPTY_STATS);

  useEffect(() => {
    if (!enabled) return;

    const store = new SegmentStore(BUFFER_SECONDS * 1000);
    const active = new Map<Recorder, number>(); // recorder → startedAt
    let cancelled = false;
    let purged = false;
    let errorCount = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      const now = Date.now();
      const starts = [...store.list.map((s) => s.startedAt), ...active.values()];
      const oldest = starts.length > 0 ? Math.min(...starts) : now;
      setStats({
        bufferedS: Math.min(BUFFER_SECONDS, (now - oldest) / 1000),
        filesOnDisk: store.list.length + active.size,
        deletedCount: store.deletedCount,
        totalMB: store.totalBytes / 1e6,
        lastOverlapS: store.lastOverlapMs != null ? store.lastOverlapMs / 1000 : undefined,
        errorCount,
      });
    };

    const startSegment = async () => {
      // Fixed cadence: schedule the next segment before awaiting this one's start, so start-up
      // latency does not accumulate and eat into the overlap.
      timer = setTimeout(startSegment, SEGMENT_SECONDS * 1000);
      try {
        const recorder = await videoOutput.createRecorder({ maxDuration: SEGMENT_SECONDS + OVERLAP_SECONDS });
        if (cancelled) return;
        if (!purged) {
          purged = true;
          purgeStaleRecordings(recorder.filePath);
        }
        await recorder.startRecording(
          (path) => {
            const startedAt = active.get(recorder) ?? Date.now();
            active.delete(recorder);
            if (cancelled) return deleteFile(path);
            store.add({
              path,
              startedAt,
              endedAt: Date.now(),
              durationS: recorder.recordedDuration,
              sizeBytes: fileSize(path),
            });
            for (const expired of store.prune(Date.now())) deleteFile(expired.path);
            refresh();
          },
          (error) => {
            active.delete(recorder);
            errorCount += 1;
            console.warn('Segment recording error', error);
          },
        );
        active.set(recorder, Date.now());
      } catch (e) {
        errorCount += 1;
        console.warn('Could not start segment', e);
      }
    };

    startSegment();
    const statsTimer = setInterval(refresh, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(statsTimer);
      for (const recorder of active.keys()) recorder.cancelRecording().catch(() => {});
      active.clear();
      // Nothing outlives the session: finished segments are deleted too.
      for (const segment of store.clear()) deleteFile(segment.path);
      setStats(EMPTY_STATS);
    };
  }, [videoOutput, enabled]);

  return stats;
}

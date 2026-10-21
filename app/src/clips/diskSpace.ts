import { Paths } from 'expo-file-system';

import { MAX_POINT_SECONDS, MAX_SAVED_POINTS } from './ClipRecorder';

/** Rough size of one minute of 720p60 as encoded by iOS (~20 Mbit/s). */
const BYTES_PER_MINUTE = 150e6;
/** Below this, recording is refused (the score still works). */
const MIN_FREE_BYTES = 500e6;

export type DiskPlan = {
  freeBytes: number;
  canRecord: boolean;
  maxSaved: number;
  warning?: string;
};

/** Worst case on disk: every kept point plus the current one at the safety limit. */
const worstCaseBytes = (maxSaved: number) => (maxSaved + 1) * (MAX_POINT_SECONDS / 60) * BYTES_PER_MINUTE;

/** Checks free space before the match and lowers the number of kept points if needed. */
export function planDiskUsage(): DiskPlan {
  let freeBytes: number;
  try {
    freeBytes = Paths.availableDiskSpace;
  } catch {
    return { freeBytes: Number.NaN, canRecord: true, maxSaved: MAX_SAVED_POINTS };
  }
  const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;
  if (freeBytes >= worstCaseBytes(MAX_SAVED_POINTS)) {
    return { freeBytes, canRecord: true, maxSaved: MAX_SAVED_POINTS };
  }
  if (freeBytes >= MIN_FREE_BYTES) {
    return { freeBytes, canRecord: true, maxSaved: 1, warning: `Low storage (${gb(freeBytes)} free): only 1 point kept` };
  }
  return { freeBytes, canRecord: false, maxSaved: 1, warning: `Storage full (${gb(freeBytes)} free): no video` };
}

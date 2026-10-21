/** One video file on disk. A clip is made of one or more segments. */
export type Segment = {
  /** File system path (not a file:// URL). */
  path: string;
  /** JS clock (Date.now) when recording actually started. */
  startedAt: number;
  /** JS clock when the file finished writing. */
  endedAt: number;
  durationS: number;
  sizeBytes: number;
};

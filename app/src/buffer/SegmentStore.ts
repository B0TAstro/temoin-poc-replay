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

/**
 * Finished segments, sorted by start time.
 * Pure logic (no disk access): `prune` returns the segments that left the window,
 * and the caller deletes the files.
 */
export class SegmentStore {
  private segments: Segment[] = [];
  private deleted = 0;

  constructor(private readonly maxSegments: number) {}

  add(segment: Segment) {
    this.segments.push(segment);
    this.segments.sort((a, b) => a.startedAt - b.startedAt);
  }

  /** Removes and returns the oldest segments beyond `maxSegments`. */
  prune(): Segment[] {
    const excess = Math.max(0, this.segments.length - this.maxSegments);
    const expired = this.segments.splice(0, excess);
    this.deleted += expired.length;
    return expired;
  }

  /** Empties the list and returns every segment (buffer shutdown). */
  clear(): Segment[] {
    const all = this.segments;
    this.segments = [];
    return all;
  }

  get list(): readonly Segment[] {
    return this.segments;
  }

  get deletedCount() {
    return this.deleted;
  }

  get totalBytes() {
    return this.segments.reduce((sum, s) => sum + s.sizeBytes, 0);
  }

  /**
   * Overlap between the last two segments, in ms.
   * Positive: they overlap (no frame lost). Negative: there is a gap.
   */
  get lastOverlapMs(): number | undefined {
    const n = this.segments.length;
    if (n < 2) return undefined;
    return this.segments[n - 2].endedAt - this.segments[n - 1].startedAt;
  }
}

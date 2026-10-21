import type { PointSnapshot } from './ClipQueue';

export type { PointSnapshot } from './ClipQueue';

/**
 * Where "end of point" events go. Today the score buttons and the relay call it (see
 * `sync/usePointEvents.ts`); tomorrow voice recognition or detection can call the same two methods.
 */
export interface PointEventSink {
  /** The point is over: the clip being recorded becomes this point. */
  onPointEnded(point: PointSnapshot): void;
  /** The last point end was a mistake (proposal cancelled, undo): its clip goes on recording. */
  onPointRetracted(): void;
}

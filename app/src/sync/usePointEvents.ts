import { useEffect, useRef } from 'react';

import type { PointEventSink, PointSnapshot } from '@/clips/pointEvents';
import { pointLabel, scoreMatch, type Player } from '@/score/tennis';

import type { PendingAction } from '../../../shared/protocol';

/** Point ends so far: the confirmed points, plus a point proposal waiting for confirmation. */
export const countPointEnds = (points: readonly Player[], pending: PendingAction | null) =>
  points.length + (pending?.kind === 'point' ? 1 : 0);

export type PointEndChange = { ended: PointSnapshot[]; retracted: number };

/** What changed between `emitted` point ends and the current match state. */
export function diffPointEnds(emitted: number, points: readonly Player[], pending: PendingAction | null): PointEndChange {
  const ends = countPointEnds(points, pending);
  const ended: PointSnapshot[] = [];
  // Each point is labelled with the score it was played at, i.e. the score before it.
  for (let index = emitted; index < ends; index++) {
    ended.push({ pointIndex: index, label: pointLabel(scoreMatch(points.slice(0, index))) });
  }
  return { ended, retracted: Math.max(0, emitted - ends) };
}

/**
 * Today's source of "end of point" events: the score buttons, through the relay.
 *
 * A point ends when "+1" is tapped, i.e. as soon as it is proposed, so the start of the next point
 * is never cut. A proposal that gets cancelled, or a confirmed undo, retracts that end.
 */
export function usePointEvents(
  sink: PointEventSink,
  points: readonly Player[],
  pending: PendingAction | null,
  /** False until the relay has sent the match state: the points already played are not events. */
  ready: boolean,
) {
  const emitted = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (emitted.current == null) {
      emitted.current = countPointEnds(points, pending); // joined a match in progress
      return;
    }
    const { ended, retracted } = diffPointEnds(emitted.current, points, pending);
    for (const point of ended) sink.onPointEnded(point);
    for (let i = 0; i < retracted; i++) sink.onPointRetracted();
    emitted.current += ended.length - retracted;
  }, [sink, points, pending, ready]);
}

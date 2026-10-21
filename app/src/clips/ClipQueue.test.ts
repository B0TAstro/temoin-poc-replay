import { describe, expect, it } from '@jest/globals';

import { ClipQueue } from './ClipQueue';
import type { Segment } from './Segment';

/** A 30 s file started at `startS` seconds (sizes in MB to keep numbers readable). */
const segment = (startS: number, durationS = 30): Segment => ({
  path: `/tmp/${startS}.mov`,
  startedAt: startS * 1000,
  endedAt: (startS + durationS) * 1000,
  durationS,
  sizeBytes: 1e6,
});
const point = (pointIndex: number) => ({ pointIndex, label: `point ${pointIndex}` });
const paths = (segments: readonly Segment[]) => segments.map((s) => s.path);

describe('one clip per point', () => {
  it('files segments under the point they were recorded for', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.endPoint(10_000, point(0));
    queue.addSegment(segment(10, 8));

    expect(queue.finished).toHaveLength(1);
    expect(queue.finished[0].point).toEqual(point(0));
    expect(paths(queue.finished[0].segments)).toEqual(['/tmp/0.mov']);
    expect(paths(queue.current.segments)).toEqual(['/tmp/10.mov']);
  });

  it('keeps a segment that finishes writing after the cut in its own point', () => {
    const queue = new ClipQueue(2);
    queue.endPoint(10_000, point(0));
    queue.addSegment(segment(0, 10.5)); // written after the cut, started before it
    expect(paths(queue.finished[0].segments)).toEqual(['/tmp/0.mov']);
    expect(queue.current.segments).toEqual([]);
  });

  it('lists finished points newest first and drops the oldest beyond the limit', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.endPoint(10_000, point(0));
    queue.addSegment(segment(10, 10));
    queue.endPoint(20_000, point(1));
    queue.addSegment(segment(20, 10));
    const dropped = queue.endPoint(30_000, point(2));

    expect(queue.finished.map((c) => c.point?.pointIndex)).toEqual([2, 1]);
    expect(paths(dropped)).toEqual(['/tmp/0.mov']);
    expect(queue.deletedCount).toBe(1);
  });

  it('deletes a late segment whose point was already dropped', () => {
    const queue = new ClipQueue(1);
    queue.endPoint(10_000, point(0));
    queue.endPoint(20_000, point(1));
    expect(paths(queue.addSegment(segment(0, 10)))).toEqual(['/tmp/0.mov']);
  });
});

describe('retracted point end (cancelled proposal, undo)', () => {
  it('glues what was filmed since back to the last point', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.endPoint(10_000, point(0));
    queue.addSegment(segment(10, 3));
    queue.retract();

    expect(queue.finished).toHaveLength(0);
    expect(queue.current.point).toBeUndefined();
    expect(paths(queue.current.segments)).toEqual(['/tmp/0.mov', '/tmp/10.mov']);

    // Segments still being written after the retraction land in the glued clip too.
    queue.addSegment(segment(13, 5));
    expect(queue.current.segments).toHaveLength(3);
  });

  it('gives a single clip for undo then corrected point', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.endPoint(10_000, point(0)); // wrong winner
    queue.addSegment(segment(10, 2));
    queue.retract(); // undo
    queue.endPoint(12_000, point(0)); // corrected
    expect(queue.finished).toHaveLength(1);
    expect(paths(queue.finished[0].segments)).toEqual(['/tmp/0.mov', '/tmp/10.mov']);
  });

  it('does nothing when there is no finished point', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.retract();
    expect(queue.current.segments).toHaveLength(1);
  });
});

describe('safety limit for a point nobody validates', () => {
  it('keeps only the last 3 minutes of the current point', () => {
    const queue = new ClipQueue(2);
    for (let s = 0; s < 240; s += 30) queue.addSegment(segment(s));
    const dropped = queue.trimCurrent(240_000, 180);

    expect(paths(dropped)).toEqual(['/tmp/0.mov', '/tmp/30.mov']);
    expect(queue.current.segments[0].startedAt).toBe(60_000);
    expect(queue.current.trimmed).toBe(true);
  });

  it('never touches finished points', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0));
    queue.endPoint(30_000, point(0));
    for (let s = 30; s < 300; s += 30) queue.addSegment(segment(s));
    queue.trimCurrent(300_000, 180);
    expect(queue.finished[0].segments).toHaveLength(1);
  });

  it('does nothing below the limit', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0));
    queue.addSegment(segment(30));
    expect(queue.trimCurrent(60_000, 180)).toEqual([]);
    expect(queue.current.trimmed).toBe(false);
  });
});

describe('gaps (pause, VAR, app in background)', () => {
  it('keeps recording into the same point after a gap', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.addSegment(segment(70, 10)); // resumed after a 60 s pause
    expect(queue.current.segments).toHaveLength(2);
    expect(queue.finished).toHaveLength(0);
  });
});

describe('end of match', () => {
  it('returns every file to delete', () => {
    const queue = new ClipQueue(2);
    queue.addSegment(segment(0, 10));
    queue.endPoint(10_000, point(0));
    queue.addSegment(segment(10, 10));
    expect(paths(queue.clear())).toEqual(['/tmp/10.mov', '/tmp/0.mov']);
    expect(queue.finished).toHaveLength(0);
    expect(queue.totalBytes).toBe(0);
  });
});

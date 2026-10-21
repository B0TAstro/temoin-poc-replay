import { describe, expect, it } from '@jest/globals';

import type { Segment } from '@/clips/Segment';

import { buildTimeline, locate } from './timeline';

const segment = (startS: number, durationS: number): Segment => ({
  path: `/tmp/${startS}.mov`,
  startedAt: startS * 1000,
  endedAt: (startS + durationS) * 1000,
  durationS,
  sizeBytes: 0,
});

describe('clip timeline', () => {
  it('keeps the real offsets of overlapping files', () => {
    const timeline = buildTimeline([segment(0, 30.5), segment(30, 12)]);
    expect(timeline.segments.map((s) => s.offsetS)).toEqual([0, 30]);
    expect(timeline.totalS).toBe(42);
  });

  it('squeezes out a pause between two files', () => {
    const timeline = buildTimeline([segment(0, 10), segment(70, 5)]); // 60 s pause
    expect(timeline.segments.map((s) => s.offsetS)).toEqual([0, 10]);
    expect(timeline.totalS).toBe(15);
    expect(locate(timeline, 12)).toEqual({ index: 1, localS: 2 });
  });

  it('plays the newest file where two overlap', () => {
    const timeline = buildTimeline([segment(0, 30.5), segment(30, 12)]);
    expect(locate(timeline, 30.2).index).toBe(1);
    expect(locate(timeline, 30.2, 0).index).toBe(0); // keeps the current one while stepping
  });
});

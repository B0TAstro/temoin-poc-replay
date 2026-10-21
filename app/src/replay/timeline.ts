import type { Segment } from '@/buffer/SegmentStore';

/** How many seconds before the VAR press the replay covers. */
export const REPLAY_WINDOW_SECONDS = 10;
/** Segments shorter than this (VAR pressed right after one started) are skipped. */
const MIN_SEGMENT_SECONDS = 0.1;

export type TimelineSegment = {
  path: string;
  /** Position of the segment's first frame on the replay timeline, in seconds. */
  offsetS: number;
  durationS: number;
};

export type Timeline = {
  segments: TimelineSegment[];
  totalS: number;
};

/**
 * Lays the last segments on a single timeline. Offsets come from the JS start times, which are
 * accurate to a few tens of ms: enough to switch from one segment to the next.
 */
export function buildTimeline(all: readonly Segment[], windowS = REPLAY_WINDOW_SECONDS): Timeline {
  const usable = all.filter((s) => s.durationS >= MIN_SEGMENT_SECONDS);
  if (usable.length === 0) return { segments: [], totalS: 0 };

  const endOf = (s: Segment) => s.startedAt + s.durationS * 1000;
  const lastEnd = Math.max(...usable.map(endOf));
  const kept = usable
    .filter((s) => endOf(s) > lastEnd - windowS * 1000)
    .sort((a, b) => a.startedAt - b.startedAt);

  const base = kept[0].startedAt;
  const segments = kept.map((s) => ({
    path: s.path,
    offsetS: (s.startedAt - base) / 1000,
    durationS: s.durationS,
  }));
  const totalS = Math.max(...segments.map((s) => s.offsetS + s.durationS));
  return { segments, totalS };
}

const contains = (s: TimelineSegment, t: number) => t >= s.offsetS && t <= s.offsetS + s.durationS;

/**
 * Finds which segment plays time `t` and where inside it. Keeps `preferIndex` when it covers `t`
 * (no needless switch while stepping frames), otherwise picks the newest segment covering `t`.
 */
export function locate(timeline: Timeline, t: number, preferIndex?: number): { index: number; localS: number } {
  const { segments } = timeline;
  const clamped = Math.min(Math.max(t, 0), timeline.totalS);
  let index = -1;
  if (preferIndex != null && segments[preferIndex] && contains(segments[preferIndex], clamped)) {
    index = preferIndex;
  } else {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (contains(segments[i], clamped)) {
        index = i;
        break;
      }
    }
  }
  if (index === -1) {
    // Gap between two segments (frames lost between files): jump to the next segment's start.
    index = segments.findIndex((s) => s.offsetS > clamped);
    if (index === -1) index = segments.length - 1;
  }
  const segment = segments[index];
  return { index, localS: Math.min(Math.max(clamped - segment.offsetS, 0), segment.durationS) };
}

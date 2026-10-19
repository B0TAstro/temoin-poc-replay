import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video, { type VideoRef } from 'react-native-video';

import type { Segment } from '@/buffer/SegmentStore';

import { buildTimeline, locate } from './timeline';
import { ZoomableView } from './ZoomableView';

const RATES = [0.25, 0.5, 1] as const;
const DEFAULT_RATE = 0.5;
/** Where the replay opens, in seconds before the VAR press. */
const START_BEFORE_END_SECONDS = 5;

type Props = {
  segments: readonly Segment[];
  /** Camera frame rate, used to step exactly one frame. */
  fps: number;
  /** performance.now() when VAR was pressed. */
  varPressedAt: number;
  /** Time spent finalizing the segments in progress, in ms. */
  finalizeMs: number;
  onResume: () => void;
};

const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);
/** Only ever called from event handlers, never during render. */
const now = () => performance.now();

/**
 * Plays the last seconds before VAR. Overlapping segments are stacked, all loaded; only the
 * active one is visible, so switching segments needs no reload.
 */
export function ReplayScreen({ segments, fps, varPressedAt, finalizeMs, onResume }: Props) {
  const timeline = useMemo(() => buildTimeline(segments), [segments]);
  const initial = useMemo(() => {
    const t = Math.max(0, timeline.totalS - START_BEFORE_END_SECONDS);
    return { t, ...locate(timeline, t) };
  }, [timeline]);

  const videoRefs = useRef<(VideoRef | null)[]>([]);
  const timeRef = useRef(initial.t);
  const initialSeekDone = useRef(false);
  const [activeIndex, setActiveIndex] = useState(initial.index);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [timeS, setTimeS] = useState(initial.t);
  const [latencyMs, setLatencyMs] = useState<number | undefined>();
  const [barWidth, setBarWidth] = useState(1);

  const setTime = (t: number) => {
    timeRef.current = t;
    setTimeS(t);
  };

  const seekTo = (t: number) => {
    const target = locate(timeline, t, activeIndex);
    // Zero tolerance: AVPlayer lands on the exact frame instead of the nearest keyframe.
    videoRefs.current[target.index]?.seek(target.localS, 0);
    setActiveIndex(target.index);
    setTime(timeline.segments[target.index].offsetS + target.localS);
  };

  const stepFrame = (direction: 1 | -1) => {
    setPlaying(false);
    seekTo(timeRef.current + direction / fps);
  };

  const togglePlay = () => {
    if (!playing && timeRef.current >= timeline.totalS - 1 / fps) seekTo(0); // replay from the start
    setPlaying((p) => !p);
  };

  const onSegmentEnd = (index: number) => {
    if (index !== activeIndex) return;
    const segment = timeline.segments[index];
    const next = timeline.segments[index + 1];
    if (!next) {
      setPlaying(false);
      setTime(timeline.totalS);
      return;
    }
    // The next segment already covers this instant (overlap): continue inside it.
    const t = segment.offsetS + segment.durationS;
    videoRefs.current[index + 1]?.seek(Math.max(0, t - next.offsetS), 0);
    setActiveIndex(index + 1);
    setTime(t);
  };

  const onInitialSeekDone = () => {
    if (initialSeekDone.current) return;
    initialSeekDone.current = true;
    const ms = now() - varPressedAt;
    setLatencyMs(ms);
    console.log(`[VAR] press → replay picture: ${ms.toFixed(0)} ms (finalize ${finalizeMs.toFixed(0)} ms)`);
    setPlaying(true);
  };

  if (timeline.segments.length === 0) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.emptyText}>Nothing recorded yet.</Text>
        <Pressable style={styles.resume} onPress={onResume}>
          <Text style={styles.resumeText}>Resume match</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const progress = timeline.totalS > 0 ? timeS / timeline.totalS : 0;

  return (
    <View style={styles.container}>
      <ZoomableView>
        {timeline.segments.map((segment, index) => (
          <Video
            key={segment.path}
            ref={(ref) => {
              videoRefs.current[index] = ref;
            }}
            source={{ uri: toUri(segment.path) }}
            style={[StyleSheet.absoluteFill, index !== activeIndex && styles.hidden]}
            resizeMode="contain"
            paused={!playing || index !== activeIndex}
            rate={rate}
            muted
            repeat={false}
            progressUpdateInterval={33}
            onLoad={() => {
              if (index !== initial.index) return;
              // Already on the right frame: no seek, so no onSeek event to wait for.
              if (initial.localS < 1 / fps) onInitialSeekDone();
              else videoRefs.current[index]?.seek(initial.localS, 0);
            }}
            onSeek={() => {
              if (index === initial.index) onInitialSeekDone();
            }}
            onProgress={(e) => {
              if (index === activeIndex && playing) setTime(segment.offsetS + e.currentTime);
            }}
            onEnd={() => onSegmentEnd(index)}
          />
        ))}
      </ZoomableView>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.badge}>
            <Text style={styles.badgeTitle}>VAR</Text>
            <Text style={styles.badgeDetail}>
              {latencyMs == null
                ? 'loading…'
                : `press → picture ${latencyMs.toFixed(0)} ms · finalize ${finalizeMs.toFixed(0)} ms`}
            </Text>
          </View>
          <Pressable style={styles.resume} onPress={onResume}>
            <Text style={styles.resumeText}>Resume match</Text>
          </Pressable>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.time}>
            {(timeS - timeline.totalS).toFixed(2)} s · x{rate}
          </Text>
          <Pressable
            style={styles.track}
            onLayout={(e) => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
            onPress={(e) => {
              setPlaying(false);
              seekTo((e.nativeEvent.locationX / barWidth) * timeline.totalS);
            }}
          >
            <View style={[styles.trackFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </Pressable>

          <View style={styles.row}>
            <ControlButton label="◀ frame" onPress={() => stepFrame(-1)} />
            <ControlButton label={playing ? 'Pause' : 'Play'} onPress={togglePlay} wide />
            <ControlButton label="frame ▶" onPress={() => stepFrame(1)} />
          </View>
          <View style={styles.row}>
            {RATES.map((r) => (
              <ControlButton key={r} label={`x${r}`} selected={rate === r} onPress={() => setRate(r)} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ControlButton({
  label,
  onPress,
  selected,
  wide,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, wide && styles.buttonWide, (selected || pressed) && styles.buttonOn]}
    >
      {({ pressed }) => (
        <Text style={[styles.buttonText, (selected || pressed) && styles.buttonTextOn]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  hidden: { opacity: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 },
  badge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexShrink: 1, marginRight: 12 },
  badgeTitle: { color: '#facc15', fontSize: 24, fontWeight: '900' },
  badgeDetail: { color: '#ddd', fontSize: 13, fontVariant: ['tabular-nums'] },
  resume: { backgroundColor: '#22c55e', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  resumeText: { color: '#000', fontSize: 18, fontWeight: '800' },
  bottomBar: { padding: 16, backgroundColor: 'rgba(0,0,0,0.6)', gap: 12 },
  time: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  track: { height: 28, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#facc15' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  button: { minWidth: 88, paddingVertical: 16, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  buttonWide: { minWidth: 120 },
  buttonOn: { backgroundColor: '#fff' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  buttonTextOn: { color: '#000' },
  empty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 24 },
  emptyText: { color: '#fff', fontSize: 22 },
});

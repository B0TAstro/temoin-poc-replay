import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  useVideoOutput,
  type CameraSessionConfig,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { RecIndicator } from '@/buffer/RecIndicator';
import type { Segment } from '@/buffer/SegmentStore';
import { useRollingBuffer } from '@/buffer/useRollingBuffer';
import { useFpsMeter } from '@/diagnostics/useFpsMeter';
import { buildJoinLink } from '@/pairing/joinLink';
import { QrCode } from '@/pairing/QrCode';
import { ReplayScreen } from '@/replay/ReplayScreen';
import { ScoreBoard } from '@/score/ScoreBoard';
import { scoreMatch } from '@/score/tennis';
import { PendingBanner } from '@/sync/PendingBanner';
import { type MatchMode, useMatchSync } from '@/sync/useMatchSync';

const TARGET_FPS = 60;
const PLAYER_NAMES: [string, string] = ['Player 1', 'Player 2'];

type Replay = { segments: Segment[]; varPressedAt: number; finalizeMs: number };

type Params = { mode?: string; relay?: string; match?: string };

function toMatchMode({ mode, relay, match }: Params): MatchMode {
  if (mode === 'host' && relay) return { kind: 'host', relay };
  if (mode === 'guest' && relay && match) return { kind: 'guest', relay, matchId: match };
  return { kind: 'solo' };
}

/** Match screen: the score, read from a distance, with the camera recording the buffer. */
export default function MatchScreen() {
  const params = useLocalSearchParams<Params>();
  const mode = useMemo(() => toMatchMode(params), [params]);
  useKeepAwake(); // otherwise the screen locks and iOS stops the camera
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { fps, droppedCount, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number | undefined>();
  const [cameraRunning, setCameraRunning] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [replay, setReplay] = useState<Replay | null>(null);
  const sync = useMatchSync(mode);
  const score = useMemo(() => scoreMatch(sync.points), [sync.points]);
  const names = PLAYER_NAMES.map((name, seat) =>
    mode.kind !== 'solo' && seat === sync.seat ? `${name} (you)` : name,
  ) as [string, string];
  // A point can only be proposed when the other phone is there to confirm it.
  const canPropose = sync.pending == null && score.winner == null && sync.opponentConnected;
  const canUndo = sync.pending == null && sync.points.length > 0 && sync.opponentConnected;
  const waitingForGuest = mode.kind === 'host' && sync.matchId != null && !sync.opponentConnected;

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  // Frame output used only for measuring: small resolution, each frame released right away.
  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_16_9,
    onFrame(frame) {
      'worklet';
      const timestamp = frame.timestamp;
      frame.dispose();
      scheduleOnRN(onFrameTimestamp, timestamp);
    },
    onFrameDropped,
  });

  // "Persistent" mode (AVAssetWriter on iOS) accepts several recorders at the same time:
  // this is what lets segments overlap.
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.HD_16_9,
    enablePersistentRecorder: true,
  });
  const { stats: bufferStats, buffer } = useRollingBuffer(videoOutput, cameraRunning && replay == null);

  const onVar = async () => {
    if (freezing || replay) return;
    setFreezing(true);
    const varPressedAt = performance.now();
    // Finalize the segment(s) in progress so the replay contains the moment of the press.
    const segments = await buffer.freeze();
    setReplay({ segments, varPressedAt, finalizeMs: performance.now() - varPressedAt });
    setFreezing(false);
  };

  const onResume = () => {
    buffer.discard(); // the replayed point is settled: start a fresh 30 s buffer
    setReplay(null); // reactivates the camera; recording restarts as soon as it is running
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Témoin needs access to the camera.</Text>
        {!canRequestPermission && <Text style={styles.hint}>Allow it in Settings › Témoin.</Text>}
        {canRequestPermission && (
          <Pressable style={styles.allow} onPress={requestPermission}>
            <Text style={styles.allowText}>Allow</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No back camera found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.preview}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={replay == null}
              outputs={[videoOutput, frameOutput]}
              constraints={[{ fps: TARGET_FPS }, { resolutionBias: videoOutput }]}
              onStarted={() => setCameraRunning(true)}
              onStopped={() => setCameraRunning(false)}
              onSessionConfigSelected={(config: CameraSessionConfig) => setSelectedFps(config.selectedFPS)}
              resizeMode="cover"
            />
          </View>
          <View style={styles.status}>
            <Text style={styles.connection} numberOfLines={2}>
              {connectionLabel(mode, sync.status, sync.matchId, sync.opponentConnected)}
            </Text>
            {sync.error != null && <Text style={styles.error}>{sync.error}</Text>}
            <RecIndicator stats={bufferStats} recording={cameraRunning} />
            <Text style={[styles.fps, fps < TARGET_FPS - 3 && styles.fpsLow]}>
              {fps.toFixed(0)} fps · {selectedFps ?? '—'} configured · {droppedCount} dropped
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.var, (pressed || freezing) && styles.pressed]}
            onPress={onVar}
            disabled={!cameraRunning || freezing}
          >
            <Text style={styles.varText}>{freezing ? '…' : 'VAR'}</Text>
          </Pressable>
        </View>

        <View style={styles.board}>
          <ScoreBoard score={score} names={names} />
        </View>

        <PendingBanner
          pending={sync.pending}
          seat={sync.seat}
          names={names}
          onConfirm={sync.confirm}
          onDispute={sync.dispute}
          onCancel={sync.cancel}
          onOpenReplay={onVar}
        />

        <View style={styles.pointButtons}>
          {PLAYER_NAMES.map((name, player) => (
            <Pressable
              key={name}
              style={({ pressed }) => [styles.point, pressed && styles.pressed, !canPropose && styles.disabled]}
              onPress={() => sync.proposePoint(player as 0 | 1)}
              disabled={!canPropose}
            >
              <Text style={styles.pointPlus}>+1</Text>
              <Text style={styles.pointName} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.undo, pressed && styles.pressed, !canUndo && styles.disabled]}
          onPress={sync.proposeUndo}
          disabled={!canUndo}
        >
          <Text style={styles.undoText}>Undo last point</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.leave}>Leave match</Text>
        </Pressable>
      </SafeAreaView>

      {waitingForGuest && (
        <View style={styles.waiting}>
          <Text style={styles.waitingTitle}>Scan to join</Text>
          <QrCode value={buildJoinLink({ relay: mode.relay, matchId: sync.matchId! })} size={260} />
          <Text style={styles.waitingCode}>Match {sync.matchId}</Text>
          <Text style={styles.waitingHint}>On the other phone: Témoin › Join match</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.leave}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {replay && (
        <ReplayScreen
          segments={replay.segments}
          fps={selectedFps ?? TARGET_FPS}
          varPressedAt={replay.varPressedAt}
          finalizeMs={replay.finalizeMs}
          onResume={onResume}
        />
      )}
    </View>
  );
}

function connectionLabel(mode: MatchMode, status: string, matchId: string | undefined, opponent: boolean) {
  if (mode.kind === 'solo') return 'Solo match · no sync';
  if (status !== 'connected') return status === 'offline' ? 'Relay unreachable · retrying…' : 'Connecting to relay…';
  if (!matchId) return 'Joining…';
  return `Match ${matchId} · ${opponent ? 'both phones connected' : 'waiting for the other phone'}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, paddingHorizontal: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  message: { color: '#fff', fontSize: 22, textAlign: 'center' },
  hint: { color: '#aaa', fontSize: 16, marginTop: 12, textAlign: 'center' },
  allow: { marginTop: 24, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  allowText: { color: '#000', fontSize: 20, fontWeight: '700' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  preview: { width: 90, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#222' },
  status: { flex: 1, gap: 6 },
  fps: { color: '#4ade80', fontSize: 12, fontVariant: ['tabular-nums'] },
  fpsLow: { color: '#f87171' },
  var: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  varText: { color: '#000', fontSize: 30, fontWeight: '900' },

  board: { flex: 1, justifyContent: 'center' },

  pointButtons: { flexDirection: 'row', gap: 16 },
  point: {
    flex: 1,
    height: 150,
    borderRadius: 20,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointPlus: { color: '#fff', fontSize: 56, fontWeight: '900' },
  pointName: { color: '#dbeafe', fontSize: 20, fontWeight: '700' },
  undo: {
    height: 64,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  undoText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  connection: { color: '#fff', fontSize: 13, fontWeight: '700' },
  error: { color: '#f87171', fontSize: 12 },
  leave: { color: '#9ca3af', fontSize: 16, textAlign: 'center', paddingBottom: 8 },
  waiting: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  waitingTitle: { color: '#fff', fontSize: 32, fontWeight: '900' },
  waitingCode: { color: '#facc15', fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  waitingHint: { color: '#d1d5db', fontSize: 16 },
});

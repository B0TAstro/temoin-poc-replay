import { StyleSheet, Text, View } from 'react-native';

import type { ClipStats } from './ClipRecorder';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function ClipIndicator({ stats, pointNumber, state }: { stats: ClipStats; pointNumber: number; state: string }) {
  const overlap = stats.lastOverlapS;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.row}>
        <View style={[styles.dot, !stats.recording && styles.dotOff]} />
        <Text style={styles.label}>
          {stats.recording ? 'REC' : state} · Point {pointNumber} · {clock(stats.currentS)}
          {stats.currentTrimmed ? ' (last 3 min)' : ''}
        </Text>
      </View>
      <Text style={styles.detail}>
        saved {stats.savedCount} · deleted {stats.deletedCount} · {stats.totalMB.toFixed(0)} MB
      </Text>
      <Text style={[styles.detail, overlap != null && overlap < 0 && styles.warn]}>
        {overlap == null ? 'overlap —' : overlap >= 0 ? `overlap ${overlap.toFixed(2)} s` : `GAP ${(-overlap).toFixed(2)} s`}
        {stats.errorCount > 0 ? ` · errors ${stats.errorCount}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ef4444', marginRight: 8 },
  dotOff: { backgroundColor: '#666' },
  label: { color: '#fff', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], flexShrink: 1 },
  detail: { color: '#ddd', fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  warn: { color: '#f87171', fontWeight: '700' },
});

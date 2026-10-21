import { StyleSheet, Text, View } from 'react-native';

import type { BufferStats } from './useRollingBuffer';

export function RecIndicator({ stats, recording }: { stats: BufferStats; recording: boolean }) {
  const seconds = Math.floor(stats.bufferedS);
  const overlap = stats.lastOverlapS;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.row}>
        <View style={[styles.dot, !recording && styles.dotOff]} />
        <Text style={styles.label}>REC · {seconds} s</Text>
      </View>
      <Text style={styles.detail}>
        segments {stats.filesOnDisk} · deleted {stats.deletedCount} · {stats.totalMB.toFixed(1)} MB
      </Text>
      <Text style={[styles.detail, overlap != null && overlap < 0 && styles.warn]}>
        {overlap == null ? 'overlap —' : overlap >= 0 ? `overlap ${overlap.toFixed(2)} s` : `GAP ${(-overlap).toFixed(2)} s`}
        {stats.errorCount > 0 ? ` · errors ${stats.errorCount}` : ''}
        {stats.full ? '' : ' · filling…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ef4444', marginRight: 8 },
  dotOff: { backgroundColor: '#666' },
  label: { color: '#fff', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  detail: { color: '#ddd', fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  warn: { color: '#f87171', fontWeight: '700' },
});

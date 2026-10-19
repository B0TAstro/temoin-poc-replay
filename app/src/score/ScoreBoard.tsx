import { StyleSheet, Text, View } from 'react-native';

import { type Player, pointLabels, type Score, statusLabel } from './tennis';

type Props = { score: Score; names: [string, string] };

/** Big, high-contrast score meant to be read from the other side of the court. */
export function ScoreBoard({ score, names }: Props) {
  const points = pointLabels(score);
  const status = statusLabel(score, names);

  return (
    <View style={styles.container}>
      {([0, 1] as Player[]).map((player) => (
        <View key={player} style={[styles.row, score.winner === player && styles.rowWinner]}>
          <Text style={styles.name} numberOfLines={1}>
            {names[player]}
          </Text>
          <View style={styles.sets}>
            {score.sets.map((set, i) => (
              <Text key={i} style={[styles.set, set.games[player] > set.games[1 - player] && styles.setWon]}>
                {set.games[player]}
                {set.tiebreak && <Text style={styles.tiebreak}>{set.tiebreak[player]}</Text>}
              </Text>
            ))}
            {score.winner == null && <Text style={styles.games}>{score.games[player]}</Text>}
          </View>
          <Text style={styles.points}>{score.winner == null ? points[player] : ''}</Text>
        </View>
      ))}
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rowWinner: { backgroundColor: '#14532d' },
  name: { flex: 1, color: '#fff', fontSize: 26, fontWeight: '700' },
  sets: { flexDirection: 'row', alignItems: 'baseline', gap: 14, marginRight: 16 },
  set: { color: '#888', fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  setWon: { color: '#fff' },
  tiebreak: { fontSize: 16 },
  games: { color: '#facc15', fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  points: {
    width: 120,
    textAlign: 'right',
    color: '#fff',
    fontSize: 72,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  status: { color: '#facc15', fontSize: 24, fontWeight: '800', textAlign: 'center', minHeight: 30 },
});

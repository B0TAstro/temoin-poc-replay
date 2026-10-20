import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PendingAction, Seat } from '../../../shared/protocol';

type Props = {
  pending: PendingAction | null;
  seat: Seat | null;
  names: [string, string];
  onConfirm: () => void;
  onDispute: () => void;
  onCancel: () => void;
  onOpenReplay: () => void;
};

/** What this phone must do about the point (or undo) waiting for co-validation. */
export function PendingBanner({ pending, seat, names, onConfirm, onDispute, onCancel, onOpenReplay }: Props) {
  if (!pending || seat == null) return null;

  const action = pending.kind === 'point' ? `Point for ${names[pending.winner]}` : 'Undo the last point';
  const mine = pending.proposedBy === seat;
  const proposer = names[pending.proposedBy];
  const otherPlayer = names[pending.proposedBy === 0 ? 1 : 0];

  if (pending.disputed) {
    return (
      <View style={[styles.banner, styles.disputed]}>
        <Text style={styles.title}>Disagreement</Text>
        <Text style={styles.detail}>
          {proposer} asked: {action}. {otherPlayer} said no.
        </Text>
        <View style={styles.row}>
          <BannerButton label="Open replay" color="#facc15" onPress={onOpenReplay} />
          {!mine && <BannerButton label="Confirm" color="#22c55e" onPress={onConfirm} />}
          <BannerButton label="Cancel" color="#555" textColor="#fff" onPress={onCancel} />
        </View>
      </View>
    );
  }

  if (mine) {
    return (
      <View style={styles.banner}>
        <Text style={styles.title}>{action}</Text>
        <Text style={styles.detail}>Waiting for {otherPlayer} to confirm…</Text>
        <View style={styles.row}>
          <BannerButton label="Cancel" color="#555" textColor="#fff" onPress={onCancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.ask]}>
      <Text style={styles.title}>{action}?</Text>
      <Text style={styles.detail}>{proposer} asks you to confirm.</Text>
      <View style={styles.row}>
        <BannerButton label="Confirm" color="#22c55e" onPress={onConfirm} />
        <BannerButton label="Disagree" color="#ef4444" textColor="#fff" onPress={onDispute} />
      </View>
    </View>
  );
}

function BannerButton({
  label,
  color,
  textColor = '#000',
  onPress,
}: {
  label: string;
  color: string;
  textColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: color }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#1f2937', borderRadius: 16, padding: 16, gap: 8 },
  ask: { backgroundColor: '#1e3a8a' },
  disputed: { backgroundColor: '#7f1d1d' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  detail: { color: '#e5e7eb', fontSize: 17 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  button: { flex: 1, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 20, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});

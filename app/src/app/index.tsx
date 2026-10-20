import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { defaultRelayUrl } from '@/sync/relayUrl';

/** Home: create a match (shows a QR code), join one by scanning it, or play solo. */
export default function HomeScreen() {
  const relay = defaultRelayUrl();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Témoin</Text>
        <Text style={styles.subtitle}>Replay for tennis matches without an umpire</Text>
      </View>

      <View style={styles.actions}>
        <HomeButton
          label="Create match"
          detail="This phone shows a QR code for the other one"
          disabled={relay == null}
          onPress={() => relay && router.push({ pathname: '/match', params: { mode: 'host', relay } })}
        />
        <HomeButton label="Join match" detail="Scan the QR code of the other phone" onPress={() => router.push('/join')} />
        <HomeButton
          label="Solo match"
          detail="One phone, no sync"
          secondary
          onPress={() => router.push({ pathname: '/match', params: { mode: 'solo' } })}
        />
      </View>

      <Text style={styles.relay}>
        {relay ? `Relay: ${relay}` : 'No relay address: set EXPO_PUBLIC_RELAY_URL or start the app from Metro'}
      </Text>
    </SafeAreaView>
  );
}

function HomeButton({
  label,
  detail,
  onPress,
  disabled,
  secondary,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (pressed || disabled) && styles.buttonDim,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
      <Text style={styles.buttonDetail}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 24, justifyContent: 'space-between' },
  header: { marginTop: 48, gap: 8 },
  title: { color: '#fff', fontSize: 56, fontWeight: '900' },
  subtitle: { color: '#9ca3af', fontSize: 18 },
  actions: { gap: 16 },
  button: { backgroundColor: '#1d4ed8', borderRadius: 20, paddingVertical: 22, paddingHorizontal: 20, gap: 4 },
  buttonSecondary: { backgroundColor: '#333' },
  buttonDim: { opacity: 0.5 },
  buttonLabel: { color: '#fff', fontSize: 26, fontWeight: '800' },
  buttonDetail: { color: '#dbeafe', fontSize: 15 },
  relay: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 16 },
});

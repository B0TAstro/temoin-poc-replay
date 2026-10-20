import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  isScannedCode,
  type ScannedObject,
  type ScannedObjectType,
  useCameraPermission,
  useObjectOutput,
} from 'react-native-vision-camera';

import { type JoinTarget, parseJoinLink } from '@/pairing/joinLink';

const QR_TYPES: ScannedObjectType[] = ['qr'];

function openMatch({ relay, matchId }: JoinTarget) {
  // replace: the scanner unmounts and frees the camera for the match screen.
  router.replace({ pathname: '/match', params: { mode: 'guest', relay, match: matchId } });
}

/** Scans the host's QR code. Also reached directly through the temoin://join deep link. */
export default function JoinScreen() {
  const { relay, match } = useLocalSearchParams<{ relay?: string; match?: string }>();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [invalid, setInvalid] = useState(false);
  const done = useRef(false);

  // Opened from the iPhone Camera app: the link already carries the match.
  useEffect(() => {
    if (relay && match && !done.current) {
      done.current = true;
      openMatch({ relay, matchId: match });
    }
  }, [relay, match]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const objectOutput = useObjectOutput({
    types: QR_TYPES,
    onObjectsScanned: (objects: ScannedObject[]) => {
      if (done.current) return;
      for (const object of objects) {
        const target = isScannedCode(object) && object.value ? parseJoinLink(object.value) : null;
        if (target) {
          done.current = true;
          openMatch(target);
          return;
        }
      }
      setInvalid(true);
    },
  });

  return (
    <View style={styles.container}>
      {hasPermission && (
        <Camera style={StyleSheet.absoluteFill} device="back" isActive outputs={[objectOutput]} resizeMode="cover" />
      )}
      <SafeAreaView style={styles.overlay}>
        <Text style={styles.title}>Scan the QR code</Text>
        <Text style={styles.hint}>
          {invalid ? 'This is not a Témoin match code.' : 'Shown on the phone that created the match.'}
        </Text>
        <View style={styles.frame} />
        <Pressable onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 24 },
  hint: { color: '#e5e7eb', fontSize: 17 },
  frame: { width: 260, height: 260, borderRadius: 24, borderWidth: 4, borderColor: '#facc15' },
  cancel: { backgroundColor: '#333', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 16 },
  cancelText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});

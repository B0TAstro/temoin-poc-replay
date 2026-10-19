import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type CameraSessionConfig,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { useFpsMeter } from '@/diagnostics/useFpsMeter';

const TARGET_FPS = 60;

export default function CameraScreen() {
  useKeepAwake(); // sinon l'écran se verrouille et iOS coupe la caméra
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { fps, droppedCount, onFrameTimestamp, onFrameDropped } = useFpsMeter();
  const [selectedFps, setSelectedFps] = useState<number | undefined>();

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  // Sortie d'images uniquement pour mesurer : petite résolution, image libérée tout de suite.
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

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Témoin a besoin de la caméra.</Text>
        {!canRequestPermission && (
          <Text style={styles.hint}>Autorise-la dans Réglages › Témoin.</Text>
        )}
        {canRequestPermission && (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Autoriser</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Aucune caméra arrière trouvée.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[frameOutput]}
        constraints={[{ fps: TARGET_FPS }]}
        onSessionConfigSelected={(config: CameraSessionConfig) => setSelectedFps(config.selectedFPS)}
        resizeMode="cover"
      />
      <View style={styles.overlay} pointerEvents="none">
        <Text style={[styles.fps, fps < TARGET_FPS - 3 && styles.fpsLow]}>
          {fps.toFixed(1)} fps
        </Text>
        <Text style={styles.detail}>
          demandé {TARGET_FPS} · configuré {selectedFps ?? '—'} · perdues {droppedCount}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  message: { color: '#fff', fontSize: 22, textAlign: 'center' },
  hint: { color: '#aaa', fontSize: 16, marginTop: 12, textAlign: 'center' },
  button: { marginTop: 24, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  buttonText: { color: '#000', fontSize: 20, fontWeight: '700' },
  overlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fps: { color: '#4ade80', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  fpsLow: { color: '#f87171' },
  detail: { color: '#ddd', fontSize: 13, marginTop: 2 },
});

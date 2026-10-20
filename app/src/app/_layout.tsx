import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
        {/* No swipe back during a match: leaving deletes the buffer. */}
        <Stack.Screen name="match" options={{ gestureEnabled: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

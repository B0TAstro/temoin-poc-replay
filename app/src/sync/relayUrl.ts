import Constants from 'expo-constants';

const RELAY_PORT = 8787;

/**
 * Where the relay server runs. In development the phone already talks to Metro on the computer,
 * so the relay is on that same machine: no address to type. EXPO_PUBLIC_RELAY_URL overrides it.
 */
export function defaultRelayUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_RELAY_URL;
  if (configured) return configured;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `ws://${host}:${RELAY_PORT}` : null;
}

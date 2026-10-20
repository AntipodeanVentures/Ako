import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// A stable identifier for this install, used by the device registry to
// limit how many devices an account can use. It persists across launches
// and is regenerated only if the app is reinstalled.
const KEY = 'ako.device-uid';

let cached: string | null = null;

function randomUid(): string {
  const part = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${part()}-${part()}`;
}

export async function getDeviceUid(): Promise<string> {
  if (cached) return cached;
  let uid = await AsyncStorage.getItem(KEY);
  if (!uid) {
    uid = randomUid();
    await AsyncStorage.setItem(KEY, uid);
  }
  cached = uid;
  return uid;
}

// A human-readable label shown in the device list in Settings.
export function getDeviceLabel(): string {
  if (Platform.OS === 'ios') return 'iOS device';
  if (Platform.OS === 'android') return 'Android device';
  return 'Web browser';
}

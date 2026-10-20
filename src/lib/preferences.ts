import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// A boolean preference backed by AsyncStorage, with the same shape for
// every flag the app stores.
function useStoredFlag(key: string, fallback: boolean) {
  const [enabled, setEnabledState] = useState(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key).then((stored) => {
      if (stored != null) setEnabledState(stored === 'true');
      setLoaded(true);
    });
  }, [key]);

  const setEnabled = (next: boolean) => {
    setEnabledState(next);
    AsyncStorage.setItem(key, String(next)).catch(() => {});
  };

  return { enabled, setEnabled, loaded };
}

// Whether lesson text and tutor replies are read aloud.
export function useReadAloud() {
  return useStoredFlag('ako.voice.readAloud', true);
}

// Whether a local notification is scheduled when reviews come due.
export function useReviewReminders() {
  return useStoredFlag('ako.reminders.reviews', true);
}

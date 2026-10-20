import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Scheduled local notifications back due-review reminders and the rest timer:
// they reach the learner even if the screen has locked or the app is closed.

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const playSound = notification.request.content.data?.sound !== false;
    return {
      shouldShowBanner: true,
      shouldShowList: false,
      shouldPlaySound: playSound,
      shouldSetBadge: false,
    };
  },
});

const ANDROID_CHANNEL = 'reviews';
let channelReady = false;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Reviews and timers',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
  });
  channelReady = true;
}

export async function ensureAlertPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Checks the current notification permission without prompting. Used to
// tell the learner when a reminder toggle cannot actually deliver.
export async function hasAlertPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

// Schedules an alert `seconds` from now. Returns its id so it can be
// cancelled if the learner acts before the timer finishes.
export async function scheduleAlert(
  seconds: number,
  title: string,
  body: string,
  sound: boolean,
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound,
        data: { sound },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: ANDROID_CHANNEL,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelAlert(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or cancelled - nothing to do.
  }
}

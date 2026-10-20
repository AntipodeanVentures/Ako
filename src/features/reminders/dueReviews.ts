import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelAlert, ensureAlertPermission, scheduleAlert } from '@/src/lib/alerts';

// Schedules one local notification for the moment reviews next come due, at the learner's reminder time
// on that day. Mirrors Thrive's wind-down reminder: the scheduled state is persisted so an app restart
// cannot double-book, and rescheduling replaces the previous alert. No server is involved.

const STORE_KEY = 'ako.reminders.due';

type Stored = { fireAt: number; id: string | null };

export type DueSummary = { dueNow: number; nextDueAt: number | null; minutes: number };

function fireTimeFor(nextDueAt: number, reminderTime: string | null): number {
  // Fire at the reminder time on the day the next card is due; if that has passed, at the due time itself.
  const d = new Date(nextDueAt);
  if (reminderTime) {
    const [h, m] = reminderTime.split(':').map(Number);
    d.setHours(h || 7, m || 0, 0, 0);
    if (d.getTime() < nextDueAt) d.setDate(d.getDate() + 1);
  }
  return Math.max(d.getTime(), Date.now() + 60_000);
}

export async function reconcileDueReminder(summary: DueSummary, reminderTime: string | null, enabled: boolean): Promise<void> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  const stored = raw ? (JSON.parse(raw) as Stored) : null;

  const wants = enabled && summary.nextDueAt != null;
  if (!wants) {
    if (stored) { await cancelAlert(stored.id); await AsyncStorage.removeItem(STORE_KEY); }
    return;
  }
  const fireAt = fireTimeFor(summary.nextDueAt as number, reminderTime);
  if (stored && Math.abs(stored.fireAt - fireAt) < 60_000) return; // already booked for this moment
  if (stored) await cancelAlert(stored.id);
  if (!(await ensureAlertPermission())) return;

  const seconds = Math.max(60, Math.round((fireAt - Date.now()) / 1000));
  const title = 'Reviews are due';
  const body = `${summary.minutes} minutes: ${summary.dueNow || 'a few'} cards and one idea.`;
  const id = await scheduleAlert(seconds, title, body, false);
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ fireAt, id } satisfies Stored));
}

import AsyncStorage from '@react-native-async-storage/async-storage';

// A sitting in progress, kept on the device so a locked screen, a phone call
// or a closed tab does not throw away the warm-up, the lesson and the practice
// so far. Saved at each transition by useSession; read back when the same
// topic is opened again; listed on the Learn tab as "Continue".

const PREFIX = 'ako:sitting:';
const FRESH_MS = 3 * 86400000;

export type Sitting = {
  v: 1;
  subjectId: string;
  topicId: string;
  title: string;
  step: string;
  at: number;
  elapsedMs: number;
  // The engine's state, as plain data: warm-up, lesson, recall, practice, chat.
  warm: unknown;
  warmAnswers: string[];
  warmGrades: unknown;
  checked: boolean;
  answers: unknown[];
  lesson: unknown;
  questionsReady: boolean;
  rec: unknown;
  recIdx: number;
  prac: unknown;
  teach: unknown;
  rp: unknown;
  chat: unknown[];
  chatTurns: number;
  debrief: unknown;
};

export const sittingKey = (subjectId: string, topicId: string) => `${PREFIX}${subjectId}:${topicId}`;

export async function saveSitting(snap: Sitting): Promise<void> {
  try {
    await AsyncStorage.setItem(sittingKey(snap.subjectId, snap.topicId), JSON.stringify(snap));
  } catch {
    // Storage full or unavailable: the sitting simply cannot be resumed.
  }
}

export async function loadSitting(subjectId: string, topicId: string): Promise<Sitting | null> {
  try {
    const raw = await AsyncStorage.getItem(sittingKey(subjectId, topicId));
    if (!raw) return null;
    const snap = JSON.parse(raw) as Sitting;
    if (snap.v !== 1 || Date.now() - snap.at > FRESH_MS) {
      await clearSitting(subjectId, topicId);
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export async function clearSitting(subjectId: string, topicId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(sittingKey(subjectId, topicId));
  } catch {
    // Nothing to do.
  }
}

// Every fresh sitting on this device, newest first.
export async function openSittings(): Promise<Sitting[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (!keys.length) return [];
    const pairs = await AsyncStorage.multiGet(keys);
    const out: Sitting[] = [];
    for (const [key, raw] of pairs) {
      if (!raw) continue;
      try {
        const snap = JSON.parse(raw) as Sitting;
        if (snap.v === 1 && Date.now() - snap.at <= FRESH_MS && snap.step !== 'done') out.push(snap);
        else await AsyncStorage.removeItem(key);
      } catch {
        await AsyncStorage.removeItem(key);
      }
    }
    return out.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

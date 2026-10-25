// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lesson as lessonFixture, planPortuguese } from '@/src/engine/fixtures';
import { normaliseLesson, normalisePlan, normalisePractice } from '@/src/engine/normalise';

import { useSession } from '../useSession';

// ---- fakes: the device store and the edge functions ----
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
    removeItem: async (k: string) => { store.delete(k); },
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null]),
  },
}));

const calls: { fn: string; kind: string }[] = [];
const fake = {
  async respond(fn: string, body: Record<string, unknown>): Promise<unknown> {
    const kind = String(body.kind ?? 'lesson');
    calls.push({ fn, kind });
    const topic = (PLAN as { topics: unknown[] }).topics[0];
    if (fn === 'lesson' && kind === 'warm') {
      return { warm: { hook: 'A hook.', questions: [
        { q: 'Does Portuguese have nasal vowels?', a: 'Yes.', purpose: 'prior', type: 'choice', options: ['Yes', 'No', 'Only in Portugal'], answer: 0 },
        { q: 'How is "pão" said?', a: 'Through the nose.', purpose: 'predict', type: 'short' },
      ] } };
    }
    if (fn === 'lesson' && kind === 'lesson') {
      const core = normaliseLesson({ ...lessonFixture('concept'), practice: [], cards: [], recall: '', why: '' }, topic as never);
      return { lesson: { ...core, meta: { prompt: 'test', model: 'fake' } }, cached: false };
    }
    if (fn === 'lesson' && kind === 'practice') {
      const full = lessonFixture('concept');
      const q = normalisePractice({ recall: full.recall, recallAnswer: full.recallAnswer, why: full.why, whyAnswer: full.whyAnswer, practice: full.practice, cards: full.cards, heldBack: full.practice.slice(0, 4) });
      return { questions: { ...q, meta: { prompt: 'test/q', model: 'fake' } } };
    }
    if (fn === 'lesson' && kind === 'bridge') return { bridge: 'You already greet people every day.' };
    if (fn === 'grade' && kind === 'answers') {
      const items = body.items as unknown[];
      return { results: items.map(() => ({ score: 1, feedback: 'Right.' })) };
    }
    throw new Error(`unexpected call ${fn} ${kind}`);
  },
};
vi.mock('@/src/features/ai/client', () => ({
  callJson: (fn: string, body: Record<string, unknown>) => fake.respond(fn, body),
  callStream: (fn: string, body: Record<string, unknown>) => fake.respond(fn, body),
  aiErrorCopy: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));
const saved: unknown[] = [];
vi.mock('@/src/features/subjects', () => ({
  saveSubject: async (s: unknown) => { saved.push(s); },
  recordActivity: async () => {},
  replaceProbeItems: async () => {},
}));
vi.mock('@/src/features/subjects/adapt', () => ({ afterTopic: async () => null }));
// The speech module reaches for the device; the hook only asks it for the subject's voice.
vi.mock('@/src/features/speech', () => ({ localeFor: (l: string | null) => (l ? 'pt-BR' : null), looksEnglish: () => true, withoutTranslation: (t: string) => t }));

const intake = { subject: 'Brazilian Portuguese', target: 's3', current: 'Complete beginner', hours: 5, minutes: 15, background: '', why: '' };
const PLAN = normalisePlan(planPortuguese as never, intake as never, 's2');
const TID: string = (PLAN as { topics: { id: string }[] }).topics[0].id;
function subject() {
  const plan = JSON.parse(JSON.stringify(PLAN));
  return {
    id: 'subj_1', profileId: 'me', intake, plan, topicState: {}, stages: {}, stageChecks: {}, milestones: {}, checks: [],
    stats: { log: {}, rlog: {}, reviewLog: {} }, errors: {}, support: 'full', pitch: null, model: null,
    cards: [], learner: { about: '', model: null }, concepts: {}, dirtyCards: new Set<string>(),
  } as never;
}

beforeEach(() => {
  store.clear();
  calls.length = 0;
  saved.length = 0;
});

describe('a sitting survives an interruption', () => {
  it('saves at each step, resumes where it stopped without rewriting the lesson, and clears itself when finished', async () => {
    const subj = subject();
    const first = renderHook(() => useSession(subj, TID, 0.9, () => {}));
    await waitFor(() => expect(first.result.current.s.warm).toBeTruthy());
    await waitFor(() => expect(first.result.current.s.lesson).toBeTruthy());

    // Warm-up answered and marked; the lesson opens.
    act(() => first.result.current.setWarmAnswer(0, 'Yes'));
    act(() => first.result.current.setWarmAnswer(1, 'Through the nose'));
    await act(async () => { await first.result.current.checkWarm(); });
    await waitFor(() => expect(first.result.current.s.warmGrades).toBeTruthy());
    act(() => first.result.current.toLearn());
    expect(first.result.current.s.step).toBe('learn');
    await waitFor(() => expect(first.result.current.s.questionsReady).toBe(true));

    // Recall, then one practice answer.
    act(() => first.result.current.toRecall());
    expect(first.result.current.s.step).toBe('recall');
    act(() => { first.result.current.setRecText('Nasal vowels go through the nose.'); first.result.current.setRecConf('sure'); });
    await act(async () => { await first.result.current.checkRecall(); });
    await waitFor(() => expect(first.result.current.s.recResult).toBeTruthy());
    act(() => first.result.current.nextRecall());
    act(() => { first.result.current.setRecText('Because the ending marks the person.'); first.result.current.setRecConf('sure'); });
    await act(async () => { await first.result.current.checkRecall(); });
    await waitFor(() => expect(first.result.current.s.recResult).toBeTruthy());
    act(() => first.result.current.nextRecall());
    expect(first.result.current.s.step).toBe('practice');
    const item = first.result.current.currentItem as { type: string; answer: number | string };
    act(() => { if (item.type === 'mcq') first.result.current.setPracPicked(Number(item.answer)); else first.result.current.setPracText(String(item.answer)); first.result.current.setPracConf('sure'); });
    await act(async () => { await first.result.current.checkPractice(); });
    await waitFor(() => expect(first.result.current.s.pracResult).toBeTruthy());
    act(() => { void first.result.current.nextPractice(); });
    await waitFor(() => expect(first.result.current.s.pracResult).toBeNull());
    const askedBefore = (first.result.current.L.prac.asked as number[]).length;
    expect(askedBefore).toBe(1);
    await waitFor(() => {
      const snap = JSON.parse(store.get(`ako:sitting:subj_1:${TID}`) ?? 'null');
      expect(snap?.step).toBe('practice');
      expect(snap?.prac?.asked?.length).toBe(1);
    });

    // The phone locks. A new screen opens the same topic.
    first.unmount();
    const lessonCallsBefore = calls.filter((c) => c.fn === 'lesson' && (c.kind === 'lesson' || c.kind === 'practice')).length;
    const subj2 = subject();
    const second = renderHook(() => useSession(subj2, TID, 0.9, () => {}));
    await waitFor(() => expect(second.result.current.resumed).toBe(true));
    expect(second.result.current.s.step).toBe('practice');
    expect(second.result.current.s.questionsReady).toBe(true);
    expect((second.result.current.L.prac.asked as number[]).length).toBe(1);
    expect(second.result.current.L.prac.correct).toBe(1);
    expect(second.result.current.s.warmGrades).toHaveLength(2);
    expect(calls.filter((c) => c.fn === 'lesson' && (c.kind === 'lesson' || c.kind === 'practice')).length).toBe(lessonCallsBefore);
    // The per-idea record was replayed into the fresh subject.
    expect(Object.keys((subj2 as { concepts: Record<string, unknown> }).concepts).length).toBeGreaterThan(0);

    // Finishing the sitting clears the saved copy.
    await act(async () => { await second.result.current.finish(); });
    await waitFor(() => expect(second.result.current.s.step).toBe('done'));
    await waitFor(() => expect(store.has(`ako:sitting:subj_1:${TID}`)).toBe(false));
    expect(saved.length).toBeGreaterThan(0);
  });

  it('starts over when asked, forgetting the saved sitting', async () => {
    const subj = subject();
    const h = renderHook(() => useSession(subj, TID, 0.9, () => {}));
    await waitFor(() => expect(h.result.current.s.lesson).toBeTruthy());
    await waitFor(() => expect(store.has(`ako:sitting:subj_1:${TID}`)).toBe(true));
    h.unmount();
    const again = renderHook(() => useSession(subject(), TID, 0.9, () => {}));
    await waitFor(() => expect(again.result.current.resumed).toBe(true));
    act(() => again.result.current.restart());
    expect(again.result.current.resumed).toBe(false);
    expect(again.result.current.s.step).toBe('warm');
    await waitFor(() => expect(again.result.current.s.lesson).toBeTruthy());
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';

import { arr, clampNum } from '@/src/engine/core';
import { topicById } from '@/src/engine/progress';
import {
  addPractice,
  addQuestionSet,
  finishTopic,
  newLesson,
  pickNextItem,
  practiceDone,
  practiceExhausted,
  scorePractice,
  useLesson as installLesson,
} from '@/src/engine/session';
import type { Lesson, PlanRevision, Topic } from '@/src/engine/types';
import { aiErrorCopy, callJson, callStream } from '@/src/features/ai/client';
import { recordActivity, saveSubject, type LiveSubject } from '@/src/features/subjects';
import { afterTopic } from '@/src/features/subjects/adapt';

// One topic, start to finish: warm-up, lesson, recall, practice, done.
// The engine owns the rules (what to ask next, when practice is done, what
// a finished topic changes); this hook owns the network calls and the
// React re-renders. The lesson state object L is mutated in place by the
// engine, so a tick counter forces renders after each change.

export type Step = 'warm' | 'learn' | 'drill' | 'recall' | 'practice' | 'teach' | 'roleplay' | 'done';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Debrief = { scores: number[]; feedback: string; mean: number };
export type Confidence = 'sure' | 'unsure' | 'guess';
export type Grade = { score: number; feedback: string };

export type WarmQuestion = { q: string; a: string; purpose?: 'prior' | 'predict'; type?: 'short' | 'choice'; options?: string[]; answer?: number | null };
type Warm = { hook: string; questions: WarmQuestion[] };

export type SessionState = {
  step: Step;
  topic: Topic;
  busy: string | null; // what we are waiting for, as a short label
  error: string | null;
  warm: Warm | null;
  warmAnswers: string[];
  warmGrades: Grade[] | null;
  lessonStarted: boolean;
  lessonProgress: { chars: number; sections: number };
  lesson: Lesson | null;
  // The recall and practice set is written from the lesson text while the learner reads.
  questionsReady: boolean;
  questionsError: string | null;
  // recall
  recIdx: number;
  recText: string;
  recConf: Confidence | null;
  recResult: Grade | null;
  // practice
  pracPicked: number | null;
  pracText: string;
  pracConf: Confidence | null;
  pracResult: Grade | null;
  // teach-back and role-play share one chat
  chat: ChatMessage[];
  chatDraft: string; // the partner's reply as it streams
  chatInput: string;
  chatTurns: number; // learner turns so far
  debrief: Debrief | null;
  // done
  summary: { added: number; firstDue: number | null; minutes: number; correct: number; asked: number; sure: number; sureRight: number; taught: boolean; roleplay: Debrief | null; motorPending: boolean; mastered: boolean } | null;
  // Changes the path revision made after this topic, if any (shown on Done).
  revision: PlanRevision['notes'] | null;
};

function serialisable(subj: LiveSubject) {
  const { dirtyCards: _d, ...rest } = subj;
  return rest;
}

export function useSession(subj: LiveSubject, topicId: string, retention: number, onSaved: () => void) {
  const topic = topicById(subj, topicId) as Topic;
  // The engine's state object is plain JS; its fields are typed loosely on purpose.
  const L: any = useRef(newLesson(topicId)).current;
  const startedAt = useRef(Date.now());
  const [, setTick] = useState(0);
  const tick = () => setTick((n) => n + 1);
  const [s, setS] = useState<SessionState>({
    step: 'warm',
    topic,
    busy: 'Writing your warm-up',
    error: null,
    warm: null,
    warmAnswers: ['', ''],
    warmGrades: null,
    lessonStarted: false,
    lessonProgress: { chars: 0, sections: 0 },
    lesson: null,
    questionsReady: false,
    questionsError: null,
    recIdx: 0,
    recText: '',
    recConf: null,
    recResult: null,
    pracPicked: null,
    pracText: '',
    pracConf: null,
    pracResult: null,
    chat: [],
    chatDraft: '',
    chatInput: '',
    chatTurns: 0,
    debrief: null,
    summary: null,
    revision: null,
  });
  const patch = useCallback((p: Partial<SessionState>) => setS((prev) => ({ ...prev, ...p })), []);

  // ---- lesson text ----
  // Written as soon as the topic opens, while the learner does the warm-up, so by the time they
  // have answered it is usually ready. The opening (bridge) and the question set come after the
  // warm-up, because they answer what the learner said.
  const corePromise = useRef<Promise<Lesson> | null>(null);
  const advanceWhenReady = useRef(false);
  const startCore = useCallback((simpler?: string[]) => {
    const prior = subj.topicState[topicId] as { status?: string; simpler?: string[]; relearn?: string } | undefined;
    const back = prior?.status === 'learning';
    const ctx = {
      // A topic that did not reach the criterion last time comes back simpler: its old section headings tell the model what to simplify.
      simpler: simpler ?? (back ? prior?.simpler : undefined),
      // Reopened after reviews or a failed check: the lesson is written afresh, from a different angle.
      relearn: back && prior?.relearn ? prior.relearn : undefined,
    };
    patch({ lessonStarted: true, error: null, lessonProgress: { chars: 0, sections: 0 } });
    const p = (async () => {
      const r = await callStream<{ lesson: Lesson; cached: boolean }>(
        'lesson',
        { subject: serialisable(subj), topicId, ctx },
        { onText: (text) => patch({ lessonProgress: { chars: text.length, sections: (text.match(/"heading"/g) || []).length } }) },
      );
      installLesson(L, r.lesson, subj);
      const go = advanceWhenReady.current;
      if (go) L.step = 'learn';
      setS((prev) => ({ ...prev, lesson: r.lesson, busy: prev.busy === 'Writing your lesson' ? null : prev.busy, step: go ? 'learn' : prev.step }));
      return r.lesson;
    })();
    corePromise.current = p;
    p.catch((e) => {
      corePromise.current = null;
      patch({ busy: null, lessonStarted: false, error: aiErrorCopy(e) });
    });
    return p;
  }, [L, patch, subj, topicId]);

  // After the warm-up: the opening that answers it, and the question set, both from the finished text.
  const questionsRequested = useRef(false);
  const lastAnswers = useRef<string[] | null>(null);
  const requestQuestions = useCallback(async (answers: string[] | null) => {
    if (questionsRequested.current) return;
    questionsRequested.current = true;
    lastAnswers.current = answers;
    patch({ questionsError: null });
    let core: Lesson;
    try {
      core = await (corePromise.current ?? startCore());
    } catch {
      questionsRequested.current = false;
      return;
    }
    const digest = { concepts: core.concepts, sections: core.sections, bridge: core.bridge, mistakes: core.mistakes };
    const ctx = { warm: L.warm, answers: (answers ?? []).map((text) => ({ text })) };
    if (L.warm && answers && answers.some((a) => a.trim())) {
      callJson<{ bridge: string }>('lesson', { kind: 'bridge', subject: serialisable(subj), topicId, lesson: digest, ctx })
        .then((r) => {
          if (!r.bridge || !L.data) return;
          L.data.bridge = r.bridge;
          setS((prev) => (prev.lesson ? { ...prev, lesson: { ...prev.lesson, bridge: r.bridge } } : prev));
        })
        .catch(() => { /* the generic opening stands */ });
    }
    try {
      const r = await callJson<{ questions: Pick<Lesson, 'recall' | 'recallAnswer' | 'why' | 'whyAnswer' | 'practice' | 'cards'> }>(
        'lesson',
        { kind: 'practice', subject: serialisable(subj), topicId, lesson: digest, ctx },
      );
      addQuestionSet(L, r.questions, subj);
      setS((prev) => ({ ...prev, lesson: L.data, questionsReady: true, questionsError: null }));
    } catch (e) {
      questionsRequested.current = false;
      patch({ questionsError: aiErrorCopy(e) });
    }
  }, [L, patch, startCore, subj, topicId]);

  // ---- warm-up ----
  const loadWarm = useCallback(async () => {
    patch({ busy: 'Writing your warm-up', error: null });
    try {
      const r = await callJson<{ warm: Warm }>('lesson', { kind: 'warm', subject: serialisable(subj), topicId });
      L.warm = r.warm;
      patch({ warm: r.warm, warmAnswers: r.warm.questions.map(() => ''), busy: null });
    } catch {
      // A warm-up that fails should not block the lesson.
      L.warm = null;
      L.checked = true;
      advanceWhenReady.current = true;
      patch({ warm: null, busy: L.data ? null : 'Writing your lesson' });
      if (L.data) { L.step = 'learn'; patch({ step: 'learn' }); }
      void requestQuestions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subj, topicId]);

  useEffect(() => {
    void startCore();
    void loadWarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkWarm = useCallback(async () => {
    if (!s.warm || s.busy === 'Marking' || L.checked) return;
    patch({ busy: 'Marking', error: null });
    // The opening and the questions use the answers, not the marks.
    void requestQuestions(s.warmAnswers);
    try {
      const items = s.warm.questions.map((q, i) => ({ prompt: q.q, answer: q.a, response: s.warmAnswers[i] || '' }));
      const r = await callJson<{ results: Grade[] }>('grade', { kind: 'answers', title: subj.plan.title, items, mode: 'warmup' });
      L.answers = s.warmAnswers.map((text, i) => ({ text, ...r.results[i] }));
      L.checked = true;
      patch({ warmGrades: r.results, busy: null });
    } catch {
      L.checked = true;
      patch({ warmGrades: s.warm.questions.map(() => ({ score: 0, feedback: '' })), busy: null });
    }
  }, [L, patch, requestQuestions, s.busy, s.warm, s.warmAnswers, subj.plan.title]);

  const skipWarm = useCallback(() => {
    L.checked = true;
    void requestQuestions(s.warmAnswers.some((a) => a.trim()) ? s.warmAnswers : null);
    if (L.data) {
      L.step = 'learn';
      patch({ step: 'learn' });
    } else {
      advanceWhenReady.current = true;
      patch({ busy: 'Writing your lesson' });
    }
  }, [L, patch, requestQuestions, s.warmAnswers]);

  const toLearn = useCallback(() => {
    L.step = 'learn';
    patch({ step: 'learn' });
  }, [L, patch]);

  // After the lesson: a physical skill shows its drill first, then recall.
  const toRecall = useCallback(() => {
    if (s.step === 'learn' && s.lesson?.drill) {
      L.step = 'drill';
      patch({ step: 'drill' });
      return;
    }
    L.step = 'recall';
    patch({ step: 'recall', recIdx: 0, recText: '', recConf: null, recResult: null });
  }, [L, patch, s.lesson, s.step]);

  // ---- recall ----
  const gradeShort = useCallback(
    async (prompt: string, answer: string, response: string, conf: Confidence | null): Promise<Grade> => {
      const r = await callJson<{ results: Grade[] }>('grade', {
        kind: 'answers',
        title: subj.plan.title,
        items: [{ prompt, answer, response, conf }],
      });
      return r.results[0] ?? { score: 0, feedback: '' };
    },
    [subj.plan.title],
  );

  const checkRecall = useCallback(async () => {
    const item = L.rec.items[s.recIdx];
    if (!item) return;
    patch({ busy: 'Marking', error: null });
    try {
      const g = await gradeShort(item.prompt, item.answer, s.recText, s.recConf);
      item.text = s.recText;
      item.conf = s.recConf;
      item.result = g;
      patch({ recResult: g, busy: null });
    } catch (e) {
      patch({ busy: null, error: aiErrorCopy(e) });
    }
  }, [L, gradeShort, patch, s.recConf, s.recIdx, s.recText]);

  const nextRecall = useCallback(() => {
    const next = s.recIdx + 1;
    if (next < L.rec.items.length) {
      patch({ recIdx: next, recText: '', recConf: null, recResult: null });
    } else {
      L.step = 'practice';
      pickNextItem(L.prac);
      patch({ step: 'practice', pracPicked: null, pracText: '', pracConf: null, pracResult: null });
    }
  }, [L, patch, s.recIdx]);

  // ---- practice ----
  const currentItem = L.prac.idx == null ? null : L.prac.items[L.prac.idx];

  const checkPractice = useCallback(async () => {
    const q = currentItem;
    if (!q) return;
    L.prac.conf = s.pracConf;
    L.prac.picked = s.pracPicked;
    L.prac.text = s.pracText;
    patch({ busy: 'Marking', error: null });
    try {
      let g: Grade;
      if (q.type === 'mcq') {
        const ok = s.pracPicked === q.answer;
        g = { score: ok ? 1 : 0, feedback: (ok ? 'Right. ' : `Not this one. The answer is "${arr(q.options)[Number(q.answer)]}". `) + (q.explanation || '') };
      } else {
        g = await gradeShort(q.prompt, String(q.answer), s.pracText, s.pracConf);
      }
      scorePractice(L, topic, subj, g);
      patch({ pracResult: g, busy: null });
      tick();
    } catch (e) {
      patch({ busy: null, error: aiErrorCopy(e) });
    }
  }, [L, currentItem, gradeShort, patch, s.pracConf, s.pracPicked, s.pracText, subj, topic]);

  const finish = useCallback(
    async (opts: { taught?: boolean } = {}) => {
      const minutes = clampNum((Date.now() - startedAt.current) / 60000, 1, Math.max(10, topic.minutes * 2));
      const milestonesBefore = new Set(Object.keys((subj.milestones as Record<string, unknown>) || {}));
      const r = finishTopic(subj, L, { minutes, retention, taught: opts.taught });
      const reachedId = Object.keys((subj.milestones as Record<string, unknown>) || {}).find((id) => !milestonesBefore.has(id));
      const milestoneReached = reachedId ? (subj.plan.milestones.find((m) => m.id === reachedId)?.title ?? null) : null;
      patch({
        step: 'done',
        busy: 'Saving',
        summary: {
          added: r.added.length,
          firstDue: r.firstDue,
          minutes: Math.round(minutes),
          correct: L.prac.correct,
          asked: L.prac.asked.length,
          // Calibration: how many answers they were sure of, and how many of those were right.
          sure: (L.prac.log as { conf: string | null; score: number }[]).filter((x) => x.conf === 'sure').length,
          sureRight: (L.prac.log as { conf: string | null; score: number }[]).filter((x) => x.conf === 'sure' && x.score >= 1).length,
          taught: Boolean(opts.taught) && L.teach.turns >= 2,
          roleplay: L.rp?.debrief ?? null,
          motorPending: r.motorPending,
          mastered: r.mastered,
        },
      });
      try {
        await saveSubject(subj);
        await recordActivity(subj.id, 'lesson', minutes);
        onSaved();
        patch({ busy: null });
      } catch (e) {
        patch({ busy: null, error: e instanceof Error ? e.message : 'Could not save. Your progress is kept on this screen; try again.' });
        return;
      }
      // After the save, off the critical path: the learner model, and a
      // revision of the path when this topic has missed twice or a
      // milestone was just reached. The Done screen shows any changes.
      const attempts = Number((subj.topicState[topicId] as { attempts?: number } | undefined)?.attempts ?? 0);
      const notes = await afterTopic(subj, topicId, evidenceFromLesson(s, L), { mastered: r.mastered, attempts, milestoneReached });
      if (notes?.length) {
        onSaved();
        patch({ revision: notes });
      }
    },
    [L, onSaved, patch, retention, s, subj, topic.minutes, topicId],
  );

  // ---- after practice: role-play for conversational topics, otherwise teach it back ----
  const afterPractice = useCallback(() => {
    const scenario = s.lesson?.scenario;
    if (topic.kind === 'roleplay' && scenario) {
      L.step = 'roleplay';
      patch({ step: 'roleplay', chat: scenario.opener ? [{ role: 'assistant', content: scenario.opener }] : [], chatDraft: '', chatInput: '', chatTurns: 0, debrief: null });
      return;
    }
    L.step = 'teach';
    L.teach.started = true;
    patch({ step: 'teach', chat: [], chatDraft: '', chatInput: '', chatTurns: 0 });
  }, [L, patch, s.lesson, topic.kind]);

  const sendChat = useCallback(async () => {
    const text = s.chatInput.trim();
    if (!text || s.busy) return;
    const mode = s.step === 'roleplay' ? 'roleplay' : 'student';
    const messages: ChatMessage[] = [...s.chat, { role: 'user', content: text }];
    patch({ chat: messages, chatInput: '', chatDraft: '', busy: 'Replying', error: null });
    try {
      const r = await callStream<{ text: string }>(
        'tutor',
        { subject: serialisable(subj), topicId, lesson: s.lesson, mode, scenario: s.lesson?.scenario ?? null, messages },
        { onText: (full) => patch({ chatDraft: full }) },
      );
      const turns = s.chatTurns + 1;
      if (mode === 'student') L.teach.turns = turns;
      patch({ chat: [...messages, { role: 'assistant', content: r.text }], chatDraft: '', chatTurns: turns, busy: null });
    } catch (e) {
      // Keep the learner's message; let them retry.
      patch({ chat: s.chat, chatInput: text, chatDraft: '', busy: null, error: aiErrorCopy(e) });
    }
  }, [L, patch, s.busy, s.chat, s.chatInput, s.chatTurns, s.lesson, s.step, subj, topicId]);

  const endRoleplay = useCallback(async () => {
    const scenario = s.lesson?.scenario;
    if (!scenario) return finish();
    patch({ busy: 'Debriefing', error: null });
    try {
      const transcript = s.chat.map((m) => (m.role === 'user' ? 'Learner: ' : 'Partner: ') + m.content).join('\n');
      const r = await callJson<{ debrief: Debrief }>('grade', { kind: 'debrief', subject: serialisable(subj), topicId, scenario, transcript });
      L.rp = { debrief: r.debrief, runs: (L.rp?.runs || 0) + 1 };
      patch({ debrief: r.debrief, busy: null });
    } catch (e) {
      patch({ busy: null, error: aiErrorCopy(e) });
    }
  }, [L, finish, patch, s.chat, s.lesson, subj, topicId]);

  const nextPractice = useCallback(async () => {
    pickNextItem(L.prac);
    patch({ pracPicked: null, pracText: '', pracConf: null, pracResult: null });
    if (practiceDone(L.prac)) {
      afterPractice();
      return;
    }
    if (practiceExhausted(L.prac)) {
      if (L.prac.extra >= 8) {
        afterPractice();
        return;
      }
      patch({ busy: 'Writing more practice' });
      try {
        const used = L.prac.items.map((q: { prompt: string }) => q.prompt);
        const r = await callJson<{ practice: Lesson['practice'] }>('lesson', {
          kind: 'more',
          subject: serialisable(subj),
          topicId,
          lesson: s.lesson,
          used,
          ability: L.prac.ability,
        });
        addPractice(L.prac, r.practice);
        patch({ busy: null });
      } catch {
        // No more questions: move on with what was done.
        afterPractice();
      }
    }
    tick();
  }, [L, afterPractice, patch, s.lesson, subj, topicId]);

  const retryLesson = useCallback(() => {
    if (!L.data) {
      advanceWhenReady.current = L.checked;
      patch({ busy: L.checked ? 'Writing your lesson' : null });
      void startCore();
    }
    if (L.checked) void requestQuestions(lastAnswers.current);
  }, [L, patch, requestQuestions, startCore]);

  return {
    s,
    L,
    topic,
    currentItem,
    setWarmAnswer: (i: number, text: string) => patch({ warmAnswers: s.warmAnswers.map((a, j) => (j === i ? text : a)) }),
    checkWarm,
    skipWarm,
    toLearn,
    toRecall,
    setRecText: (recText: string) => patch({ recText }),
    setRecConf: (recConf: Confidence) => patch({ recConf }),
    checkRecall,
    nextRecall,
    setPracPicked: (pracPicked: number) => patch({ pracPicked }),
    setPracText: (pracText: string) => patch({ pracText }),
    setPracConf: (pracConf: Confidence) => patch({ pracConf }),
    checkPractice,
    nextPractice,
    setChatInput: (chatInput: string) => patch({ chatInput }),
    sendChat,
    endRoleplay,
    finish,
    retryLesson,
    clearError: () => patch({ error: null }),
  };
}

// What happened in this topic, in plain lines, for the learner-model update
// and the path revision: warm-up answers against the model answers, recall
// and why answers with their marks, every practice answer with its mark
// and confidence, the role-play debrief and whether the idea was taught back.
type LogEntry = { prompt: string; response: string; score: number; conf: string | null; difficulty: number; re: boolean };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evidenceFromLesson(s: SessionState, L: any): string {
  const lines: string[] = [];
  const pct = (x: number) => Math.round(x * 100) + '%';
  if (s.warm) {
    s.warm.questions.forEach((q, i) => {
      const g = s.warmGrades?.[i];
      lines.push(`Warm-up: ${q.q} | they said: ${s.warmAnswers[i] || '(blank)'}${g ? ' | mark ' + pct(g.score) : ''}`);
    });
  }
  for (const it of arr(L.rec?.items) as { key: string; prompt: string; text: string; result: { score: number } | null }[]) {
    if (it.result) lines.push(`${it.key === 'why' ? 'Why' : 'Recall'}: ${it.prompt} | they said: ${it.text || '(blank)'} | mark ${pct(it.result.score)}`);
  }
  for (const e of arr(L.prac?.log) as LogEntry[]) {
    lines.push(`Practice (difficulty ${e.difficulty}${e.re ? ', asked again' : ''}): ${e.prompt} | they said: ${e.response || '(blank)'} | mark ${pct(e.score)}${e.conf ? ', felt ' + e.conf : ''}`);
  }
  if (L.rp?.debrief) lines.push(`Role-play: ${pct(L.rp.debrief.mean)} of the criteria. ${L.rp.debrief.feedback}`);
  if (L.teach?.turns) lines.push(`Taught it back over ${L.teach.turns} turns.`);
  lines.push(`Outcome: ${L.mastered ? 'mastered' : 'not yet mastered'}; ${L.prac?.correct ?? 0} fully right of ${L.prac?.asked?.length ?? 0} asked, ${L.prac?.misses ?? 0} missed.`);
  return lines.join('\n').slice(0, 3000);
}

import { useCallback, useEffect, useRef, useState } from 'react';

import { arr, clampNum } from '@/src/engine/core';
import { topicById } from '@/src/engine/progress';
import {
  addPractice,
  finishTopic,
  newLesson,
  pickNextItem,
  practiceDone,
  practiceExhausted,
  scorePractice,
  useLesson as installLesson,
} from '@/src/engine/session';
import type { Lesson, Topic } from '@/src/engine/types';
import { aiErrorCopy, callJson, callStream } from '@/src/features/ai/client';
import { recordActivity, saveSubject, type LiveSubject } from '@/src/features/subjects';

// One topic, start to finish: warm-up, lesson, recall, practice, done.
// The engine owns the rules (what to ask next, when practice is done, what
// a finished topic changes); this hook owns the network calls and the
// React re-renders. The lesson state object L is mutated in place by the
// engine, so a tick counter forces renders after each change.

export type Step = 'warm' | 'learn' | 'recall' | 'practice' | 'done';
export type Confidence = 'sure' | 'unsure' | 'guess';
export type Grade = { score: number; feedback: string };

type WarmQuestion = { q: string; a: string };
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
  // done
  summary: { added: number; firstDue: number | null; minutes: number; correct: number; asked: number } | null;
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
    recIdx: 0,
    recText: '',
    recConf: null,
    recResult: null,
    pracPicked: null,
    pracText: '',
    pracConf: null,
    pracResult: null,
    summary: null,
  });
  const patch = useCallback((p: Partial<SessionState>) => setS((prev) => ({ ...prev, ...p })), []);

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
      patch({ warm: null, busy: null });
      void startLesson(null, [], undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subj, topicId]);

  useEffect(() => {
    void loadWarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- lesson ----
  const startLesson = useCallback(
    async (warm: Warm | null, answers: string[], simpler?: string[], advance = false) => {
      patch({ lessonStarted: true, error: null, lessonProgress: { chars: 0, sections: 0 }, busy: advance ? 'Writing your lesson' : null });
      try {
        const ctx = { warm, answers: answers.map((text) => ({ text })), simpler };
        const r = await callStream<{ lesson: Lesson; cached: boolean }>(
          'lesson',
          { subject: serialisable(subj), topicId, ctx },
          {
            onText: (text) => patch({ lessonProgress: { chars: text.length, sections: (text.match(/"heading"/g) || []).length } }),
          },
        );
        installLesson(L, r.lesson, subj);
        L.step = 'learn';
        setS((prev) => ({ ...prev, lesson: r.lesson, busy: prev.busy === 'Writing your lesson' ? null : prev.busy, step: advance ? 'learn' : prev.step }));
      } catch (e) {
        patch({ busy: null, lessonStarted: false, error: aiErrorCopy(e) });
      }
    },
    [L, patch, subj, topicId],
  );

  const checkWarm = useCallback(async () => {
    if (!s.warm) return;
    patch({ busy: 'Marking', error: null });
    // Start the lesson now; it uses the answers, not the marks.
    void startLesson(s.warm, s.warmAnswers);
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
  }, [L, patch, s.warm, s.warmAnswers, startLesson, subj.plan.title]);

  const skipWarm = useCallback(() => {
    L.checked = true;
    void startLesson(s.warm, s.warmAnswers, undefined, true);
  }, [L, s.warm, s.warmAnswers, startLesson]);

  const toLearn = useCallback(() => {
    L.step = 'learn';
    patch({ step: 'learn' });
  }, [L, patch]);

  const toRecall = useCallback(() => {
    L.step = 'recall';
    patch({ step: 'recall', recIdx: 0, recText: '', recConf: null, recResult: null });
  }, [L, patch]);

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

  const finish = useCallback(async () => {
    const minutes = clampNum((Date.now() - startedAt.current) / 60000, 1, Math.max(10, topic.minutes * 2));
    const r = finishTopic(subj, L, { minutes, retention });
    patch({ step: 'done', busy: 'Saving', summary: { added: r.added.length, firstDue: r.firstDue, minutes: Math.round(minutes), correct: L.prac.correct, asked: L.prac.asked.length } });
    try {
      await saveSubject(subj);
      await recordActivity(subj.id, 'lesson', minutes);
      onSaved();
      patch({ busy: null });
    } catch (e) {
      patch({ busy: null, error: e instanceof Error ? e.message : 'Could not save. Your progress is kept on this screen; try again.' });
    }
  }, [L, onSaved, patch, retention, subj, topic.minutes]);

  const nextPractice = useCallback(async () => {
    pickNextItem(L.prac);
    patch({ pracPicked: null, pracText: '', pracConf: null, pracResult: null });
    if (practiceDone(L.prac)) {
      void finish();
      return;
    }
    if (practiceExhausted(L.prac)) {
      if (L.prac.extra >= 8) {
        void finish();
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
        // No more questions: close the topic on what was done.
        void finish();
      }
    }
    tick();
  }, [L, finish, patch, s.lesson, subj, topicId]);

  const retryLesson = useCallback(() => startLesson(s.warm, s.warmAnswers, undefined, true), [s.warm, s.warmAnswers, startLesson]);

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
    finish,
    retryLesson,
    clearError: () => patch({ error: null }),
  };
}

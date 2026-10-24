import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/src/components/ui';
import { isLearned, mixedDue, recordMinutes, recordMixed, reopenTopics, topicById } from '@/src/engine/progress';
import type { PracticeItem, Topic } from '@/src/engine/types';
import { aiErrorCopy, callJson } from '@/src/features/ai/client';
import { useProfile } from '@/src/features/profile';
import { recordActivity, saveSubject, useInvalidateSubject, useLiveSubjects, type LiveSubject } from '@/src/features/subjects';
import { QuestionRun, type RunResult } from '@/src/screens/QuestionRun';
import { useTheme } from '@/src/theme';

// Mixed practice: a weekly set across several learned topics, each question
// needing two of them told apart or combined. One-topic practice never
// builds that discrimination. A topic that scores nothing is reopened.

function serialisable(subj: LiveSubject) {
  const { dirtyCards: _d, ...rest } = subj;
  return rest;
}

// The engine's weekly pick, or, when it has been done this week already and the learner asks anyway, the same shape of sample.
function topicsFor(subj: LiveSubject): Topic[] {
  const due = mixedDue(subj) as Topic[] | null;
  if (due) return due;
  const learned = subj.plan.topics.filter((t) => isLearned(subj, t));
  const byAge = [...learned].sort((a, b) => Number((subj.topicState[a.id] as { masteredAt?: number })?.masteredAt ?? 0) - Number((subj.topicState[b.id] as { masteredAt?: number })?.masteredAt ?? 0));
  return [...byAge.slice(0, 2), ...byAge.slice(-3)].filter((t, i, arr) => arr.indexOf(t) === i);
}

export default function MixedRoute() {
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const { spacing } = useTheme();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const subj = subjects.find((s) => s.id === subjectId);
  const startedAt = useRef(Date.now());
  const [questions, setQuestions] = useState<{ id: string; label: string; item: PracticeItem }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ ok: number; n: number; perTopic: { title: string; ok: number; n: number }[]; reopened: string[] } | null>(null);
  const topics = useMemo(() => (subj ? topicsFor(subj) : []), [subj]);
  const asked = useRef(false);

  useEffect(() => {
    if (!subj || asked.current) return;
    if (topics.length < 3) { setError('Not enough learned topics yet for mixed practice.'); return; }
    asked.current = true;
    callJson<{ questions: PracticeItem[] }>('grade', { kind: 'mixed', subject: serialisable(subj), topicIds: topics.map((t) => t.id) })
      .then((r) => setQuestions(r.questions.map((item, i) => ({ id: `m${i}`, label: topicById(subj, item.topicId ?? '')?.title ?? subj.plan.title, item }))))
      .catch((e) => setError(aiErrorCopy(e)));
  }, [subj, topics]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  const onMarked = async (results: RunResult[]) => {
    if (!subj || !questions) return;
    const minutes = Math.max(1, (Date.now() - startedAt.current) / 60000);
    const per = new Map<string, { title: string; ok: number; n: number }>();
    const flat = results.map((r, i) => {
      const tid = questions[i].item.topicId ?? '';
      const ok = r.score >= 1;
      const t = per.get(tid) ?? { title: topicById(subj, tid)?.title ?? tid, ok: 0, n: 0 };
      t.n++;
      if (ok) t.ok++;
      per.set(tid, t);
      return { topicId: tid, ok };
    });
    recordMixed(subj, flat);
    // Nothing right on a topic asked more than once: it is being confused with its neighbours; teach it again.
    const reopen = [...per.entries()].filter(([, t]) => t.n >= 2 && t.ok === 0).map(([tid]) => tid);
    if (reopen.length) reopenTopics(subj, reopen, 'mixed practice showed it was being confused with a neighbouring idea');
    recordMinutes(subj, 'review', minutes);
    await saveSubject(subj);
    await recordActivity(subj.id, 'review', minutes);
    setOutcome({ ok: flat.filter((f) => f.ok).length, n: flat.length, perTopic: [...per.values()], reopened: reopen.map((tid) => topicById(subj, tid)?.title ?? tid) });
    invalidate();
  };

  if (!loading && !subj) {
    return (
      <Screen width="reading">
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
          <Text variant="prose">Subject not found.</Text>
          <Button label="Back" onPress={close} />
        </View>
      </Screen>
    );
  }

  return (
    <QuestionRun
      title="Mixed practice"
      subtitle={subj?.plan.title ?? ''}
      intro={`Eight questions across ${topics.length} earlier topics. Each needs two of them told apart or put together.`}
      gradeTitle={subj?.plan.title ?? 'Ako'}
      questions={questions}
      loading={loading ? 'Loading' : 'Writing the set'}
      error={error}
      onClose={close}
      onMarked={onMarked}
      summary={() =>
        outcome ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="prose">
              {outcome.ok} of {outcome.n} right.
            </Text>
            <Text variant="body" color="textMuted">
              {outcome.perTopic.map((t) => `${t.title}: ${t.ok} of ${t.n}`).join(' · ')}
            </Text>
            {outcome.reopened.length ? (
              <Text variant="body">
                {outcome.reopened.join(', ')}: nothing right, so {outcome.reopened.length === 1 ? 'it is' : 'they are'} back on your path to be taught again.
              </Text>
            ) : null}
          </View>
        ) : null
      }
      onDone={() => router.replace('/learn')}
    />
  );
}

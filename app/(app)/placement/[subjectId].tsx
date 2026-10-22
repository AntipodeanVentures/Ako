import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/src/components/ui';
import { clampNum } from '@/src/engine/core';
import { STAGES } from '@/src/engine/ladder';
import { normQ } from '@/src/engine/normalise';
import { placeKnown, recordMinutes } from '@/src/engine/progress';
import type { PracticeItem } from '@/src/engine/types';
import { aiErrorCopy, callJson } from '@/src/features/ai/client';
import { useProfile } from '@/src/features/profile';
import {
  recordActivity,
  saveSubject,
  useInvalidateSubject,
  useLiveSubjects,
  type LiveSubject,
} from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

// The placement check: skip what you already know. Eight to ten questions
// across the plan, basic to advanced, one topic each. A topic answered fully
// right is marked known and skipped; a whole level known counts as reached.
// Offered once, to learners who did not start as complete beginners. It
// costs ten minutes and can save weeks.

type Grade = { score: number; feedback: string };

export default function PlacementRoute() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const [frozen] = useState<{ subj: LiveSubject | null }>({ subj: null });
  const subj = subjects.find((s) => s.id === subjectId);
  if (subj && !frozen.subj) frozen.subj = subj;
  if (!frozen.subj) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator /> : <Text color="textMuted">Subject not found.</Text>}
        </View>
      </Screen>
    );
  }
  return <PlacementScreen subj={frozen.subj} />;
}

function PlacementScreen({ subj }: { subj: LiveSubject }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const [questions, setQuestions] = useState<PracticeItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<{ picked: number | null; text: string }[]>([]);
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [placed, setPlaced] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState<string | null>('Writing your placement check');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const { dirtyCards: _d, ...subject } = subj;
        const r = await callJson<{ placement: { questions: unknown[] } }>('grade', { kind: 'placement', subject });
        const qs = (r.placement?.questions ?? []).map((q) => normQ(q)).filter(Boolean).slice(0, 10) as PracticeItem[];
        if (qs.length < 4) throw new Error('The check came back too short. Try again.');
        setQuestions(qs);
        setBusy(null);
      } catch (e) {
        setBusy(null);
        setError(aiErrorCopy(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = questions?.[idx] ?? null;

  const next = async () => {
    if (!questions || !q) return;
    const all = [...answers, { picked, text }];
    setAnswers(all);
    setPicked(null);
    setText('');
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      return;
    }
    await mark(all);
  };

  const mark = async (all: { picked: number | null; text: string }[]) => {
    if (!questions) return;
    setBusy('Marking');
    setError(null);
    try {
      const shortIdx = questions.map((qq, i) => (qq.type === 'short' ? i : -1)).filter((i) => i >= 0);
      let shortGrades: Grade[] = [];
      if (shortIdx.length) {
        const r = await callJson<{ results: Grade[] }>('grade', {
          kind: 'answers',
          title: subj.plan.title,
          items: shortIdx.map((i) => ({ prompt: questions[i].prompt, answer: String(questions[i].answer), response: all[i]?.text || '' })),
        });
        shortGrades = r.results;
      }
      const g: Grade[] = questions.map((qq, i) => {
        if (qq.type === 'mcq') {
          const ok = all[i]?.picked === qq.answer;
          return { score: ok ? 1 : 0, feedback: (ok ? 'Right. ' : `The answer was "${qq.options?.[Number(qq.answer)] ?? ''}". `) + (qq.explanation || '') };
        }
        return shortGrades[shortIdx.indexOf(i)] ?? { score: 0, feedback: '' };
      });
      setGrades(g);
      // Only a fully right answer places a topic out: a half-right answer means it is worth the lesson.
      const knownIds = Array.from(new Set(questions.map((qq, i) => (g[i].score >= 1 ? qq.topicId : '')).filter(Boolean)));
      const done = placeKnown(subj, knownIds) as { id: string; title: string }[];
      setPlaced(done.map((t) => ({ id: t.id, title: t.title })));
      const minutes = clampNum((Date.now() - startedAt.current) / 60000, 1, 30);
      recordMinutes(subj, 'lesson', minutes);
      await saveSubject(subj);
      await recordActivity(subj.id, 'lesson', minutes);
      invalidate();
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(aiErrorCopy(e));
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  if (grades && questions) {
    const score = grades.reduce((n, x) => n + x.score, 0);
    const placedStages = STAGES.filter((s) => (subj.stages[s.id] as { placed?: boolean } | undefined)?.placed);
    return (
      <Screen scroll width="reading">
        <Header title="Placement" subtitle={subj.plan.title} onClose={close} />
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="figure">
              {score % 1 ? score.toFixed(1) : score}
              <Text variant="heading" color="textMuted">
                {' '}
                of {grades.length}
              </Text>
            </Text>
            <Text variant="heading" color={placed.length ? 'accent' : 'text'}>
              {placed.length ? `${placed.length} ${placed.length === 1 ? 'topic' : 'topics'} skipped` : 'Nothing to skip yet'}
            </Text>
            <Text variant="body" color="textMuted">
              {placed.length
                ? `Already known, so your path starts past them: ${placed.map((t) => t.title).join('; ')}.${placedStages.length ? ` The ${placedStages.map((s) => s.name).join(' and ')} level counts as reached.` : ''} Anything answered partly right stays in, since it is worth the lesson.`
                : 'Every topic stays in. The first lessons will go quickly where the ideas are familiar.'}
            </Text>
          </View>

          <View>
            {questions.map((qq, i) => {
              const g = grades[i];
              const tone = g.score >= 1 ? colors.accent : g.score > 0 ? colors.warning : colors.danger;
              return (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ width: 3, backgroundColor: tone, borderRadius: 2 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{qq.prompt}</Text>
                    <Text variant="caption" color="textMuted">
                      {g.feedback}
                    </Text>
                  </View>
                </View>
              );
            })}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>

          <Button label="Back to today" onPress={() => router.replace('/learn')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll width="reading">
      <Header title="Placement" subtitle={subj.plan.title} onClose={close} />
      <View style={{ marginTop: spacing.xl, flex: 1, gap: spacing.xl }}>
        {error ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="body" color="danger">
              {error}
            </Text>
            <Button label="Back" variant="secondary" onPress={close} />
          </View>
        ) : !q ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ActivityIndicator size="small" />
            <View>
              <Text variant="bodyStrong">{busy || 'One moment'}</Text>
              <Text variant="caption" color="textMuted">
                Eight to ten questions, basic to advanced. Answer what you can; a blank is fine.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text variant="caption" color="textMuted">
              {idx + 1} of {questions?.length}
            </Text>
            <Text variant="prose">{q.prompt}</Text>
            {q.type === 'mcq' ? (
              <View style={{ gap: spacing.sm }}>
                {(q.options || []).map((opt, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setPicked(i)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: picked === i }}
                    style={{
                      padding: spacing.lg,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: picked === i ? colors.primary : colors.border,
                      backgroundColor: picked === i ? colors.primaryMuted : colors.surface,
                    }}
                  >
                    <Text variant="body">{opt}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <TextField label="Your answer" value={text} onChangeText={setText} placeholder="In your own words, or leave blank" multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
            )}
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                label={idx + 1 < (questions?.length ?? 0) ? 'Next' : 'Finish and mark'}
                onPress={next}
                loading={busy === 'Marking'}
              />
              <Text variant="caption" color="textMuted" center>
                Not sure? Leave it and move on. Only a fully right answer skips a topic.
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function Header({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="eyebrow" color="textMuted">
          {subtitle}
        </Text>
        <Text variant="title">{title}</Text>
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ padding: 4 }}>
        <Ionicons name="close" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

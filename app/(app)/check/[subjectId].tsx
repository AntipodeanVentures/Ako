import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/src/components/ui';
import { clampNum } from '@/src/engine/core';
import { LEVEL_PASS, stageName } from '@/src/engine/ladder';
import { normQ } from '@/src/engine/normalise';
import { markStageReached, recordMinutes, reopenTopics, stageTopics } from '@/src/engine/progress';
import type { PracticeItem, StageId } from '@/src/engine/types';
import { aiErrorCopy, callJson } from '@/src/features/ai/client';
import { useProfile } from '@/src/features/profile';
import {
  recordActivity,
  saveSubject,
  useInvalidateSubject,
  useLiveSubjects,
  type LiveSubject,
} from '@/src/features/subjects';
import { adaptPlan } from '@/src/features/subjects/adapt';
import { extendPlanTo, nextStageToPlan } from '@/src/features/subjects/extend';
import { useTheme } from '@/src/theme';

// The level check: eight to ten questions across the level's topics, from
// memory, at least three days after the last of them was learned. Passing
// (80%) marks the level reached, and the next level's topics are written,
// up to the target. Failing reopens the topics behind the wrong answers:
// they come first next session, their cards come due now, and the path is
// revised in the light of what the check showed. The check opens again
// once those topics are relearned and three days old.

type Grade = { score: number; feedback: string };

export default function CheckRoute() {
  const { subjectId, stageId } = useLocalSearchParams<{ subjectId: string; stageId: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const [frozen] = useState<{ subj: LiveSubject | null }>({ subj: null });
  const subj = subjects.find((s) => s.id === subjectId);
  if (subj && !frozen.subj) frozen.subj = subj;
  if (!frozen.subj || !stageId) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator /> : <Text color="textMuted">Subject not found.</Text>}
        </View>
      </Screen>
    );
  }
  return <CheckScreen subj={frozen.subj} stageId={stageId as StageId} />;
}

function CheckScreen({ subj, stageId }: { subj: LiveSubject; stageId: StageId }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const [questions, setQuestions] = useState<PracticeItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<{ picked: number | null; text: string }[]>([]);
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [busy, setBusy] = useState<string | null>('Writing your level check');
  const [error, setError] = useState<string | null>(null);
  const [extension, setExtension] = useState<{ stage: StageId; count: number } | null>(null);
  const [reopened, setReopened] = useState<string[]>([]);
  const [revision, setRevision] = useState<string[]>([]);
  const startedAt = useRef(Date.now());
  const name = stageName(stageId);

  useEffect(() => {
    (async () => {
      try {
        const topics = stageTopics(subj, stageId) as { id: string }[];
        const { dirtyCards: _d, ...subject } = subj;
        const r = await callJson<{ check: { questions: unknown[] } }>('grade', {
          kind: 'check',
          subject,
          topicIds: topics.map((t) => t.id),
          stageId,
        });
        const qs = (r.check?.questions ?? []).map((q) => normQ(q)).filter(Boolean).slice(0, 10) as PracticeItem[];
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
      const score = g.reduce((n, x) => n + x.score, 0);
      const total = g.length;
      const passed = score / total >= LEVEL_PASS;
      const now = Date.now();
      subj.stageChecks[stageId] = { at: now };
      if (passed) markStageReached(subj, stageId, score, total);
      // The topics behind the wrong answers go back to learning and their cards come due now.
      const missedTopics = Array.from(new Set(questions.map((qq, i) => (g[i].score < 1 ? qq.topicId : '')).filter(Boolean)));
      const back = passed ? [] : (reopenTopics(subj, missedTopics) as { id: string; title: string }[]);
      setReopened(back.map((t) => t.title));
      const minutes = clampNum((now - startedAt.current) / 60000, 1, 40);
      recordMinutes(subj, 'lesson', minutes);
      await saveSubject(subj);
      await recordActivity(subj.id, 'lesson', minutes);
      invalidate();
      if (!passed) {
        // Off the critical path: let the path adapt to what the check showed.
        const evidence = questions.map((qq, i) => `${qq.topicId}: ${qq.prompt} | they said: ${all[i]?.picked != null ? qq.options?.[all[i].picked as number] ?? '' : all[i]?.text || '(blank)'} | mark ${Math.round(g[i].score * 100)}%`).join('\n');
        adaptPlan(subj, `The ${name} level check was failed: ${score % 1 ? score.toFixed(1) : score} of ${total}. The topics behind the wrong answers have been reopened. Decide whether a bridging topic, a split or a reorder would help before they are relearned.`, { evidence })
          .then((a) => { if (a?.notes?.length) { setRevision(a.notes.map((n) => n.why || n.title)); invalidate(); } })
          .catch((e) => console.warn('path revision failed', e));
      }
      if (passed) {
        const nextStage = nextStageToPlan(subj);
        if (nextStage) {
          setBusy(`Writing the ${stageName(nextStage)} topics`);
          try {
            const ext = await extendPlanTo(subj, nextStage);
            setExtension({ stage: nextStage, count: ext.topics.length });
            invalidate();
          } catch (e) {
            setError(`The level is recorded, but the next topics could not be written: ${aiErrorCopy(e)}. Open the Path tab to try again.`);
          }
        }
      }
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(aiErrorCopy(e));
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  // ---- results ----
  if (grades && questions) {
    const score = grades.reduce((n, x) => n + x.score, 0);
    const passed = score / grades.length >= LEVEL_PASS;
    const stageDef = subj.plan.stages.find((s) => s.id === stageId);
    return (
      <Screen scroll width="reading">
        <Header title={`${name} level check`} subtitle={subj.plan.title} onClose={close} />
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="figure">
              {score % 1 ? score.toFixed(1) : score}
              <Text variant="heading" color="textMuted">
                {' '}
                of {grades.length}
              </Text>
            </Text>
            <Text variant="heading" color={passed ? 'accent' : 'text'}>
              {passed ? `${name} reached` : `Not yet. ${Math.round(LEVEL_PASS * 100)}% passes.`}
            </Text>
            <Text variant="body" color="textMuted">
              {passed
                ? stageDef?.equivalent
                  ? `About ${stageDef.equivalent}. Reviews keep it honest from here.`
                  : 'Reviews keep it honest from here.'
                : reopened.length
                  ? `The topics behind the missed questions are open again and come first next session: ${reopened.join('; ')}. Their cards are due now. The check opens again once they are relearned.`
                  : 'Keep reviewing; the check opens again in three days. The questions below show where it slipped.'}
            </Text>
          </View>

          {revision.length ? (
            <View style={{ gap: spacing.xs, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
              <Text variant="bodyStrong">Your path has changed</Text>
              {revision.map((line, i) => (
                <Text key={i} variant="body" color="textMuted">
                  {line}
                </Text>
              ))}
            </View>
          ) : null}

          {busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ActivityIndicator size="small" />
              <Text variant="bodyStrong">{busy}</Text>
            </View>
          ) : extension ? (
            <Text variant="body">
              {extension.count} topics written for {stageName(extension.stage)}. They are on your path.
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}

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

          <Button label="Back to today" onPress={() => router.replace('/learn')} disabled={Boolean(busy)} />
        </View>
      </Screen>
    );
  }

  // ---- questions ----
  return (
    <Screen scroll width="reading">
      <Header title={`${name} level check`} subtitle={subj.plan.title} onClose={close} />
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
                From memory, no notes. Eight to ten questions across the level.
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
              <TextField label="Your answer" value={text} onChangeText={setText} placeholder="In your own words" multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
            )}
            <View style={{ marginTop: spacing.lg }}>
              <Button
                label={idx + 1 < (questions?.length ?? 0) ? 'Next' : 'Finish and mark'}
                onPress={next}
                loading={busy === 'Marking'}
                disabled={q.type === 'mcq' ? picked == null : !text.trim()}
              />
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


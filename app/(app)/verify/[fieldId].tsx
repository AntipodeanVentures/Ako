import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Missing, Screen, Text, TextField } from '@/src/components/ui';
import { STAGES, stageName } from '@/src/engine/ladder';
import { normQ } from '@/src/engine/normalise';
import { verifiedLevel } from '@/src/engine/progress';
import type { PracticeItem, StageId } from '@/src/engine/types';
import { aiErrorCopy, callJson } from '@/src/features/ai/client';
import { useKnowItems, usePriorFields, useProfile, useUpdatePriorField } from '@/src/features/profile';
import { recomputeAbout } from '@/src/features/profile/know';
import { useTheme } from '@/src/theme';
import type { PriorFieldRow } from '@/src/types/database';

// Verifying a field the learner brought with them: eight to ten questions from memory, two per
// rung from Beginner up to one above the level they claimed. The highest rung passed with every
// rung below it passed becomes the verified level, which the map draws filled and the planner
// can rely on. A claim stays a claim until this is taken.

type Grade = { score: number; feedback: string };
type Q = PracticeItem & { level: StageId };

export default function VerifyRoute() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const fields = usePriorFields();
  const field = (fields.data ?? []).find((f) => f.id === fieldId);
  if (!field) return <Missing loading={fields.isLoading} title="This field is no longer on your map" body="It may have been removed on another device." />;
  return <VerifyScreen field={field} />;
}

function VerifyScreen({ field }: { field: PriorFieldRow }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { profile, refresh } = useProfile();
  const items = useKnowItems();
  const fields = usePriorFields();
  const update = useUpdatePriorField();
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<{ picked: number | null; text: string }[]>([]);
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [result, setResult] = useState<{ level: StageId | null; score: number; asked: number } | null>(null);
  const [busy, setBusy] = useState<string | null>('Writing your check');
  const [error, setError] = useState<string | null>(null);
  const name = field.area ? `${field.field} › ${field.area}` : field.field;

  useEffect(() => {
    (async () => {
      try {
        const r = await callJson<{ verify: { questions: unknown[] } }>('grade', { kind: 'verify', field: { field: field.field, area: field.area, level: field.level, basis: field.basis } });
        const qs = (r.verify?.questions ?? [])
          .map((q) => { const n = normQ(q) as Q | null; if (n) n.level = ((q as { level?: string }).level as StageId) || 's1'; return n; })
          .filter(Boolean)
          .slice(0, 12) as Q[];
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
    if (idx + 1 < questions.length) { setIdx(idx + 1); return; }
    await mark(all);
  };

  const mark = async (all: { picked: number | null; text: string }[]) => {
    if (!questions || !profile) return;
    setBusy('Checking');
    setError(null);
    try {
      const shortIdx = questions.map((qq, i) => (qq.type === 'short' ? i : -1)).filter((i) => i >= 0);
      let shortGrades: Grade[] = [];
      if (shortIdx.length) {
        const r = await callJson<{ results: Grade[] }>('grade', {
          kind: 'answers',
          title: name,
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
      const v = verifiedLevel(questions, g) as { level: StageId | null; byLevel: Record<string, { ok: number; n: number }>; score: number; asked: number };
      setResult(v);
      await update.mutateAsync({ id: field.id, verified_level: v.level, verified_at: new Date().toISOString(), verified: { score: v.score, asked: v.asked, byLevel: v.byLevel } });
      // The learner's about text carries the verified level into every prompt from now on.
      const after = (fields.data ?? []).map((f) => (f.id === field.id ? { ...f, verified_level: v.level } : f));
      await recomputeAbout(profile, items.data ?? [], undefined, after);
      await refresh();
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(aiErrorCopy(e));
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  if (grades && questions && result) {
    const claimed = stageName(field.level);
    const shown = result.level ? stageName(result.level) : null;
    const verdict = !shown
      ? `Below ${STAGES[0].name} on this check`
      : result.level === field.level
        ? `${shown}, as you said`
        : STAGES.findIndex((s) => s.id === result.level) > STAGES.findIndex((s) => s.id === field.level)
          ? `${shown}: a rung above what you said`
          : `${shown}: a rung below what you said (${claimed})`;
    return (
      <Screen scroll width="reading">
        <Header title="Verify" subtitle={name} onClose={close} />
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="figure">
              {result.score % 1 ? result.score.toFixed(1) : result.score}
              <Text variant="heading" color="textMuted">
                {' '}
                of {result.asked}
              </Text>
            </Text>
            <Text variant="heading" color={shown ? 'accent' : 'text'}>
              {verdict}
            </Text>
            <Text variant="body" color="textMuted">
              {shown
                ? `The map now draws ${name} as shown at ${shown}, and the planner can skip what that covers. Check again any time.`
                : `The field stays on your map as you described it, marked as not yet shown. A rung is passed when its two questions are mostly right; try again when you like.`}
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
                    <Text variant="caption" color="textMuted">
                      {stageName(qq.level)}
                    </Text>
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

          <Button label="Back to You" onPress={() => router.replace('/you')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll width="reading">
      <Header title="Verify" subtitle={name} onClose={close} />
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
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{busy || 'One moment'}</Text>
              <Text variant="caption" color="textMuted">
                Two questions per rung, from Beginner to one above {stageName(field.level)}. From memory; a blank is fine.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text variant="caption" color="textMuted">
              {idx + 1} of {questions?.length} · {stageName(q.level)}
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
              <Button label={idx + 1 < (questions?.length ?? 0) ? 'Next' : 'Finish and check'} onPress={next} loading={busy === 'Checking'} />
              <Text variant="caption" color="textMuted" center>
                Not sure? Leave it and move on. The level comes from the rungs you pass.
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
          {title}
        </Text>
        <Text variant="title">{subtitle}</Text>
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ padding: 4 }}>
        <Ionicons name="close" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

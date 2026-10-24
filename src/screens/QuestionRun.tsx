import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/src/components/ui';
import type { PracticeItem } from '@/src/engine/types';
import { aiErrorCopy, callJson } from '@/src/features/ai/client';
import { useTheme } from '@/src/theme';

// A short run of questions answered from memory, one at a time, marked
// together at the end: the retention probe and mixed practice both use it.
// Multiple choice is marked here; short answers go to the grader in one call.

export type RunQuestion = {
  id: string;
  // Shown above the question: where it comes from.
  label: string;
  item: PracticeItem;
};
export type RunResult = { id: string; score: number; feedback: string; response: string };
export type Grade = { score: number; feedback: string };

type Props = {
  title: string;
  subtitle: string;
  intro?: string;
  gradeTitle: string;
  questions: RunQuestion[] | null;
  loading?: string | null;
  error?: string | null;
  onClose: () => void;
  // Called once with every result; the caller saves and decides what follows.
  onMarked: (results: RunResult[]) => Promise<void> | void;
  // Rendered above the marked list when the run is done.
  summary?: (results: RunResult[]) => ReactNode;
  doneLabel?: string;
  onDone: () => void;
};

export function QuestionRun({ title, subtitle, intro, gradeTitle, questions, loading, error, onClose, onMarked, summary, doneLabel = 'Back to today', onDone }: Props) {
  const { colors, spacing, radius } = useTheme();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<{ picked: number | null; text: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [results, setResults] = useState<RunResult[] | null>(null);

  const q = questions?.[idx];

  const next = async () => {
    if (!questions || !q) return;
    const all = [...answers];
    all[idx] = { picked, text };
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
    setMarkError(null);
    try {
      const shortIdx = questions.map((x, i) => (x.item.type === 'short' ? i : -1)).filter((i) => i >= 0);
      let shortGrades: Grade[] = [];
      if (shortIdx.length) {
        const r = await callJson<{ results: Grade[] }>('grade', {
          kind: 'answers',
          title: gradeTitle,
          items: shortIdx.map((i) => ({ prompt: questions[i].item.prompt, answer: String(questions[i].item.answer), response: all[i]?.text || '' })),
        });
        shortGrades = r.results;
      }
      const out: RunResult[] = questions.map((x, i) => {
        const it = x.item;
        if (it.type === 'mcq') {
          const ok = all[i]?.picked === it.answer;
          return { id: x.id, score: ok ? 1 : 0, feedback: (ok ? 'Right. ' : `The answer was "${it.options?.[Number(it.answer)] ?? ''}". `) + (it.explanation || ''), response: it.options?.[all[i]?.picked ?? -1] ?? '' };
        }
        const g = shortGrades[shortIdx.indexOf(i)] ?? { score: 0, feedback: '' };
        return { id: x.id, score: g.score, feedback: g.feedback || it.explanation || '', response: all[i]?.text || '' };
      });
      setBusy('Saving');
      await onMarked(out);
      setResults(out);
      setBusy(null);
    } catch (e) {
      setMarkError(aiErrorCopy(e));
      setBusy(null);
    }
  };

  const header = (
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

  if (results && questions) {
    return (
      <Screen scroll width="reading">
        {header}
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          {summary ? summary(results) : null}
          <View>
            {questions.map((x, i) => {
              const r = results[i];
              const tone = r.score >= 1 ? colors.accent : r.score > 0 ? colors.warning : colors.danger;
              return (
                <View key={x.id} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ width: 3, backgroundColor: tone, borderRadius: 2 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="caption" color="textMuted">
                      {x.label}
                    </Text>
                    <Text variant="bodyStrong">{x.item.prompt}</Text>
                    <Text variant="caption" color="textMuted">
                      {r.feedback}
                    </Text>
                  </View>
                </View>
              );
            })}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
          <Button label={doneLabel} onPress={onDone} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll width="reading">
      {header}
      <View style={{ marginTop: spacing.xl, flex: 1, gap: spacing.xl }}>
        {error || markError ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="body" color="danger">
              {error || markError}
            </Text>
            {markError && answers.length ? <Button label="Mark again" onPress={() => mark(answers)} loading={Boolean(busy)} /> : null}
            <Button label="Back" variant="secondary" onPress={onClose} />
          </View>
        ) : !q || busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ActivityIndicator size="small" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{busy || loading || 'One moment'}</Text>
              {intro ? (
                <Text variant="caption" color="textMuted">
                  {intro}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <Text variant="caption" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
                {q.label}
              </Text>
              <Text variant="caption" color="textMuted">
                {idx + 1} of {questions?.length}
              </Text>
            </View>
            <Text variant="prose">{q.item.prompt}</Text>
            {q.item.type === 'mcq' ? (
              <View style={{ gap: spacing.sm }}>
                {(q.item.options || []).map((opt, i) => (
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
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                label={idx + 1 < (questions?.length ?? 0) ? 'Next' : 'Finish and mark'}
                onPress={next}
                disabled={q.item.type === 'mcq' ? picked == null : !text.trim()}
              />
              <Pressable onPress={next} style={{ alignSelf: 'center', padding: spacing.sm }}>
                <Text variant="caption" color="textMuted">
                  I don&apos;t know this one
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

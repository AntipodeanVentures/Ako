import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/src/components/ui';
import { fmtInterval } from '@/src/engine/core';
import { dueCards, logReview, recordMinutes, topicById } from '@/src/engine/progress';
import { reviewCard } from '@/src/engine/scheduling';
import { recordRelearn } from '@/src/engine/session';
import type { Card } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import {
  logReviewRow,
  recordActivity,
  saveSubject,
  useInvalidateSubject,
  useLiveSubjects,
  type LiveSubject,
} from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

// Due cards across every subject, one at a time: read the front, recall,
// show the back, say how it went. The four grades are FSRS's. Everything
// is written back when the run ends (or the learner leaves).

type Item = { subj: LiveSubject; card: Card };

const GRADES: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: 'Again' },
  { value: 2, label: 'Hard' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Easy' },
];

export default function ReviewRoute() {
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const [frozen] = useState<{ items: Item[] | null }>({ items: null });
  if (!frozen.items && subjects.length && !loading) {
    const items: Item[] = [];
    for (const s of subjects) for (const c of dueCards(s.cards ?? []) as Card[]) items.push({ subj: s, card: c });
    // Interleave subjects rather than running one then the next.
    items.sort((a, b) => a.card.due - b.card.due);
    frozen.items = items;
  }
  if (!frozen.items) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }
  return <ReviewScreen items={frozen.items} retention={Number(profile?.retention ?? 0.9)} />;
}

function ReviewScreen({ items, retention }: { items: Item[]; retention: number }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const results = useRef<{ ok: number; n: number; pending: { subj: LiveSubject; cardId: string; log: { rating: number; elapsed_days: number; scheduled_days: number; reviewedAt: number } }[] }>({ ok: 0, n: 0, pending: [] });

  const item = items[idx];
  const topic = useMemo(() => (item ? topicById(item.subj, item.card.topicId) : null), [item]);

  const grade = (g: 1 | 2 | 3 | 4) => {
    if (!item) return;
    const { subj, card } = item;
    const { card: next, log } = reviewCard(card, g, retention);
    const ok = g >= 3;
    recordRelearn(subj, next, ok);
    logReview(subj, ok);
    subj.cards = (subj.cards ?? []).map((c) => (c.id === card.id ? next : c));
    subj.dirtyCards.add(card.id);
    results.current.n++;
    if (ok) results.current.ok++;
    results.current.pending.push({ subj, cardId: card.id, log });
    setShown(false);
    setIdx(idx + 1);
  };

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const minutes = Math.max(0.5, (Date.now() - startedAt.current) / 60000);
      const touched = new Map<string, LiveSubject>();
      for (const p of results.current.pending) touched.set(p.subj.id, p.subj);
      for (const subj of touched.values()) {
        const share = results.current.pending.filter((p) => p.subj.id === subj.id).length / Math.max(1, results.current.n);
        recordMinutes(subj, 'review', minutes * share);
        await saveSubject(subj);
        await recordActivity(subj.id, 'review', minutes * share);
      }
      for (const p of results.current.pending) await logReviewRow(p.subj, p.cardId, p.log);
      results.current.pending = [];
      invalidate();
      router.replace('/learn');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setSaving(false);
    }
  };

  const close = () => {
    if (results.current.pending.length) void finish();
    else if (router.canGoBack()) router.back();
    else router.replace('/learn');
  };

  if (!item) {
    const r = results.current;
    return (
      <Screen width="reading">
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
          <Text variant="prose">{r.n ? `${r.ok} of ${r.n} recalled.` : 'Nothing due right now.'}</Text>
          {r.n ? (
            <Text variant="body" color="textMuted">
              Each one you recall on a new day counts towards that topic being secure.
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <Button label="Back to today" onPress={r.n ? finish : close} loading={saving} />
        </View>
      </Screen>
    );
  }

  const nextIn = (g: 1 | 2 | 3 | 4) => {
    const { card } = reviewCard(item.card, g, retention);
    return fmtInterval((card.due - Date.now()) / 86400000);
  };

  return (
    <Screen width="reading">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="eyebrow" color="textMuted">
          {item.subj.plan.title}
          {topic ? ` · ${topic.title}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="caption" color="textMuted">
            {idx + 1} of {items.length}
          </Text>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <Text variant="prose">{item.card.front}</Text>
        {shown ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xl }}>
            <Text variant="body">{item.card.back}</Text>
          </View>
        ) : null}
      </View>

      {shown ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {GRADES.map((g) => (
            <Pressable
              key={g.value}
              onPress={() => grade(g.value)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 56,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: g.value === 3 ? colors.primary : colors.border,
                backgroundColor: g.value === 3 ? colors.primary : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text variant="bodyStrong" color={g.value === 3 ? 'onPrimary' : 'text'}>
                {g.label}
              </Text>
              <Text variant="caption" color={g.value === 3 ? 'onPrimary' : 'textMuted'} style={{ opacity: 0.8 }}>
                {nextIn(g.value)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Button label="Show the answer" onPress={() => setShown(true)} />
      )}
    </Screen>
  );
}

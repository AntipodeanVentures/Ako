import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/src/components/ui';
import { fmtInterval } from '@/src/engine/core';
import { dueCards, logReview, noteConcept, recordMinutes, reopenTopics, retentionFor, topicById } from '@/src/engine/progress';
import { cardFront, reviewCard } from '@/src/engine/scheduling';
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
import { afterReviews } from '@/src/features/subjects/adapt';
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

// Overdue first, then within the same due day take turns between topics
// (and so between subjects), so one card's answer does not cue the next and
// a topic's cards, which share a due time, do not run as a block.
function interleave(items: Item[]): Item[] {
  const day = (t: number) => Math.floor(t / 86400000);
  const sorted = [...items].sort((a, b) => a.card.due - b.card.due);
  const out: Item[] = [];
  let i = 0;
  while (i < sorted.length) {
    const d = day(sorted[i].card.due);
    const group: Item[] = [];
    while (i < sorted.length && day(sorted[i].card.due) === d) group.push(sorted[i++]);
    const byTopic = new Map<string, Item[]>();
    for (const it of group) {
      const k = `${it.subj.id}:${it.card.topicId}`;
      byTopic.set(k, [...(byTopic.get(k) ?? []), it]);
    }
    const queues = [...byTopic.values()];
    while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  }
  return out;
}

export default function ReviewRoute() {
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const [frozen] = useState<{ items: Item[] | null }>({ items: null });
  if (!frozen.items && subjects.length && !loading) {
    const items: Item[] = [];
    for (const s of subjects) for (const c of dueCards(s.cards ?? []) as Card[]) items.push({ subj: s, card: c });
    frozen.items = interleave(items);
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
    // The review target can be tightened per subject by the retention probes.
    const { card: next, log } = reviewCard(card, g, retentionFor(subj, retention));
    const ok = g >= 3;
    recordRelearn(subj, next, ok);
    logReview(subj, ok);
    // Reviews feed the same per-idea record as practice, so lessons, warm-ups and the path revision see what is slipping.
    noteConcept(subj, card.topicId, (card as { concept?: number | null }).concept ?? null, (card as { conceptName?: string }).conceptName ?? '', ok);
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
      const forgottenBySubject = new Map<string, { topicTitle: string; front: string; back: string }[]>();
      for (const subj of touched.values()) {
        const mine = results.current.pending.filter((p) => p.subj.id === subj.id);
        const share = mine.length / Math.max(1, results.current.n);
        recordMinutes(subj, 'review', minutes * share);
        // Cards failed today, and leeches: a card failed three times or more means the lesson did not stick, so
        // its topic is reopened and taught again from a different angle, before the confusion settles in.
        const forgotten = mine.filter((p) => p.log.rating === 1).map((p) => (subj.cards ?? []).find((c) => c.id === p.cardId)).filter(Boolean) as Card[];
        forgottenBySubject.set(subj.id, forgotten.map((c) => ({ topicTitle: topicById(subj, c.topicId)?.title ?? c.topicId, front: c.front, back: c.back })));
        const leeches = Array.from(new Set(forgotten.filter((c) => Number((c as { lapses?: number }).lapses ?? 0) >= 3).map((c) => c.topicId)));
        if (leeches.length) reopenTopics(subj, leeches, 'its review cards kept being forgotten');
        await saveSubject(subj);
        await recordActivity(subj.id, 'review', minutes * share);
      }
      for (const p of results.current.pending) await logReviewRow(p.subj, p.cardId, p.log);
      results.current.pending = [];
      invalidate();
      router.replace('/learn');
      // Off the critical path: let the path adapt where enough was forgotten to mean something.
      for (const subj of touched.values()) {
        void afterReviews(subj, forgottenBySubject.get(subj.id) ?? []).then((notes) => { if (notes?.length) invalidate(); });
      }
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
    const { card } = reviewCard(item.card, g, retentionFor(item.subj, retention));
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
        <Text variant="prose">{cardFront(item.card)}</Text>
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

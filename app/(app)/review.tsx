import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/src/components/ui';
import { fmtInterval } from '@/src/engine/core';
import { dueCards, logReview, noteConcept, recordMinutes, recordTeach, reopenTopics, retentionFor, teachDue, topicById } from '@/src/engine/progress';
import { cardFront, recallChance, reviewCard } from '@/src/engine/scheduling';
import { recordRelearn, sameAnswer } from '@/src/engine/session';
import type { Card, Topic } from '@/src/engine/types';
import { callJson } from '@/src/features/ai/client';
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
import { REVIEW_CAP, aboutMinutes, REVIEW_MINUTES_EACH } from '@/src/features/subjects/summary';
import { TeachBack } from '@/src/screens/TeachBack';
import { useTheme } from '@/src/theme';

// Due cards across every subject, one at a time: read the front, type the answer from memory, see the back
// and the mark, move on. The mark sets the FSRS rating (right: Good; partly: Hard; wrong or blank: Again),
// so the schedule rests on recall rather than on a self-rating made after seeing the answer, which the
// judgement-of-learning literature shows runs high. The learner can override. A run is capped so a backlog
// never becomes a wall; the cards most likely forgotten come first. The run ends with a teach-back when a
// topic's first review day has come. Everything is written back when the run ends (or the learner leaves).

type Item = { subj: LiveSubject; card: Card };
type Rating = 1 | 2 | 3 | 4;
type Mark = { score: number; feedback: string };

const GRADES: { value: Rating; label: string }[] = [
  { value: 1, label: 'Again' },
  { value: 2, label: 'Hard' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Easy' },
];

// Most at risk first (lowest predicted recall), then within the run take turns between topics (and so between
// subjects), so one card's answer does not cue the next and a topic's cards do not run as a block.
function order(items: Item[], retention: number): Item[] {
  const now = Date.now();
  const risk = (it: Item) => recallChance(it.card, now, retentionFor(it.subj, retention)) ?? 0;
  const sorted = [...items].sort((a, b) => risk(a) - risk(b) || a.card.due - b.card.due);
  const byTopic = new Map<string, Item[]>();
  for (const it of sorted) {
    const k = `${it.subj.id}:${it.card.topicId}`;
    byTopic.set(k, [...(byTopic.get(k) ?? []), it]);
  }
  const queues = [...byTopic.values()];
  const out: Item[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  return out;
}

const ratingFor = (score: number): Rating => (score >= 1 ? 3 : score > 0 ? 2 : 1);

export default function ReviewRoute() {
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const retention = Number(profile?.retention ?? 0.9);
  const [frozen] = useState<{ items: Item[] | null; total: number }>({ items: null, total: 0 });
  if (!frozen.items && subjects.length && !loading) {
    const items: Item[] = [];
    for (const s of subjects) for (const c of dueCards(s.cards ?? []) as Card[]) items.push({ subj: s, card: c });
    frozen.total = items.length;
    frozen.items = order(items, retention).slice(0, REVIEW_CAP);
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
  return <ReviewScreen items={frozen.items} total={frozen.total} retention={retention} title={subjects[0]?.plan.title ?? ''} />;
}

function ReviewScreen({ items, total, retention, title }: { items: Item[]; total: number; retention: number; title: string }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  const [mark, setMark] = useState<Mark | null>(null);
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [teach, setTeach] = useState<{ subj: LiveSubject; topic: Topic } | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const results = useRef<{ ok: number; n: number; pending: { subj: LiveSubject; cardId: string; log: { rating: number; elapsed_days: number; scheduled_days: number; reviewedAt: number } }[] }>({ ok: 0, n: 0, pending: [] });
  const markSeq = useRef(0);

  const item = items[idx];
  const topic = useMemo(() => (item ? topicById(item.subj, item.card.topicId) : null), [item]);

  // Reveal the back at once; the mark follows (instant when the words match, otherwise from the grader).
  const check = async (gaveUp = false) => {
    if (!item || shown) return;
    setShown(true);
    const answer = text.trim();
    if (gaveUp || !answer) {
      setMark({ score: 0, feedback: gaveUp ? 'No answer this time. Read the back, say it once, and it comes round again soon.' : '' });
      setRating(1);
      return;
    }
    if (sameAnswer(answer, item.card.back)) {
      setMark({ score: 1, feedback: 'Right.' });
      setRating(3);
      return;
    }
    const seq = ++markSeq.current;
    setMarking(true);
    setMarkFailed(false);
    try {
      const r = await callJson<{ results: Mark[] }>('grade', {
        kind: 'answers',
        title: item.subj.plan.title,
        items: [{ prompt: cardFront(item.card), answer: item.card.back, response: answer }],
      });
      if (seq !== markSeq.current) return;
      const m = r.results[0] ?? { score: 0, feedback: '' };
      setMark(m);
      setRating(ratingFor(m.score));
    } catch {
      if (seq !== markSeq.current) return;
      // No mark: the learner rates it, as before.
      setMarkFailed(true);
    } finally {
      if (seq === markSeq.current) setMarking(false);
    }
  };

  const commit = (g: Rating) => {
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
    markSeq.current++;
    setShown(false);
    setMark(null);
    setMarking(false);
    setMarkFailed(false);
    setRating(null);
    setText('');
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    if (nextIdx >= items.length) setTeach(pickTeach());
  };

  // A topic reviewed in this run whose first review day has come, and which has not yet been taught back.
  const pickTeach = (): { subj: LiveSubject; topic: Topic } | null => {
    const bySubject = new Map<string, { subj: LiveSubject; ids: string[] }>();
    for (const p of results.current.pending) {
      const card = (p.subj.cards ?? []).find((c) => c.id === p.cardId);
      const e = bySubject.get(p.subj.id) ?? { subj: p.subj, ids: [] };
      if (card) e.ids.push(card.topicId);
      bySubject.set(p.subj.id, e);
    }
    for (const { subj, ids } of bySubject.values()) {
      const t = teachDue(subj, ids) as Topic | null;
      if (t) return { subj, topic: t };
    }
    return null;
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
      // Off the critical path: let the path adapt where enough was forgotten to mean something.
      for (const subj of touched.values()) {
        void afterReviews(subj, forgottenBySubject.get(subj.id) ?? []).then((notes) => { if (notes?.length) invalidate(); });
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setSaving(false);
      return false;
    }
  };

  const leave = async (then: 'learn' | 'review') => {
    if (results.current.pending.length) {
      const ok = await finish();
      if (!ok) return;
    }
    if (then === 'review') router.replace('/review');
    else router.replace('/learn');
  };

  const close = () => {
    if (results.current.pending.length) void leave('learn');
    else if (router.canGoBack()) router.back();
    else router.replace('/learn');
  };

  // ---- the end of the run: teach-back when due, then the summary ----
  if (!item) {
    const r = results.current;
    if (teach) {
      return (
        <Screen scroll width="reading">
          <Header title={teach.subj.plan.title} right={null} onClose={close} />
          <View style={{ marginTop: spacing.xl }}>
            <TeachBack
              subj={teach.subj}
              topic={teach.topic}
              onDone={(turns) => {
                recordTeach(teach.subj, teach.topic.id, turns);
                setTeach(null);
              }}
            />
          </View>
        </Screen>
      );
    }
    const left = Math.max(0, total - items.length);
    return (
      <Screen width="reading">
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
          <Text variant="prose">{r.n ? `${r.ok} of ${r.n} recalled.` : 'Nothing due right now.'}</Text>
          {r.n ? (
            <Text variant="body" color="textMuted">
              Each one you recall on a new day counts towards that topic being secure.
              {left ? ` ${left} more ${left === 1 ? 'is' : 'are'} due today, ${aboutMinutes(Math.max(1, Math.round(Math.min(left, REVIEW_CAP) * REVIEW_MINUTES_EACH)))}; now or later, as you like.` : ''}
            </Text>
          ) : null}
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          {left && r.n ? <Button label={`Keep going (${Math.min(left, REVIEW_CAP)} more)`} onPress={() => void leave('review')} loading={saving} /> : null}
          <Button label="Back to today" variant={left && r.n ? 'secondary' : 'primary'} onPress={() => (r.n ? void leave('learn') : close())} loading={saving} />
        </View>
      </Screen>
    );
  }

  const nextIn = (g: Rating) => {
    const { card } = reviewCard(item.card, g, retentionFor(item.subj, retention));
    return fmtInterval((card.due - Date.now()) / 86400000);
  };
  const tone = mark ? (mark.score >= 1 ? colors.accent : mark.score > 0 ? colors.warning : colors.danger) : colors.border;
  const label = mark ? (mark.score >= 1 ? 'Right' : mark.score > 0 ? 'Partly' : 'Not yet') : '';

  return (
    <Screen scroll width="reading">
      <Header
        title={`${item.subj.plan.title}${topic ? ` · ${topic.title}` : ''}`}
        right={`${idx + 1} of ${items.length}`}
        onClose={close}
      />

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.xl }}>
        <Text variant="prose">{cardFront(item.card)}</Text>

        {!shown ? (
          <>
            <TextField label="From memory" value={text} onChangeText={setText} placeholder="Say it in your own words" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <Button label="Check" onPress={() => void check()} disabled={!text.trim()} />
            <Pressable onPress={() => void check(true)} style={{ alignSelf: 'center', padding: spacing.sm }} accessibilityRole="button">
              <Text variant="caption" color="textMuted">
                I don&apos;t know this one
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {text.trim() ? (
              <Text variant="body" color="textMuted">
                {text.trim()}
              </Text>
            ) : null}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xl }}>
              <Text variant="body">{item.card.back}</Text>
            </View>
            {marking ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ActivityIndicator size="small" />
                <Text variant="caption" color="textMuted">
                  Marking
                </Text>
              </View>
            ) : mark ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ width: 3, backgroundColor: tone, borderRadius: 2 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="caption" style={{ color: tone }}>
                    {label}
                    {rating ? ` · next in ${nextIn(rating)}` : ''}
                  </Text>
                  {mark.feedback ? <Text variant="body">{mark.feedback}</Text> : null}
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      {shown && !marking && (mark || markFailed) ? (
        markFailed ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              The marker is not reachable; say how it went.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {GRADES.map((g) => (
                <Pressable
                  key={g.value}
                  onPress={() => commit(g.value)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flex: 1, minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: g.value === 3 ? colors.primary : colors.border, backgroundColor: g.value === 3 ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
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
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Button label="Next" onPress={() => commit(rating ?? 1)} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl }}>
              {rating && rating >= 3 ? (
                <>
                  <Pressable onPress={() => commit(4)} hitSlop={8} accessibilityRole="button">
                    <Text variant="caption" color="textMuted">
                      Too easy ({nextIn(4)})
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => commit(1)} hitSlop={8} accessibilityRole="button">
                    <Text variant="caption" color="textMuted">
                      I had forgotten it
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => commit(3)} hitSlop={8} accessibilityRole="button">
                  <Text variant="caption" color="textMuted">
                    I did know it ({nextIn(3)})
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )
      ) : null}
      {!shown && title ? <View style={{ height: spacing.xl }} /> : null}
    </Screen>
  );
}

function Header({ title, right, onClose }: { title: string; right: string | null; onClose: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Text variant="eyebrow" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {right ? (
          <Text variant="caption" color="textMuted">
            {right}
          </Text>
        ) : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

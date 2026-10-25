import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Say, Screen, Text, TextField } from '@/src/components/ui';
import { fmtDate } from '@/src/engine/core';
import { logPractice, recordApply, recordMinutes, suspendCard, topicById, topicStatus } from '@/src/engine/progress';
import { cardFront } from '@/src/engine/scheduling';
import type { Card, Topic } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import { sendReport } from '@/src/features/reporting';
import { localeFor, looksEnglish, withoutTranslation } from '@/src/features/speech';
import { recordActivity, saveSubject, useInvalidateSubject, useLiveSubjects, type LiveSubject } from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

// One topic after the sitting: what it teaches, its cards and when they come round, the drill to practise from
// (with a way to log a session), today's task, the judgement of learning against the first review, and a way to
// learn it again. The Path opens this for a learned topic instead of starting a whole new lesson.

type TopicState = {
  status?: string;
  masteredAt?: number;
  concepts?: string[];
  drill?: { steps: string[]; dose: string; checks: string[]; cues: string[]; feedback: string; imagery: string; safety: string } | null;
  logs?: { at: number; checks: boolean[]; allChecks: boolean; note: string }[];
  apply?: { text: string; at: number; done: boolean | null };
  retained?: { ok: number; n: number; last: number };
  jol?: number | null;
  jolActual?: number | null;
  attempts?: number;
};

export default function TopicRoute() {
  const { subjectId, topicId } = useLocalSearchParams<{ subjectId: string; topicId: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const subj = subjects.find((s) => s.id === subjectId);
  const topic = subj ? (topicById(subj, topicId) as Topic | null) : null;
  if (!subj || !topic) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator /> : <Text color="textMuted">Topic not found.</Text>}
        </View>
      </Screen>
    );
  }
  return <TopicScreen subj={subj} topic={topic} />;
}

function TopicScreen({ subj, topic }: { subj: LiveSubject; topic: Topic }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const st = (subj.topicState[topic.id] ?? {}) as TopicState;
  const status = topicStatus(subj, topic) as string;
  const cards = (subj.cards ?? []).filter((c) => c.topicId === topic.id);
  const locale = localeFor(subj.plan.language);
  const voiceFor = (text: string) => (locale && !looksEnglish(withoutTranslation(text)) ? locale : null);
  const [saving, setSaving] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [checks, setChecks] = useState<boolean[]>(() => (st.drill?.checks ?? []).map(() => false));
  const [note, setNote] = useState('');
  const [logged, setLogged] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/path'));
  const learn = () => router.push({ pathname: '/session/[subjectId]', params: { subjectId: subj.id, topicId: topic.id } });

  const save = async (what: string, change: () => void) => {
    setSaving(what);
    try {
      change();
      await saveSubject(subj);
      invalidate();
    } finally {
      setSaving(null);
    }
  };

  const flag = async (card: Card) => {
    setFlagged((f) => ({ ...f, [card.id]: true }));
    await save('flag', () => suspendCard(subj, card.id));
    sendReport('problem', `Wrong content flagged: card in "${topic.title}" (${subj.plan.title}). Front: ${card.front} | Back: ${card.back}`, { subjectId: subj.id, topicId: topic.id, cardId: card.id, kind: 'content' }).catch(() => {});
  };

  const logSession = async () => {
    const minutes = 10;
    await save('log', () => {
      logPractice(subj, topic.id, checks, note);
      recordMinutes(subj, 'lesson', minutes);
    });
    recordActivity(subj.id, 'lesson', minutes).catch(() => {});
    setLogged(checks.every(Boolean) ? 'Logged. Every check passed, so the topic counts as learned.' : 'Logged. It stays in practice until a session passes every check.');
    setChecks(checks.map(() => false));
    setNote('');
  };

  const statusLine = (() => {
    if (status === 'known') return 'Known before you started; skipped.';
    if (status === 'mastered') return `Learned ${st.masteredAt ? 'on ' + fmtDate(st.masteredAt) : ''}${st.retained?.n ? (st.retained.last ? ' · retained weeks later' : ' · faded at the retention check') : ''}`.trim();
    if (status === 'practising') return 'Learned on screen; waiting for a practice session where every check passes.';
    if (status === 'learning') return Number(st.attempts) ? 'Not yet at the mark; it comes back simpler.' : 'Open to learn.';
    return status === 'available' ? 'Open to learn.' : 'Locked until its prerequisites are learned.';
  })();

  const jolLine = st.jol != null && st.jolActual != null
    ? `You predicted ${Math.round(st.jol * 100)}% of the cards right at the first review; you recalled ${Math.round(st.jolActual * 100)}%.${st.jol - st.jolActual >= 0.25 ? ' Your guess ran high: a sign to trust the reviews, not the feeling.' : st.jolActual - st.jol >= 0.25 ? ' Your guess ran low.' : ' Close.'}`
    : null;

  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" color="textMuted">
            {subj.plan.title}
          </Text>
          <Text variant="title">{topic.title}</Text>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
        <Text variant="body">{topic.summary}</Text>
        <Text variant="caption" color={status === 'mastered' || status === 'known' ? 'accent' : 'textMuted'}>
          {statusLine}
        </Text>
        {jolLine ? (
          <Text variant="caption" color="textMuted">
            {jolLine}
          </Text>
        ) : null}
      </View>

      {st.apply?.text ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            {st.apply.done == null ? 'Use it today' : st.apply.done ? 'Used it' : 'Not used yet'}
          </Text>
          <Text variant="body">{st.apply.text}</Text>
          {st.apply.done == null ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable onPress={() => void save('apply', () => recordApply(subj, topic.id, true))} accessibilityRole="button" style={{ paddingVertical: spacing.xs }}>
                <Text variant="caption" color="text">
                  Did it
                </Text>
              </Pressable>
              <Pressable onPress={() => void save('apply', () => recordApply(subj, topic.id, false))} accessibilityRole="button" style={{ paddingVertical: spacing.xs }}>
                <Text variant="caption" color="textMuted">
                  Not yet
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {st.concepts?.length ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            What it teaches
          </Text>
          {st.concepts.map((c, i) => (
            <Text key={i} variant="body">
              {c}
            </Text>
          ))}
        </View>
      ) : null}

      {st.drill ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <Text variant="eyebrow" color="textMuted">
            Practise away from the screen
          </Text>
          <View style={{ gap: spacing.sm }}>
            {st.drill.steps.map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text variant="body" color="textMuted" style={{ width: 22 }}>
                  {i + 1}.
                </Text>
                <Text variant="body" style={{ flex: 1 }}>
                  {step}
                </Text>
              </View>
            ))}
            {st.drill.dose ? (
              <Text variant="caption" color="textMuted">
                {st.drill.dose}
              </Text>
            ) : null}
          </View>
          {st.drill.cues?.length ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="bodyStrong">Think about</Text>
              {st.drill.cues.map((c, i) => (
                <Text key={i} variant="body">
                  {c}
                </Text>
              ))}
              {st.drill.feedback ? (
                <Text variant="caption" color="textMuted">
                  {st.drill.feedback}
                </Text>
              ) : null}
            </View>
          ) : null}
          {st.drill.imagery ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="bodyStrong">Sixty seconds in your head</Text>
              <Text variant="body">{st.drill.imagery}</Text>
            </View>
          ) : null}
          {st.drill.safety ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="bodyStrong">Safety</Text>
              <Text variant="body">{st.drill.safety}</Text>
            </View>
          ) : null}
          {st.drill.checks?.length ? (
            <View style={{ gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
              <Text variant="bodyStrong">Log a practice session</Text>
              <Text variant="caption" color="textMuted">
                Tick each check that held for most repetitions. Every check passing once counts the topic as learned.
              </Text>
              {st.drill.checks.map((c, i) => (
                <Pressable
                  key={i}
                  onPress={() => setChecks((v) => v.map((x, j) => (j === i ? !x : x)))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: checks[i] }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}
                >
                  <Ionicons name={checks[i] ? 'checkbox' : 'square-outline'} size={20} color={checks[i] ? colors.text : colors.textMuted} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {c}
                  </Text>
                </Pressable>
              ))}
              <TextField label="Notes, optional" value={note} onChangeText={setNote} placeholder="What felt right, what did not" multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
              <Button label="Log it" variant="secondary" onPress={() => void logSession()} loading={saving === 'log'} />
              {logged ? (
                <Text variant="caption" color="accent">
                  {logged}
                </Text>
              ) : null}
            </View>
          ) : null}
          {st.logs?.length ? (
            <View>
              {[...st.logs].reverse().slice(0, 5).map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text variant="caption" color="textMuted">
                    {fmtDate(l.at)}
                  </Text>
                  <Text variant="caption" color={l.allChecks ? 'accent' : 'textMuted'}>
                    {l.checks.filter(Boolean).length} of {l.checks.length} checks
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {cards.length ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Cards
          </Text>
          <View>
            {cards.map((c) => {
              const due = c.due - Date.now();
              const when = c.suspended ? 'set aside' : due <= 0 ? 'due now' : due < 86400000 * 1.5 ? 'due tomorrow' : `due ${fmtDate(c.due)}`;
              return (
                <View key={c.id} style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs, opacity: c.suspended ? 0.6 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {cardFront(c)}
                    </Text>
                    {locale ? <Say text={withoutTranslation(c.front)} locale={voiceFor(c.front)} /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                    <Text variant="body" color="textMuted" style={{ flex: 1 }}>
                      {c.back}
                    </Text>
                    {locale ? <Say text={withoutTranslation(c.back)} locale={voiceFor(c.back)} /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" color="textMuted">
                      {when}
                      {c.reviews ? ` · ${c.reviews} ${c.reviews === 1 ? 'review' : 'reviews'}` : ''}
                    </Text>
                    {!c.suspended && !flagged[c.id] ? (
                      <Pressable onPress={() => void flag(c)} hitSlop={8} accessibilityRole="button">
                        <Text variant="caption" color="textMuted">
                          This looks wrong
                        </Text>
                      </Pressable>
                    ) : flagged[c.id] || c.suspended ? (
                      <Text variant="caption" color="textMuted">
                        Flagged, out of reviews
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        {status === 'available' || status === 'learning' ? (
          <Button label="Start" onPress={learn} />
        ) : status === 'mastered' || status === 'known' || status === 'practising' ? (
          <Button label="Learn it again" variant="secondary" onPress={learn} />
        ) : null}
      </View>
    </Screen>
  );
}

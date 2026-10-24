import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/src/components/ui';
import { calibrateFromProbes, noteConcept, recordMinutes, recordProbe, reopenTopics } from '@/src/engine/progress';
import { planProbe, useOpenProbeItems, type ProbeEntry } from '@/src/features/probe';
import { useProfile } from '@/src/features/profile';
import { markProbeItem, recordActivity, saveSubject, useInvalidateSubject, useLiveSubjects, type LiveSubject } from '@/src/features/subjects';
import { QuestionRun, type RunResult } from '@/src/screens/QuestionRun';
import { useTheme } from '@/src/theme';

// The weekly retention check: questions never seen before, on topics
// learned two to six weeks ago. The result is the evidence that a topic
// stayed learned; it is recorded on the topic ("retained" on the Path),
// feeds the per-idea record, reopens a topic that has faded, and
// calibrates the mastery bar and review target for the subject.

const RETAINED = 0.5; // the grader's "partly right" still shows the idea is there

export default function ProbeRoute() {
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = useInvalidateSubject();
  const { spacing } = useTheme();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const open = useOpenProbeItems(profile?.id ?? null);
  const startedAt = useRef(Date.now());
  const [frozen] = useState<{ plan: ProbeEntry[] | null }>({ plan: null });
  if (!frozen.plan && subjects.length && !loading && open.data) frozen.plan = planProbe(subjects, open.data.items);
  const entries = frozen.plan;
  const [outcome, setOutcome] = useState<{ ok: number; n: number; faded: string[]; calibrated: { subject: string; criterion: number }[] } | null>(null);

  const questions = useMemo(
    () => entries?.map((e) => ({ id: e.row.id, label: `${e.subj.plan.title} · ${e.topic.title}`, item: e.item })) ?? null,
    [entries],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  const onMarked = async (results: RunResult[]) => {
    if (!entries) return;
    const minutes = Math.max(0.5, (Date.now() - startedAt.current) / 60000);
    const touched = new Map<string, LiveSubject>();
    const byTopic = new Map<string, { subj: LiveSubject; title: string; ok: number; n: number }>();
    let ok = 0;
    for (const r of results) {
      const e = entries.find((x) => x.row.id === r.id);
      if (!e) continue;
      const retained = r.score >= RETAINED;
      if (retained) ok++;
      recordProbe(e.subj, e.topic.id, retained);
      noteConcept(e.subj, e.topic.id, e.item.concept ?? null, '', retained);
      touched.set(e.subj.id, e.subj);
      const k = `${e.subj.id}:${e.topic.id}`;
      const t = byTopic.get(k) ?? { subj: e.subj, title: e.topic.title, ok: 0, n: 0 };
      t.n++;
      if (retained) t.ok++;
      byTopic.set(k, t);
      void markProbeItem(e.row.id, r.score, r.response).catch(() => {});
    }
    // A topic with nothing retained this week comes back to be taught again, from a different angle.
    const faded: string[] = [];
    for (const [k, t] of byTopic) {
      if (t.ok === 0) {
        reopenTopics(t.subj, [k.split(':')[1]], 'a retention check weeks later showed it had faded');
        faded.push(t.title);
      }
    }
    const calibrated: { subject: string; criterion: number }[] = [];
    for (const subj of touched.values()) {
      const before = (subj.stats.calibration as { criterion?: number } | undefined)?.criterion ?? 3;
      const cal = calibrateFromProbes(subj) as { criterion: number } | null;
      if (cal && cal.criterion !== before) calibrated.push({ subject: subj.plan.title, criterion: cal.criterion });
      recordMinutes(subj, 'review', minutes / touched.size);
      await saveSubject(subj);
      await recordActivity(subj.id, 'review', minutes / touched.size);
    }
    setOutcome({ ok, n: results.length, faded, calibrated });
    invalidate();
    void qc.invalidateQueries({ queryKey: ['probe_items'] });
  };

  if (entries && !entries.length) {
    return (
      <Screen width="reading">
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
          <Text variant="prose">Nothing to check yet.</Text>
          <Text variant="body" color="textMuted">
            A topic is checked two to six weeks after you learn it, with questions you have not seen. Come back once a few have been learned that long.
          </Text>
          <Button label="Back" onPress={close} />
        </View>
      </Screen>
    );
  }

  return (
    <QuestionRun
      title="Did it stick?"
      subtitle="Retention check"
      intro="A few questions on topics from weeks ago. From memory; guessing is fine."
      gradeTitle={entries?.[0]?.subj.plan.title ?? 'Ako'}
      questions={questions}
      loading={loading || open.isLoading ? 'Finding what to check' : null}
      error={open.error ? 'Could not load the check. Try again.' : null}
      onClose={close}
      onMarked={onMarked}
      summary={(results) =>
        outcome ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="prose">
              {outcome.ok} of {outcome.n} retained.
            </Text>
            <Text variant="body" color="textMuted">
              These were questions you had never seen, weeks after the lessons. That is the real measure; the Path now shows it beside each level.
            </Text>
            {outcome.faded.length ? (
              <Text variant="body">
                {outcome.faded.join(', ')}: nothing came back, so {outcome.faded.length === 1 ? 'it is' : 'they are'} back on your path to be taught again from a different angle.
              </Text>
            ) : null}
            {outcome.calibrated.map((c) => (
              <Text key={c.subject} variant="body">
                {c.criterion > 3
                  ? `In ${c.subject}, less than 60% has been retained, so a topic now needs four fully right answers before it counts as learned, and reviews come a little sooner.`
                  : `In ${c.subject}, retention is back above 75%, so the usual bar applies again.`}
              </Text>
            ))}
            {results.length === 0 ? null : null}
          </View>
        ) : null
      }
      onDone={() => router.replace('/learn')}
    />
  );
}

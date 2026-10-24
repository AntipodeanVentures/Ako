import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { PROBE_MIN_ITEMS, pickProbe, probeCandidates, probeDue } from '@/src/engine/progress';
import type { PracticeItem, Topic } from '@/src/engine/types';
import { lastProbeAt, listOpenProbeItems, type LiveSubject } from '@/src/features/subjects';
import type { ProbeItemRow } from '@/src/types/database';

// The weekly retention probe: a few questions the learner has never seen,
// on topics mastered two to six weeks ago, across subjects. The questions
// were written with each lesson's practice set and held back (probe_items).
// The engine decides which topics are eligible and how to sample; this
// module joins that to the stored items and to the screens.

export type ProbeEntry = { row: ProbeItemRow; subj: LiveSubject; topic: Topic; item: PracticeItem };

export function useOpenProbeItems(profileId: string | null) {
  return useQuery({
    queryKey: ['probe_items', 'open', profileId],
    enabled: Boolean(profileId),
    queryFn: async () => ({ items: await listOpenProbeItems(profileId as string), lastAt: await lastProbeAt(profileId as string) }),
    staleTime: 60_000,
  });
}

// This week's probe, or an empty list when nothing is ready.
export function planProbe(subjects: LiveSubject[], rows: ProbeItemRow[]): ProbeEntry[] {
  const perTopic: { key: string; items: ProbeEntry[] }[] = [];
  for (const subj of subjects) {
    for (const topic of probeCandidates(subj) as Topic[]) {
      const items = rows
        .filter((r) => r.subject_id === subj.id && r.topic_id === topic.id)
        .map((row) => ({ row, subj, topic, item: row.item as unknown as PracticeItem }))
        .filter((e) => e.item && e.item.prompt);
      if (items.length) perTopic.push({ key: `${subj.id}:${topic.id}`, items });
    }
  }
  // Oldest-mastered first is the engine's order within a subject; across subjects, take turns.
  return (pickProbe(perTopic) as { key: string; item: ProbeEntry }[]).map((p) => p.item);
}

// For the Learn tab: is a probe due, and how many questions would it have.
export function useProbeStatus(profileId: string | null, subjects: LiveSubject[]): { due: boolean; count: number } {
  const q = useOpenProbeItems(profileId);
  return useMemo(() => {
    if (!q.data) return { due: false, count: 0 };
    const plan = planProbe(subjects, q.data.items);
    return { due: probeDue(q.data.lastAt) && plan.length >= PROBE_MIN_ITEMS, count: plan.length };
  }, [q.data, subjects]);
}

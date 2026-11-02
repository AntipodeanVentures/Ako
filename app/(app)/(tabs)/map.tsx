import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { openNode } from '@/src/components/KnowledgeMap';
import { useKnowItems, usePriorFields, useProfile } from '@/src/features/profile';
import { useProbeStatus } from '@/src/features/probe';
import { useOpenSitting } from '@/src/features/session/useOpenSitting';
import { useInvalidateSubject, useLiveSubjects } from '@/src/features/subjects';
import { assignSchemas } from '@/src/features/subjects/schema';
import { routeForStep } from '@/src/features/subjects/start';
import { liveSubjects, nextStep } from '@/src/features/subjects/summary';
import { startLabel } from '@/src/screens/LearnView';
import { MapHome } from '@/src/screens/MapHome';

// The home: the map of what you know, and one tap to today's session.
export default function MapScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const live = useLiveSubjects(profile);
  // Memoised: the map re-settles its layout whenever this array changes.
  const subjects = useMemo(() => liveSubjects(live.subjects), [live.subjects]);
  const items = useKnowItems();
  const know = useMemo(() => (items.data ?? []).map((r) => ({ id: r.id, kind: r.kind, title: r.title, detail: r.detail })), [items.data]);
  const priorQ = usePriorFields();
  const prior = useMemo(() => priorQ.data ?? [], [priorQ.data]);
  const probe = useProbeStatus(profile?.id ?? null, subjects);
  const resume = useOpenSitting(subjects);
  const invalidate = useInvalidateSubject();
  const qc = useQueryClient();
  // Topics placed in fewer than three levels, and fields brought without a domain, are placed once, then everything reloads.
  const place = useCallback(async () => { await assignSchemas(subjects, prior); invalidate(); qc.invalidateQueries({ queryKey: ['prior_fields'] }); }, [subjects, prior, invalidate, qc]);
  const step = nextStep(subjects, { probe, resume });
  // A sitting left halfway, a level check or a retention probe outranks the map's own reading of the day.
  const line = step.kind === 'resume' ? `Pick up ${step.topic.title} where you left off.` : step.kind === 'probe' ? 'A five-minute check on what you learned weeks ago.' : step.kind === 'check' ? `The ${step.stageName} level check in ${step.subject.plan.title}.` : step.kind === 'mixed' ? `Mixed practice across ${step.topics.length} earlier topics in ${step.subject.plan.title}.` : undefined;

  return (
    <MapHome
      subjects={subjects}
      know={know}
      prior={prior}
      retention={Number(profile?.retention ?? 0.9)}
      line={line}
      startLabel={startLabel(step)}
      onStart={() => routeForStep(router, step)}
      onOpen={(n) => openNode(router, n)}
      onPlace={place}
    />
  );
}

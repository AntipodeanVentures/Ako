import { useRouter } from 'expo-router';

import { useProfile } from '@/src/features/profile';
import { useProbeStatus } from '@/src/features/probe';
import { useOpenSitting } from '@/src/features/session/useOpenSitting';
import { useLiveSubjects } from '@/src/features/subjects';
import type { nextStep } from '@/src/features/subjects/summary';
import { LearnView } from '@/src/screens/LearnView';

export default function LearnScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const probe = useProbeStatus(profile?.id ?? null, subjects);
  const resume = useOpenSitting(subjects);

  const start = (step: ReturnType<typeof nextStep>) => {
    if (step.kind === 'resume') router.push({ pathname: '/session/[subjectId]', params: { subjectId: step.subject.id, topicId: step.topic.id } });
    else if (step.kind === 'review') router.push('/review');
    else if (step.kind === 'probe') router.push('/probe');
    else if (step.kind === 'mixed') router.push({ pathname: '/mixed/[subjectId]', params: { subjectId: step.subject.id } });
    else if (step.kind === 'check') router.push({ pathname: '/check/[subjectId]', params: { subjectId: step.subject.id, stageId: step.stageId } });
    else if (step.kind === 'topic') router.push({ pathname: '/session/[subjectId]', params: { subjectId: step.subject.id, topicId: step.topic.id } });
    else router.push('/goal');
  };

  return (
    <LearnView
      subjects={subjects}
      loading={loading}
      extras={{ probe, resume }}
      onStart={start}
      onOpenSubject={(subjectId) => router.push({ pathname: '/path', params: { subjectId } })}
      onAddSubject={() => router.push('/goal')}
    />
  );
}

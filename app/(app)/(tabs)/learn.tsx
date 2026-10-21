import { useRouter } from 'expo-router';

import { useProfile } from '@/src/features/profile';
import { useLiveSubjects } from '@/src/features/subjects';
import type { nextStep } from '@/src/features/subjects/summary';
import { LearnView } from '@/src/screens/LearnView';

export default function LearnScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);

  const start = (step: ReturnType<typeof nextStep>) => {
    if (step.kind === 'review') router.push('/review');
    else if (step.kind === 'check') router.push({ pathname: '/check/[subjectId]', params: { subjectId: step.subject.id, stageId: step.stageId } });
    else if (step.kind === 'topic') router.push({ pathname: '/session/[subjectId]', params: { subjectId: step.subject.id, topicId: step.topic.id } });
    else router.push('/goal');
  };

  return (
    <LearnView
      subjects={subjects}
      loading={loading}
      onStart={start}
      onOpenSubject={(subjectId) => router.push({ pathname: '/path', params: { subjectId } })}
      onAddSubject={() => router.push('/goal')}
    />
  );
}

import { useRouter } from 'expo-router';

import { applyDue, recordApply } from '@/src/engine/progress';
import type { Topic } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import { useProbeStatus } from '@/src/features/probe';
import { useOpenSitting } from '@/src/features/session/useOpenSitting';
import { saveSubject, useInvalidateSubject, useLiveSubjects } from '@/src/features/subjects';
import type { nextStep } from '@/src/features/subjects/summary';
import { LearnView, type ApplyPrompt } from '@/src/screens/LearnView';

export default function LearnScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const probe = useProbeStatus(profile?.id ?? null, subjects);
  const resume = useOpenSitting(subjects);
  const invalidate = useInvalidateSubject();
  // Yesterday's "use it today" task, from whichever subject set one.
  const apply: ApplyPrompt | null = (() => {
    for (const s of subjects) {
      const a = applyDue(s) as { topic: Topic; text: string } | null;
      if (a) return { subject: s, topic: a.topic, text: a.text };
    }
    return null;
  })();
  const answerApply = (p: ApplyPrompt, done: boolean) => {
    recordApply(p.subject, p.topic.id, done);
    saveSubject(p.subject).then(() => invalidate()).catch(() => {});
  };

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
      apply={apply}
      onApply={answerApply}
      onStart={start}
      onOpenSubject={(subjectId) => router.push({ pathname: '/path', params: { subjectId } })}
      onAddSubject={() => router.push('/goal')}
    />
  );
}

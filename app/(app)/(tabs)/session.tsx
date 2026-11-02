import { useRouter } from 'expo-router';

import { applyDue, recordApply } from '@/src/engine/progress';
import type { Topic } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import { useProbeStatus } from '@/src/features/probe';
import { useOpenSitting } from '@/src/features/session/useOpenSitting';
import { saveSubject, useInvalidateSubject, useLiveSubjects } from '@/src/features/subjects';
import { routeForStep } from '@/src/features/subjects/start';
import { liveSubjects } from '@/src/features/subjects/summary';
import { LearnView, type ApplyPrompt } from '@/src/screens/LearnView';

// The session: what is next and how long it takes, how today is going, and where each subject
// stands. The map is the home; this is where the work is listed.
export default function SessionScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const all = useLiveSubjects(profile);
  const subjects = liveSubjects(all.subjects);
  const loading = all.loading;
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

  return (
    <LearnView
      subjects={subjects}
      loading={loading}
      extras={{ probe, resume }}
      apply={apply}
      onApply={answerApply}
      onStart={(step) => routeForStep(router, step)}
      onOpenSubject={(subjectId) => router.push({ pathname: '/subject/[subjectId]', params: { subjectId } })}
      onAddSubject={() => router.push('/goal')}
    />
  );
}

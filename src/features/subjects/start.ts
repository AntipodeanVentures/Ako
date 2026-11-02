import type { useRouter } from 'expo-router';

import type { nextStep } from './summary';

// Where the one Start button goes, for whichever step is next. Shared by the map (the home)
// and the session screen, so the two never disagree.
export function routeForStep(router: ReturnType<typeof useRouter>, step: ReturnType<typeof nextStep>) {
  if (step.kind === 'resume') router.push({ pathname: '/session/[subjectId]', params: { subjectId: step.subject.id, topicId: step.topic.id } });
  else if (step.kind === 'review') router.push('/review');
  else if (step.kind === 'probe') router.push('/probe');
  else if (step.kind === 'mixed') router.push({ pathname: '/mixed/[subjectId]', params: { subjectId: step.subject.id } });
  else if (step.kind === 'check') router.push({ pathname: '/check/[subjectId]', params: { subjectId: step.subject.id, stageId: step.stageId } });
  else if (step.kind === 'topic') router.push({ pathname: '/session/[subjectId]', params: { subjectId: step.subject.id, topicId: step.topic.id } });
  else router.push('/goal');
}

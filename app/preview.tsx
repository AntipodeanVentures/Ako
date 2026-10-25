import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen, Text } from '@/src/components/ui';
import { makeCards } from '@/src/engine/scheduling';
import type { Plan } from '@/src/engine/types';
import { buildSubject, type LiveSubject } from '@/src/features/subjects';
import { planPortuguese } from '@/src/engine/fixtures';
import { seedBuildForPreview } from '@/src/features/subjects/planBuilder';
import { LearnView } from '@/src/screens/LearnView';
import { SubjectPath } from '@/src/screens/PathView';
import { DoneStep, LearnStep, PracticeStep, RecallStep, StepStrip, WarmStep, type SessionApi } from '@/src/screens/SessionSteps';
import { useTheme } from '@/src/theme';

import PlaceScreen from './(onboarding)/place';
import GoalScreen from './(onboarding)/goal';

// Development only: the signed-in screens rendered from fixture data, so
// layout can be checked in a browser without an account. Not reachable in
// a production build.

function fixtureSubject(): LiveSubject {
  const plan = { v: 4, ...planPortuguese } as unknown as Plan;
  const day = new Date();
  day.setDate(day.getDate() - 3);
  const subj = buildSubject(
    {
      id: 'fixture',
      profile_id: 'me',
      title: plan.title,
      intake: { subject: 'Brazilian Portuguese', target: 's3', current: 'Know a little', hours: 2, minutes: 15 },
      plan,
      plan_version: 4,
      pitch: null,
      support: 'full',
      stats: { minutes: 85, lessonMinutes: 70, reviewMinutes: 15, lastStudied: Date.now() - 86400000, log: { [today()]: 12 } },
      model: null,
      role_area_id: null,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    null,
    [
      { subject_id: 'fixture', profile_id: 'me', topic_id: 'p1', status: 'mastered', correct: 5, misses: 0, relearn_days: [], jol: null, jol_actual: null, mastered_at: day.toISOString(), extra: {}, updated_at: '' },
      { subject_id: 'fixture', profile_id: 'me', topic_id: 'p2', status: 'mastered', correct: 5, misses: 1, relearn_days: [], jol: null, jol_actual: null, mastered_at: day.toISOString(), extra: {}, updated_at: '' },
    ],
    [],
    [],
  );
  const t = plan.topics[0];
  const cards = makeCards(t, [{ front: 'How is the nasal "ão" in "pão" made?', back: 'Air through the nose as the vowel glides; no hard n.', concept: 0 }], 3);
  cards[0].due = Date.now() - 1000;
  subj.cards = cards;
  return subj;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// One topic's sitting, frozen at a step, from a hand-written lesson on ser and estar.
const LESSON = {
  concepts: ['What ser is for', 'What estar is for', 'Location and events', 'Adjectives that change meaning'],
  bridge: 'Last time you met the nasal vowels, the sound that marks Portuguese out from Spanish. Today is the other thing that trips English speakers up: Portuguese has two verbs where English has one, and you already use the distinction every day without a word for it.',
  compare: {
    a: 'Ana é médica. (Ana is a doctor.)',
    b: 'Ana está cansada. (Ana is tired.)',
    question: 'Both sentences say Ana "is" something. What is different about the two somethings?',
    answer: 'Being a doctor is who Ana is; being tired is how she is right now. Portuguese uses ser for the first and estar for the second.',
  },
  sections: [
    {
      heading: 'Two verbs, one job',
      paragraphs: [
        'English has one verb for "to be". Portuguese splits the job in two. Ser is for what something is: identity, origin, profession, lasting traits. Estar is for how something is at the moment: feelings, health, location, passing states.',
        'The test is simple. Ask whether the sentence would still be true next week with nothing changed. "Ana is a doctor" would; that is ser. "Ana is tired" might not; that is estar.',
      ],
      points: ['ser: eu sou, você é, nós somos, eles são', 'estar: eu estou, você está, nós estamos, eles estão'],
    },
    {
      heading: 'Location is always estar',
      paragraphs: [
        'Where something is right now takes estar, even for buildings that never move: o banco está na praça (the bank is on the square). The exception is events. A festa é na praça (the party is on the square), because an event is where it takes place rather than where it happens to be.',
      ],
    },
    {
      heading: 'The adjectives that change meaning',
      paragraphs: [
        'Some adjectives mean different things with each verb. Ela é chata is "she is boring"; ela está chata is "she is being annoying". Ele é bom is "he is a good person"; ele está bom is "he is well". This is where the verb carries meaning that English leaves to context.',
      ],
    },
  ],
  workedExample: {
    problem: 'Translate: "My brother is a teacher and he is in London this week."',
    steps: ['"Is a teacher" is identity, so ser: meu irmão é professor.', '"Is in London" is location, so estar: ele está em Londres.', 'Join them: Meu irmão é professor e está em Londres esta semana.'],
    gaps: [1],
    answer: 'Meu irmão é professor e está em Londres esta semana.',
  },
  mistakes: [
    'Using ser for a location because the place is permanent. A building takes estar; only an event takes ser.',
    'Translating "I am hot" as eu sou quente, which means something quite different. Temperature and feelings take estar: estou com calor.',
  ],
  recall: 'In your own words: what decides whether a Portuguese sentence uses ser or estar?',
  recallAnswer: 'Ser for what something is (identity, origin, profession, lasting traits, and where an event takes place); estar for how something is now (feelings, health, passing states, and where a thing is).',
  why: 'Why does a party take ser for its location when a bank takes estar?',
  whyAnswer: 'An event is defined by where it happens, so its location is part of what it is; a bank merely happens to be somewhere.',
  practice: [
    { kind: 'question', type: 'mcq', difficulty: 1, concept: 0, prompt: 'Which verb? Eu ___ brasileiro. (I am Brazilian.)', options: ['sou', 'estou', 'é', 'está'], answer: 0, explanation: 'Nationality is identity, so ser: eu sou.' },
    { kind: 'question', type: 'mcq', difficulty: 2, concept: 1, prompt: 'Which verb? O café ___ frio. (The coffee is cold.)', options: ['é', 'está'], answer: 1, explanation: 'The coffee\'s temperature is how it is right now, so estar.' },
    { kind: 'question', type: 'short', difficulty: 3, concept: 1, mix: true, prompt: 'A training partner texts "estou cansado" after a session. From the verb alone, is he describing a passing state or a lasting trait, and how do you know?', answer: 'A passing state: estar marks how he is now. Sou cansado would make tiredness part of who he is.', explanation: '' },
    { kind: 'question', type: 'mcq', difficulty: 4, concept: 2, prompt: 'Which verb? A reunião ___ na sala 3. (The meeting is in room 3.)', options: ['é', 'está'], answer: 0, explanation: 'A meeting is an event, so where it takes place is part of what it is: ser.' },
    { kind: 'question', type: 'mcq', difficulty: 4, concept: 3, prompt: 'Someone says of a colleague: "ele está chato hoje". What are they most likely saying?', options: ['He is a boring person', 'He is being annoying today', 'He is bored today', 'He is unwell today'], answer: 1, explanation: 'With estar, chato is a passing state: being annoying. With ser it would be the trait, boring.' },
    { kind: 'question', type: 'short', difficulty: 5, concept: 2, prompt: 'A friend says "o show está no parque". What has she probably got wrong, and how would you say it?', answer: 'A show is an event, so its location takes ser: o show é no parque. Está would suggest the show is an object sitting in the park.', explanation: '' },
  ],
};

function mockSession(step: string): SessionApi {
  const noop = () => {};
  const warm = {
    hook: 'Portuguese has two verbs for "to be", and picking the wrong one can turn "I am bored" into "I am boring".',
    questions: [
      { q: 'In English, "I am tired" and "I am Australian" use the same verb. Does Portuguese?', a: 'No: two verbs, ser and estar.', purpose: 'prior', type: 'choice', options: ['Yes, one verb', 'No, two verbs', 'Only in formal speech'], answer: 1 },
      { q: 'Which do you think gets its own verb: things that change (tired, hungry) or things that stay (nationality, profession)?', a: 'Both: estar for what changes, ser for what stays.', purpose: 'predict', type: 'choice', options: ['The changing things', 'The lasting things', 'Both, one verb each'], answer: 2 },
    ],
  };
  const marked = step.endsWith('-marked');
  const base = step.replace('-marked', '');
  const prac = { items: LESSON.practice, asked: [0], idx: 1, re: false, correct: 1, requeue: [], log: [] };
  const s = {
    step: base,
    topic: { id: 'p4', title: 'Ser and estar', kind: 'concept' },
    busy: null,
    error: null,
    warm: base === 'warm' ? warm : null,
    warmAnswers: marked ? ['No, two verbs', 'The changing things'] : ['', ''],
    warmGrades: base === 'warm' && marked ? [{ score: 1, feedback: 'Right: ser and estar.' }, { score: 0.5, feedback: 'Half of it. The changing things get estar; the lasting things get ser, so both have their own verb.' }] : null,
    lessonStarted: true,
    lessonProgress: { chars: 0, sections: 0 },
    lesson: LESSON,
    questionsReady: true,
    questionsError: null,
    recIdx: 0,
    recText: marked ? 'Ser is for what something permanently is, estar for how it is at the moment, like being tired or being somewhere.' : '',
    recConf: marked ? 'sure' : null,
    recResult: base === 'recall' && marked ? { score: 0.5, feedback: 'The core is right: what it is against how it is now. One gap: where a thing is takes estar, but where an event takes place takes ser, so "permanent" is not quite the test.' } : null,
    pracPicked: base === 'practice' ? 0 : null,
    pracText: '',
    pracConf: base === 'practice' ? 'sure' : null,
    pracResult: base === 'practice' && marked ? { score: 0, feedback: 'Not this one. The answer is "está". The coffee\'s temperature is how it is right now, so estar.' } : null,
    chat: [],
    chatDraft: '',
    chatInput: '',
    chatTurns: 0,
    debrief: null,
    summary: base === 'done' ? { added: 4, firstDue: Date.now() + 86400000, minutes: 19, correct: 3, asked: 5, sure: 3, sureRight: 2, taught: true, roleplay: null, motorPending: false, mastered: true } : null,
    revision: null,
  };
  const L = { checked: marked, warm, data: LESSON, prac, rec: { idx: 0, items: [{ key: 'recall', prompt: LESSON.recall, answer: LESSON.recallAnswer }, { key: 'why', prompt: LESSON.why, answer: LESSON.whyAnswer }] }, teach: { turns: 0 } };
  return {
    s, L, topic: s.topic, currentItem: LESSON.practice[1], resumed: step === 'practice', restart: noop,
    setWarmAnswer: noop, checkWarm: noop, skipWarm: noop, toLearn: noop, toRecall: noop, setRecText: noop, setRecConf: noop, checkRecall: noop, nextRecall: noop,
    setPracPicked: noop, setPracText: noop, setPracConf: noop, checkPractice: noop, nextPractice: noop, setChatInput: noop, sendChat: noop, endRoleplay: noop, finish: noop, retryLesson: noop, clearError: noop,
  } as unknown as SessionApi;
}

function SessionPreview({ step }: { step: string }) {
  const { spacing } = useTheme();
  const S = mockSession(step);
  const base = step.replace('-marked', '');
  return (
    <Screen scroll width="reading">
      <View style={{ gap: 2 }}>
        <Text variant="eyebrow" color="textMuted">
          Brazilian Portuguese
        </Text>
        <Text variant="title">Ser and estar</Text>
      </View>
      <StepStrip S={S} />
      <View style={{ marginTop: spacing.xl, flex: 1 }}>
        {base === 'warm' ? <WarmStep S={S} /> : null}
        {base === 'learn' ? <LearnStep S={S} /> : null}
        {base === 'recall' ? <RecallStep S={S} /> : null}
        {base === 'practice' ? <PracticeStep S={S} item={S.currentItem} /> : null}
        {base === 'done' ? <DoneStep S={S} onClose={() => {}} /> : null}
      </View>
    </Screen>
  );
}

export default function PreviewScreen() {
  const { screen, built, subject, step } = useLocalSearchParams<{ screen?: string; built?: string; subject?: string; step?: string }>();
  const { spacing } = useTheme();
  const subj = useMemo(fixtureSubject, []);
  if (!__DEV__) return <Redirect href="/" />;

  if (screen === 'place') {
    if (built) {
      const plan = { v: 4, ...planPortuguese, title: subject || planPortuguese.title } as unknown as Plan;
      seedBuildForPreview({ subject: subject || 'Brazilian Portuguese', target: 's3', current: 'Know a little', hours: 2, minutes: 15, background: '', why: '' }, plan);
    }
    return <PlaceScreen />;
  }
  if (screen === 'goal') return <GoalScreen />;
  if (screen === 'session') return <SessionPreview step={step || 'learn'} />;
  if (screen === 'path') {
    return (
      <Screen scroll>
        <SubjectPath subj={subj} onOpenTopic={() => {}} />
      </Screen>
    );
  }
  if (screen === 'empty') {
    return <LearnView subjects={[]} loading={false} onStart={() => {}} onOpenSubject={() => {}} onAddSubject={() => {}} />;
  }
  if (screen === 'learn') {
    return <LearnView subjects={[subj]} loading={false} onStart={() => {}} onOpenSubject={() => {}} onAddSubject={() => {}} />;
  }
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <Text variant="title">Preview</Text>
      <View style={{ gap: spacing.xs }}>
        {['learn', 'empty', 'path', 'goal', 'place', 'session&step=warm', 'session&step=learn', 'session&step=recall', 'session&step=practice', 'session&step=practice-marked', 'session&step=done'].map((s) => (
          <Text key={s} variant="body">
            /preview?screen={s}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

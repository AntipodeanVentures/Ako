// Fixtures copied from the artifact's test mock (test/mock.js), so the engine tests check the same shapes the app was tested against.
const stagesExtra = (i) => ({ basis: ['CEFR A1', 'CEFR A2 to B1', 'CEFR B2', 'CEFR C1', 'CEFR C2'][i], outcomes: [['greet someone and ask how they are', 'introduce yourself'], ['describe your day', 'order in a restaurant'], ['debate a topic'], ['write a formal letter'], ['teach the language']][i], external: ['Take a CEFR A1 practice test', 'Take a CEFR A2 practice test', 'Take a CEFR B2 practice test', '', ''][i] });
const stages = [
  { id: 's1', means: 'Greet people and ask simple questions.', equivalent: 'CEFR A1', hours: 60 },
  { id: 's2', means: 'Hold everyday conversations about work, family and training.', equivalent: 'CEFR A2 to B1', hours: 300 },
  { id: 's3', means: 'Follow fast native speech and debate topics.', equivalent: 'CEFR B2', hours: 800 },
  { id: 's4', means: 'Write and speak with near-native precision.', equivalent: 'CEFR C1', hours: 1500 },
  { id: 's5', means: 'Research or teach the language at university level.', equivalent: 'CEFR C2 plus academic work', hours: 4000 }
];
export const planPortuguese = {
  title: 'Brazilian Portuguese', subjectType: 'language', language: 'pt-BR',
  summary: 'Build a core of high-frequency words and sentence patterns, then speak early with a tutor who prompts self-correction.',
  stages: stages.map((s, i) => Object.assign({}, s, stagesExtra(i))),
  rules: ['Learn new words in small related sets.', 'Speak from week one with a tutor who prompts you to self-correct.', 'Listen daily to material you mostly understand.', 'Review sentence cards in both directions.'],
  milestones: [{ id: 'A', title: 'Survive a first conversation', test: 'Introduce yourself and ask 5 questions', stage: 's1' }, { id: 'B', title: 'Talk about your day', test: 'Describe yesterday for 2 minutes', stage: 's2' }],
  topics: [
    { id: 'p1', title: 'Sounds and nasal vowels', summary: 'How Brazilian Portuguese sounds differ from Spanish and English.', kind: 'concept', stage: 's1', milestone: 'A', prereqs: [], minutes: 25 },
    { id: 'p2', title: 'Greetings and introductions', summary: 'Say hello, give your name, ask how someone is.', kind: 'vocabulary', stage: 's1', milestone: 'A', prereqs: ['p1'], minutes: 30 },
    { id: 'p3', title: 'Present tense of -ar verbs', summary: 'Conjugate regular -ar verbs for everyday actions.', kind: 'procedure', stage: 's1', milestone: 'A', prereqs: ['p2'], minutes: 35, threshold: true, outcome: 1 },
    { id: 'p4', title: 'Ser and estar', summary: 'The two verbs for "to be" and when to use each.', kind: 'concept', stage: 's2', milestone: 'B', prereqs: ['p3'], minutes: 40 },
    { id: 'p5', title: 'Past tense for telling stories', summary: 'Use the preterite to say what you did.', kind: 'procedure', stage: 's2', milestone: 'B', prereqs: ['p4', 'zz'], minutes: 40 },
    { id: 'p6', title: 'Gym and training vocabulary', summary: 'Words for training, positions and coaching.', kind: 'vocabulary', stage: 's2', milestone: 'B', prereqs: ['p2'], minutes: 30 }
  ],
  resources: [{ title: 'Pimsleur Portuguese (Brazilian)', creator: 'Pimsleur', type: 'course', why: 'Audio drills for speaking early', search: 'Pimsleur Brazilian Portuguese' }],
  safety: []
};
export const planJudo = {
  title: 'Judo throws', subjectType: 'physical', language: null, summary: 'Learn grips, balance-breaking and two core throws.',
  stages: stages.map((s, i) => ({ id: s.id, means: ['Fall safely and drill one throw', 'Throw a resisting partner', 'Chain throws at pace', 'Coach others', 'Elite competition and coaching science'][i], equivalent: ['yellow belt', 'orange to green belt', 'brown belt', 'black belt', 'national coach'][i], hours: [50, 200, 800, 2000, 6000][i] })),
  rules: ['Drill briefly, then practise in varied situations.'],
  milestones: [{ id: 'm1', title: 'Throw in cooperative drills', test: 'Ten clean O-soto-gari on each side', stage: 's1' }],
  topics: [
    { id: 't1', title: 'Breakfalls (ukemi)', summary: 'Fall safely backwards and to the side.', kind: 'motor', stage: 's1', milestone: 'm1', prereqs: [], minutes: 30 },
    { id: 't2', title: 'Kuzushi: breaking balance', summary: 'Move your partner off balance before throwing.', kind: 'concept', stage: 's1', milestone: 'm1', prereqs: ['t1'], minutes: 30 },
    { id: 't3', title: 'O-soto-gari', summary: 'Major outer reap.', kind: 'motor', stage: 's1', milestone: 'm1', prereqs: ['t2'], minutes: 40 }
  ],
  resources: [], safety: ['Learn breakfalls with a qualified coach before throwing practice.']
};
export const planNegotiation = {
  title: 'Negotiation', subjectType: 'interpersonal', language: null, summary: 'Learn to prepare, listen and trade.',
  stages: stages.map((s, i) => ({ id: s.id, means: 'Negotiation at level ' + (i + 1), equivalent: '', basis: 'no formal framework', outcomes: ['open a negotiation well'], external: '', hours: [30, 100, 300, 800, 2000][i] })),
  rules: ['Practise out loud.'],
  milestones: [{ id: 'm1', title: 'Hold a tough conversation', test: 'Negotiate a rent reduction in a role-play', stage: 's1' }],
  topics: [
    { id: 'n1', title: 'Opening a negotiation', summary: 'Set the tone and anchor.', kind: 'roleplay', stage: 's1', milestone: 'm1', prereqs: [], minutes: 30 },
    { id: 'n2', title: 'Listening for interests', summary: 'Hear what they need.', kind: 'concept', stage: 's1', milestone: 'm1', prereqs: ['n1'], minutes: 30 },
    { id: 'n3', title: 'Trading concessions', summary: 'Give to get.', kind: 'roleplay', stage: 's1', milestone: 'm1', prereqs: ['n2'], minutes: 30 }
  ],
  resources: [], safety: []
};
export function lesson(kind) {
  return {
    concepts: ['Verb endings', 'Subject pronouns'],
    scenario: kind === 'roleplay' ? { setting: 'You are meeting your landlord about the rent.', yourRole: 'the tenant', claudeRole: 'a landlord who is friendly but firm', goal: 'Open calmly and set out what you want.', criteria: ['Opens with rapport', 'States the goal clearly', 'Asks a question before proposing'], opener: 'Thanks for coming in. What did you want to talk about?' } : null,
    bridge: 'You already greet training partners every day; this builds on that.',
    compare: { a: 'Case A: Ana says "bom dia" at 9am.', b: 'Case B: Ana says "boa noite" at 9pm.', question: 'What do these share, and what makes the difference?', answer: 'Both are greetings; the time of day picks the word.' },
    sections: [{ heading: 'The core idea', paragraphs: ['Paragraph one explains the idea with an example.', 'Paragraph two links it to what you know.'], points: ['Point A', 'Point B'] }, { heading: 'In practice', paragraphs: ['A concrete example.'] }],
    workedExample: { problem: 'Conjugate falar for eu.', steps: ['Drop -ar', 'Add -o'], gaps: [1], answer: 'falo' },
    mistakes: ['Mixing up ser and estar.'],
    recall: 'Explain the core idea in your own words.', recallAnswer: 'A model answer.',
    why: 'Why does the ending change?', whyAnswer: 'Because the ending marks the person.',
    practice: [
      { type: 'mcq', difficulty: 1, concept: 0, prompt: 'MCQ one?', options: ['wrong', 'right', 'wrong', 'wrong'], answer: 1, explanation: 'Because.' },
      { type: 'short', difficulty: 2, concept: 1, prompt: 'Short one?', answer: 'right', explanation: 'Because.' },
      { type: 'mcq', difficulty: 3, concept: 0, mix: true, prompt: 'MCQ two?', options: ['right', 'wrong', 'wrong', 'wrong'], answer: 0, explanation: 'Because.' },
      { type: 'mcq', difficulty: 4, concept: 1, prompt: 'MCQ three?', options: ['wrong', 'wrong', 'right', 'wrong'], answer: 2, explanation: 'Because.' },
      { type: 'mcq', prompt: 'MCQ bad', options: ['only one'], answer: 3 }
    ],
    cards: [{ front: 'How do you say "good morning"?', back: 'Bom dia', concept: 0 }, { front: 'Conjugate falar (eu)', back: 'falo', concept: 1 }, { front: 'Empty', back: '' }],
    drill: kind === 'motor' ? { steps: ['Sit, roll back, slap the mat'], dose: '3 sets of 10', checks: ['Chin tucked', 'Slap at 45 degrees', 'Exhale on impact'], cues: ['Aim the slap at a spot on the mat'], feedback: 'Check form every fifth rep, then every tenth.', imagery: 'Picture the roll.', safety: 'Use a mat.' } : null,
    resources: [{ title: 'Some book', creator: 'Someone', search: 'some book' }]
  };
}

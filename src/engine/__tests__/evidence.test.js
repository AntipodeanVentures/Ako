import { describe, expect, it } from 'vitest';

import {
  EVIDENCE, evidenceById,
  CRITERION, HARD, BAND_TARGET, LEVEL_PASS, LEVEL_DELAY, RELEARN_TARGET, ROLE_LEVEL_GOOD, PITCH, SUPPORT, relearnTarget,
  PROBE_FIRST_DAYS, PROBE_FIRST_TARGET, PROBE_SECOND_GAP, MIXED_MIN_LEARNED, MIXED_EVERY_LEARNED, calibrateFromProbes,
  METHOD, warmupPrompt, lessonPrompt, practicePrompt, gradePrompt, planPrompt, reviewPlanPrompt, normalisePlan,
} from '../index.js';
import { planPortuguese } from '../fixtures.js';

// The method is held to the literature it cites (docs/evidence-base.md). If a constant or a prompt
// rule drifts, this names the principle and the paper rather than letting the change pass quietly.

const intake = { subject: 'Brazilian Portuguese', current: 'Know a little', target: 's3', hours: 2, minutes: 15, why: 'travel' };
const plan = normalisePlan(planPortuguese, intake, 's2');
// One earlier topic learned, so the prompts that mix in earlier topics have something to mix.
const subj = { id: 'x', plan, intake, topicState: { [plan.topics[0].id]: { status: 'mastered', masteredAt: Date.now() - 86400000 } }, stages: {}, concepts: {}, stats: {}, pitch: 2, support: 'full', learner: { about: '', model: null }, cards: [] };
const topic = plan.topics[1];
const warm = { warm: { questions: [{ q: 'Q?', a: 'A' }] }, answers: [{ text: 'a guess' }] };
const lesson = { concepts: ['a', 'b'], sections: [{ heading: 'h', paragraphs: ['p'], points: [] }], bridge: 'b', mistakes: [] };

// What the engine actually does, keyed the way the ledger names it.
const actual = {
  RETENTION_DEFAULT: 0.9,
  PROBE_FIRST_DAYS, PROBE_FIRST_TARGET, PROBE_SECOND_GAP,
  CRITERION, RELEARN_TARGET,
  CALIBRATION_TIGHT: calibrateFromProbes({ stats: { probe: { ok: 7, n: 10 } } }).retention,
  CALIBRATION_TIGHTER: calibrateFromProbes({ stats: { probe: { ok: 5, n: 10 } } }).retention,
  BAND_TARGET, HARD,
  SUPPORT_LEVELS: Object.keys(SUPPORT),
  TERMS_COMPLETE_BEGINNER: PITCH[1].terms, TERMS_BEGINNER: PITCH[2].terms,
  THRESHOLD_EXTRA_RELEARN: relearnTarget({ threshold: true }) - relearnTarget({ threshold: false }),
  MIXED_MIN_LEARNED, MIXED_EVERY_LEARNED,
  LEVEL_PASS, LEVEL_DELAY, ROLE_LEVEL_GOOD,
};
const prompts = {
  METHOD,
  warmupPrompt: warmupPrompt(subj, topic),
  lessonPrompt: lessonPrompt(subj, topic, {}),
  practicePrompt: practicePrompt(subj, topic, lesson, warm),
  gradePrompt: gradePrompt('Test', [{ prompt: 'q', answer: 'a', response: 'r' }], undefined),
  planPrompt: planPrompt(intake, 's2'),
  reviewPlanPrompt: reviewPlanPrompt(plan, intake),
};

describe('the method matches the evidence ledger', () => {
  for (const e of EVIDENCE) {
    it(`${e.id}: ${e.principle} (${e.sources.join('; ')})`, () => {
      for (const [k, v] of Object.entries(e.params || {})) {
        expect(actual, `${k} is not in the engine's actual table`).toHaveProperty(k);
        expect(actual[k], `${k} drifted from ${e.sources[0]}`).toEqual(v);
      }
      for (const [name, phrases] of Object.entries(e.prompts || {})) {
        expect(prompts, `${name} is not a prompt the test builds`).toHaveProperty(name);
        for (const ph of phrases) expect(prompts[name], `${name} no longer says "${ph}" (${e.sources[0]})`).toContain(ph);
      }
    });
  }
  it('every principle names at least one source and the ledger is addressable', () => {
    for (const e of EVIDENCE) expect(e.sources.length).toBeGreaterThan(0);
    expect(evidenceById('relearning').params.CRITERION).toBe(3);
    expect(evidenceById('nope')).toBeNull();
  });
});

// plan: writes a learning plan for a subject, then runs the critic pass, and returns the normalised plan.
// Streams the draft as it arrives so the app can show the outline while the critic works.
//
// Request: { intake: { subject, target, current, hours, background, why, syllabus, role? }, coverTo: 's2' }
// Response: ndjson events: text deltas, then { type: 'done', data: { plan } }

import { planPrompt, reviewPlanPrompt, normalisePlan, METHOD } from '../../../src/engine/index.js';
import { CORS, errorResponse, requireCaller } from '../_shared/auth.ts';
import { MODELS } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';
import { ndjsonStream } from '../_shared/stream.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    await checkLimit(caller, 'plan');
    const { intake, coverTo } = await req.json();
    // The learner's confirmed background travels with the request; the engine reads intake.about.
    const { data: prof } = await caller.admin.from('profiles').select('about').eq('id', caller.profileId).maybeSingle();
    const fullIntake = { ...intake, about: prof?.about ?? '' };

    return ndjsonStream(async (emit) => {
      const draft = await sample({ model: MODELS.frontier, system: METHOD, prompt: planPrompt(fullIntake, coverTo), maxTokens: 8000, onText: (delta) => emit({ type: 'text', delta }) });
      await recordUsage(caller, 'plan', draft.inputTokens, draft.outputTokens);
      let plan = normalisePlan(parseJson(draft.text), fullIntake, coverTo);
      emit({ type: 'draft', data: { plan } });
      // The critic reads the draft against the learner and the level definitions and returns a corrected plan.
      try {
        const review = await sample({ model: MODELS.frontier, system: METHOD, prompt: reviewPlanPrompt(plan, fullIntake), maxTokens: 8000 });
        await recordUsage(caller, 'plan', review.inputTokens, review.outputTokens);
        const reviewed = parseJson(review.text) as { changes?: string[] };
        const corrected = normalisePlan(reviewed, fullIntake, coverTo);
        corrected.changes = Array.isArray(reviewed.changes) ? reviewed.changes.slice(0, 12) : [];
        plan = corrected;
      } catch (e) {
        console.error('critic pass failed, keeping the draft', e);
      }
      emit({ type: 'done', data: { plan } });
    });
  } catch (e) {
    return errorResponse(e);
  }
});

// plan: writes a learning plan for a subject and returns the normalised draft.
// Streams the text as it arrives so the app can show the outline growing.
//
// Request: { intake: { subject, target, current, hours, background, why, syllabus, role? }, coverTo: 's2' }
// Response: ndjson events: text deltas, then { type: 'done', data: { plan } }
//
// The critic pass is a separate request, so neither call runs near the
// platform's wall-clock limit (150 s on the free plan; each pass alone can
// take over a minute): { kind: 'review', intake, coverTo, plan }
// Response: JSON { plan } (the corrected plan, with "changes").
//
// Extending to the next level: { kind: 'extend', subject, stageId: 's3' }
// Response: JSON { extension: { milestones, topics } }, to append to the plan.

import { planPrompt, reviewPlanPrompt, normalisePlan, extendPrompt, normaliseExtension, METHOD } from '../_shared/engine/index.js';
import { CORS, HttpError, errorResponse, json, requireCaller } from '../_shared/auth.ts';
import { MODELS } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';
import { ndjsonStream } from '../_shared/stream.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    await checkLimit(caller, 'plan');
    const body = await req.json();
    if (body.kind === 'extend') {
      const subject = body.subject;
      if (!subject || !body.stageId) throw new HttpError(400, 'bad_request', 'Subject and stage are required.');
      const { data: prof } = await caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle();
      subject.learner = { about: prof?.about ?? '', model: prof?.model ?? null };
      const r = await sample({ model: MODELS.frontier, system: METHOD, prompt: extendPrompt(subject, body.stageId), maxTokens: 12000 });
      await recordUsage(caller, 'plan', r.inputTokens, r.outputTokens);
      const extension = normaliseExtension(parseJson(r.text, r.stopReason), subject.plan, body.stageId);
      return json({ extension });
    }
    const { intake, coverTo } = body;
    if (!intake?.subject) throw new HttpError(400, 'bad_request', 'Tell us what you want to learn.');
    // The learner's confirmed background travels with the request; the engine reads intake.about.
    const { data: prof } = await caller.admin.from('profiles').select('about').eq('id', caller.profileId).maybeSingle();
    const fullIntake = { ...intake, about: prof?.about ?? '' };

    if (body.kind === 'review') {
      // The critic reads the draft against the learner and the level definitions and returns a corrected plan.
      if (!body.plan) throw new HttpError(400, 'bad_request', 'A draft plan is required.');
      const review = await sample({ model: MODELS.frontier, system: METHOD, prompt: reviewPlanPrompt(body.plan, fullIntake), maxTokens: 16000 });
      await recordUsage(caller, 'plan', review.inputTokens, review.outputTokens);
      const reviewed = parseJson(review.text, review.stopReason) as { changes?: string[] };
      const corrected = normalisePlan(reviewed, fullIntake, coverTo);
      corrected.changes = Array.isArray(reviewed.changes) ? reviewed.changes.slice(0, 12) : [];
      return json({ plan: corrected });
    }

    return ndjsonStream(async (emit) => {
      const draft = await sample({ model: MODELS.frontier, system: METHOD, prompt: planPrompt(fullIntake, coverTo), maxTokens: 16000, onText: (delta) => emit({ type: 'text', delta }) });
      await recordUsage(caller, 'plan', draft.inputTokens, draft.outputTokens);
      const plan = normalisePlan(parseJson(draft.text, draft.stopReason), fullIntake, coverTo);
      emit({ type: 'done', data: { plan } });
    });
  } catch (e) {
    return errorResponse(e);
  }
});

// plan: writes a learning plan for a subject and returns the normalised draft.
// Streams the text as it arrives so the app can show the outline growing.
//
// Request: { intake: { subject, target, current, hours, background, why, context?, syllabus, role? }, coverTo: 's2' }
// Response: ndjson events: text deltas, then { type: 'done', data: { plan } }
//
// The critic pass is a separate request, so neither call runs near the
// platform's wall-clock limit (150 s on the free plan; each pass alone can
// take over a minute): { kind: 'review', intake, coverTo, plan, subjectId? }
// Response: JSON { plan } (the corrected plan, with "changes").
//
// Both passes, and 'extend', are told what the learner's other subjects on
// the app already cover (loadElsewhere), so related subjects do not each
// re-teach the same basics. The draft's own saved row is left out by
// `subjectId` on the review pass.
//
// Extending to the next level: { kind: 'extend', subject, stageId: 's3' }
// Response: JSON { extension: { milestones, topics } }, to append to the plan.
//
// Revising the path from evidence: { kind: 'adapt', subject, reason, note?, evidence? }
// Response: JSON { adaptation: { topics, milestones, notes } }, the new topic list to
// replace the plan's, with one note per change (empty when nothing changed).

import { planPrompt, reviewPlanPrompt, normalisePlan, extendPrompt, normaliseExtension, adaptPrompt, normaliseAdaptation, METHOD, str } from '../_shared/engine/index.js';
import { CORS, HttpError, errorResponse, json, requireCaller } from '../_shared/auth.ts';
import { modelFor } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';
import { ndjsonStream } from '../_shared/stream.ts';
import { loadElsewhere } from '../_shared/subject.ts';

// What the other subjects cover is context, never a reason to fail a build.
async function elsewhereOrNone(admin: Parameters<typeof loadElsewhere>[0], profileId: string, excludeId?: string | null, excludeTitle?: string | null) {
  try {
    return await loadElsewhere(admin, profileId, excludeId, excludeTitle);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    await checkLimit(caller, 'plan');
    const body = await req.json();
    if (body.kind === 'extend') {
      const subject = body.subject;
      if (!subject || !body.stageId) throw new HttpError(400, 'bad_request', 'Subject and stage are required.');
      const [{ data: prof }, elsewhere] = await Promise.all([
        caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle(),
        elsewhereOrNone(caller.admin, caller.profileId, subject.id),
      ]);
      subject.learner = { about: prof?.about ?? '', model: prof?.model ?? null };
      subject.intake = { ...(subject.intake ?? {}), elsewhere };
      const r = await sample({ model: modelFor('extend'), system: METHOD, prompt: extendPrompt(subject, body.stageId), maxTokens: 12000 });
      await recordUsage(caller, 'plan', r.inputTokens, r.outputTokens);
      const extension = normaliseExtension(parseJson(r.text, r.stopReason), subject.plan, body.stageId);
      return json({ extension });
    }
    if (body.kind === 'adapt') {
      const subject = body.subject;
      if (!subject?.plan) throw new HttpError(400, 'bad_request', 'Subject is required.');
      const { data: prof } = await caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle();
      subject.learner = { about: prof?.about ?? '', model: prof?.model ?? null };
      const ctx = { reason: str(body.reason, 400) || 'A routine look at the path.', note: str(body.note, 600), evidence: str(body.evidence, 3000) };
      const r = await sample({ model: modelFor('adapt'), system: METHOD, prompt: adaptPrompt(subject, ctx), maxTokens: 4000 });
      await recordUsage(caller, 'plan', r.inputTokens, r.outputTokens);
      const adaptation = normaliseAdaptation(parseJson(r.text, r.stopReason), subject.plan, subject);
      return json({ adaptation });
    }
    const { intake, coverTo } = body;
    if (!intake?.subject) throw new HttpError(400, 'bad_request', 'Tell us what you want to learn.');
    // The learner's confirmed background travels with the request (the engine reads intake.about),
    // as does what their other subjects already cover (intake.elsewhere). Neither is stored on the
    // subject: the client saves its own intake, and both are re-read fresh on every pass.
    const [{ data: prof }, elsewhere] = await Promise.all([
      caller.admin.from('profiles').select('about').eq('id', caller.profileId).maybeSingle(),
      elsewhereOrNone(caller.admin, caller.profileId, typeof body.subjectId === 'string' ? body.subjectId : null, [body.plan?.title, intake.subject].find((t) => typeof t === 'string' && t.trim()) ?? null),
    ]);
    const fullIntake = { ...intake, context: str(intake.context, 2000), about: prof?.about ?? '', elsewhere };

    if (body.kind === 'review') {
      // The critic reads the draft against the learner and the level definitions and returns a corrected plan.
      if (!body.plan) throw new HttpError(400, 'bad_request', 'A draft plan is required.');
      const review = await sample({ model: modelFor('review'), system: METHOD, prompt: reviewPlanPrompt(body.plan, fullIntake), maxTokens: 16000 });
      await recordUsage(caller, 'plan', review.inputTokens, review.outputTokens);
      const reviewed = parseJson(review.text, review.stopReason) as { changes?: string[] };
      const corrected = normalisePlan(reviewed, fullIntake, coverTo);
      corrected.changes = Array.isArray(reviewed.changes) ? reviewed.changes.slice(0, 12) : [];
      return json({ plan: corrected });
    }

    return ndjsonStream(async (emit) => {
      const draft = await sample({ model: modelFor('plan'), system: METHOD, prompt: planPrompt(fullIntake, coverTo), maxTokens: 16000, onText: (delta) => emit({ type: 'text', delta }) });
      await recordUsage(caller, 'plan', draft.inputTokens, draft.outputTokens);
      const plan = normalisePlan(parseJson(draft.text, draft.stopReason), fullIntake, coverTo);
      emit({ type: 'done', data: { plan } });
    });
  } catch (e) {
    return errorResponse(e);
  }
});

// extract: the calls that read the learner's own material or map a goal, none of which store anything by themselves.
//
// Request: { kind: 'know', material: string, fromPhoto?: boolean, image?: { mediaType, dataBase64 } }   -> items to confirm
//        | { kind: 'start', subject: string }                                                             -> a suggested starting point
//        | { kind: 'role', title: string, description?: string }                                          -> a role map
//        | { kind: 'model', subject, topicId, evidence }                                                   -> learner model update
//        | { kind: 'intake', subject, current, target, minutes }                                           -> up to three questions to ask before the plan
// Response: JSON

import {
  knowPrompt, startPrompt, rolePrompt, modelPrompt, intakePrompt, normaliseKnow, normaliseStart, normaliseRole, normaliseModel, normaliseIntake, topicById, METHOD, str,
} from '../_shared/engine/index.js';
import { CORS, errorResponse, json, requireCaller, HttpError } from '../_shared/auth.ts';
import { MODELS } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    await checkLimit(caller, 'extract');
    const body = await req.json();
    const { data: prof } = await caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle();
    const about = prof?.about ?? '';

    if (body.kind === 'know') {
      const material = str(body.material, 12000);
      if (!material && !body.image) throw new HttpError(400, 'bad_request', 'Nothing to read.');
      const r = await sample({ model: MODELS.mid, prompt: knowPrompt(material, Boolean(body.image)), images: body.image ? [body.image] : undefined, maxTokens: 1800 });
      await recordUsage(caller, 'extract', r.inputTokens, r.outputTokens);
      return json({ know: normaliseKnow(parseJson(r.text, r.stopReason)) });
    }
    if (body.kind === 'start') {
      const r = await sample({ model: MODELS.small, prompt: startPrompt(str(body.subject, 160), about), maxTokens: 600 });
      await recordUsage(caller, 'extract', r.inputTokens, r.outputTokens);
      return json({ start: normaliseStart(parseJson(r.text, r.stopReason)) });
    }
    if (body.kind === 'intake') {
      const subject = str(body.subject, 160);
      if (!subject) throw new HttpError(400, 'bad_request', 'Tell us what you want to learn.');
      // The mid model: choosing which questions matter for a subject is a judgement call, and it still answers in a few seconds.
      const r = await sample({ model: MODELS.mid, prompt: intakePrompt(subject, str(body.current, 40) || 'Know a little', str(body.target, 4) || 's3', Number(body.minutes) || 15, about), maxTokens: 900 });
      await recordUsage(caller, 'extract', r.inputTokens, r.outputTokens);
      return json({ intake: normaliseIntake(parseJson(r.text, r.stopReason)) });
    }
    if (body.kind === 'role') {
      const r = await sample({ model: MODELS.frontier, system: METHOD, prompt: rolePrompt(str(body.title, 140), str(body.description, 6000), about), maxTokens: 3000 });
      await recordUsage(caller, 'extract', r.inputTokens, r.outputTokens);
      return json({ role: normaliseRole(parseJson(r.text, r.stopReason)) });
    }
    if (body.kind === 'model') {
      const subject = body.subject;
      subject.learner = { about, model: prof?.model ?? null };
      const topic = topicById(subject, body.topicId);
      const r = await sample({ model: MODELS.small, prompt: modelPrompt(subject, topic, body.evidence), maxTokens: 700 });
      await recordUsage(caller, 'extract', r.inputTokens, r.outputTokens);
      return json({ model: normaliseModel(parseJson(r.text, r.stopReason)) });
    }
    throw new HttpError(400, 'bad_request', 'Unknown kind.');
  } catch (e) {
    return errorResponse(e);
  }
});

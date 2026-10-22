// grade: marks answers (practice, recall, reviews), level checks, role-play debriefs and photo form checks.
//
// Request: { kind: 'answers', title, items: [{ prompt, answer, response, conf? }], mode? }
//        | { kind: 'check', subject, topicIds: string[], stageId? }        (writes the check questions)
//        | { kind: 'debrief', subject, topicId, scenario, transcript }
//        | { kind: 'photo', subject, topicId, drill, image: { mediaType, dataBase64 } }
// Response: JSON

import { placementPrompt,
  gradePrompt, checkPrompt, debriefPrompt, formCheckPrompt, normaliseDebrief, topicById, METHOD, arr, str,
} from '../_shared/engine/index.js';
import { CORS, errorResponse, json, requireCaller, HttpError } from '../_shared/auth.ts';
import { modelFor } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    await checkLimit(caller, 'grade');
    const body = await req.json();

    if (body.kind === 'answers') {
      const items = arr(body.items).slice(0, 12);
      const r = await sample({ model: modelFor('grade'), system: METHOD, prompt: gradePrompt(str(body.title, 160), items, body.mode), maxTokens: 1800 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      const raw = parseJson(r.text, r.stopReason) as { results?: { score?: number; feedback?: string }[] };
      const results = arr(raw && raw.results).slice(0, items.length).map((x) => ({ score: Math.max(0, Math.min(1, Number(x && x.score) || 0)), feedback: str(x && x.feedback, 600) }));
      while (results.length < items.length) results.push({ score: 0, feedback: '' });
      return json({ results });
    }

    const subject = body.subject;
    if (!subject) throw new HttpError(400, 'bad_request', 'Subject is required.');
    const { data: prof } = await caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle();
    subject.learner = { about: prof?.about ?? '', model: prof?.model ?? null };

    if (body.kind === 'placement') {
      // Skip what you already know: eight to ten questions across the plan, basic to advanced. The frontier model
      // writes them because they decide what the learner never sees.
      const r = await sample({ model: modelFor('placement'), system: METHOD, prompt: placementPrompt(subject), maxTokens: 4000 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      return json({ placement: parseJson(r.text, r.stopReason) });
    }
    if (body.kind === 'check') {
      const topics = arr(body.topicIds).map((id: string) => topicById(subject, id)).filter(Boolean);
      if (!topics.length) throw new HttpError(400, 'bad_request', 'No topics to check.');
      const r = await sample({ model: modelFor('check'), system: METHOD, prompt: checkPrompt(subject, topics, body.stageId), maxTokens: 4000 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      return json({ check: parseJson(r.text, r.stopReason) });
    }

    if (body.kind === 'debrief') {
      const topic = topicById(subject, body.topicId);
      const r = await sample({ model: modelFor('debrief'), system: METHOD, prompt: debriefPrompt(subject, topic, body.scenario, str(body.transcript, 12000)), maxTokens: 1500 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      return json({ debrief: normaliseDebrief(parseJson(r.text, r.stopReason), arr(body.scenario && body.scenario.criteria).length || 3) });
    }

    if (body.kind === 'photo') {
      const topic = topicById(subject, body.topicId);
      const im = body.image;
      if (!im || !im.dataBase64) throw new HttpError(400, 'bad_request', 'No photo.');
      // The image is forwarded to the model and never stored.
      const r = await sample({ model: modelFor('photo'), system: METHOD, prompt: formCheckPrompt(subject, topic, body.drill), images: [im], maxTokens: 800 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      return json({ feedback: r.text });
    }

    throw new HttpError(400, 'bad_request', 'Unknown kind.');
  } catch (e) {
    return errorResponse(e);
  }
});

// tutor: one turn of the tutor, the teach-back "student", or a role-play character. Streams the reply.
//
// Request: { subject, topicId, lesson?, mode: 'tutor' | 'student' | 'roleplay', scenario?, messages: [{ role, content }] }
// Response: ndjson events: text deltas, then { type: 'done', data: { text } }

import { tutorRules, topicById, METHOD, arr, str } from '../_shared/engine/index.js';
import { CORS, errorResponse, requireCaller, HttpError } from '../_shared/auth.ts';
import { modelFor } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { sample } from '../_shared/anthropic.ts';
import { ndjsonStream } from '../_shared/stream.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    await checkLimit(caller, 'tutor');
    const body = await req.json();
    const subject = body.subject;
    if (!subject) throw new HttpError(400, 'bad_request', 'Subject is required.');
    const { data: prof } = await caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle();
    subject.learner = { about: prof?.about ?? '', model: prof?.model ?? null };
    const topic = body.topicId ? topicById(subject, body.topicId) : null;
    const rules = tutorRules(subject, topic, body.lesson ?? null, body.mode ?? 'tutor', body.scenario ?? null);
    // The transcript is capped so a long role-play cannot run away with tokens.
    const messages = arr(body.messages).slice(-24).map((m: { role: string; content: string }) => ({ role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user', content: str(m.content, 4000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw new HttpError(400, 'bad_request', 'The last message must be from the learner.');

    return ndjsonStream(async (emit) => {
      const r = await sample({ model: modelFor('tutor'), system: METHOD + '\n\n' + rules, prompt: messages, maxTokens: 900, onText: (delta) => emit({ type: 'text', delta }) });
      await recordUsage(caller, 'tutor', r.inputTokens, r.outputTokens);
      emit({ type: 'done', data: { text: r.text } });
    });
  } catch (e) {
    return errorResponse(e);
  }
});

// lesson: the warm-up, the lesson itself, or more practice for a topic. Lessons are cached per topic and level;
// the personal layer is generated per learner on top of the cached canonical lesson.
//
// Request: { kind: 'warm' | 'lesson' | 'more', subject: SubjectContext, topicId, ctx?: { warm, answers }, used?: string[], ability?: number }
// Response: ndjson events: text deltas, then { type: 'done', data: { warm | lesson | practice, cached } }

import {
  lessonPrompt, morePracticePrompt, warmupPrompt, normaliseLesson, normaliseWarm, normQ, topicById, pitchOf, METHOD, arr,
} from '../_shared/engine/index.js';
import { CORS, errorResponse, requireCaller, HttpError } from '../_shared/auth.ts';
import { cacheKey, readCache, writeCache } from '../_shared/cache.ts';
import { MODELS } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';
import { ndjsonStream } from '../_shared/stream.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    const body = await req.json();
    const { kind, subject, topicId } = body;
    const topic = topicById(subject, topicId);
    if (!topic) throw new HttpError(400, 'bad_request', 'Unknown topic.');
    // Attach the learner's context the engine expects (see src/engine/README.md).
    const { data: prof } = await caller.admin.from('profiles').select('about, model').eq('id', caller.profileId).maybeSingle();
    subject.learner = { about: prof?.about ?? '', model: prof?.model ?? null };

    if (kind === 'warm') {
      const r = await sample({ model: MODELS.mid, system: METHOD, prompt: warmupPrompt(subject, topic), maxTokens: 1500 });
      await recordUsage(caller, 'lesson', r.inputTokens, r.outputTokens);
      return new Response(JSON.stringify({ warm: normaliseWarm(parseJson(r.text, r.stopReason)) }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (kind === 'more') {
      await checkLimit(caller, 'grade');
      const r = await sample({ model: MODELS.mid, system: METHOD, prompt: morePracticePrompt(subject, topic, body.lesson, arr(body.used), body.ability), maxTokens: 2500 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      const raw = parseJson(r.text) as { practice?: unknown[] };
      const practice = arr(raw && raw.practice).map(normQ).filter(Boolean).slice(0, 6);
      if (!practice.length) throw new HttpError(502, 'invalid_json', 'No usable questions came back. Try again.');
      return new Response(JSON.stringify({ practice }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    await checkLimit(caller, 'lesson');
    // Cache on what shapes the canonical lesson: subject, topic, stage and the pitch band. The warm-up answers and the
    // learner's background shape only the personal layer, which the prompt adds on top (bridge, analogies).
    const pitchBand = pitchOf(subject);
    const key = await cacheKey([subject.plan.title, topic.title, topic.stage, pitchBand]);
    const cached = await readCache(caller, key);
    return ndjsonStream(async (emit) => {
      if (cached) {
        emit({ type: 'done', data: { lesson: cached, cached: true } });
        return;
      }
      const r = await sample({ model: MODELS.mid, system: METHOD, prompt: lessonPrompt(subject, topic, body.ctx ?? {}), maxTokens: 10000, onText: (delta) => emit({ type: 'text', delta }) });
      await recordUsage(caller, 'lesson', r.inputTokens, r.outputTokens);
      const lesson = normaliseLesson(parseJson(r.text, r.stopReason), topic);
      await writeCache(caller, key, { subjectTitle: subject.plan.title, topicTitle: topic.title, stageId: topic.stage, pitchBand }, lesson);
      emit({ type: 'done', data: { lesson, cached: false } });
    });
  } catch (e) {
    return errorResponse(e);
  }
});

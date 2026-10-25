// lesson: the warm-up, the lesson text, the opening that answers the warm-up, the recall and practice set,
// or more practice for a topic. The lesson text (the core) is written as soon as the topic opens, while the
// learner does the warm-up; the set is written from the finished text while they read it. So the wait for a
// lesson is a few seconds rather than the whole generation, and every question is grounded in what was taught.
//
// Request: { kind: 'warm' | 'lesson' | 'cached' | 'bridge' | 'practice' | 'more', subject, topicId, ctx?: { warm, answers, simpler, relearn }, lesson?, used?, ability? }
// Response: 'lesson' streams ndjson (text deltas, then { type: 'done', data: { lesson, cached } }); the rest return JSON.

import {
  lessonPrompt, practicePrompt, bridgePrompt, morePracticePrompt, warmupPrompt, checkQuestionsPrompt, checkLessonPrompt, normaliseLesson, normalisePractice, normaliseBridge, normaliseWarm, normQ, topicById, pitchOf, METHOD, arr,
} from '../_shared/engine/index.js';
import { CORS, errorResponse, requireCaller, HttpError } from '../_shared/auth.ts';
import { PROMPT_VERSION, QUESTIONS_VERSION, cacheKey, readCache, writeCache } from '../_shared/cache.ts';
import { modelFor } from '../_shared/limits.ts';
import { checkLimit, recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';
import { ndjsonStream } from '../_shared/stream.ts';

// Work that outlives the response (Supabase's edge runtime keeps the instance alive for it).
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
const waitUntil = (p: Promise<unknown>) => {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
  else void p;
};

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
      const r = await sample({ model: modelFor('warm'), system: METHOD, prompt: warmupPrompt(subject, topic), maxTokens: 1500 });
      await recordUsage(caller, 'lesson', r.inputTokens, r.outputTokens);
      return new Response(JSON.stringify({ warm: normaliseWarm(parseJson(r.text, r.stopReason)) }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (kind === 'more') {
      await checkLimit(caller, 'grade');
      const r = await sample({ model: modelFor('more'), system: METHOD, prompt: morePracticePrompt(subject, topic, body.lesson, arr(body.used), body.ability), maxTokens: 2500 });
      await recordUsage(caller, 'grade', r.inputTokens, r.outputTokens);
      const raw = parseJson(r.text, r.stopReason) as { practice?: unknown[] };
      const practice = arr(raw && raw.practice).map(normQ).filter(Boolean).slice(0, 6);
      if (!practice.length) throw new HttpError(502, 'invalid_json', 'No usable questions came back. Try again.');
      return new Response(JSON.stringify({ practice }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (kind === 'bridge') {
      const r = await sample({ model: modelFor('bridge'), prompt: bridgePrompt(subject, topic, body.lesson, body.ctx ?? {}), maxTokens: 300 });
      await recordUsage(caller, 'lesson', r.inputTokens, r.outputTokens);
      return new Response(JSON.stringify({ bridge: normaliseBridge(parseJson(r.text, r.stopReason)) }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    const ctx = body.ctx ?? {};
    const pitchBand = pitchOf(subject);
    const key = await cacheKey([caller.profileId, subject.plan.title, topic.title, topic.stage, pitchBand, ctx.simpler?.length ? 'simpler' : '', ctx.relearn ? 'relearn:' + String(ctx.relearn).slice(0, 16) : '']);

    if (kind === 'cached') {
      // The lesson text if the server still has it, for the teach-back on the first review day; never written afresh.
      const core = await readCache(caller, key);
      return new Response(JSON.stringify({ lesson: core ?? null }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (kind === 'practice') {
      // The set for this lesson, cached beside the lesson text. A lesson cached before the split carries its own set.
      const pkey = key + ':' + QUESTIONS_VERSION;
      const hit = (await readCache(caller, pkey)) as { practice?: unknown[] } | null;
      if (hit?.practice?.length) return new Response(JSON.stringify({ questions: hit, cached: true }), { headers: { 'content-type': 'application/json', ...CORS } });
      const model = modelFor('practice');
      const r = await sample({ model, system: METHOD, prompt: practicePrompt(subject, topic, body.lesson, ctx), maxTokens: 5000 });
      await recordUsage(caller, 'lesson', r.inputTokens, r.outputTokens);
      let questions: Record<string, unknown> = { ...normalisePractice(parseJson(r.text, r.stopReason)), meta: { prompt: PROMPT_VERSION + '/' + QUESTIONS_VERSION, model } };
      // A strict second reading before anything becomes a card. If the checker fails or returns something unusable,
      // the set stands as written; a check is a net, not a gate.
      try {
        const verifier = modelFor('verify');
        const v = await sample({ model: verifier, prompt: checkQuestionsPrompt(subject, topic, body.lesson, questions), maxTokens: 6000 });
        await recordUsage(caller, 'lesson', v.inputTokens, v.outputTokens);
        const verdict = parseJson(v.text, v.stopReason) as { changed?: boolean; fixes?: string[]; questions?: unknown } | null;
        if (verdict?.changed && verdict.questions) {
          const fixed = normalisePractice(verdict.questions);
          questions = { ...fixed, meta: { ...(questions.meta as Record<string, unknown>), checked: verifier, fixes: arr(verdict.fixes).slice(0, 8) } };
        } else {
          questions.meta = { ...(questions.meta as Record<string, unknown>), checked: verifier, fixes: [] };
        }
      } catch (e) {
        console.warn('question check skipped', e instanceof Error ? e.message : e);
      }
      await writeCache(caller, pkey, { subjectTitle: subject.plan.title, topicTitle: topic.title, stageId: topic.stage, pitchBand }, questions);
      return new Response(JSON.stringify({ questions, cached: false }), { headers: { 'content-type': 'application/json', ...CORS } });
    }

    await checkLimit(caller, 'lesson');
    // Cache on what shapes the canonical lesson: subject, topic, stage and the pitch band. The warm-up answers and the
    // learner's background shape only the personal layer, which the prompt adds on top (bridge, analogies).
    // Keyed per learner: the lesson mixes in their earlier topics and their learner model, so it must not be served to anyone else. The cache still makes a retry or a repeat instant.
    // A topic coming back (simpler after a miss, or relearned after reviews showed it was forgotten) gets a fresh
    // lesson, not the cached one, and the frontier model: these and threshold concepts are where depth pays most.
    const again = Boolean(ctx.simpler?.length) || Boolean(ctx.relearn);
    const deep = Boolean(topic.threshold) || again;
    const cached = await readCache(caller, key);
    return ndjsonStream(async (emit) => {
      if (cached) {
        emit({ type: 'done', data: { lesson: cached, cached: true } });
        return;
      }
      const model = modelFor(deep ? 'lessonDeep' : 'lesson');
      const r = await sample({ model, system: METHOD, prompt: lessonPrompt(subject, topic, ctx), maxTokens: 5000, onText: (delta) => emit({ type: 'text', delta }) });
      await recordUsage(caller, 'lesson', r.inputTokens, r.outputTokens);
      // Tagged with the prompt version and model, so retention weeks later can be compared across them.
      const lesson = { ...normaliseLesson(parseJson(r.text, r.stopReason), topic), meta: { prompt: PROMPT_VERSION, model } };
      await writeCache(caller, key, { subjectTitle: subject.plan.title, topicTitle: topic.title, stageId: topic.stage, pitchBand }, lesson);
      emit({ type: 'done', data: { lesson, cached: false } });
      // After the learner has it: a strict second reading of the text. A corrected lesson replaces the cached one, so a
      // retry, a resumed sitting or the teach-back day sees the corrected version; the error list is kept with it.
      waitUntil((async () => {
        try {
          const verifier = modelFor('verify');
          const v = await sample({ model: verifier, prompt: checkLessonPrompt(subject, topic, lesson), maxTokens: 6000 });
          await recordUsage(caller, 'lesson', v.inputTokens, v.outputTokens);
          const verdict = parseJson(v.text, v.stopReason) as { changed?: boolean; fixes?: string[]; lesson?: Record<string, unknown> } | null;
          const checked = { ...lesson.meta, checked: verifier, fixes: verdict?.changed ? arr(verdict.fixes).slice(0, 8) : [] };
          if (verdict?.changed && verdict.lesson) {
            const corrected = { ...normaliseLesson({ ...lesson, ...verdict.lesson }, topic), meta: checked };
            await writeCache(caller, key, { subjectTitle: subject.plan.title, topicTitle: topic.title, stageId: topic.stage, pitchBand }, corrected);
          } else {
            await writeCache(caller, key, { subjectTitle: subject.plan.title, topicTitle: topic.title, stageId: topic.stage, pitchBand }, { ...lesson, meta: checked });
          }
        } catch (e) {
          console.warn('lesson check skipped', e instanceof Error ? e.message : e);
        }
      })());
    });
  } catch (e) {
    return errorResponse(e);
  }
});

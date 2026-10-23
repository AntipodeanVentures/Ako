// after: the work that follows a session, done on the server so it finishes
// whether or not the app stays open. After a topic: the learner model is
// rewritten from what happened, and the topics ahead are revised when the
// topic missed the mark, a milestone was reached, or three more topics have
// been mastered. After reviews: a revision when two or more cards were
// forgotten. Everything is written to the database here; the app refetches.
//
// Request: { kind: 'topic', subjectId, topicId, evidence, mastered, attempts, milestoneReached }
//        | { kind: 'reviews', subjectId, forgotten: [{ topicTitle, front, back }] }
// Response: JSON { notes: [{ op, id, title, why }], model: {...} | null }

import { adaptPrompt, modelPrompt, normaliseAdaptation, normaliseModel, topicById, METHOD, str, arr } from '../_shared/engine/index.js';
import { CORS, HttpError, errorResponse, json, requireCaller } from '../_shared/auth.ts';
import { modelFor } from '../_shared/limits.ts';
import { recordUsage } from '../_shared/metering.ts';
import { parseJson, sample } from '../_shared/anthropic.ts';
import { loadSubject, type ServerSubject } from '../_shared/subject.ts';

type Note = { op: string; id: string; title: string; why: string };

async function revise(caller: Awaited<ReturnType<typeof requireCaller>>, subj: ServerSubject, reason: string, evidence: string): Promise<Note[]> {
  const r = await sample({ model: modelFor('adapt'), system: METHOD, prompt: adaptPrompt(subj, { reason, note: '', evidence }), maxTokens: 4000 });
  await recordUsage(caller, 'plan', r.inputTokens, r.outputTokens);
  const a = normaliseAdaptation(parseJson(r.text, r.stopReason), subj.plan, subj) as { topics: unknown[]; milestones: unknown[]; notes: Note[] };
  if (!a.notes.length) return [];
  const plan = { ...subj.plan, topics: a.topics, milestones: a.milestones, history: [...arr(subj.plan.history), { at: Date.now(), reason, notes: a.notes }].slice(-12) };
  const { error } = await caller.admin.from('subjects').update({ plan }).eq('id', subj.id);
  if (error) throw new HttpError(500, 'server_error', 'The revised path could not be saved.');
  subj.plan = plan;
  return a.notes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    const body = await req.json();
    const subj = await loadSubject(caller.admin, caller.profileId, str(body.subjectId, 60));
    if (!subj) throw new HttpError(404, 'not_found', 'Subject not found.');

    if (body.kind === 'reviews') {
      const forgotten = arr(body.forgotten).slice(0, 40) as { topicTitle: string; front: string; back: string }[];
      if (forgotten.length < 2) return json({ notes: [], model: null });
      const evidence = forgotten.map((f) => `Forgotten in review (${str(f.topicTitle, 160)}): ${str(f.front, 300)} -> ${str(f.back, 300)}`).join('\n');
      const notes = await revise(caller, subj, `In today's reviews ${forgotten.length} cards in this subject were forgotten. Decide whether the topics ahead assume something that has not stuck, and whether a bridging or consolidating topic belongs before them.`, evidence);
      return json({ notes, model: null });
    }

    if (body.kind !== 'topic') throw new HttpError(400, 'bad_request', 'Unknown kind.');
    const topic = topicById(subj, str(body.topicId, 20)) as { id: string; title: string } | null;
    if (!topic) throw new HttpError(400, 'bad_request', 'Unknown topic.');
    const evidence = str(body.evidence, 3000);

    // 1. The learner model, always.
    let model: Record<string, unknown> | null = null;
    try {
      const r = await sample({ model: modelFor('model'), prompt: modelPrompt(subj, topic, evidence), maxTokens: 900 });
      await recordUsage(caller, 'extract', r.inputTokens, r.outputTokens);
      model = normaliseModel(parseJson(r.text, r.stopReason)) as Record<string, unknown>;
      await caller.admin.from('subjects').update({ model }).eq('id', subj.id);
      subj.model = model;
    } catch (e) {
      console.error('learner model update failed', e);
    }

    // 2. A revision of the path, when there is a reason.
    const mastered = body.mastered === true;
    const attempts = Number(body.attempts) || 0;
    const milestone = str(body.milestoneReached, 200);
    const masteredCount = subj.plan.topics.filter((t) => (subj.topicState[String(t.id)] ?? {}).status === 'mastered').length;
    let reason: string | null = null;
    if (!mastered) {
      reason = attempts >= 2
        ? `The topic "${topic.title}" has not reached the mark after ${attempts} attempts. Decide whether something before it is missing, whether it should be split, or whether it is fine to keep trying as it is.`
        : `The topic "${topic.title}" missed the mark on its first attempt and comes back next session in a simpler form. Look at what went wrong: if a prerequisite is missing or the topic is too dense, change the path now; if it looks like one rough sitting, change nothing.`;
    } else if (milestone) {
      reason = `The milestone "${milestone}" has just been reached. Check that the topics still ahead fit what this learner has shown and what they said they want.`;
    } else if (masteredCount > 0 && masteredCount % 3 === 0) {
      reason = `A routine look after ${masteredCount} topics mastered: with what the learner has shown so far, are the topics still ahead the right ones, in the right order, at the right grain? Change nothing unless the evidence calls for it.`;
    }
    let notes: Note[] = [];
    if (reason) {
      try {
        notes = await revise(caller, subj, reason, evidence);
      } catch (e) {
        console.error('path revision failed', e);
      }
    }
    return json({ notes, model });
  } catch (e) {
    return errorResponse(e);
  }
});

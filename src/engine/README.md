# The engine

Pure logic ported from the Polymath Engine artifact. It runs in the app and in the
Supabase edge functions, and it is tested with Vitest without a model.

## Conventions

- ES modules in JavaScript with the artifact's field names unchanged. `types.ts`
  describes the payload shapes; `normalise.js` is the real contract: every model
  answer goes through it before it is shown or stored.
- No network and no storage in here. A prompt function returns a string; the
  caller sends it to the model; the answer comes back through a `normalise*`
  function. The session functions update a state object and return it.
- The learner's context travels on the subject: callers attach `subj.cards`
  (this subject's cards) and `subj.learner` (`{ about, model }`) before calling
  anything that needs them. Prompts without a subject take `about` as an argument
  (`startPrompt`, `rolePrompt`).
- Time comes from `nowMs()` in `core.js`, which tests can pin with `setNow(ms)`.

## Modules

| File | Holds |
| --- | --- |
| `core.js` | small helpers, the clock, formatting |
| `ladder.js` | the five rungs (Beginner to Expert) with their anchors, pitch levels, support fading, the constants |
| `scheduling.js` | FSRS set-up, making and reviewing cards, recall chance |
| `progress.js` | topic and stage status, level checks, minutes, retention, pace and time-to-level estimates, concepts, roles |
| `know.js` | the confirmed profile items and the summary generated from them |
| `prompts.js` | every prompt: plan, critic, warm-up, lesson, practice, grading, level check, tutor, roles, extraction |
| `normalise.js` | the validators for every model answer, plus the plan upgrade path |
| `session.js` | the lesson deck as state: steps, practice in the productive band, finishing a topic, relearning |

Converting the modules to TypeScript is incremental work for later; the boundary
types in `types.ts` and the tests are what the rest of the codebase relies on.

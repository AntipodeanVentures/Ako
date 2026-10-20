# The AI server

Five Deno edge functions, one per kind of call. The model key lives here and nowhere else.

| Function | Does | Streams |
| --- | --- | --- |
| `plan` | writes the plan, runs the critic pass, returns the normalised plan | yes |
| `lesson` | warm-up, lesson (cached per topic and level), more practice | lesson only |
| `grade` | marks answers, writes level checks, debriefs role-plays, checks a photo | no |
| `tutor` | one turn of tutor, teach-back student or role-play character | yes |
| `extract` | profile import, starting point, role map, learner model update | no |

`_shared/` holds the Anthropic client (streaming, prompt caching of the method text), the caller check
(session token to profile id, plus a service-role client), metering against the `usage` table, the lesson
cache, the limits and the ndjson streaming helper.

They import the engine from `_shared/engine/`, a copy of `src/engine` made by `npm run functions:sync`
(the bundler only sees files under `supabase/functions`). `npm run functions:deploy` syncs and deploys in one step.
`deno.json` maps the `ts-fsrs` import to its npm package for Deno.

## Deploy

The model key is a function secret, set once in the Supabase dashboard: Project Settings, Edge Functions,
Secrets, name `ANTHROPIC_API_KEY`. It never goes in the repo or the app.

With the Supabase CLI signed in:

```
npm run functions:deploy
```

Without the CLI (the dashboard's function editor, or a tool that takes one file per function):

```
npm run functions:bundle        # writes build/functions/<fn>.js and deno.json
```

Deploy each bundle as `index.js` with `deno.json` as the import map and "verify JWT" on. This is how the
first deploy to the live project was done, on 20 October 2026; all five functions are ACTIVE at version 1.

Optional secrets `MODEL_FRONTIER`, `MODEL_MID`, `MODEL_SMALL` override the model names in `_shared/limits.ts`.

## Smoke test

Without a session, every function answers `401 {"error":{"code":"not_signed_in"}}`, which shows it booted.
With a signed-in session token:

```
curl -N -X POST "$SUPABASE_URL/functions/v1/plan" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"intake":{"subject":"Spanish","target":"s3","current":"Know a little","hours":5,"background":"","why":"Talk with my in-laws"},"coverTo":"s2"}'
```

Expect text events, a `draft` event, then `done` with the plan; a row appears in `usage`. If the key is not
set the answer is `500 not_configured`.

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

```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npm run functions:deploy
```

Optional secrets `MODEL_FRONTIER`, `MODEL_MID`, `MODEL_SMALL` override the model names in `_shared/limits.ts`.

## Smoke test

With a signed-in session token:

```
curl -N -X POST "$SUPABASE_URL/functions/v1/plan" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"intake":{"subject":"Spanish","target":"s3","current":"Know a little","hours":5,"background":"","why":"Talk with my in-laws"},"coverTo":"s2"}'
```

Expect text events, a `draft` event, then `done` with the plan; a row appears in `usage`.

Not yet run against a live project: the first deploy is session 4's acceptance test.

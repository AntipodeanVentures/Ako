# Ako

A personal tutor that takes you from any starting point to a stated level in
anything, and shows the evidence. Built on the same architecture as Thrive:
Expo SDK 54 with file-based routing, Supabase for sign-in and data,
TanStack Query feature modules, and EAS builds.

## Layout

- `app/`: routes. `(auth)` sign-in and sign-up, `(onboarding)` the first run,
  `(app)/(tabs)` Learn, Path and You, plus the session, check and role screens.
- `src/engine/`: the learning engine, ported from the Polymath Engine
  artifact. Pure TypeScript: scheduling, the ladder, estimates, prompts and
  the validators for model output. No React, no Supabase. Shared with the
  edge functions.
- `src/features/`: one module per feature (`api.ts`, `hooks.ts`, `types.ts`).
- `src/components/ui/`, `src/theme/`: the UI kit and tokens.
- `supabase/migrations/`: numbered SQL, row-level security on every table.
- `supabase/functions/`: the AI server (Deno edge functions). The model key
  lives here and nowhere else.
- `website/`: the static site (privacy, terms, the shareable level card).

## Get started

1. `npm install`
2. `npx expo start` (press `w` for the web preview, or scan the QR code with
   Expo Go on your phone)

`.env.development` already points at the development Supabase project, whose
schema and edge functions are deployed. Only the model key is set by hand, as
a function secret in the Supabase dashboard (`ANTHROPIC_API_KEY`).

For a fresh project: apply `supabase/schema.sql` in the SQL editor, run
`npm run functions:deploy`, set the secret, and put the new project's URL and
publishable key in `.env`.

`npm test` runs the engine tests. `npm run typecheck` runs the compiler.

Read `AGENTS.md` before writing code: it points at the exact Expo docs for
this SDK version.

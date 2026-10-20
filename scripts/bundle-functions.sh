#!/usr/bin/env bash
# Bundle each edge function into a single JavaScript file, ready to deploy.
#
# The Supabase CLI (`npm run functions:deploy`) bundles on its own, so this script is only
# for deploying without the CLI: the Supabase dashboard's function editor, or a tool that
# takes one file per function. Each bundle keeps npm packages external, so it stays small
# (20 to 35 KB) and the import map in supabase/functions/deno.json resolves them at run time.
#
# Usage:  scripts/bundle-functions.sh [out-dir]      (default: build/functions)
# Needs:  deno 2.x on the PATH.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/build/functions}"
FUNCS=(plan lesson grade tutor extract)

cd "$ROOT"
node scripts/sync-engine.mjs
mkdir -p "$OUT"
cd supabase/functions

for fn in "${FUNCS[@]}"; do
  deno bundle --config deno.json --platform deno \
    --external "npm:*" --external "@supabase/supabase-js" --external "ts-fsrs" \
    -o "$OUT/$fn.js" "$fn/index.ts"
  printf '%-8s %6s bytes\n' "$fn" "$(wc -c < "$OUT/$fn.js")"
done

cp deno.json "$OUT/deno.json"
echo "Bundles written to $OUT. Deploy each as index.js with deno.json as the import map."

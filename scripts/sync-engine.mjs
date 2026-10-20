#!/usr/bin/env node
// Copies src/engine into supabase/functions/_shared/engine so the edge functions are self-contained
// (the Supabase bundler only sees files under supabase/functions). Run before `supabase functions deploy`;
// `npm run functions:sync` does it, and the deploy script runs it first.

import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const src = new URL('../src/engine/', import.meta.url).pathname;
const dest = new URL('../supabase/functions/_shared/engine/', import.meta.url).pathname;
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(src)) {
  if (!f.endsWith('.js')) continue;
  copyFileSync(join(src, f), join(dest, f));
}
console.log('engine synced to supabase/functions/_shared/engine');

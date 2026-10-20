// Usage metering and the per-tier limits, backed by the usage table and its RPCs (migration 0006).

import type { Caller } from './auth.ts';
import { HttpError } from './auth.ts';
import { LIMITS } from './limits.ts';

export type Kind = 'plan' | 'lesson' | 'grade' | 'tutor' | 'extract';

export async function checkLimit(caller: Caller, kind: Kind): Promise<void> {
  const { data, error } = await caller.admin.rpc('usage_window', { p_profile_id: caller.profileId });
  if (error) { console.error(error); return; } // never block a learner on a metering read failure
  const rows = (data ?? []) as { kind: string; today: number; week: number }[];
  const row = rows.find((r) => r.kind === kind) ?? { kind, today: 0, week: 0 };
  const lim = LIMITS[caller.tier];
  const over =
    (kind === 'lesson' && row.week >= lim.lessonsPerWeek) ||
    (kind === 'plan' && row.week >= lim.plansPerWeek) ||
    (kind === 'grade' && row.today >= lim.gradesPerDay) ||
    (kind === 'tutor' && row.today >= lim.tutorTurnsPerDay);
  if (over) {
    throw new HttpError(429, caller.tier === 'free' ? 'free_limit' : 'daily_limit',
      caller.tier === 'free'
        ? 'You have used this week\'s free lessons. Reviews stay free; Pro removes the limit.'
        : 'You have hit today\'s ceiling. It resets at midnight; reviews are unaffected.');
  }
}

export async function recordUsage(caller: Caller, kind: Kind, input: number, output: number): Promise<void> {
  const { error } = await caller.admin.rpc('record_usage', { p_profile_id: caller.profileId, p_kind: kind, p_input: input, p_output: output });
  if (error) console.error(error);
}

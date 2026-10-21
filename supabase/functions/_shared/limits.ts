// Free-tier and Pro ceilings. One place to change when the pricing decision lands.
// Reviews are local and unlimited; these cover the calls that cost money.

export type Tier = 'free' | 'pro';

// During the private beta (BETA_UNLIMITED unset or "true") every account gets the Pro ceilings, which exist
// only so a runaway loop cannot run up the bill. Set BETA_UNLIMITED=false as a function secret to turn the
// free tier on when pricing lands.
export const BETA_UNLIMITED = (Deno.env.get('BETA_UNLIMITED') ?? 'true') !== 'false';

export const LIMITS: Record<Tier, { lessonsPerWeek: number; gradesPerDay: number; tutorTurnsPerDay: number; plansPerWeek: number }> = {
  free: { lessonsPerWeek: 3, gradesPerDay: 40, tutorTurnsPerDay: 30, plansPerWeek: 2 },
  // Pro has a soft daily cap so a runaway loop cannot run up the bill; the app shows a friendly message.
  pro: { lessonsPerWeek: 60, gradesPerDay: 400, tutorTurnsPerDay: 300, plansPerWeek: 20 },
};

// Which model answers which kind of call. Names are configuration, not code: change here when a better or
// cheaper model arrives. Frontier for the plan and its critic, mid for teaching, small for grading.
export const MODELS = {
  frontier: Deno.env.get('MODEL_FRONTIER') ?? 'claude-opus-5-5',
  mid: Deno.env.get('MODEL_MID') ?? 'claude-sonnet-5-5',
  small: Deno.env.get('MODEL_SMALL') ?? 'claude-haiku-5-5',
};

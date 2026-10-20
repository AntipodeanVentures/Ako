// Turns the caller's Supabase session token into a profile id, and gives the functions a
// service-role client for metering and the cache (which clients cannot touch under RLS).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Caller = { profileId: string; tier: 'free' | 'pro'; admin: SupabaseClient };

export async function requireCaller(req: Request): Promise<Caller> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, 'not_signed_in', 'Sign in to use Ako.');
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const asUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'not_signed_in', 'Your session has expired. Sign in again.');
  const admin = createClient(url, service);
  // Entitlement: a 'pro' row in profiles.model is a placeholder until RevenueCat's webhook writes a real one (session 8).
  const { data: prof } = await admin.from('profiles').select('model').eq('id', data.user.id).maybeSingle();
  const tier = (prof?.model as { tier?: string } | null)?.tier === 'pro' ? 'pro' : 'free';
  return { profileId: data.user.id, tier, admin };
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(e: unknown): Response {
  const err = e instanceof HttpError ? e : new HttpError(500, 'server_error', 'Something went wrong. Try again.');
  if (!(e instanceof HttpError)) console.error(e);
  return json({ error: { code: err.code, message: err.message } }, err.status);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
}

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
};

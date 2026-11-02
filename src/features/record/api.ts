import { env } from '@/src/lib/env';
import { getSupabase } from '@/src/lib/supabase';
import type { RecordRow } from '@/src/types/database';

import type { RecordData } from './build';

// Issuing, withdrawing and reading records of knowledge. A record is a snapshot under a code;
// the learner's own rows are read and written under RLS, and the public read of one code goes
// through the `record` edge function, which never lists.

// Codes avoid the letters and digits that are read for each other (0 O, 1 I, 8 B).
const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXYZ2345679';

function randomCode(): string {
  const bytes = new Uint8Array(8);
  const c = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const s = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

// The code as a person would type it, in the form it is stored: four, a dash, four.
export function normaliseCode(raw: string): string | null {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : null;
}

// The learner's current record: the latest one not withdrawn, or null.
export async function fetchMyRecord(): Promise<RecordRow | null> {
  const { data, error } = await getSupabase().from('records').select('*').is('revoked_at', null).order('issued_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as RecordRow | null) ?? null;
}

// Issues a record under a fresh code. Any earlier record is withdrawn first, so one link is live at a time.
export async function issueRecord(profileId: string, data: RecordData): Promise<RecordRow> {
  const sb = getSupabase();
  await sb.from('records').update({ revoked_at: new Date().toISOString() }).eq('profile_id', profileId).is('revoked_at', null);
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = randomCode();
    const { data: row, error } = await sb.from('records').insert({ code, profile_id: profileId, name: data.name, snapshot: data }).select('*').single();
    if (!error) return row as RecordRow;
    // A code already taken (unique violation) gets another try; anything else is an error.
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not issue a code. Try again.');
}

export async function revokeRecord(code: string): Promise<void> {
  const { error } = await getSupabase().from('records').update({ revoked_at: new Date().toISOString() }).eq('code', code);
  if (error) throw error;
}

export type PublicRecord = { code: string; name: string; snapshot: unknown; issued_at: string };
export class RecordLookupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// The public read, with no sign-in: one code, one record, or an error that says why not.
export async function fetchPublicRecord(raw: string): Promise<PublicRecord> {
  const code = normaliseCode(raw);
  if (!code) throw new RecordLookupError('bad_code', 'A record code has eight letters and numbers.');
  const res = await fetch(`${env.supabaseUrl}/functions/v1/record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.supabaseAnonKey, Authorization: `Bearer ${env.supabaseAnonKey}` },
    body: JSON.stringify({ code }),
  });
  let body: { record?: PublicRecord; error?: { code?: string; message?: string } } = {};
  try { body = await res.json(); } catch { body = {}; }
  if (!res.ok || !body.record) throw new RecordLookupError(body.error?.code ?? 'server_error', body.error?.message ?? 'The record could not be read. Try again.');
  return body.record;
}

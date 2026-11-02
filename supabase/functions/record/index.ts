// record: the public read of a record of knowledge, one code at a time. No sign-in: anyone
// with the link can open it. Returns the snapshot the learner issued, or says why not: no
// record has the code, or its owner withdrew it. Nothing here lists records, and a wrong code
// learns nothing but that it is wrong.
//
// Request: { code: 'ACDE-FGHJ' }   (POST; deployed with JWT verification off)
// Response: JSON { record: { code, name, snapshot, issued_at } }

import { createClient } from '@supabase/supabase-js';

import { CORS, HttpError, errorResponse, json } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    let raw = '';
    try {
      const body = await req.json();
      raw = String(body?.code ?? '');
    } catch {
      raw = '';
    }
    const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length !== 8) throw new HttpError(400, 'bad_code', 'A record code has eight letters and numbers.');
    const code = `${s.slice(0, 4)}-${s.slice(4)}`;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await admin.from('records').select('code, name, snapshot, issued_at, revoked_at').eq('code', code).maybeSingle();
    if (error) {
      console.error(error);
      throw new HttpError(500, 'server_error', 'The record could not be read. Try again.');
    }
    if (!data) throw new HttpError(404, 'not_found', 'No record has this code.');
    if (data.revoked_at) throw new HttpError(410, 'withdrawn', 'This record was withdrawn by its owner.');
    return json({ record: { code: data.code, name: data.name, snapshot: data.snapshot, issued_at: data.issued_at } });
  } catch (e) {
    return errorResponse(e);
  }
});

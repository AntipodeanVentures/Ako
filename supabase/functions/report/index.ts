// report: a crash or a problem from the app, stored in the learner's own
// project and, when RESEND_API_KEY and REPORT_TO are set as function
// secrets, emailed to the person running the beta.
//
// Request: { kind: 'crash' | 'problem', message: string, detail?: object }
// Response: JSON { ok: true }

import { str } from '../_shared/engine/index.js';
import { CORS, HttpError, errorResponse, json, requireCaller } from '../_shared/auth.ts';

const SENDER = Deno.env.get('REPORT_FROM') ?? 'Ako <hello@ako.antipodean.ventures>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const caller = await requireCaller(req);
    const body = await req.json();
    const kind = body.kind === 'crash' ? 'crash' : 'problem';
    const message = str(body.message, 4000);
    if (!message) throw new HttpError(400, 'bad_request', 'Say what went wrong.');
    // Keep the context bounded: a crash loop must not fill the table.
    let detail: Record<string, unknown> = {};
    try {
      const raw = JSON.stringify(body.detail ?? {});
      detail = JSON.parse(raw.length > 20000 ? JSON.stringify({ truncated: true, head: raw.slice(0, 20000) }) : raw);
    } catch {
      detail = {};
    }
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await caller.admin.from('reports').select('id', { count: 'exact', head: true }).eq('profile_id', caller.profileId).gte('created_at', since);
    if ((count ?? 0) >= 30) throw new HttpError(429, 'rate_limited', 'That is plenty of reports for one hour. Thank you; they are all here.');
    const { error } = await caller.admin.from('reports').insert({ profile_id: caller.profileId, kind, message, detail });
    if (error) {
      console.error(error);
      throw new HttpError(500, 'server_error', 'The report could not be saved.');
    }

    const key = Deno.env.get('RESEND_API_KEY');
    const to = Deno.env.get('REPORT_TO');
    if (key && to) {
      const lines = Object.entries(detail).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: SENDER,
          to: [to],
          subject: `[Ako ${kind}] ${message.slice(0, 80).replace(/\s+/g, ' ')}`,
          text: `${kind === 'crash' ? 'A crash' : 'A problem report'} from ${caller.profileId}\n\n${message}\n\n${lines}`,
        }),
      }).catch((e) => { console.error('report email failed', e); return null; });
      if (res && !res.ok) console.error('report email failed', res.status, await res.text().catch(() => ''));
    }
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
});

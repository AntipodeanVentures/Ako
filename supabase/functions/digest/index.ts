// digest: the daily reminder, run by the database's scheduler every hour
// (migration 0009). For each learner whose reminder hour matches the hour in
// London and who has not had today's email, it counts the cards due and
// whether they have studied today, and sends one short email through
// Resend. Without RESEND_API_KEY it logs what it would have sent.
//
// Not called by the app. Protected by a shared token in the request header,
// matched against app_config (readable only by the service role), because
// the caller is the scheduler rather than a signed-in learner.

import { createClient } from '@supabase/supabase-js';

const SITE = Deno.env.get('SITE_URL') ?? 'https://ako-eight.vercel.app';
const SENDER = Deno.env.get('REPORT_FROM') ?? 'Ako <hello@ako.antipodean.ventures>';

function londonHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(now));
}
function londonDay(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'digest_secret').maybeSingle();
  const secret = Deno.env.get('DIGEST_SECRET') ?? cfg?.value ?? '';
  if (!secret || req.headers.get('x-digest-secret') !== secret) return new Response('forbidden', { status: 403 });

  const hour = londonHour();
  const today = londonDay();
  const key = Deno.env.get('RESEND_API_KEY');

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, display_name, reminder_time, digest_sent_day')
    .not('reminder_time', 'is', null);
  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0, skipped = 0;
  for (const p of profiles ?? []) {
    const h = Number(String(p.reminder_time ?? '').split(':')[0]);
    if (!Number.isFinite(h) || h !== hour || p.digest_sent_day === today) { skipped++; continue; }

    const [{ count: due }, { data: todayRows }, { data: subjects }, { data: userRes }] = await Promise.all([
      admin.from('cards').select('id', { count: 'exact', head: true }).eq('profile_id', p.id).lte('due', new Date().toISOString()),
      admin.from('activity').select('lesson_minutes, review_minutes').eq('profile_id', p.id).eq('day', today),
      admin.from('subjects').select('title').eq('profile_id', p.id).order('updated_at', { ascending: false }).limit(3),
      admin.auth.admin.getUserById(p.id),
    ]);
    const studied = (todayRows ?? []).some((r) => Number(r.lesson_minutes) + Number(r.review_minutes) > 0);
    const email = userRes?.user?.email;
    if (!email || !(subjects ?? []).length || studied) { skipped++; continue; }

    const n = due ?? 0;
    const first = (subjects ?? [])[0]?.title ?? 'your subject';
    const name = (p.display_name || '').trim();
    const subject = n ? `Ako: ${n} ${n === 1 ? 'review' : 'reviews'} waiting` : `Ako: one new idea in ${first}`;
    const text = `${name ? name + ', ' : ''}${n ? `${n} ${n === 1 ? 'card is' : 'cards are'} due today, then one new idea in ${first}.` : `nothing is due for review; one new idea in ${first} is ready.`}\n\n${SITE}\n\nAbout ten minutes. Reminders are set on the You tab.`;

    if (!key) {
      console.log('digest (no RESEND_API_KEY): would send', { to: email, subject });
    } else {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: SENDER, to: [email], subject, text }),
      }).catch((e) => { console.error('digest email failed', e); return null; });
      if (!res || !res.ok) { console.error('digest email failed', res?.status, await res?.text().catch(() => '')); skipped++; continue; }
    }
    await admin.from('profiles').update({ digest_sent_day: today }).eq('id', p.id);
    sent++;
  }
  return new Response(JSON.stringify({ hour, today, sent, skipped, emailing: Boolean(key) }), { headers: { 'content-type': 'application/json' } });
});

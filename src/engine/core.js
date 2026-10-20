// Ported from the Polymath Engine artifact (v4). Pure logic: no React, no Supabase, no DOM.
// The data shapes (plan, lesson, topicState, card) are unchanged so the prompts, validators and
// tests move across without edits. See src/engine/README.md for the conventions.

const DAY = 864e5;
// The clock is overridable so tests and the estimates can travel in time.
let fixedNow = null;
const nowMs = () => (fixedNow ?? Date.now());
function setNow(ms) { fixedNow = ms; }
const clone = (o) => JSON.parse(JSON.stringify(o));
const str = (x, max = 4000) => (typeof x === 'string' ? x : x == null ? '' : String(x)).trim().slice(0, max);
const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x, d) => { const n = Number(x); return Number.isFinite(n) ? n : d; };
const clampNum = (x, a, b) => Math.min(b, Math.max(a, x));
const rid = (p) => p + Math.random().toString(36).slice(2, 9) + (Date.now() % 1679616).toString(36);
const pct = (x) => Math.round(x * 100) + '%';
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
function dayKey(ms) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function endOfToday(atMs = nowMs()) { const d = new Date(atMs); d.setHours(23, 59, 59, 999); return d.getTime(); }
function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
function fmtInterval(days) {
  if (days < 1) return 'today';
  if (days < 31) return Math.round(days) + ' d';
  if (days < 365) return Math.round(days / 30.4) + ' mo';
  return (days / 365).toFixed(1) + ' y';
}
function fmtTime(min) {
  const m = Math.round(min || 0);
  if (m < 60) return m + ' min';
  const hh = Math.floor(m / 60), mm = m % 60;
  return hh + ' h' + (mm ? ' ' + mm + ' min' : '');
}
const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export { DAY, nowMs, setNow, clone, str, arr, num, clampNum, rid, pct, plural, dayKey, endOfToday, startOfDay, fmtInterval, fmtTime, fmtDate };

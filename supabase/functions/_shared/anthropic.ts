// The one place that talks to the model. Streams text when asked, returns token counts for metering,
// and keeps the method text in a cached prompt block so every call does not pay for it again.

import { HttpError } from './auth.ts';

export type Tier = 'frontier' | 'mid' | 'small';

type Opts = {
  model: string;
  system?: string;          // the method and rules, cached across calls
  prompt: string | { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  images?: { mediaType: string; dataBase64: string }[];
  onText?: (delta: string) => void;
  signal?: AbortSignal;
};

export type Result = { text: string; inputTokens: number; outputTokens: number; stopReason: string | null };

export async function sample(o: Opts): Promise<Result> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new HttpError(500, 'not_configured', 'The model key is not set on the server.');
  const messages = typeof o.prompt === 'string'
    ? [{ role: 'user', content: o.images?.length
        ? [...o.images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.dataBase64 } })), { type: 'text', text: o.prompt }]
        : o.prompt }]
    : o.prompt;
  const body: Record<string, unknown> = {
    model: o.model,
    max_tokens: o.maxTokens ?? 4096,
    messages,
    stream: Boolean(o.onText),
  };
  if (o.system) body.system = [{ type: 'text', text: o.system, cache_control: { type: 'ephemeral' } }];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: o.signal,
  });
  if (res.status === 429) throw new HttpError(429, 'rate_limited', 'The model is busy. Try again in a moment.');
  if (!res.ok) { console.error(await res.text()); throw new HttpError(502, 'model_error', 'The model did not answer. Try again.'); }

  if (!o.onText) {
    const data = await res.json();
    const text = (data.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
    return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, stopReason: data.stop_reason ?? null };
  }

  // Server-sent events: forward text deltas as they arrive and total the usage at the end.
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '', inputTokens = 0, outputTokens = 0, stopReason: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev: Record<string, unknown>;
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }
      if (ev.type === 'content_block_delta') {
        const d = (ev.delta as { type: string; text?: string });
        if (d.type === 'text_delta' && d.text) { text += d.text; o.onText(d.text); }
      } else if (ev.type === 'message_start') {
        inputTokens = ((ev.message as { usage?: { input_tokens?: number } }).usage?.input_tokens) ?? 0;
      } else if (ev.type === 'message_delta') {
        outputTokens = ((ev.usage as { output_tokens?: number })?.output_tokens) ?? outputTokens;
        stopReason = ((ev.delta as { stop_reason?: string })?.stop_reason) ?? stopReason;
      }
    }
  }
  return { text, inputTokens, outputTokens, stopReason };
}

// Pulls the first JSON object or array out of a model answer that may carry prose around it.
// Models occasionally put a raw newline or tab inside a JSON string, which strict JSON rejects.
// This walks the text and escapes control characters only where they sit inside a string.
function repairJson(t: string): string {
  let out = '', inStr = false, esc = false;
  for (const ch of t) {
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') continue;
      if (ch === '\t') { out += '\\t'; continue; }
      if (ch < ' ') continue;
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

export function parseJson(text: string, stopReason?: string | null): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const core = a >= 0 && b > a ? t.slice(a, b + 1) : t;
  try { return JSON.parse(core); } catch { /* fall through */ }
  try { return JSON.parse(repairJson(core)); } catch { /* fall through */ }
  // Leave enough in the logs to see why: how it stopped, and the ends of the text.
  console.error('parseJson failed', JSON.stringify({ stopReason: stopReason ?? null, length: text.length, head: text.slice(0, 200), tail: text.slice(-300) }));
  if (stopReason === 'max_tokens') throw new HttpError(502, 'too_long', 'The answer ran past its length limit. Try again.');
  throw new HttpError(502, 'invalid_json', 'The model answer could not be read. Try again.');
}

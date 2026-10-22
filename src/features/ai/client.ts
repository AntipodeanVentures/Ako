import { fetch as expoFetch } from 'expo/fetch';

import { env } from '@/src/lib/env';
import { getSupabase } from '@/src/lib/supabase';

// The client for the edge functions. Streaming calls read newline-delimited JSON events
// ({type:'text',delta}, {type:'draft',data}, {type:'done',data}, {type:'error',code,message});
// plain calls return JSON. Errors carry the function's code so screens can branch on it
// (free_limit, daily_limit, rate_limited, invalid_json, not_signed_in).

export class AiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type FunctionName = 'plan' | 'lesson' | 'grade' | 'tutor' | 'extract' | 'report';

async function headers() {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('not_signed_in', 'Sign in to continue.');
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json', apikey: env.supabaseAnonKey };
}

const url = (fn: FunctionName) => `${env.supabaseUrl}/functions/v1/${fn}`;

async function throwFrom(res: Response): Promise<never> {
  let code = 'server_error', message = 'Something went wrong. Try again.';
  try {
    const body = await res.json();
    code = body?.error?.code ?? code;
    message = body?.error?.message ?? message;
  } catch {
    // keep the defaults
  }
  throw new AiError(code, message);
}

export async function callJson<T>(fn: FunctionName, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url(fn), { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal });
  if (!res.ok) await throwFrom(res);
  return (await res.json()) as T;
}

export type StreamHandlers<T> = {
  onText?: (text: string, delta: string) => void;
  onDraft?: (data: unknown) => void;
  signal?: AbortSignal;
};

// Streams a function's answer. Resolves with the `done` event's data; rejects with an AiError on an `error` event.
export async function callStream<T>(fn: FunctionName, body: unknown, h: StreamHandlers<T> = {}): Promise<T> {
  const res = await expoFetch(url(fn), { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal: h.signal });
  if (!res.ok) await throwFrom(res as unknown as Response);
  if (!res.body) throw new AiError('no_stream', 'The server did not stream an answer.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '';
  let done: T | undefined;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line) as { type: string; delta?: string; data?: unknown; code?: string; message?: string };
      if (ev.type === 'text' && ev.delta) { text += ev.delta; h.onText?.(text, ev.delta); }
      else if (ev.type === 'draft') h.onDraft?.(ev.data);
      else if (ev.type === 'done') done = ev.data as T;
      else if (ev.type === 'error') throw new AiError(ev.code ?? 'server_error', ev.message ?? 'Something went wrong.');
    }
  }
  if (done === undefined) throw new AiError('incomplete', 'The answer stopped early. Try again.');
  return done;
}

// Plain-language copy for the codes a screen will meet.
export function aiErrorCopy(e: unknown): string {
  const err = e as { code?: string; message?: string };
  switch (err?.code) {
    case 'free_limit': return 'You have used this week\'s free lessons. Reviews stay free; Pro removes the limit.';
    case 'daily_limit': return 'You have hit today\'s ceiling. It resets at midnight; reviews are unaffected.';
    case 'rate_limited': return 'The tutor is busy. Give it a moment and try again.';
    case 'invalid_json': return 'The answer came back garbled. Try again.';
    case 'too_long': return 'The answer ran past its length limit. Try again.';
    case 'not_signed_in': return 'Sign in to continue.';
    default: return err?.message || 'Something went wrong. Try again.';
  }
}

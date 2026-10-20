// A small helper for streaming a function's answer to the app as newline-delimited JSON events:
//   {"type":"text","delta":"..."} while the model writes, then {"type":"done","data":...} or {"type":"error",...}.

import { CORS } from './auth.ts';

export function ndjsonStream(run: (emit: (ev: Record<string, unknown>) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
      try { await run(emit); }
      catch (e) {
        const err = e as { code?: string; message?: string };
        emit({ type: 'error', code: err.code ?? 'server_error', message: err.message ?? 'Something went wrong.' });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store', ...CORS } });
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { callJson } from '@/src/features/ai/client';

// Crash and problem reporting, kept inside the learner's own project: no
// third-party service, no new account. A crash (an uncaught error, a
// rejected promise nobody handled, or a render error caught by the error
// boundary) is reported automatically, with a throttle so a loop cannot
// flood the table. A problem is what the learner types on the You tab. Both
// carry the same context: where they were, what build, whether it was
// opened from the home screen, and the last few console errors.

type Entry = { at: number; text: string };
const recentErrors: Entry[] = [];
const routes: Entry[] = [];
let installed = false;
let lastCrashAt = 0;
let crashesThisSession = 0;

export const BUILD = (process.env.EXPO_PUBLIC_BUILD ?? '').slice(0, 7) || 'dev';
export const VERSION = Constants.expoConfig?.version ?? '0.0.0';

function remember(list: Entry[], text: string, cap: number) {
  list.push({ at: Date.now(), text: text.slice(0, 600) });
  if (list.length > cap) list.splice(0, list.length - cap);
}

// Called by the root layout whenever the route changes.
export function noteRoute(pathname: string) {
  if (!routes.length || routes[routes.length - 1].text !== pathname) remember(routes, pathname, 12);
}

export function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return Platform.OS !== 'web';
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
}

export function context(): Record<string, unknown> {
  const w = typeof window !== 'undefined' ? window : null;
  return {
    version: VERSION,
    build: BUILD,
    platform: Platform.OS,
    standalone: isStandalone(),
    userAgent: w?.navigator?.userAgent ?? '',
    viewport: w ? `${w.innerWidth}x${w.innerHeight}` : '',
    route: routes.length ? routes[routes.length - 1].text : '',
    routes: routes.map((r) => r.text),
    recentErrors: recentErrors.map((e) => `${new Date(e.at).toISOString()} ${e.text}`),
    at: new Date().toISOString(),
  };
}

export async function sendReport(kind: 'crash' | 'problem', message: string, detail: Record<string, unknown> = {}): Promise<void> {
  await callJson('report', { kind, message: message.slice(0, 4000), detail: { ...context(), ...detail } });
}

// Reports a crash unless one was reported in the last minute or five have
// gone already this session. Never throws.
export function reportCrash(message: string, detail: Record<string, unknown> = {}) {
  const now = Date.now();
  remember(recentErrors, message, 20);
  if (now - lastCrashAt < 60_000 || crashesThisSession >= 5) return;
  lastCrashAt = now;
  crashesThisSession++;
  sendReport('crash', message, detail).catch(() => {});
}

const describe = (e: unknown): { message: string; stack: string } => {
  if (e instanceof Error) return { message: e.message || String(e), stack: (e.stack || '').slice(0, 4000) };
  if (typeof e === 'string') return { message: e, stack: '' };
  try { return { message: JSON.stringify(e).slice(0, 600), stack: '' }; } catch { return { message: String(e), stack: '' }; }
};

// Global handlers: once, from the root layout.
export function installReporting() {
  if (installed) return;
  installed = true;
  // Console errors are kept (not sent) so a report carries what preceded it.
  const original = console.error;
  console.error = (...args: unknown[]) => {
    try { remember(recentErrors, args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '), 20); } catch { /* keep going */ }
    original(...args);
  };
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => {
      const d = describe(ev.error ?? ev.message);
      reportCrash(d.message, { stack: d.stack, source: `${ev.filename ?? ''}:${ev.lineno ?? ''}` });
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const d = describe((ev as PromiseRejectionEvent).reason);
      reportCrash(`Unhandled: ${d.message}`, { stack: d.stack });
    });
  } else {
    const utils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } }).ErrorUtils;
    if (utils) {
      const prev = utils.getGlobalHandler();
      utils.setGlobalHandler((e, fatal) => {
        const d = describe(e);
        reportCrash(`${fatal ? 'Fatal: ' : ''}${d.message}`, { stack: d.stack });
        prev?.(e, fatal);
      });
    }
  }
}

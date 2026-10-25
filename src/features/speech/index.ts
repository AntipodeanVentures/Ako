import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// Sound. Two directions:
//  - speak(): the device reads a phrase or a lesson aloud (expo-speech; the browser's own voices on the web).
//    A language subject's phrases are read in that language, so the learner hears the sounds the lesson is about.
//  - dictation (useDictation.ts): the learner speaks an answer instead of typing it, where the browser offers
//    speech recognition (Chrome on Android and desktop; Safari in part). Native builds come later.

// What the plan calls the language ("pt-BR", "Spanish", "Brazilian Portuguese") mapped to a speech locale.
const LOCALES: [RegExp, string][] = [
  [/^pt-?br|brazil/i, 'pt-BR'], [/^pt|portug/i, 'pt-PT'], [/^es-?mx|mexic/i, 'es-MX'], [/^es|spanish|castellano|español/i, 'es-ES'],
  [/^fr|french|français/i, 'fr-FR'], [/^de|german|deutsch/i, 'de-DE'], [/^it|italian/i, 'it-IT'], [/^ja|japanese/i, 'ja-JP'],
  [/^zh|mandarin|chinese/i, 'zh-CN'], [/^ko|korean/i, 'ko-KR'], [/^ar|arabic/i, 'ar-SA'], [/^ru|russian/i, 'ru-RU'],
  [/^nl|dutch/i, 'nl-NL'], [/^sv|swedish/i, 'sv-SE'], [/^pl|polish/i, 'pl-PL'], [/^tr|turkish/i, 'tr-TR'], [/^hi|hindi/i, 'hi-IN'],
  [/^el|greek/i, 'el-GR'], [/^he|hebrew/i, 'he-IL'], [/^mi|m(ā|a)ori|te reo/i, 'mi-NZ'], [/^en|english/i, 'en-GB'],
];
export function localeFor(language: string | null | undefined): string | null {
  if (!language) return null;
  const l = language.trim();
  if (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(l) && l.includes('-')) return l;
  for (const [re, code] of LOCALES) if (re.test(l)) return code;
  return null;
}

export function canSpeak(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Common English function words: a phrase with one of them is read in English even in a language subject;
// a phrase without is read in the target language (the card's back, an option, a sentence in the lesson).
const ENGLISH = /\b(the|is|are|was|what|how|which|you|your|a|an|to|of|and|in|do|does|say|mean|means|this|that|it|for|with|when|why|who)\b/i;
export const looksEnglish = (text: string) => ENGLISH.test(text);

// "Ana é médica. (Ana is a doctor.)" -> "Ana é médica." A bracketed translation is for the eye, not the voice.
export const withoutTranslation = (text: string) => text.replace(/\s*\([^()]*\)/g, '').trim() || text;

let current: { id: number } | null = null;
let seq = 0;
// A read-aloud run (several paragraphs). Any stop, or any single phrase spoken, ends the run after its current part.
let run = 0;

export function stopSpeaking() {
  run++;
  current = null;
  try { Speech.stop(); } catch { /* nothing was speaking */ }
}

// Speaks one string. Resolves when it ends or is stopped. Any earlier speech, including a read-aloud run, is stopped first.
export function speak(text: string, locale: string | null = null, rate = 0.95): Promise<void> {
  run++;
  return speakOne(text, locale, rate);
}

function speakOne(text: string, locale: string | null = null, rate = 0.95): Promise<void> {
  const t = text.trim();
  if (!t || !canSpeak()) return Promise.resolve();
  try { Speech.stop(); } catch { /* nothing was speaking */ }
  const me = { id: ++seq };
  current = me;
  return new Promise((resolve) => {
    const done = () => { if (current === me) current = null; resolve(); };
    try {
      Speech.speak(t, { language: locale ?? 'en-GB', rate, onDone: done, onStopped: done, onError: done });
    } catch {
      done();
    }
  });
}

// Reads paragraphs in order; stops when stopSpeaking() is called or another run starts.
export async function speakAll(parts: string[], locale: string | null = null): Promise<void> {
  const me = ++run;
  for (const p of parts) {
    if (run !== me) return;
    await speakOne(p, locale);
  }
}

export const isSpeaking = () => current !== null;

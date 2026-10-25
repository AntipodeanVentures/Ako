import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Speaking an answer instead of typing it, through the browser's speech recognition where it exists
// (Chrome on Android and desktop; Safari in part). Where it does not, the control is simply not shown and the
// keyboard's own microphone remains. Interim results stream into the field as they arrive.

type RecognitionResultEvent = { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => recognitionClass() !== null;

// onText receives the whole utterance so far (interim), then the final text with final = true.
export function useDictation(onText: (text: string, final: boolean) => void, lang = 'en-GB') {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const handler = useRef(onText);
  handler.current = onText;

  const stop = useCallback(() => {
    try { rec.current?.stop(); } catch { /* already stopped */ }
  }, []);

  const start = useCallback(() => {
    const R = recognitionClass();
    if (!R || listening) return;
    try {
      const r = new R();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        let text = '';
        let final = false;
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) final = true;
        }
        handler.current(text.trim(), final);
      };
      r.onerror = (e) => {
        setError(e?.error === 'not-allowed' ? 'The microphone is blocked for this site.' : e?.error === 'no-speech' ? null : 'Could not hear that.');
        setListening(false);
      };
      r.onend = () => setListening(false);
      rec.current = r;
      setError(null);
      r.start();
      setListening(true);
    } catch {
      setError('Dictation is not available here.');
      setListening(false);
    }
  }, [lang, listening]);

  useEffect(() => () => { try { rec.current?.abort(); } catch { /* fine */ } }, []);

  return { supported: dictationSupported(), listening, error, start, stop };
}

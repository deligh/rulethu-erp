"use client";

// Browser speech-to-text (Web Speech API). Works in Chrome/Edge on desktop and
// Android; Safari support varies. Returns supported=false where unavailable.

import { useCallback, useEffect, useRef, useState } from "react";

type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

function makeRecognizer(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

/** Short dictation: calls onFinal with each finalised phrase. */
export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<SR | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => { setSupported(!!makeRecognizer()); }, []);

  const start = useCallback(() => {
    const r = makeRecognizer();
    if (!r) return;
    r.lang = "en-ZW"; r.continuous = false; r.interimResults = false;
    r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim()); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, []);
  const stop = useCallback(() => { rec.current?.stop(); setListening(false); }, []);
  return { supported, listening, start, stop };
}

/** Long-running transcription for meetings: keeps restarting until stopped. */
export function useTranscriber() {
  const [supported, setSupported] = useState(false);
  const [running, setRunning] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<SR | null>(null);
  const want = useRef(false);

  useEffect(() => { setSupported(!!makeRecognizer()); }, []);

  const boot = useCallback(() => {
    const r = makeRecognizer();
    if (!r) return;
    r.lang = "en-ZW"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) setFinalText((s) => (s + " " + t.trim()).trim());
        else inter += t;
      }
      setInterim(inter);
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { setError("Microphone permission was denied."); want.current = false; setRunning(false); } };
    r.onend = () => { setInterim(""); if (want.current) { try { r.start(); } catch { /* restart race */ } } else setRunning(false); };
    rec.current = r;
    try { r.start(); } catch { /* already started */ }
  }, []);

  const start = useCallback(() => { setError(""); want.current = true; setRunning(true); boot(); }, [boot]);
  const stop = useCallback(() => { want.current = false; rec.current?.stop(); setRunning(false); }, []);
  const reset = useCallback(() => { setFinalText(""); setInterim(""); }, []);
  return { supported, running, finalText, interim, error, start, stop, reset, setFinalText };
}

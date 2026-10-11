import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import type { Answer } from '../protocol/notes';
import type { Stimulus } from '../protocol/curriculum';
import { scoreTrial, type TrialRecord } from '../protocol/progression';

export type TrialPhase = 'ready' | 'loading' | 'playing' | 'feedback' | 'done';

interface Options {
  stimuli: Stimulus[];
  windowMs: number;
  feedback: boolean;
  onDone?: (records: TrialRecord[]) => void;
}

const FEEDBACK_MS = 1000;
const NO_FEEDBACK_PAUSE_MS = 250;

/**
 * Corre una secuencia de trials. Cada trial lo arranca la persona (como en el paper):
 * suena la nota, las opciones quedan activas desde el inicio y el tiempo se mide
 * desde que empieza a sonar. Si no responde dentro de la ventana, es error.
 */
export function useTrialRunner({ stimuli, windowMs, feedback, onDone }: Options) {
  const engine = getAudioEngine();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<TrialPhase>('ready');
  const [records, setRecords] = useState<TrialRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onsetRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledRef = useRef(false);
  const recordsRef = useRef<TrialRecord[]>([]);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (advanceRef.current) clearTimeout(advanceRef.current);
      engine.stopNotes();
    },
    [engine]
  );

  const settle = useCallback(
    (answer: Answer | null, rtMs: number | null) => {
      if (settledRef.current) return;
      settledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const record = scoreTrial(stimuli[index], answer, rtMs, windowMs);
      const next = [...recordsRef.current, record];
      recordsRef.current = next;
      setRecords(next);
      setPhase('feedback');

      advanceRef.current = setTimeout(
        () => {
          if (index + 1 >= stimuli.length) {
            setPhase('done');
            onDoneRef.current?.(next);
          } else {
            setIndex(index + 1);
            setPhase('ready');
          }
        },
        feedback ? FEEDBACK_MS : NO_FEEDBACK_PAUSE_MS
      );
    },
    [stimuli, index, windowMs, feedback]
  );

  const start = useCallback(async () => {
    if (phase !== 'ready') return;
    setError(null);
    setPhase('loading');
    settledRef.current = false;
    onsetRef.current = null;
    try {
      const onset = await engine.playMidi(stimuli[index].midi, stimuli[index].timbre);
      onsetRef.current = onset;
      // Las opciones se activan cuando la nota empieza a sonar, no antes.
      await new Promise((r) => setTimeout(r, Math.max(0, onset - performance.now())));
      setPhase('playing');
      const remaining = windowMs + (onset - performance.now());
      timeoutRef.current = setTimeout(() => settle(null, null), Math.max(0, remaining));
    } catch (e) {
      console.error(e);
      setError('No se pudo reproducir el sonido. Revisá la conexión y probá de nuevo.');
      setPhase('ready');
    }
  }, [phase, engine, stimuli, index, windowMs, settle]);

  const answer = useCallback(
    (value: Answer) => {
      if (phase !== 'playing' || onsetRef.current === null) return;
      const rt = Math.max(0, performance.now() - onsetRef.current);
      settle(value, rt);
    },
    [phase, settle]
  );

  return {
    index,
    total: stimuli.length,
    phase,
    records,
    lastRecord: records[records.length - 1] ?? null,
    current: stimuli[index],
    error,
    start,
    answer,
  };
}

import React, { useEffect, useRef, useState } from 'react';
import { useProtocol } from '../state/protocol-context';
import { getAudioEngine } from '../audio/engine';
import { RandomizationEngine } from '../utils/randomization';
import { CHROMATIC_NOTES, getNotesForLevel, PROTOCOL_CONFIG, RETENTION_TEST_TRIALS } from '../protocol/config';
import { createTrial } from '../services/storage';

interface RetentionTestProps {
  week: number;
  onTestComplete: () => void;
}

type TestStatus = 'playing' | 'waiting_response' | 'results';

interface TestMetrics {
  accuracy: number;
  rtAvg: number;
  passed: boolean;
}

export const RetentionTest: React.FC<RetentionTestProps> = ({ week, onTestComplete }) => {
  const { user, currentSession, submitTestResponse, addTrialToSession } = useProtocol();
  const audioEngineRef = useRef(getAudioEngine());
  const randomizerRef = useRef<RandomizationEngine | null>(null);
  const responseStartRef = useRef<number | null>(null);
  const currentTrialRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trialResultsRef = useRef<Array<{ correct: boolean; reactionTime: number }>>([]);
  const playedTrialKeyRef = useRef<string | null>(null);

  const notePool = week === 8 ? CHROMATIC_NOTES : getNotesForLevel(user?.current_level || 1);
  const totalTrials = week === 2 ? RETENTION_TEST_TRIALS.week2 : week === 4 ? RETENTION_TEST_TRIALS.week4 : RETENTION_TEST_TRIALS.final;
  const [trialNumber, setTrialNumber] = useState(1);
  const [status, setStatus] = useState<TestStatus>('playing');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TestMetrics | null>(null);

  useEffect(() => {
    randomizerRef.current = new RandomizationEngine(notePool, true);
    trialResultsRef.current = [];
    playedTrialKeyRef.current = null;
    setTrialNumber(1);
    setStatus('playing');
    setSelectedNote(null);
    setMetrics(null);
  }, [currentSession?.id, week, user?.current_level]);

  useEffect(() => {
    if (!user || !currentSession) return;
    if (trialNumber > totalTrials) return;
    const trialKey = `${currentSession.id}-${trialNumber}`;
    if (playedTrialKeyRef.current === trialKey) return;
    playedTrialKeyRef.current = trialKey;

    let cancelled = false;

    const runTrial = async () => {
      setStatus('playing');
      setSelectedNote(null);
      if (!randomizerRef.current) return;

      const trialParams = randomizerRef.current.generateTrial();
      const trial = createTrial(trialNumber, trialParams.note, trialParams.octave, trialParams.timbre, trialParams.seed);
      currentTrialRef.current = trial;
      addTrialToSession(trial);

      try {
        await audioEngineRef.current.playNote(
          trial.note,
          trial.octave,
          trial.timbre,
          PROTOCOL_CONFIG.audio.noteDuration
        );
      } catch (error) {
        console.error('Error playing test note:', error);
      }

      if (cancelled) return;

      responseStartRef.current = Date.now();
      setStatus('waiting_response');

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        submitCurrentResponse();
      }, PROTOCOL_CONFIG.trialTimeout);
    };

    runTrial();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [trialNumber, currentSession?.id, user, addTrialToSession]);

  const finalizeTest = () => {
    const total = trialResultsRef.current.length || 1;
    const correctCount = trialResultsRef.current.filter((entry) => entry.correct).length;
    const accuracy = (correctCount / total) * 100;
    const rtAvg =
      trialResultsRef.current.length > 0
        ? trialResultsRef.current.reduce((sum, entry) => sum + entry.reactionTime, 0) / trialResultsRef.current.length
        : 0;
    const rtThreshold = PROTOCOL_CONFIG.rtThresholds[9];
    const passed = accuracy >= 90 && rtAvg <= rtThreshold;

    setMetrics({
      accuracy,
      rtAvg,
      passed,
    });
    setStatus('results');
  };

  const submitCurrentResponse = (noteOverride?: string) => {
    if (!currentTrialRef.current || !responseStartRef.current || status !== 'waiting_response') {
      return;
    }

    const reactionTime = Date.now() - responseStartRef.current;
    const response = (noteOverride || selectedNote || 'NONE').toUpperCase();
    const correct = response === currentTrialRef.current.note;

    submitTestResponse(currentTrialRef.current.id, response, reactionTime);
    trialResultsRef.current.push({ correct, reactionTime });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (trialNumber >= totalTrials) {
      finalizeTest();
      return;
    }

    setTrialNumber((prev) => prev + 1);
  };

  const handleNoteClick = (note: string) => {
    if (status !== 'waiting_response') return;
    setSelectedNote(note);
    submitCurrentResponse(note);
  };

  if (!user || !currentSession) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando prueba...</p>
      </div>
    );
  }

  const weekLabel = week === 8 ? 'Final' : `Semana ${week}`;
  const progress = Math.min(100, Math.round(((trialNumber - (status === 'results' ? 0 : 1)) / totalTrials) * 100));
  const scoreProgress = metrics ? Math.max(0, Math.min(100, metrics.accuracy)) : 0;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Prueba de retención</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{weekLabel}</p>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {Math.min(trialNumber, totalTrials)} / {totalTrials}
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-cyan-500 transition-all dark:bg-cyan-400" style={{ width: `${status === 'results' ? 100 : progress}%` }} />
        </div>
      </div>

      <div className="flex min-h-[16rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/70 px-4 dark:border-slate-800 dark:bg-slate-900/60">
        {status === 'playing' && (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-400" />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Escuchando nota...</p>
          </div>
        )}

        {status === 'waiting_response' && (
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">¿Qué nota escuchaste?</p>
            {selectedNote && (
              <p className="mt-3 font-mono text-5xl font-semibold text-cyan-600 dark:text-cyan-300">{selectedNote}</p>
            )}
          </div>
        )}

        {status === 'results' && metrics && (
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {metrics.passed ? 'Prueba aprobada' : 'Prueba no aprobada'}
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900 dark:text-white">{metrics.accuracy.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aciertos</p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-400" style={{ width: `${scoreProgress}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Tiempo medio: {metrics.rtAvg.toFixed(0)}ms</p>
            {week === 8 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Puedes repetir esta prueba final las veces que necesites.
              </p>
            )}
            <button
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              onClick={onTestComplete}
            >
              Volver al inicio
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {notePool.map((note) => (
          <button
            key={note}
            className={`rounded-xl border px-3 py-3 text-center font-semibold transition ${
              selectedNote === note
                ? 'border-cyan-500 bg-cyan-500 text-slate-950 dark:border-cyan-400 dark:bg-cyan-400'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
            } ${status !== 'waiting_response' ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={() => handleNoteClick(note)}
            disabled={status !== 'waiting_response'}
          >
            {note}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Sin feedback inmediato: responde lo más rápido y preciso posible.
      </div>
    </div>
  );
};

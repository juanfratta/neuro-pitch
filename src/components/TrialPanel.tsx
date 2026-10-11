import { useEffect } from 'react';
import { OUT_OF_BOUND, answerLabel, type Answer } from '../protocol/notes';
import type { useTrialRunner } from '../hooks/useTrialRunner';
import { Button, ProgressBar } from './ui';

type Runner = ReturnType<typeof useTrialRunner>;

interface Props {
  runner: Runner;
  options: Answer[];
  feedback: boolean;
  windowMs: number;
  devMode?: boolean;
}

export function TrialPanel({ runner, options, feedback, windowMs, devMode = false }: Props) {
  const { phase, index, total, lastRecord, current, error, start, answer } = runner;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' && phase === 'ready') {
        event.preventDefault();
        void start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start]);

  const answering = phase === 'playing';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            Trial {Math.min(index + 1, total)} de {total}
          </span>
          <span>Ventana: {(windowMs / 1000).toFixed(2)} s</span>
        </div>
        <ProgressBar value={(index / total) * 100} />
      </div>

      <div className="flex min-h-[11rem] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
        {phase === 'ready' && (
          <>
            <Button onClick={() => void start()} className="px-8 py-3 text-base">
              Escuchar
            </Button>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">o barra espaciadora</p>
          </>
        )}
        {phase === 'loading' && <div className="spinner" aria-label="Cargando sonido" />}
        {phase === 'playing' && <p className="text-lg font-semibold text-slate-900 dark:text-white">¿Qué escuchaste?</p>}
        {phase === 'feedback' && lastRecord && (
          feedback ? (
            <div className={lastRecord.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              <p className="text-xl font-semibold">
                {lastRecord.correct ? 'Correcto' : lastRecord.answer === null ? 'Se pasó el tiempo' : 'Incorrecto'}
              </p>
              {!lastRecord.correct && (
                <p className="mt-1 text-sm">
                  Era: <span className="font-semibold">{answerLabel(lastRecord.stimulus.expected)}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{lastRecord.answer === null ? 'Sin respuesta' : 'Registrado'}</p>
          )
        )}
        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => answer(option)}
            disabled={!answering}
            className={`rounded-xl border px-2 py-3 text-center font-semibold transition ${
              option === OUT_OF_BOUND ? 'col-span-3 sm:col-span-2' : ''
            } ${
              answering
                ? 'border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100 dark:hover:bg-cyan-900/50'
                : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
            }`}
          >
            {answerLabel(option)}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">Sin cantar, tararear ni usar referencias. Respondé por cómo suena la nota.</p>

      {devMode && current && (
        <p className="text-center font-mono text-[11px] text-slate-400">
          dev: {current.chroma}
          {current.octave} · midi {current.midi} · {current.timbre} · esperado {current.expected}
        </p>
      )}
    </div>
  );
}

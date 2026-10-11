import { useEffect } from 'react';
import type { Answer } from '../protocol/notes';
import type { useTrialRunner } from '../hooks/useTrialRunner';
import { ChromaWheel } from './ChromaWheel';

type Runner = ReturnType<typeof useTrialRunner>;

interface Props {
  runner: Runner;
  options: Answer[];
  feedback: boolean;
  windowMs: number;
  devMode?: boolean;
}

/**
 * Sala de escucha: panel oscuro con la rueda cromática.
 * Se ve igual en tema claro y oscuro, para que el foco quede en el sonido.
 */
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

  const hint =
    phase === 'ready' ? 'Tocá el centro o la barra espaciadora'
    : phase === 'playing' ? '¿Qué escuchaste?'
    : phase === 'loading' ? 'Cargando'
    : ' ';

  return (
    <div className="listening-room relative -mx-5 overflow-hidden rounded-2xl px-4 pb-5 pt-4 sm:mx-0 sm:px-6">
      <div className="flex items-baseline justify-between text-[13px] text-[#A9B6CF]">
        <span className="tabular-nums">
          {Math.min(index + 1, total)} de {total}
        </span>
        <span className="tabular-nums">{(windowMs / 1000).toFixed(2)} s para responder</span>
      </div>

      {total <= 40 ? (
        <div className="mt-2 flex gap-[3px]" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{ background: i < index ? '#E3B35C' : i === index ? '#E3B35C80' : '#22314F' }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#22314F]" aria-hidden>
          <div className="h-full rounded-full bg-[#E3B35C] transition-[width]" style={{ width: `${(index / total) * 100}%` }} />
        </div>
      )}

      <div className="mt-4">
        <ChromaWheel
          options={options}
          phase={phase}
          trialIndex={index}
          windowMs={windowMs}
          feedback={feedback}
          lastRecord={lastRecord}
          onListen={() => void start()}
          onAnswer={answer}
        />
      </div>

      <p className="mt-2 text-center text-sm text-[#A9B6CF]" aria-live="polite">
        {hint}
      </p>
      {error && <p className="mt-2 text-center text-sm text-[#FF7A6B]">{error}</p>}
      <p className="mt-4 text-center text-xs text-[#6F7E9C]">Sin cantar, tararear ni usar referencias.</p>

      {devMode && current && (
        <p className="mt-2 text-center font-mono text-[11px] text-[#6F7E9C]">
          dev: {current.chroma}
          {current.octave} · midi {current.midi} · {current.timbre} · esperado {current.expected}
        </p>
      )}
    </div>
  );
}

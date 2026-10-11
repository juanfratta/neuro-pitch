import { useEffect } from 'react';
import { OUT_OF_BOUND, displayNote, type Answer } from '../protocol/notes';
import type { useTrialRunner } from '../hooks/useTrialRunner';
import { ChromaWheel } from './ChromaWheel';
import { readRevealAnswers } from '../utils/app-mode';

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
 * Tiene paleta de día y de noche (variables --np-* en index.css).
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
    : phase === 'playing'
      ? options.includes(OUT_OF_BOUND)
        ? options.length === 2
          ? `¿Es ${displayNote(options[0])}? Si no, tocá el centro: fuera de rango`
          : '¿Qué escuchaste? Si no es ninguna de tus notas, tocá el centro'
        : '¿Qué escuchaste?'
    : phase === 'loading' ? 'Cargando'
    : ' ';

  return (
    <div className="listening-room relative -mx-5 overflow-hidden rounded-2xl px-4 pb-5 pt-4 sm:mx-0 sm:px-6">
      <div className="flex items-baseline justify-between text-[13px] text-[var(--np-mist)]">
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
              style={{ background: i <= index ? 'var(--np-brass)' : 'var(--np-track)', opacity: i === index ? 0.5 : 1 }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--np-track)]" aria-hidden>
          <div className="h-full rounded-full bg-[var(--np-brass)] transition-[width]" style={{ width: `${(index / total) * 100}%` }} />
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

      <p className="mt-2 text-center text-sm text-[var(--np-mist)]" aria-live="polite">
        {hint}
      </p>
      {error && <p className="mt-2 text-center text-sm text-[var(--np-coral)]">{error}</p>}
      <p className="mt-4 text-center text-xs text-[var(--np-muted)]">Sin cantar, tararear ni usar referencias.</p>

      {devMode && readRevealAnswers() && current && (
        <p className="mt-2 text-center font-mono text-[11px] text-[var(--np-coral)]">
          dev: {current.chroma}
          {current.octave} · midi {current.midi} · {current.timbre} · esperado {current.expected}
        </p>
      )}
    </div>
  );
}

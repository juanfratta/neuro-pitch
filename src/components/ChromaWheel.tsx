/**
 * Rueda cromática: las 12 notas en círculo, como el croma que se entrena.
 *
 * El centro cumple dos funciones: antes de cada trial es "Escuchar" y, mientras suena
 * la nota, es "Fuera de rango". Así, después de tocar Escuchar el cursor o el dedo ya
 * está sobre fuera de rango, y todas las notas quedan a la misma distancia.
 *
 * Reglas que la rueda respeta (ver AGENTS.md):
 * - Nada en pantalla depende de la nota que suena antes de responder. El pulso al
 *   sonar es idéntico para las 12 notas.
 * - En niveles sin feedback no se revela nada: ni color ni arco.
 */

import { motion, useReducedMotion } from 'motion/react';
import { CHROMAS, OUT_OF_BOUND, chromaIndex, displayNote, noteParts, type Answer, type Chroma } from '../protocol/notes';
import type { TrialRecord } from '../protocol/progression';
import type { TrialPhase } from '../hooks/useTrialRunner';

const C = 210;
const VIEW = 176; // medio lado del viewBox
const NOTE_RADIUS = 142;
const NOTE_SIZE = 28;
const TIMER_RADIUS = 100;
const CENTER_RADIUS = 80;
const LOCKED_LABEL_RADIUS = 118;

/** Colores por tema: definidos como variables en index.css (.dark cambia la paleta). */
const COLORS = {
  room: 'var(--np-room)',
  surface: 'var(--np-surface)',
  dot: 'var(--np-dot)',
  center: 'var(--np-center)',
  onAccent: 'var(--np-on-accent)',
  faint: 'var(--np-faint)',
  mist: 'var(--np-mist)',
  brass: 'var(--np-brass)',
  mint: 'var(--np-mint)',
  coral: 'var(--np-coral)',
  lavender: 'var(--np-lavender)',
};
const FILL_TRANSITION = 'fill 200ms ease, stroke 200ms ease';
const SERIF = '"Fraunces", Georgia, serif';

function polar(index: number, radius: number) {
  const angle = ((index * 30 - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) };
}

/** Arco por el camino más corto entre dos notas, sobre el radio de las notas. */
function arcPath(from: number, to: number, radius: number): string {
  const delta = ((((to - from) % 12) + 18) % 12) - 6; // -6..5
  const a = polar(from, radius);
  const b = polar(to, radius);
  const sweep = delta >= 0 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 ${sweep} ${b.x} ${b.y}`;
}

interface Props {
  options: Answer[];
  phase: TrialPhase;
  trialIndex: number;
  windowMs: number;
  feedback: boolean;
  lastRecord: TrialRecord | null;
  onListen: () => void;
  onAnswer: (answer: Answer) => void;
  /** Vista estática para explicar cómo responder: sin interacción. */
  preview?: boolean;
}

type NoteState = 'idle' | 'active' | 'locked' | 'correct' | 'wrong' | 'reveal';

/** Nombre de la nota en el círculo: sostenido grande y bemol chico debajo. */
function NoteLabel({ note, x, y, size, color, compact = false }: { note: Chroma; x: number; y: number; size: number; color: string; compact?: boolean }) {
  const { main, alt } = noteParts(note);
  if (!alt || compact) {
    return (
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={size} className="pointer-events-none" style={{ fontFamily: SERIF, fontWeight: 600, fill: color }}>
        {main}
      </text>
    );
  }
  return (
    <text x={x} y={y} textAnchor="middle" className="pointer-events-none" style={{ fontFamily: SERIF, fontWeight: 600, fill: color }}>
      <tspan x={x} dy={-size * 0.08} fontSize={size * 0.8}>
        {main}
      </tspan>
      <tspan x={x} dy={size * 0.72} fontSize={size * 0.52} style={{ opacity: 0.8 }}>
        {alt}
      </tspan>
    </text>
  );
}

export function ChromaWheel({ options, phase, trialIndex, windowMs, feedback, lastRecord, onListen, onAnswer, preview = false }: Props) {
  const reduceMotion = useReducedMotion();
  const answering = phase === 'playing' && !preview;
  const lit = answering || preview;
  const hasOutOfBound = options.includes(OUT_OF_BOUND);
  const showFeedback = phase === 'feedback' && feedback && lastRecord !== null && !preview;

  const expected = lastRecord?.stimulus.expected ?? null;
  const answered = lastRecord?.answer ?? null;
  const heard = lastRecord?.stimulus.chroma ?? null;

  const noteState = (note: Chroma): NoteState => {
    const isOption = options.includes(note);
    if (showFeedback) {
      if (note === expected) return 'correct';
      if (note === answered && !lastRecord!.correct) return 'wrong';
      if (expected === OUT_OF_BOUND && note === heard) return 'reveal';
    }
    if (!isOption) return 'locked';
    return lit ? 'active' : 'idle';
  };

  // Arco de error: de la respuesta a la nota que sonó, solo con feedback y respuesta con nombre.
  const arc =
    showFeedback && !lastRecord!.correct && answered && answered !== OUT_OF_BOUND && heard
      ? arcPath(chromaIndex(answered), chromaIndex(heard), NOTE_RADIUS)
      : null;

  // Qué es el centro en cada momento
  type CenterMode = 'listen' | 'out' | 'idle' | 'result';
  const centerMode: CenterMode =
    preview ? (hasOutOfBound ? 'out' : 'idle')
    : phase === 'ready' ? 'listen'
    : answering && hasOutOfBound ? 'out'
    : phase === 'feedback' ? 'result'
    : 'idle';
  const centerClickable = !preview && (centerMode === 'listen' || (centerMode === 'out' && answering));

  const resultText = (() => {
    if (!lastRecord || phase !== 'feedback') return '';
    if (!feedback) return lastRecord.answer === null ? 'Sin respuesta' : 'Registrado';
    if (lastRecord.correct) return 'Correcto';
    if (lastRecord.answer === null) return 'Tiempo';
    return expected === OUT_OF_BOUND ? `Sonó ${displayNote(heard ?? '')}` : `Era ${displayNote(expected ?? '')}`;
  })();

  const outRight = showFeedback && expected === OUT_OF_BOUND && lastRecord!.correct;
  const outWrong = showFeedback && answered === OUT_OF_BOUND && !lastRecord!.correct;
  const centerFill =
    centerMode === 'listen' ? COLORS.brass
    : centerMode === 'out' ? COLORS.lavender
    : outRight ? COLORS.mint
    : outWrong ? COLORS.coral
    : COLORS.center;
  const centerTextColor =
    centerMode === 'listen' || centerMode === 'out' || outRight || outWrong ? COLORS.onAccent
    : showFeedback ? (lastRecord!.correct ? COLORS.mint : COLORS.coral)
    : COLORS.mist;

  const timerLength = 2 * Math.PI * TIMER_RADIUS;

  const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const onCenter = () => {
    if (preview) return;
    if (centerMode === 'listen') onListen();
    else if (centerMode === 'out' && answering) onAnswer(OUT_OF_BOUND);
  };

  return (
    <svg
      viewBox={`${C - VIEW} ${C - VIEW} ${VIEW * 2} ${VIEW * 2}`}
      className="mx-auto block w-full max-w-[420px] select-none"
      role={preview ? 'img' : 'group'}
      aria-label={preview ? 'Ejemplo de la rueda de respuestas' : 'Rueda de notas'}
    >
      <defs>
        <radialGradient id="wheel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.surface} stopOpacity="0.9" />
          <stop offset="70%" stopColor={COLORS.room} stopOpacity="0.4" />
          <stop offset="100%" stopColor={COLORS.room} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={VIEW - 2} fill="url(#wheel-glow)" />

      {/* Guía circular de las notas */}
      <circle cx={C} cy={C} r={NOTE_RADIUS} fill="none" style={{ stroke: COLORS.faint }} strokeOpacity={0.45} strokeWidth={1} />

      {/* Arco de error */}
      {arc && (
        <motion.path
          key={`arc-${trialIndex}`}
          d={arc}
          fill="none"
          style={{ stroke: COLORS.coral }}
          strokeWidth={6}
          strokeLinecap="round"
          initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0.9 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ duration: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}
        />
      )}

      {/* Notas */}
      {CHROMAS.map((note, i) => {
        const { x, y } = polar(i, NOTE_RADIUS);
        const label = polar(i, LOCKED_LABEL_RADIUS);
        const state = noteState(note);
        const clickable = state === 'active' && answering;
        const isOption = options.includes(note) && !preview;
        const fill =
          state === 'correct' ? COLORS.mint
          : state === 'wrong' ? COLORS.coral
          : state === 'active' ? COLORS.brass
          : state === 'idle' ? COLORS.surface
          : state === 'reveal' ? COLORS.faint
          : COLORS.dot;
        const textColor =
          state === 'active' || state === 'correct' || state === 'wrong' ? COLORS.onAccent
          : state === 'idle' ? COLORS.brass
          : state === 'reveal' ? COLORS.mist
          : COLORS.faint;
        const isLockedDot = state === 'locked';
        return (
          <g
            key={note}
            role={isOption ? 'button' : undefined}
            aria-label={isOption ? note : undefined}
            aria-disabled={isOption ? !clickable : undefined}
            tabIndex={clickable ? 0 : -1}
            onClick={() => clickable && onAnswer(note)}
            onKeyDown={keyActivate(() => clickable && onAnswer(note))}
            className={clickable ? 'cursor-pointer outline-none [&:focus-visible>g>circle]:stroke-white' : 'outline-none'}
          >
            <motion.g
              whileHover={clickable && !reduceMotion ? { scale: 1.08 } : undefined}
              whileTap={clickable && !reduceMotion ? { scale: 0.94 } : undefined}
              style={{ transformOrigin: `${x}px ${y}px` }}
            >
              <circle
                cx={x}
                cy={y}
                r={isLockedDot ? 9 : NOTE_SIZE}
                strokeOpacity={0.6}
                strokeWidth={1.5}
                style={{
                  fill,
                  stroke: state === 'idle' ? COLORS.brass : 'transparent',
                  transition: reduceMotion ? undefined : FILL_TRANSITION,
                }}
              />
            </motion.g>
            {isLockedDot ? (
              <NoteLabel note={note} x={label.x} y={label.y} size={12} color={COLORS.faint} compact />
            ) : (
              <NoteLabel note={note} x={x} y={y} size={21} color={textColor} />
            )}
          </g>
        );
      })}

      {/* Temporizador: se vacía durante la ventana de respuesta */}
      <circle cx={C} cy={C} r={TIMER_RADIUS} fill="none" style={{ stroke: COLORS.faint }} strokeOpacity={0.4} strokeWidth={3} />
      {phase === 'playing' && !preview && (
        <motion.circle
          key={`timer-${trialIndex}`}
          cx={C}
          cy={C}
          r={TIMER_RADIUS}
          fill="none"
          style={{ stroke: COLORS.brass }}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={timerLength}
          transform={`rotate(-90 ${C} ${C})`}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: timerLength }}
          transition={{ duration: windowMs / 1000, ease: 'linear' }}
        />
      )}

      {/* Pulso al sonar: igual para todas las notas */}
      {phase === 'playing' && !preview && !reduceMotion && (
        <motion.circle
          key={`pulse-${trialIndex}`}
          cx={C}
          cy={C}
          r={CENTER_RADIUS}
          fill="none"
          style={{ stroke: COLORS.brass }}
          strokeWidth={2}
          initial={{ r: CENTER_RADIUS, opacity: 0.7 }}
          animate={{ r: TIMER_RADIUS + 24, opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* Centro: Escuchar, o Fuera de rango mientras suena */}
      <g
        role={centerClickable ? 'button' : undefined}
        aria-label={centerClickable ? (centerMode === 'listen' ? 'Escuchar' : 'Fuera de rango') : undefined}
        tabIndex={centerClickable ? 0 : -1}
        onClick={onCenter}
        onKeyDown={keyActivate(onCenter)}
        className={centerClickable ? 'cursor-pointer outline-none' : 'outline-none'}
      >
        <motion.g
          whileHover={centerClickable && !reduceMotion ? { scale: 1.04 } : undefined}
          whileTap={centerClickable && !reduceMotion ? { scale: 0.97 } : undefined}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          <circle
            cx={C}
            cy={C}
            r={CENTER_RADIUS}
            strokeWidth={2}
            style={{
              fill: centerFill,
              stroke: centerMode === 'idle' || centerMode === 'result' ? COLORS.faint : 'transparent',
              transition: reduceMotion ? undefined : FILL_TRANSITION,
            }}
          />
        </motion.g>
        {phase === 'loading' && !preview && (
          <motion.circle
            cx={C}
            cy={C}
            r={18}
            fill="none"
            strokeWidth={2}
            strokeDasharray="28 200"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${C}px ${C}px`, stroke: COLORS.mist }}
          />
        )}
        <text x={C} y={C} textAnchor="middle" className="pointer-events-none" style={{ fontFamily: SERIF, fontWeight: 600, fill: centerTextColor }}>
          {centerMode === 'listen' && (
            <tspan x={C} dy="0.35em" fontSize={20}>
              Escuchar
            </tspan>
          )}
          {centerMode === 'out' && (
            <>
              <tspan x={C} dy="-0.25em" fontSize={18}>
                Fuera
              </tspan>
              <tspan x={C} dy="1.15em" fontSize={18}>
                de rango
              </tspan>
            </>
          )}
          {centerMode === 'result' && (
            <tspan x={C} dy="0.35em" fontSize={resultText.length > 10 ? 14 : 19}>
              {resultText}
            </tspan>
          )}
        </text>
      </g>
    </svg>
  );
}

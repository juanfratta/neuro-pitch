/**
 * Rueda cromática: las 12 notas en círculo, como el croma que se entrena.
 *
 * Reglas que la rueda respeta (ver AGENTS.md):
 * - Nada en pantalla depende de la nota que suena antes de responder. El pulso al
 *   sonar es idéntico para las 12 notas.
 * - En niveles sin feedback no se revela nada: ni color ni arco.
 * - Todas las opciones quedan a la misma distancia del centro.
 */

import { motion, useReducedMotion } from 'motion/react';
import { CHROMAS, OUT_OF_BOUND, chromaIndex, displayNote, type Answer, type Chroma } from '../protocol/notes';
import type { TrialRecord } from '../protocol/progression';
import type { TrialPhase } from '../hooks/useTrialRunner';

const SIZE = 420;
const C = SIZE / 2;
const NOTE_RADIUS = 142;
const NOTE_SIZE = 27;
const TIMER_RADIUS = 100;
const CENTER_RADIUS = 78;
const RING_INNER = 178;
const RING_OUTER = 204;
/** Línea base del texto del anillo: centrado en la banda. */
const RING_LABEL = (RING_INNER + RING_OUTER) / 2 - 4;
const LOCKED_LABEL_RADIUS = 120;

const COLORS = {
  night: '#0F1B33',
  deep: '#0A1326',
  slate: '#22314F',
  faint: '#3A4A6B',
  mist: '#A9B6CF',
  brass: '#E3B35C',
  mint: '#7FD1AE',
  coral: '#FF7A6B',
  lavender: '#8E93D6',
};

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

function ringPath(): string {
  // anillo completo como dos semicírculos (para que sea clickeable como un solo trazo)
  const r = (RING_INNER + RING_OUTER) / 2;
  return `M ${C - r} ${C} A ${r} ${r} 0 1 1 ${C + r} ${C} A ${r} ${r} 0 1 1 ${C - r} ${C}`;
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
}

type NoteState = 'idle' | 'active' | 'locked' | 'correct' | 'wrong' | 'reveal';

export function ChromaWheel({ options, phase, trialIndex, windowMs, feedback, lastRecord, onListen, onAnswer }: Props) {
  const reduceMotion = useReducedMotion();
  const answering = phase === 'playing';
  const hasOutOfBound = options.includes(OUT_OF_BOUND);
  const showFeedback = phase === 'feedback' && feedback && lastRecord !== null;

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
    return answering ? 'active' : 'idle';
  };

  const ringState: NoteState = showFeedback
    ? expected === OUT_OF_BOUND
      ? 'correct'
      : answered === OUT_OF_BOUND
        ? 'wrong'
        : answering
          ? 'active'
          : 'idle'
    : answering
      ? 'active'
      : 'idle';

  // Arco de error: de la respuesta a la nota que sonó, solo con feedback y respuesta con nombre.
  const arc =
    showFeedback && !lastRecord!.correct && answered && answered !== OUT_OF_BOUND && heard
      ? arcPath(chromaIndex(answered), chromaIndex(heard), NOTE_RADIUS)
      : null;

  const timerLength = 2 * Math.PI * TIMER_RADIUS;

  const centerLabel = (() => {
    if (phase === 'ready') return 'Escuchar';
    if (phase === 'loading') return '';
    if (phase === 'playing') return '';
    if (phase === 'feedback' && lastRecord) {
      if (!feedback) return lastRecord.answer === null ? 'Sin respuesta' : 'Registrado';
      if (lastRecord.correct) return 'Correcto';
      if (lastRecord.answer === null) return 'Tiempo';
      return expected === OUT_OF_BOUND ? `Sonó ${displayNote(heard ?? '')}` : `Era ${displayNote(expected ?? '')}`;
    }
    return '';
  })();

  const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <svg viewBox={hasOutOfBound ? `0 0 ${SIZE} ${SIZE}` : `${C - 176} ${C - 176} 352 352`} className="mx-auto block w-full max-w-[440px] select-none" role="group" aria-label="Rueda de notas">
      <defs>
        <radialGradient id="wheel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.slate} stopOpacity="0.9" />
          <stop offset="70%" stopColor={COLORS.night} stopOpacity="0.4" />
          <stop offset="100%" stopColor={COLORS.night} stopOpacity="0" />
        </radialGradient>
        <path id="ring-label-path" d={`M ${C - RING_LABEL} ${C} A ${RING_LABEL} ${RING_LABEL} 0 0 1 ${C + RING_LABEL} ${C}`} />
      </defs>

      <circle cx={C} cy={C} r={RING_INNER - 4} fill="url(#wheel-glow)" />

      {/* Anillo fuera de rango */}
      {hasOutOfBound && (
        <g
          role="button"
          aria-label="Fuera de rango"
          aria-disabled={!answering}
          tabIndex={answering ? 0 : -1}
          onClick={() => answering && onAnswer(OUT_OF_BOUND)}
          onKeyDown={keyActivate(() => answering && onAnswer(OUT_OF_BOUND))}
          className={answering ? 'cursor-pointer outline-none' : 'outline-none'}
        >
          <motion.path
            d={ringPath()}
            fill="none"
            strokeWidth={RING_OUTER - RING_INNER}
            animate={{
              stroke:
                ringState === 'correct' ? COLORS.mint : ringState === 'wrong' ? COLORS.coral : COLORS.lavender,
              strokeOpacity: ringState === 'active' ? 0.38 : ringState === 'idle' ? 0.14 : 0.75,
            }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          />
          <text fontSize="11" letterSpacing="3" fill={ringState === 'idle' ? COLORS.faint : COLORS.deep} style={{ fontWeight: 600 }}>
            <textPath href="#ring-label-path" startOffset="50%" textAnchor="middle">
              fuera de rango
            </textPath>
          </text>
        </g>
      )}

      {/* Guía circular de las notas */}
      <circle cx={C} cy={C} r={NOTE_RADIUS} fill="none" stroke={COLORS.faint} strokeOpacity={0.35} strokeWidth={1} />

      {/* Arco de error */}
      {arc && (
        <motion.path
          key={`arc-${trialIndex}`}
          d={arc}
          fill="none"
          stroke={COLORS.coral}
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
        const clickable = state === 'active';
        const fill =
          state === 'correct' ? COLORS.mint
          : state === 'wrong' ? COLORS.coral
          : state === 'active' ? COLORS.brass
          : state === 'idle' ? COLORS.slate
          : state === 'reveal' ? COLORS.faint
          : COLORS.deep;
        const textColor =
          state === 'active' || state === 'correct' || state === 'wrong' ? COLORS.deep
          : state === 'idle' ? COLORS.brass
          : state === 'reveal' ? COLORS.mist
          : COLORS.faint;
        const isLockedDot = state === 'locked';
        return (
          <g
            key={note}
            role={options.includes(note) ? 'button' : undefined}
            aria-label={options.includes(note) ? note : undefined}
            aria-disabled={options.includes(note) ? !clickable : undefined}
            tabIndex={clickable ? 0 : -1}
            onClick={() => clickable && onAnswer(note)}
            onKeyDown={keyActivate(() => clickable && onAnswer(note))}
            className={clickable ? 'cursor-pointer outline-none [&:focus-visible>circle]:stroke-white' : 'outline-none'}
          >
            <motion.circle
              cx={x}
              cy={y}
              r={isLockedDot ? 9 : NOTE_SIZE}
              initial={false}
              animate={{ r: isLockedDot ? 9 : NOTE_SIZE, fill }}
              stroke={state === 'idle' ? COLORS.brass : 'transparent'}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              whileHover={clickable && !reduceMotion ? { scale: 1.08 } : undefined}
              whileTap={clickable && !reduceMotion ? { scale: 0.94 } : undefined}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
            <text
              x={isLockedDot ? label.x : x}
              y={isLockedDot ? label.y : y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={isLockedDot ? 11 : 20}
              fill={textColor}
              className="pointer-events-none"
              style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 }}
            >
              {displayNote(note)}
            </text>
          </g>
        );
      })}

      {/* Temporizador: se vacía durante la ventana de respuesta */}
      <circle cx={C} cy={C} r={TIMER_RADIUS} fill="none" stroke={COLORS.faint} strokeOpacity={0.3} strokeWidth={3} />
      {phase === 'playing' && (
        <motion.circle
          key={`timer-${trialIndex}`}
          cx={C}
          cy={C}
          r={TIMER_RADIUS}
          fill="none"
          stroke={COLORS.brass}
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
      {phase === 'playing' && !reduceMotion && (
        <motion.circle
          key={`pulse-${trialIndex}`}
          cx={C}
          cy={C}
          r={CENTER_RADIUS}
          fill="none"
          stroke={COLORS.brass}
          strokeWidth={2}
          initial={{ r: CENTER_RADIUS, opacity: 0.7 }}
          animate={{ r: TIMER_RADIUS + 26, opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* Centro */}
      <g
        role={phase === 'ready' ? 'button' : undefined}
        aria-label={phase === 'ready' ? 'Escuchar' : undefined}
        tabIndex={phase === 'ready' ? 0 : -1}
        onClick={() => phase === 'ready' && onListen()}
        onKeyDown={keyActivate(() => phase === 'ready' && onListen())}
        className={phase === 'ready' ? 'cursor-pointer outline-none' : 'outline-none'}
      >
        <motion.circle
          cx={C}
          cy={C}
          r={CENTER_RADIUS}
          animate={{
            fill: phase === 'ready' ? COLORS.brass : COLORS.deep,
            stroke: phase === 'ready' ? COLORS.brass : COLORS.slate,
          }}
          strokeWidth={2}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          whileHover={phase === 'ready' && !reduceMotion ? { scale: 1.04 } : undefined}
          style={{ transformOrigin: `${C}px ${C}px` }}
        />
        {phase === 'loading' && (
          <motion.circle
            cx={C}
            cy={C}
            r={18}
            fill="none"
            stroke={COLORS.mist}
            strokeWidth={2}
            strokeDasharray="28 200"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${C}px ${C}px` }}
          />
        )}
        <text
          x={C}
          y={C}
          dy="0.35em"
          textAnchor="middle"
          fontSize={centerLabel.length > 10 ? 15 : 19}
          fill={
            phase === 'ready' ? COLORS.deep
            : showFeedback ? (lastRecord!.correct ? COLORS.mint : COLORS.coral)
            : COLORS.mist
          }
          className="pointer-events-none"
          style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 }}
        >
          {centerLabel}
        </text>
      </g>
    </svg>
  );
}

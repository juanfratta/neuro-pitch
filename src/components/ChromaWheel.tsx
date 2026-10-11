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
/** En la mitad de abajo el texto queda hacia adentro de la línea base. */
const RING_LABEL_BOTTOM = (RING_INNER + RING_OUTER) / 2 + 4;

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
const FILL_TRANSITION = 'fill 200ms ease, stroke 200ms ease, stroke-opacity 200ms ease';

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
  /** Vista estática para explicar cómo responder: sin interacción ni texto en el centro. */
  preview?: boolean;
}

type NoteState = 'idle' | 'active' | 'locked' | 'correct' | 'wrong' | 'reveal';

export function ChromaWheel({ options, phase, trialIndex, windowMs, feedback, lastRecord, onListen, onAnswer, preview = false }: Props) {
  const reduceMotion = useReducedMotion();
  const answering = phase === 'playing' && !preview;
  const lit = answering || preview;
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
    return lit ? 'active' : 'idle';
  };

  const ringState: NoteState = showFeedback
    ? expected === OUT_OF_BOUND
      ? 'correct'
      : answered === OUT_OF_BOUND
        ? 'wrong'
        : answering
          ? 'active'
          : 'idle'
    : lit
      ? 'active'
      : 'idle';

  // Arco de error: de la respuesta a la nota que sonó, solo con feedback y respuesta con nombre.
  const arc =
    showFeedback && !lastRecord!.correct && answered && answered !== OUT_OF_BOUND && heard
      ? arcPath(chromaIndex(answered), chromaIndex(heard), NOTE_RADIUS)
      : null;

  const timerLength = 2 * Math.PI * TIMER_RADIUS;

  const centerLabel = (() => {
    if (preview) return '';
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
    <svg
      viewBox={hasOutOfBound ? `0 0 ${SIZE} ${SIZE}` : `${C - 176} ${C - 176} 352 352`}
      className="mx-auto block w-full max-w-[440px] select-none"
      role={preview ? 'img' : 'group'}
      aria-label={preview ? 'Ejemplo de la rueda de respuestas' : 'Rueda de notas'}
    >
      <defs>
        <radialGradient id="wheel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.surface} stopOpacity="0.9" />
          <stop offset="70%" stopColor={COLORS.room} stopOpacity="0.4" />
          <stop offset="100%" stopColor={COLORS.room} stopOpacity="0" />
        </radialGradient>
        <path id="ring-label-path" d={`M ${C - RING_LABEL} ${C} A ${RING_LABEL} ${RING_LABEL} 0 0 1 ${C + RING_LABEL} ${C}`} />
        <path id="ring-label-path-bottom" d={`M ${C - RING_LABEL_BOTTOM} ${C} A ${RING_LABEL_BOTTOM} ${RING_LABEL_BOTTOM} 0 0 0 ${C + RING_LABEL_BOTTOM} ${C}`} />
      </defs>

      <circle cx={C} cy={C} r={RING_INNER - 4} fill="url(#wheel-glow)" />

      {/* Anillo fuera de rango */}
      {hasOutOfBound && (
        <g
          role={preview ? undefined : 'button'}
          aria-label={preview ? undefined : 'Fuera de rango'}
          aria-disabled={!answering}
          tabIndex={answering ? 0 : -1}
          onClick={() => answering && onAnswer(OUT_OF_BOUND)}
          onKeyDown={keyActivate(() => answering && onAnswer(OUT_OF_BOUND))}
          className={answering ? 'cursor-pointer outline-none' : 'outline-none'}
        >
          <path
            d={ringPath()}
            fill="none"
            strokeWidth={RING_OUTER - RING_INNER}
            style={{
              stroke: ringState === 'correct' ? COLORS.mint : ringState === 'wrong' ? COLORS.coral : COLORS.lavender,
              strokeOpacity: ringState === 'active' ? 0.4 : ringState === 'idle' ? 0.16 : 0.85,
              transition: reduceMotion ? undefined : FILL_TRANSITION,
            }}
          />
          {(['ring-label-path', 'ring-label-path-bottom'] as const).map((id) => (
            <text
              key={id}
              fontSize="11"
              letterSpacing="3"
              className="pointer-events-none"
              style={{ fontWeight: 600, fill: ringState === 'idle' ? COLORS.faint : ringState === 'active' ? COLORS.mist : COLORS.onAccent }}
            >
              <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                fuera de rango
              </textPath>
            </text>
          ))}
        </g>
      )}

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
        const clickable = state === 'active';
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
            role={options.includes(note) && !preview ? 'button' : undefined}
            aria-label={options.includes(note) && !preview ? note : undefined}
            aria-disabled={options.includes(note) && !preview ? !clickable : undefined}
            tabIndex={clickable ? 0 : -1}
            onClick={() => clickable && onAnswer(note)}
            onKeyDown={keyActivate(() => clickable && onAnswer(note))}
            className={clickable ? 'cursor-pointer outline-none [&:focus-visible>circle]:stroke-white' : 'outline-none'}
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
            <text
              x={isLockedDot ? label.x : x}
              y={isLockedDot ? label.y : y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={isLockedDot ? 11 : 20}
              className="pointer-events-none"
              style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600, fill: textColor }}
            >
              {displayNote(note)}
            </text>
          </g>
        );
      })}

      {/* Temporizador: se vacía durante la ventana de respuesta */}
      <circle cx={C} cy={C} r={TIMER_RADIUS} fill="none" style={{ stroke: COLORS.faint }} strokeOpacity={0.4} strokeWidth={3} />
      {phase === 'playing' && (
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
      {phase === 'playing' && !reduceMotion && (
        <motion.circle
          key={`pulse-${trialIndex}`}
          cx={C}
          cy={C}
          r={CENTER_RADIUS}
          fill="none"
          style={{ stroke: COLORS.brass }}
          strokeWidth={2}
          initial={{ r: CENTER_RADIUS, opacity: 0.7 }}
          animate={{ r: TIMER_RADIUS + 26, opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* Centro */}
      <g
        role={phase === 'ready' && !preview ? 'button' : undefined}
        aria-label={phase === 'ready' && !preview ? 'Escuchar' : undefined}
        tabIndex={phase === 'ready' && !preview ? 0 : -1}
        onClick={() => phase === 'ready' && !preview && onListen()}
        onKeyDown={keyActivate(() => phase === 'ready' && !preview && onListen())}
        className={phase === 'ready' && !preview ? 'cursor-pointer outline-none' : 'outline-none'}
      >
        <motion.g
          whileHover={phase === 'ready' && !reduceMotion ? { scale: 1.04 } : undefined}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          <circle
            cx={C}
            cy={C}
            r={CENTER_RADIUS}
            strokeWidth={2}
            style={{
              fill: phase === 'ready' && !preview ? COLORS.brass : COLORS.center,
              stroke: phase === 'ready' && !preview ? COLORS.brass : COLORS.faint,
              transition: reduceMotion ? undefined : FILL_TRANSITION,
            }}
          />
        </motion.g>
        {phase === 'loading' && (
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
        <text
          x={C}
          y={C}
          dy="0.35em"
          textAnchor="middle"
          fontSize={centerLabel.length > 10 ? 15 : 19}
          className="pointer-events-none"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 600,
            fill:
              phase === 'ready' ? COLORS.onAccent
              : showFeedback ? (lastRecord!.correct ? COLORS.mint : COLORS.coral)
              : COLORS.mist,
          }}
        >
          {centerLabel}
        </text>
      </g>
    </svg>
  );
}

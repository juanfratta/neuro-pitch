/**
 * Puntaje de un intento y avance por la escalera de niveles.
 * Funciones puras: reciben estado y devuelven estado nuevo.
 */

import { OUT_OF_BOUND, chromaDistance, type Answer, type Chroma } from './notes';
import { trainedSet, type Stimulus } from './curriculum';
import {
  FINAL_CONSECUTIVE_PASSES,
  LEVELS_PER_STAGE,
  LEVEL_LADDER,
  REQUIRE_TRAINED_ACCURACY,
  RETREAT_AFTER_FAILED_ATTEMPTS,
  SPECIAL_EXERCISE_EVERY_ATTEMPTS,
  SPECIAL_EXERCISE_MIN_TRAINED,
  TOTAL_STAGES,
  baseWindowMs,
  levelSpec,
} from './params';

export interface TrialRecord {
  stimulus: Stimulus;
  /** null = no respondió dentro de la ventana. */
  answer: Answer | null;
  /** Desde el inicio de la nota. null si no respondió. */
  rtMs: number | null;
  correct: boolean;
}

export function scoreTrial(stimulus: Stimulus, answer: Answer | null, rtMs: number | null, windowMs: number): TrialRecord {
  const inTime = answer !== null && rtMs !== null && rtMs <= windowMs;
  return { stimulus, answer, rtMs, correct: inTime && answer === stimulus.expected };
}

export interface AttemptSummary {
  total: number;
  correct: number;
  /** 0-100 */
  accuracy: number;
  /** 0-100, solo trials con notas aprendidas. */
  trainedAccuracy: number;
  /** Error medio en semitonos (0-6) cuando se respondió una nota con nombre y el estímulo era una nota con nombre. */
  meanErrorSemitones: number | null;
  /** Tiempo medio de los aciertos, en ms. */
  meanCorrectRtMs: number | null;
}

export function summarize(trials: readonly TrialRecord[]): AttemptSummary {
  const total = trials.length;
  const correct = trials.filter((t) => t.correct).length;
  const trainedTrials = trials.filter((t) => t.stimulus.expected !== OUT_OF_BOUND);
  const trainedCorrect = trainedTrials.filter((t) => t.correct).length;

  const errors = trials
    .filter((t) => t.answer !== null && t.answer !== OUT_OF_BOUND)
    .map((t) => chromaDistance(t.answer as Chroma, t.stimulus.chroma));
  const correctRts = trials.filter((t) => t.correct && t.rtMs !== null).map((t) => t.rtMs as number);

  return {
    total,
    correct,
    accuracy: total ? (correct / total) * 100 : 0,
    trainedAccuracy: trainedTrials.length ? (trainedCorrect / trainedTrials.length) * 100 : 0,
    meanErrorSemitones: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
    meanCorrectRtMs: correctRts.length ? correctRts.reduce((a, b) => a + b, 0) / correctRts.length : null,
  };
}

export interface ProgressState {
  /** Cantidad de notas aprendidas (1 a 12). */
  stage: number;
  /** Nivel dentro de la etapa (1 a 24). */
  level: number;
  failedAtLevel: number;
  attemptsSinceSpecial: number;
  /** Pases seguidos del último nivel de la etapa 12. */
  finalStreak: number;
  /** Ya hizo los 3 pases; falta el pase en frío tras 12 h sin entrenar. */
  awaitingColdPass: boolean;
  completed: boolean;
}

export const INITIAL_PROGRESS: ProgressState = {
  stage: 1,
  level: 1,
  failedAtLevel: 0,
  attemptsSinceSpecial: 0,
  finalStreak: 0,
  awaitingColdPass: false,
  completed: false,
};

export interface AttemptParams {
  trained: Chroma[];
  minAccuracy: number;
  feedback: boolean;
  windowMs: number;
}

export function attemptParams(state: ProgressState): AttemptParams {
  const spec = levelSpec(state.level);
  return {
    trained: trainedSet(state.stage),
    minAccuracy: spec.minAccuracy,
    feedback: spec.feedback,
    windowMs: Math.round(baseWindowMs(state.stage) * spec.windowFactor),
  };
}

export function isPass(summary: AttemptSummary, minAccuracy: number): boolean {
  if (summary.accuracy < minAccuracy) return false;
  if (REQUIRE_TRAINED_ACCURACY && summary.trainedAccuracy < minAccuracy) return false;
  return true;
}

export type Outcome =
  | 'failed'
  | 'passed'
  | 'jumped'
  | 'stage-up'
  | 'final-streak'
  | 'awaiting-cold-pass'
  | 'cold-pass-failed'
  | 'completed';

export interface AttemptOutcome {
  state: ProgressState;
  outcome: Outcome;
  passed: boolean;
}

/**
 * Salto de nivel (paper): si en un nivel que pide menos de 90% se saca 90% o más,
 * se considera pasado el primer nivel del bloque que pide 90% y se sigue desde el siguiente.
 */
function jumpTarget(level: number): number | null {
  const spec = levelSpec(level);
  if (spec.minAccuracy >= 90) return null;
  const blockFeedback = spec.feedback;
  const firstNinety = LEVEL_LADDER.find((l) => l.feedback === blockFeedback && l.minAccuracy >= 90 && l.level > level);
  return firstNinety ? firstNinety.level + 1 : null;
}

export function applyAttempt(state: ProgressState, summary: AttemptSummary): AttemptOutcome {
  if (state.completed) return { state, outcome: 'completed', passed: isPass(summary, 90) };

  const { minAccuracy } = attemptParams(state);
  const passed = isPass(summary, minAccuracy);
  const base: ProgressState = { ...state, attemptsSinceSpecial: state.attemptsSinceSpecial + 1 };
  const isFinalLevel = state.stage === TOTAL_STAGES && state.level === LEVELS_PER_STAGE;

  if (state.awaitingColdPass) {
    if (passed) return { state: { ...base, completed: true, awaitingColdPass: false }, outcome: 'completed', passed };
    return { state: { ...base, awaitingColdPass: false, finalStreak: 0, failedAtLevel: 0 }, outcome: 'cold-pass-failed', passed };
  }

  if (!passed) {
    return {
      state: { ...base, failedAtLevel: base.failedAtLevel + 1, finalStreak: isFinalLevel ? 0 : base.finalStreak },
      outcome: 'failed',
      passed,
    };
  }

  if (isFinalLevel) {
    const finalStreak = state.finalStreak + 1;
    if (finalStreak >= FINAL_CONSECUTIVE_PASSES) {
      return { state: { ...base, finalStreak, awaitingColdPass: true, failedAtLevel: 0 }, outcome: 'awaiting-cold-pass', passed };
    }
    return { state: { ...base, finalStreak, failedAtLevel: 0 }, outcome: 'final-streak', passed };
  }

  if (state.level === LEVELS_PER_STAGE) {
    return { state: { ...base, stage: state.stage + 1, level: 1, failedAtLevel: 0 }, outcome: 'stage-up', passed };
  }

  const jump = isPass(summary, 90) ? jumpTarget(state.level) : null;
  if (jump !== null) {
    return { state: { ...base, level: jump, failedAtLevel: 0 }, outcome: 'jumped', passed };
  }

  return { state: { ...base, level: state.level + 1, failedAtLevel: 0 }, outcome: 'passed', passed };
}

export function canRetreat(state: ProgressState): boolean {
  return !state.completed && !state.awaitingColdPass && state.failedAtLevel >= RETREAT_AFTER_FAILED_ATTEMPTS && state.level > 1;
}

/**
 * Volver a un nivel más fácil. Sin feedback => primer nivel con feedback al 90%;
 * con feedback => cuatro niveles atrás.
 */
export function retreat(state: ProgressState): ProgressState {
  const spec = levelSpec(state.level);
  const target = spec.feedback ? Math.max(1, state.level - 4) : 9;
  return { ...state, level: Math.min(target, state.level), failedAtLevel: 0, finalStreak: 0 };
}

export function specialExerciseDue(state: ProgressState): boolean {
  return (
    !state.completed &&
    state.stage >= SPECIAL_EXERCISE_MIN_TRAINED &&
    state.attemptsSinceSpecial >= SPECIAL_EXERCISE_EVERY_ATTEMPTS
  );
}

/** La nota aprendida con menor acierto en los trials dados. */
export function weakestChroma(trials: readonly TrialRecord[], trained: readonly Chroma[]): Chroma {
  let worst: Chroma = trained[0];
  let worstAcc = Infinity;
  for (const chroma of trained) {
    const own = trials.filter((t) => t.stimulus.expected === chroma);
    if (own.length === 0) continue;
    const acc = own.filter((t) => t.correct).length / own.length;
    if (acc < worstAcc) {
      worstAcc = acc;
      worst = chroma;
    }
  }
  return worst;
}

/** Número de nivel global (1 a 288), para mostrar. */
export function globalLevel(state: ProgressState): number {
  return (state.stage - 1) * LEVELS_PER_STAGE + state.level;
}

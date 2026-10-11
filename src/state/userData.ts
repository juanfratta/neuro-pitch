/**
 * Datos del usuario y reglas que dependen del calendario (horas, racha, cupos de test).
 * Todo puro salvo load/save, para poder testearlo.
 */

import { OUT_OF_BOUND, type Answer, type Chroma, CHROMAS } from '../protocol/notes';
import { makeStimulus, type Timbre } from '../protocol/curriculum';
import {
  COLD_PASS_REST_MS,
  POST_TEST_COOLDOWN_MS,
  POST_TEST_MIN_HOURS,
  POST_TEST_REST_MS,
  STREAK_MAX_GAP_DAYS,
} from '../protocol/params';
import { INITIAL_PROGRESS, type AttemptSummary, type Outcome, type ProgressState, type TrialRecord } from '../protocol/progression';
import type { TestReport } from '../protocol/assessment';

export const STORAGE_KEY = 'neuro_pitch_v3';
const DATA_VERSION = 3;

/** Trial guardado en forma compacta: [midi, timbre, esperado, respuesta, rtMs, correcto]. */
export type CompactTrial = [number, Timbre, Answer, Answer | null, number | null, 0 | 1];

export type AttemptKind = 'level' | 'special-feedback' | 'special-no-feedback';

export interface AttemptRecord {
  kind: AttemptKind;
  stage: number;
  level: number;
  startedAt: string;
  endedAt: string;
  windowMs: number;
  feedback: boolean;
  summary: AttemptSummary;
  passed: boolean;
  outcome: Outcome | null;
  trials: CompactTrial[];
}

export type TestKind = 'pre' | 'post';

export interface TestRecord {
  kind: TestKind;
  startedAt: string;
  endedAt: string;
  report: TestReport;
  trials: CompactTrial[];
}

export interface UserData {
  version: number;
  createdAt: string;
  progress: ProgressState;
  attempts: AttemptRecord[];
  tests: TestRecord[];
  lastTrainingAt: string | null;
}

export function createUserData(now: Date = new Date()): UserData {
  return {
    version: DATA_VERSION,
    createdAt: now.toISOString(),
    progress: { ...INITIAL_PROGRESS },
    attempts: [],
    tests: [],
    lastTrainingAt: null,
  };
}

export function loadUserData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserData;
      if (parsed.version === DATA_VERSION) return parsed;
    }
  } catch (error) {
    console.error('No se pudieron leer los datos guardados', error);
  }
  return createUserData();
}

export function saveUserData(data: UserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('No se pudieron guardar los datos', error);
  }
}

export function compactTrial(t: TrialRecord): CompactTrial {
  return [t.stimulus.midi, t.stimulus.timbre, t.stimulus.expected, t.answer, t.rtMs === null ? null : Math.round(t.rtMs), t.correct ? 1 : 0];
}

export function expandTrial([midi, timbre, expected, answer, rtMs, correct]: CompactTrial): TrialRecord {
  const chroma: Chroma = CHROMAS[midi % 12];
  const octave = (Math.floor(midi / 12) - 1) as 4 | 5 | 6;
  const stimulus = { ...makeStimulus(chroma, octave, timbre, null), expected };
  return { stimulus, answer, rtMs, correct: correct === 1 };
}

// ---------- tiempo de entrenamiento ----------

export function attemptDurationMs(a: AttemptRecord): number {
  return Math.max(0, new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime());
}

export function totalTrainingMs(data: UserData): number {
  return data.attempts.reduce((sum, a) => sum + attemptDurationMs(a), 0);
}

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function weekTrainingMs(data: UserData, now: Date = new Date()): number {
  const from = startOfWeek(now).getTime();
  return data.attempts.filter((a) => new Date(a.startedAt).getTime() >= from).reduce((sum, a) => sum + attemptDurationMs(a), 0);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/**
 * Días consecutivos entrenando (paper): la racha vuelve a cero si pasan más de dos
 * días calendario sin entrenar. Días salteados dentro del margen no suman pero no cortan.
 */
export function streakDays(data: UserData, now: Date = new Date()): number {
  const days = [...new Set(data.attempts.map((a) => dayKey(new Date(a.startedAt))))].sort();
  if (days.length === 0) return 0;
  const today = dayKey(now);
  if (daysBetween(days[days.length - 1], today) > STREAK_MAX_GAP_DAYS) return 0;
  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (daysBetween(days[i - 1], days[i]) > STREAK_MAX_GAP_DAYS) break;
    streak++;
  }
  return streak;
}

// ---------- tests y pase en frío ----------

export function preTest(data: UserData): TestRecord | undefined {
  return data.tests.find((t) => t.kind === 'pre');
}

export function lastPostTest(data: UserData): TestRecord | undefined {
  return [...data.tests].reverse().find((t) => t.kind === 'post');
}

export function msSinceTraining(data: UserData, now: Date = new Date()): number {
  return data.lastTrainingAt ? now.getTime() - new Date(data.lastTrainingAt).getTime() : Infinity;
}

export interface Availability {
  available: boolean;
  /** Si no está disponible, por qué (para mostrar). */
  reason: string | null;
  /** Milisegundos hasta que se habilita por tiempo, si aplica. */
  waitMs: number;
}

export function coldPassAvailability(data: UserData, now: Date = new Date()): Availability {
  if (!data.progress.awaitingColdPass) return { available: false, reason: null, waitMs: 0 };
  const wait = COLD_PASS_REST_MS - msSinceTraining(data, now);
  if (wait > 0) return { available: false, reason: 'Tienen que pasar 12 h sin entrenar antes del pase final.', waitMs: wait };
  return { available: true, reason: null, waitMs: 0 };
}

export function postTestAvailability(data: UserData, now: Date = new Date()): Availability {
  if (!preTest(data)) return { available: false, reason: 'Primero hay que hacer el test inicial.', waitMs: 0 };
  const hours = totalTrainingMs(data) / 3_600_000;
  if (hours < POST_TEST_MIN_HOURS && !data.progress.completed) {
    return { available: false, reason: `Se habilita con ${POST_TEST_MIN_HOURS} h de entrenamiento (llevás ${hours.toFixed(1)} h).`, waitMs: 0 };
  }
  const last = lastPostTest(data);
  if (last) {
    const wait = POST_TEST_COOLDOWN_MS - (now.getTime() - new Date(last.endedAt).getTime());
    if (wait > 0) return { available: false, reason: 'El test de progreso se puede hacer una vez por semana.', waitMs: wait };
  }
  const rest = POST_TEST_REST_MS - msSinceTraining(data, now);
  if (rest > 0) return { available: false, reason: 'Tienen que pasar 12 h sin entrenar antes del test.', waitMs: rest };
  return { available: true, reason: null, waitMs: 0 };
}

/** Trials de las últimas N tandas de nivel, para elegir la nota más floja. */
export function recentLevelTrials(data: UserData, attempts: number): TrialRecord[] {
  return data.attempts
    .filter((a) => a.kind === 'level')
    .slice(-attempts)
    .flatMap((a) => a.trials.map(expandTrial))
    .filter((t) => t.stimulus.expected !== OUT_OF_BOUND);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

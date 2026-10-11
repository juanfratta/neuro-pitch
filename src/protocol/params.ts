/**
 * Parámetros del protocolo.
 *
 * Fuente: Wong, Cheung, Ngan & Wong (2025), "Learning fast and accurate absolute
 * pitch judgment in adulthood", Psychonomic Bulletin & Review 32:1676–1688.
 *
 * Cada valor está marcado como:
 *   [PAPER]          dato explícito del artículo.
 *   [RECONSTRUIDO]   el artículo da el marco pero no el valor exacto, y el material
 *                    suplementario (OSM) tampoco lo trae. Si conseguimos el detalle
 *                    (por ejemplo escribiendo a los autores), se cambia solo este archivo.
 *   [PROPIO]         decisión nuestra que el paper no especifica.
 */

import type { Chroma } from './notes';

/** [PAPER] El entrenamiento empieza con F y agrega vecinas alternando abajo/arriba (E, F#, D#, G...). */
export const ANCHOR_CHROMA: Chroma = 'F';

/** [PAPER] 24 niveles por cada nota que se agrega; 12 notas => 288 niveles. */
export const LEVELS_PER_STAGE = 24;
export const TOTAL_STAGES = 12;

/** [PAPER] Clips de 800 ms con rampa de 100 ms al inicio y al final. */
export const NOTE_DURATION_MS = 800;
export const NOTE_RAMP_MS = 100;

/**
 * [PAPER, OSM Table 1] Ventana de respuesta del último nivel sin feedback de cada etapa,
 * según la cantidad de notas aprendidas. Crece ~5% por nota.
 */
export const FINAL_WINDOW_BY_PITCHES_MS: readonly number[] = [
  1183, 1242, 1305, 1371, 1440, 1513, 1589, 1668, 1751, 1839, 1930, 2028,
];

export function baseWindowMs(trainedCount: number): number {
  const n = Math.min(Math.max(trainedCount, 1), 12);
  return FINAL_WINDOW_BY_PITCHES_MS[n - 1];
}

export interface LevelSpec {
  /** 1 a 24 dentro de la etapa. */
  level: number;
  /** Porcentaje mínimo de aciertos para pasar (0-100). */
  minAccuracy: number;
  /** Si se muestra la respuesta correcta después de cada trial. */
  feedback: boolean;
  /** Multiplicador sobre la ventana base de la etapa. 1 = ventana final. */
  windowFactor: number;
}

/**
 * [PAPER] Dentro de cada etapa la exigencia sube de 20% a 90%, primero con feedback y
 * después sin feedback, y la ventana se acorta hasta la ventana final de la etapa.
 * La OSM solo fija la ventana del último nivel sin feedback de cada etapa.
 * [RECONSTRUIDO] El reparto exacto en 24 niveles:
 *   1-8    con feedback, 20% a 90%, ventana x1,5
 *   9-12   con feedback, 90%, la ventana baja de x1,375 a x1
 *   13-20  sin feedback, 20% a 90%, ventana x1
 *   21-24  sin feedback, 90%, ventana x1 (cuatro veces seguidas: consistencia)
 */
export const LEVEL_LADDER: readonly LevelSpec[] = [
  ...[20, 30, 40, 50, 60, 70, 80, 90].map((minAccuracy, i) => ({
    level: i + 1,
    minAccuracy,
    feedback: true,
    windowFactor: 1.5,
  })),
  ...[1.375, 1.25, 1.125, 1].map((windowFactor, i) => ({
    level: 9 + i,
    minAccuracy: 90,
    feedback: true,
    windowFactor,
  })),
  ...[20, 30, 40, 50, 60, 70, 80, 90].map((minAccuracy, i) => ({
    level: 13 + i,
    minAccuracy,
    feedback: false,
    windowFactor: 1,
  })),
  ...[0, 1, 2, 3].map((i) => ({
    level: 21 + i,
    minAccuracy: 90,
    feedback: false,
    windowFactor: 1,
  })),
];

export function levelSpec(level: number): LevelSpec {
  const spec = LEVEL_LADDER[level - 1];
  if (!spec) throw new Error(`Nivel inválido: ${level}`);
  return spec;
}

/** [PROPIO] Trials por intento de nivel. El paper no lo informa en el texto principal. */
export const TRIALS_PER_ATTEMPT = 30;

/**
 * [PROPIO] Porción mínima de trials con notas aprendidas. Evita que con 1 nota y 4 vecinas
 * fuera de rango alcance con apretar siempre "fuera de rango".
 */
export const MIN_TRAINED_SHARE = 0.5;

/**
 * [PROPIO] Para pasar, además del acierto total, hay que alcanzar el mínimo en los trials
 * de notas aprendidas. Es la misma idea del paper (no aprobar por estrategia) aplicada
 * a la respuesta "fuera de rango".
 */
export const REQUIRE_TRAINED_ACCURACY = true;

/** [PAPER] Vecinos fuera de rango: +1 y +2 semitonos sobre la nota más aguda, -1 y -2 bajo la más grave. */
export const OUT_OF_BOUND_SPAN = 2;

/** [PAPER] Si se intenta 10 veces el mismo nivel sin pasar, se ofrece volver a uno más fácil. */
export const RETREAT_AFTER_FAILED_ATTEMPTS = 10;

/** [PAPER] Con 5 notas o más, cada 15 niveles intentados hay dos ejercicios sobre la nota más floja. */
export const SPECIAL_EXERCISE_MIN_TRAINED = 5;
export const SPECIAL_EXERCISE_EVERY_ATTEMPTS = 15;
export const SPECIAL_EXERCISE_FEEDBACK_TRIALS = 12;
export const SPECIAL_EXERCISE_NO_FEEDBACK_TRIALS = 22;

/** [PAPER] Cierre: pasar el último nivel 3 veces seguidas y después una vez al primer intento tras 12 h sin entrenar. */
export const FINAL_CONSECUTIVE_PASSES = 3;
export const COLD_PASS_REST_MS = 12 * 60 * 60 * 1000;

/** [PAPER] Tono de Shepard de 20 s antes de un nivel sin feedback si se escucharon muestras. */
export const SHEPARD_DURATION_MS = 20_000;

/** [PAPER] Meta: 25 h en 8 semanas, al menos 2 h por semana. */
export const TARGET_TOTAL_HOURS = 25;
export const TARGET_WEEKLY_HOURS = 2;

/** [PAPER] Se invitó al post-test a quien hizo 10 h o más. */
export const POST_TEST_MIN_HOURS = 10;
/** [PROPIO] Post-test como mucho una vez cada 7 días, y con 12 h sin entrenar antes. */
export const POST_TEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const POST_TEST_REST_MS = 12 * 60 * 60 * 1000;

/** [PAPER] Test: 144 trials, 5 s máximo, notas consecutivas a más de 12 semitonos. */
export const TEST_WINDOW_MS = 5000;
export const TEST_REPETITIONS = 2;
export const TEST_MIN_SEMITONE_GAP = 13;

/** [PAPER] La racha se corta si pasan más de dos días calendario sin entrenar. */
export const STREAK_MAX_GAP_DAYS = 2;

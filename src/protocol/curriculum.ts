/**
 * Qué se entrena en cada etapa y qué suena en cada trial de entrenamiento.
 */

import {
  CHROMAS,
  OCTAVES,
  OUT_OF_BOUND,
  chromaAt,
  chromaIndex,
  chromaDistance,
  sortChromatic,
  toMidi,
  type Answer,
  type Chroma,
  type Octave,
} from './notes';
import { ANCHOR_CHROMA, MIN_TRAINED_SHARE, OUT_OF_BOUND_SPAN } from './params';
import { shuffle, type Rng } from './rng';

export type Timbre = 'piano-train' | 'piano-test' | 'guitar-test';

export interface Stimulus {
  chroma: Chroma;
  octave: Octave;
  midi: number;
  timbre: Timbre;
  /** Respuesta correcta: la nota, o "fuera de rango". */
  expected: Answer;
}

/**
 * Orden en que se agregan las notas: ancla, después -1, +1, -2, +2...
 * Con F: F, E, F#, D#, G, D, G#, C#, A, C, A#, B.
 */
export function introductionOrder(anchor: Chroma = ANCHOR_CHROMA): Chroma[] {
  const base = chromaIndex(anchor);
  const offsets = [0];
  for (let step = 1; offsets.length < 12; step++) {
    offsets.push(-step);
    if (offsets.length < 12) offsets.push(step);
  }
  // El offset +6 y -6 son la misma nota; el bucle de arriba la incluye una sola vez.
  return offsets.map((o) => chromaAt(base + o));
}

/** Notas aprendidas en la etapa `stage` (1 a 12). */
export function trainedSet(stage: number, anchor: Chroma = ANCHOR_CHROMA): Chroma[] {
  return sortChromatic(introductionOrder(anchor).slice(0, stage));
}

/**
 * Tonos fuera de rango: notas todavía no aprendidas que están a 1 o 2 semitonos
 * de los bordes del set. Desaparecen cuando no quedan notas libres a los costados.
 */
export function outOfBoundSet(trained: readonly Chroma[]): Chroma[] {
  if (trained.length >= 12) return [];
  return CHROMAS.filter(
    (c) => !trained.includes(c) && Math.min(...trained.map((t) => chromaDistance(c, t))) <= OUT_OF_BOUND_SPAN
  );
}

/** Botones que ve la persona: las notas aprendidas en orden y, si corresponde, "fuera de rango". */
export function answerOptions(trained: readonly Chroma[]): Answer[] {
  const options: Answer[] = sortChromatic(trained);
  if (outOfBoundSet(trained).length > 0) options.push(OUT_OF_BOUND);
  return options;
}

function balancedDeck<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const out: T[] = [];
  while (out.length < count) out.push(...shuffle(rng, items));
  return out.slice(0, count);
}

/**
 * Secuencia de estímulos para un intento de nivel.
 * - Notas aprendidas y fuera de rango en proporción, con al menos MIN_TRAINED_SHARE de aprendidas.
 * - Cada nota y cada octava aparecen de forma pareja (mazo barajado).
 * - Nunca el mismo tono exacto dos veces seguidas.
 */
export function generateTrainingStimuli(
  rng: Rng,
  trained: readonly Chroma[],
  count: number,
  timbre: Timbre = 'piano-train'
): Stimulus[] {
  const oob = outOfBoundSet(trained);
  const trainedShare = oob.length === 0 ? 1 : Math.max(MIN_TRAINED_SHARE, trained.length / (trained.length + oob.length));
  const trainedCount = Math.round(count * trainedShare);

  const chromas = [
    ...balancedDeck(rng, trained, trainedCount),
    ...balancedDeck(rng, oob, count - trainedCount),
  ];
  const octaves = balancedDeck(rng, OCTAVES, count);

  for (let attempt = 0; attempt < 50; attempt++) {
    const order = shuffle(rng, chromas);
    const stimuli = order.map((chroma, i) => makeStimulus(chroma, octaves[i], timbre, trained));
    const hasRepeat = stimuli.some((s, i) => i > 0 && s.midi === stimuli[i - 1].midi);
    if (!hasRepeat) return stimuli;
  }
  return shuffle(rng, chromas).map((chroma, i) => makeStimulus(chroma, octaves[i], timbre, trained));
}

export function makeStimulus(
  chroma: Chroma,
  octave: Octave,
  timbre: Timbre,
  trained: readonly Chroma[] | null
): Stimulus {
  const expected: Answer = trained === null || trained.includes(chroma) ? chroma : OUT_OF_BOUND;
  return { chroma, octave, midi: toMidi(chroma, octave), timbre, expected };
}

/**
 * Ejercicio especial sobre una nota floja: "¿es esta nota o no?".
 * La mitad de los trials es la nota objetivo; el resto, otras notas aprendidas o fuera de rango.
 */
export function generateSpecialStimuli(
  rng: Rng,
  target: Chroma,
  trained: readonly Chroma[],
  count: number
): Stimulus[] {
  const others = [...trained, ...outOfBoundSet(trained)].filter((c) => c !== target);
  const targetCount = Math.round(count / 2);
  const chromas = shuffle(rng, [
    ...Array<Chroma>(targetCount).fill(target),
    ...balancedDeck(rng, others, count - targetCount),
  ]);
  const octaves = balancedDeck(rng, OCTAVES, count);
  return chromas.map((chroma, i) => {
    const s = makeStimulus(chroma, octaves[i], 'piano-train', null);
    return { ...s, expected: chroma === target ? target : OUT_OF_BOUND };
  });
}

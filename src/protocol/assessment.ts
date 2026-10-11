/**
 * Pre-test y post-test (Wong et al., 2025):
 * 144 trials = 12 notas x 3 octavas x 2 timbres x 2 repeticiones.
 * Primero el bloque de piano (un piano distinto al del entrenamiento), después guitarra.
 * Notas consecutivas siempre a más de 12 semitonos. Sin feedback. 5 s máximo.
 */

import { CHROMAS, OCTAVES } from './notes';
import { makeStimulus, type Stimulus, type Timbre } from './curriculum';
import { TEST_MIN_SEMITONE_GAP, TEST_REPETITIONS } from './params';
import { shuffle, type Rng } from './rng';
import { summarize, type AttemptSummary, type TrialRecord } from './progression';

export const TEST_TIMBRES: readonly Timbre[] = ['piano-test', 'guitar-test'];

function blockItems(timbre: Timbre): Stimulus[] {
  const items: Stimulus[] = [];
  for (let r = 0; r < TEST_REPETITIONS; r++) {
    for (const chroma of CHROMAS) {
      for (const octave of OCTAVES) items.push(makeStimulus(chroma, octave, timbre, null));
    }
  }
  return items;
}

/**
 * Ordena un bloque respetando la distancia mínima con el trial anterior.
 * Greedy aleatorio que prioriza los tonos con menos compañeros posibles
 * (los de la octava del medio), con reintentos si se traba.
 */
function orderBlock(rng: Rng, items: Stimulus[], previousMidi: number | null): Stimulus[] {
  const compatible = (a: number, b: number) => Math.abs(a - b) >= TEST_MIN_SEMITONE_GAP;

  for (let attempt = 0; attempt < 2000; attempt++) {
    const remaining = shuffle(rng, items);
    const out: Stimulus[] = [];
    let last = previousMidi;
    let stuck = false;

    while (remaining.length > 0) {
      const candidates = remaining.filter((s) => last === null || compatible(s.midi, last));
      if (candidates.length === 0) {
        stuck = true;
        break;
      }
      // Preferimos el candidato con menos compatibles entre los que quedan: evita quedar sin salida al final.
      let best = candidates[0];
      let bestScore = Infinity;
      for (const c of candidates) {
        const score = remaining.filter((r) => r !== c && compatible(r.midi, c.midi)).length + rng() * 3;
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      out.push(best);
      remaining.splice(remaining.indexOf(best), 1);
      last = best.midi;
    }

    if (!stuck) return out;
  }
  throw new Error('No se pudo armar una secuencia de test que respete la distancia mínima');
}

export function generateTestSequence(rng: Rng): Stimulus[] {
  const sequence: Stimulus[] = [];
  for (const timbre of TEST_TIMBRES) {
    const previous = sequence.length ? sequence[sequence.length - 1].midi : null;
    sequence.push(...orderBlock(rng, blockItems(timbre), previous));
  }
  return sequence;
}

export interface TestReport {
  overall: AttemptSummary;
  byTimbre: Record<string, AttemptSummary>;
}

export function reportTest(trials: readonly TrialRecord[]): TestReport {
  const byTimbre: Record<string, AttemptSummary> = {};
  for (const timbre of TEST_TIMBRES) {
    byTimbre[timbre] = summarize(trials.filter((t) => t.stimulus.timbre === timbre));
  }
  return { overall: summarize(trials), byTimbre };
}

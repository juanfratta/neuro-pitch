/**
 * Notas, octavas y distancias.
 * Todo lo que el protocolo necesita saber sobre alturas vive acá.
 */

export const CHROMAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type Chroma = (typeof CHROMAS)[number];

/** Respuesta "fuera de rango": el tono no es ninguna de las notas que se están aprendiendo. */
export const OUT_OF_BOUND = 'OUT' as const;
export type Answer = Chroma | typeof OUT_OF_BOUND;

/** Wong et al. (2025): tonos de piano de C4 a B6, tres octavas. */
export const OCTAVES = [4, 5, 6] as const;
export type Octave = (typeof OCTAVES)[number];

export function chromaIndex(chroma: Chroma): number {
  return CHROMAS.indexOf(chroma);
}

export function chromaAt(index: number): Chroma {
  return CHROMAS[((index % 12) + 12) % 12];
}

/** MIDI: C4 = 60. */
export function toMidi(chroma: Chroma, octave: Octave): number {
  return (octave + 1) * 12 + chromaIndex(chroma);
}

/**
 * Distancia de croma en semitonos, circular (0 a 6).
 * Es la "size of error" del paper: cuán lejos quedó la respuesta de la nota correcta.
 */
export function chromaDistance(a: Chroma, b: Chroma): number {
  const d = Math.abs(chromaIndex(a) - chromaIndex(b)) % 12;
  return Math.min(d, 12 - d);
}

export function sortChromatic(notes: readonly Chroma[]): Chroma[] {
  return [...notes].sort((a, b) => chromaIndex(a) - chromaIndex(b));
}

/** Nombre para mostrar. Usamos cifrado americano, igual que el paper. */
export function answerLabel(answer: Answer): string {
  return answer === OUT_OF_BOUND ? 'Fuera de rango' : answer;
}

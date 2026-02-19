/**
 * Randomization Engine - Anti-Relative Pitch Controls
 * Ensures randomization complies with neuropsychological protocol
 * 
 * Requirements:
 * - No consecutive identical notes
 * - No A-B-A patterns
 * - Mix octaves (1, 2, 3, 4, 5, 6)
 * - Explicit seed for reproducibility
 * - Occasional out-of-set trials for detection
 */

import type { ChromaticNote, Octave, Timbre } from '../types';
import { CHROMATIC_NOTES, OCTAVES } from '../types';
import { ANTI_RELATIVE_PITCH_RULES } from '../protocol/config';

/**
 * Seeded random number generator (for reproducibility)
 * Uses xorshift32 algorithm
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Math.floor(Math.random() * 0xffffffff)) {
    this.seed = seed >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Get next random number [0, 1)
   */
  random(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Get random integer [min, max]
   */
  randomInt(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  /**
   * Get random element from array
   */
  choice<T>(array: readonly T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Generate seed string for recording
   */
  getSeedString(): string {
    return this.seed.toString(36);
  }
}

/**
 * Generate a trial note with anti-relative-pitch constraints
 */
export interface TrialParams {
  note: ChromaticNote;
  octave: Octave;
  timbre: Timbre;
  seed: string;
}

/**
 * Randomization state for a session/test
 */
export class RandomizationEngine {
  private seed: number;
  private rng: SeededRandom;
  private lastNote: ChromaticNote | null = null;
  private last2Notes: [ChromaticNote, ChromaticNote] | null = null;
  private currentNoteSet: ChromaticNote[];
  private outOfSetProbability: number;
  private allNotes: ChromaticNote[];
  private testTimbres: Timbre[];
  private isTestMode: boolean;
  private octavePool: readonly Octave[];

  constructor(
    noteSet: ChromaticNote[],
    isTestMode: boolean = false,
    seed?: number
  ) {
    this.seed = seed ?? Math.floor(Math.random() * 0xffffffff);
    this.rng = new SeededRandom(this.seed);
    this.currentNoteSet = noteSet;
    this.testTimbres = ['piano'];
    this.isTestMode = isTestMode;
    this.allNotes = CHROMATIC_NOTES;
    this.octavePool = OCTAVES;
    this.outOfSetProbability = ANTI_RELATIVE_PITCH_RULES.includeOutOfSetTrials || 0.1;
  }

  /**
   * Generate next trial ensuring anti-relative-pitch compliance
   */
  generateTrial(): TrialParams {
    // Decide if this should be an out-of-set trial (for detection).
    // Keep level-1 (2-note set) strictly in-set to avoid introducing foreign notes.
    const canUseOutOfSet = this.currentNoteSet.length > 2;
    const useOutOfSet =
      !this.isTestMode && canUseOutOfSet && this.rng.random() < this.outOfSetProbability;

    // Select note set for this trial
    let availableNotes = useOutOfSet
      ? this.allNotes.filter((n) => !this.currentNoteSet.includes(n))
      : this.currentNoteSet;

    // Apply anti-relative-pitch constraints
    availableNotes = this.filterAvailableNotes(availableNotes);

    // Ensure we didn't filter out all notes
    if (availableNotes.length === 0) {
      console.warn('All notes filtered; allowing last note');
      availableNotes = this.currentNoteSet;
    }

    const selectedNote = this.rng.choice(availableNotes);
    const selectedOctave = this.rng.choice(this.octavePool);
    const selectedTimbre = this.isTestMode ? this.rng.choice(this.testTimbres) : 'piano';

    // Update state
    this.last2Notes = this.lastNote ? [this.lastNote, selectedNote] : null;
    this.lastNote = selectedNote;

    return {
      note: selectedNote,
      octave: selectedOctave,
      timbre: selectedTimbre,
      seed: this.rng.getSeedString(),
    };
  }

  /**
   * Filter notes based on anti-relative-pitch rules
   */
  private filterAvailableNotes(availableNotes: ChromaticNote[]): ChromaticNote[] {
    let filtered = [...availableNotes];
    const noteSetSize = this.currentNoteSet.length;

    // Rule 1: No consecutive identical notes
    // For 2-note sets, allow repeats so distribution is not forced into near-deterministic alternation.
    if (
      ANTI_RELATIVE_PITCH_RULES.prohibitConsecutiveRepeat &&
      this.lastNote &&
      noteSetSize > 2
    ) {
      filtered = filtered.filter((n) => n !== this.lastNote);
    }

    // Rule 2: No A-B-A pattern
    // Prevent selecting the note from 2 trials ago if it's different from last trial
    if (
      ANTI_RELATIVE_PITCH_RULES.prohibitABA &&
      this.last2Notes &&
      this.last2Notes[0] !== this.last2Notes[1] &&
      noteSetSize > 2
    ) {
      // last2Notes[0] is from 2 trials ago, last2Notes[1] is from 1 trial ago
      // Prevent selecting last2Notes[0] to avoid A-B-A pattern
      filtered = filtered.filter((n) => n !== this.last2Notes![0]);
    }

    return filtered;
  }

  /**
   * Get current seed for UI display (research mode)
   */
  getCurrentSeed(): string {
    return this.seed.toString(36);
  }

  /**
   * Reset engine for new test or session
   */
  reset(): void {
    this.lastNote = null;
    this.last2Notes = null;
    this.rng = new SeededRandom(this.seed);
  }
}

/**
 * Generate octaves with minimum gap constraint (for tests)
 * Ensures octaves don't cluster (helps prevent octave-based strategies)
 */
export function generateOctaveSequence(
  trialCount: number,
  minGap: number = 1
): Octave[] {
  const octaves: Octave[] = [];
  const rng = new SeededRandom();

  for (let i = 0; i < trialCount; i++) {
    let octave: Octave;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      octave = rng.choice(OCTAVES);
      attempts++;
    } while (
      attempts < maxAttempts &&
      octaves.length > 0 &&
      Math.abs(octaves[octaves.length - 1] - octave) < minGap
    );

    octaves.push(octave);
  }

  return octaves;
}

/**
 * Validate trial params for anti-relative-pitch compliance
 */
export function validateTrialCompliance(
  trial: TrialParams,
  previousTrials: TrialParams[],
  expectedNoteSet?: ChromaticNote[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check if note is in expected set
  if (expectedNoteSet && !expectedNoteSet.includes(trial.note)) {
    issues.push(`Note ${trial.note} not in expected set`);
  }

  // Check for consecutive repetition
  if (previousTrials.length > 0 && previousTrials[previousTrials.length - 1].note === trial.note) {
    issues.push('Consecutive note repetition detected');
  }

  // Check for A-B-A pattern
  if (
    previousTrials.length >= 2 &&
    previousTrials[previousTrials.length - 2].note === trial.note &&
    previousTrials[previousTrials.length - 1].note !== trial.note
  ) {
    issues.push('A-B-A pattern detected');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Helper: Create randomization engine for training session
 */
export function createTrainingRandomizer(
  _level: number,
  noteSet: ChromaticNote[],
  seed?: number
): RandomizationEngine {
  return new RandomizationEngine(noteSet, false, seed);
}

/**
 * Helper: Create randomization engine for retention/final test
 */
export function createTestRandomizer(seed?: number): RandomizationEngine {
  // Tests always use all 12 notes to ensure full evaluation
  return new RandomizationEngine(CHROMATIC_NOTES, true, seed);
}

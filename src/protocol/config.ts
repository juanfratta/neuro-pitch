/**
 * Protocol Configuration for Wong 2025
 * Curriculum, thresholds, and scientific parameters
 * Do NOT modify criteria or reduce requirements
 */

import type { ProtocolConfig, ChromaticNote } from '../types';

export { CHROMATIC_NOTES } from '../types';

/**
 * Level-by-level curriculum
 * Each level adds ONE note after achieving 90% accuracy
 * Starting with 2 non-canonical notes (D#/Eb, F#/Gb) to avoid bias
 * User must reach 90%+ accuracy to unlock next note
 */
const LEVEL_NOTE_SETS: ChromaticNote[][] = [
  // Level 1: 2 notes (D#/Eb, F#/Gb)
  ['D#', 'F#'],
  
  // Level 2: 3 notes (add B)
  ['D#', 'F#', 'B'],
  
  // Level 3: 4 notes (add G)
  ['D#', 'F#', 'B', 'G'],
  
  // Level 4: 5 notes (add E)
  ['D#', 'E', 'F#', 'B', 'G'],
  
  // Level 5: 6 notes (add C#)
  ['B', 'C#', 'D#', 'E', 'F#', 'G'],
  
  // Level 6: 7 notes (add A)
  ['A', 'B', 'C#', 'D#', 'E', 'F#', 'G'],
  
  // Level 7: 8 notes (add G#)
  ['A', 'B', 'C#', 'D#', 'E', 'F#', 'G', 'G#'],
  
  // Level 8: 9 notes (add A#)
  ['A', 'A#', 'B', 'C#', 'D#', 'E', 'F#', 'G', 'G#'],
  
  // Level 9: 10 notes (add C)
  ['A', 'A#', 'B', 'C', 'C#', 'D#', 'E', 'F#', 'G', 'G#'],
  
  // Level 10: 11 notes (add D)
  ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F#', 'G', 'G#'],
];

/**
 * Reaction time thresholds per level (milliseconds)
 * User's average RT must be <= this value to advance
 * Progressively tighter constraints enforce faster, automatic responding
 */
const RT_THRESHOLDS: number[] = [
  2500, // Level 1: 2.5 seconds max
  2300, // Level 2
  2100, // Level 3
  1900, // Level 4
  1700, // Level 5
  1500, // Level 6: 1.5 seconds
  1300, // Level 7
  1100, // Level 8
  900,  // Level 9
  700,  // Level 10: 700ms max (must be fast and automatic)
];

/**
 * Core protocol configuration
 * Scientific parameters - DO NOT MODIFY
 */
export const PROTOCOL_CONFIG: ProtocolConfig = {
  version: 'wong-2025-v1',
  
  levelNoteSet: LEVEL_NOTE_SETS,
  rtThresholds: RT_THRESHOLDS,
  
  // Scientific criterion: minimum 90% accuracy to advance
  minAccuracy: 90,
  
  // Criterion must be sustained across 3 consecutive sessions
  sessionsRequiredForAdvance: 3,
  
  // Trial timeout: must respond within 5 seconds (hard limit)
  trialTimeout: 5000,
  
  // Trials per training session
  trialsPerSession: 30,
  
  // Audio engine parameters
  audio: {
    noteDuration: 2500, // 2.5 seconds (note is played this long)
    a4_frequency: 440, // A4 = 440 Hz
    volume: 0.7, // Consistent volume
  },
};

/**
 * Retention test schedule (in days from start)
 * Post-training evaluation without feedback
 */
export const RETENTION_TEST_SCHEDULE = {
  week2: 14,  // Day 14
  week4: 28,  // Day 28
  final: null, // Manual trigger or after all levels complete
};

/**
 * Anti-relative-pitch controls
 * Applied during training AND testing to prevent relational listening
 */
export const ANTI_RELATIVE_PITCH_RULES = {
  prohibitConsecutiveRepeat: true, // Can't play same note twice in a row
  prohibitABA: true, // Can't have A-B-A pattern
  prohibitABCBA: true, // Can't have reversal patterns
  octaveMixing: true, // Always mix octaves 3, 4, 5, 6
  minOctavaGapInTests: 1, // Minimum gap > 1 octave between notes in tests
  randomSeed: true, // Every trial uses explicit seed
  includeOutOfSetTrials: 0.1, // 10% of trials use notes outside current set (detection)
  instructionText: 'Do not sing, hum, or use reference instruments. Listen only to the isolated note.',
};

/**
 * Helper function: Get note set for a given level (1-10)
 */
export function getNotesForLevel(level: number): ChromaticNote[] {
  if (level < 1 || level > 10) {
    throw new Error(`Invalid level: ${level}. Must be 1-10.`);
  }
  return LEVEL_NOTE_SETS[level - 1];
}

/**
 * Helper function: Get RT threshold for a given level
 */
export function getRTThresholdForLevel(level: number): number {
  if (level < 1 || level > 10) {
    throw new Error(`Invalid level: ${level}. Must be 1-10.`);
  }
  return RT_THRESHOLDS[level - 1];
}

/**
 * Validation: ensure config is immutable at runtime
 */
export const validateProtocolIntegrity = (): boolean => {
  // Ensure all levels 1-10 present
  if (LEVEL_NOTE_SETS.length !== 10) {
    console.error('Protocol error: Missing levels in curriculum');
    return false;
  }
  if (RT_THRESHOLDS.length !== 10) {
    console.error('Protocol error: Missing RT thresholds');
    return false;
  }
  
  // Ensure accuracy threshold is non-negotiable 90%
  if (PROTOCOL_CONFIG.minAccuracy !== 90) {
    console.error('Protocol violation: minAccuracy must be exactly 90%');
    return false;
  }
  
  // Ensure advance requirement is 3 consecutive sessions
  if (PROTOCOL_CONFIG.sessionsRequiredForAdvance !== 3) {
    console.error('Protocol violation: must require 3 consecutive sessions for advance');
    return false;
  }
  
  // Ensure gradual level progression (each level adds at least one note)
  for (let i = 1; i < LEVEL_NOTE_SETS.length; i++) {
    if (LEVEL_NOTE_SETS[i].length <= LEVEL_NOTE_SETS[i - 1].length) {
      console.error(`Protocol error: Level ${i + 1} does not increase note count`);
      return false;
    }
  }
  
  return true;
};

// Validate protocol at import time
if (!validateProtocolIntegrity()) {
  throw new Error('Protocol configuration is invalid. See console errors.');
}

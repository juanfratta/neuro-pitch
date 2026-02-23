/**
 * Protocol Configuration for Wong 2025 variants
 * v1: original app behavior (2-note start + weekly tests)
 * v2: strict-like behavior (1-note start + no weekly tests)
 */

import type { ProtocolConfig, ChromaticNote } from '../types';
import { CHROMATIC_NOTES } from '../types';
import { getProtocolVariant, type ProtocolVariant } from '../utils/protocol-variant';

export { CHROMATIC_NOTES } from '../types';

const TOTAL_LEVELS = 10;

const V1_LEVEL_NOTE_SETS: ChromaticNote[][] = [
  ['D#', 'F#'],
  ['D#', 'F#', 'B'],
  ['D#', 'F#', 'B', 'G'],
  ['D#', 'F#', 'B', 'G', 'C#'],
  ['D#', 'F#', 'B', 'G', 'C#', 'A'],
  ['D#', 'F#', 'B', 'G', 'C#', 'A', 'E'],
  ['D#', 'F#', 'B', 'G', 'C#', 'A', 'E', 'C'],
  ['D#', 'F#', 'B', 'G', 'C#', 'A', 'E', 'C', 'F'],
  ['D#', 'F#', 'B', 'G', 'C#', 'A', 'E', 'C', 'F', 'A#'],
  CHROMATIC_NOTES,
];

function getChromaticIndex(note: ChromaticNote): number {
  const index = CHROMATIC_NOTES.indexOf(note);
  if (index < 0) {
    throw new Error(`Invalid note in chromatic scale: ${note}`);
  }
  return index;
}

function wrapChromaticIndex(index: number): number {
  return ((index % CHROMATIC_NOTES.length) + CHROMATIC_NOTES.length) % CHROMATIC_NOTES.length;
}

function buildAnchoredNoteSet(level: number, anchorNote: ChromaticNote): ChromaticNote[] {
  if (level < 1 || level > TOTAL_LEVELS) {
    throw new Error(`Invalid level: ${level}. Must be 1-${TOTAL_LEVELS}.`);
  }

  const anchorIndex = getChromaticIndex(anchorNote);
  const offsets: number[] = [0];

  for (let step = 1; offsets.length < level; step++) {
    offsets.push(-step);
    if (offsets.length < level) {
      offsets.push(step);
    }
  }

  const notes = offsets.map((offset) => CHROMATIC_NOTES[wrapChromaticIndex(anchorIndex + offset)]);
  return [...notes].sort((a, b) => getChromaticIndex(a) - getChromaticIndex(b));
}

const V2_REFERENCE_LEVEL_NOTE_SETS: ChromaticNote[][] = Array.from(
  { length: TOTAL_LEVELS },
  (_, index) => buildAnchoredNoteSet(index + 1, 'F')
);

const RT_THRESHOLDS: number[] = [
  2500,
  2300,
  2100,
  1900,
  1700,
  1500,
  1300,
  1100,
  900,
  700,
];

function getLevelNoteSetsForVariant(variant: ProtocolVariant): ChromaticNote[][] {
  return variant === 'v1' ? V1_LEVEL_NOTE_SETS : V2_REFERENCE_LEVEL_NOTE_SETS;
}

export function isWeeklyRetentionEnabled(variant: ProtocolVariant = getProtocolVariant()): boolean {
  return variant === 'v1';
}

export function getRetentionUnlockSessions(variant: ProtocolVariant = getProtocolVariant()): {
  week2: number | null;
  week4: number | null;
  final: number;
} {
  if (variant === 'v1') {
    return {
      week2: 15,
      week4: 30,
      final: 45,
    };
  }

  return {
    week2: null,
    week4: null,
    final: 45,
  };
}

const activeVariant = getProtocolVariant();

export const PROTOCOL_CONFIG: ProtocolConfig = {
  version: 'wong-2025-v1',
  levelNoteSet: getLevelNoteSetsForVariant(activeVariant),
  rtThresholds: RT_THRESHOLDS,
  minAccuracy: 90,
  sessionsRequiredForAdvance: 3,
  trialTimeout: 5000,
  trialsPerSession: 30,
  audio: {
    noteDuration: 2500,
    a4_frequency: 440,
    volume: 0.7,
  },
};

export const RETENTION_TEST_SCHEDULE = {
  week2: 14,
  week4: 28,
  final: null,
};

export const RETENTION_TEST_TRIALS = {
  week2: 24,
  week4: 48,
  final: 144,
} as const;

export const ANTI_RELATIVE_PITCH_RULES = {
  prohibitConsecutiveRepeat: true,
  prohibitABA: true,
  prohibitABCBA: true,
  octaveMixing: true,
  minOctavaGapInTests: 1,
  randomSeed: true,
  includeOutOfSetTrials: 0.1,
  instructionText: 'Do not sing, hum, or use reference instruments. Listen only to the isolated note.',
};

export function getNotesForLevel(level: number): ChromaticNote[] {
  return getNotesForLevelWithAnchor(level, 'F', getProtocolVariant());
}

export function getNotesForLevelWithAnchor(
  level: number,
  anchorNote: ChromaticNote,
  variant: ProtocolVariant = getProtocolVariant()
): ChromaticNote[] {
  if (level < 1 || level > TOTAL_LEVELS) {
    throw new Error(`Invalid level: ${level}. Must be 1-${TOTAL_LEVELS}.`);
  }

  if (variant === 'v1') {
    return V1_LEVEL_NOTE_SETS[level - 1];
  }

  return buildAnchoredNoteSet(level, anchorNote);
}

export function getRTThresholdForLevel(level: number): number {
  if (level < 1 || level > TOTAL_LEVELS) {
    throw new Error(`Invalid level: ${level}. Must be 1-${TOTAL_LEVELS}.`);
  }
  return RT_THRESHOLDS[level - 1];
}

export const validateProtocolIntegrity = (): boolean => {
  if (RT_THRESHOLDS.length !== TOTAL_LEVELS) {
    console.error('Protocol error: Missing RT thresholds');
    return false;
  }

  if (PROTOCOL_CONFIG.minAccuracy !== 90) {
    console.error('Protocol violation: minAccuracy must be exactly 90%');
    return false;
  }

  if (PROTOCOL_CONFIG.sessionsRequiredForAdvance !== 3) {
    console.error('Protocol violation: must require 3 consecutive sessions for advance');
    return false;
  }

  const levelNoteSets = getLevelNoteSetsForVariant(activeVariant);
  if (levelNoteSets.length !== TOTAL_LEVELS) {
    console.error('Protocol error: Missing levels in curriculum');
    return false;
  }

  for (let i = 1; i < levelNoteSets.length; i++) {
    if (levelNoteSets[i].length <= levelNoteSets[i - 1].length) {
      console.error(`Protocol error: Level ${i + 1} does not increase note count`);
      return false;
    }
  }

  return true;
};

if (!validateProtocolIntegrity()) {
  throw new Error('Protocol configuration is invalid. See console errors.');
}


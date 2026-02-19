/**
 * Type definitions for Absolute Pitch Trainer - Wong 2025 Protocol
 * Neuropsychological training protocol following Wong et al. (2025)
 */

// Musical notes (chromatic)
export type ChromaticNote = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export const CHROMATIC_NOTES: ChromaticNote[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Timbre (instrument)
export type Timbre = 'piano' | 'sine';
export const TRAINING_TIMBRE: Timbre = 'piano';
export const TEST_TIMBRES: Timbre[] = ['piano', 'sine'];

// Octaves range (single source of truth for training + tests)
export const OCTAVES = [2, 3, 4, 5, 6] as const;
export type Octave = (typeof OCTAVES)[number];

// Response types
export type TrialFeedback = 'correct' | 'incorrect' | 'slow';

/**
 * Individual trial record
 * Each trial is an atomic sensory event during training or testing
 */
export interface Trial {
  id: string;
  trial_number: number; // Sequence within session or test
  note: ChromaticNote;
  octave: Octave;
  timbre: Timbre;
  user_response: ChromaticNote | null; // null if not responded
  correct: boolean | null; // null if not yet marked
  reaction_time_ms: number | null; // null if not yet responded
  feedback: TrialFeedback | null; // null until marked
  seed: string; // Randomization seed for this trial
  timestamp: string; // ISO string
}

/**
 * Training session
 * A session contains multiple trials within a single level
 */
export interface Session {
  id: string;
  level: number; // Current protocol level (1-10)
  trials: Trial[];
  accuracy: number; // Percentage 0-100
  rt_avg: number; // Average reaction time in ms
  timestamp: string;
  completed_at: string | null;
}

/**
 * Retention test (week 2, 4, or final)
 * No feedback given during test; evaluation in isolation
 */
export interface RetentionTest {
  id: string;
  week: number; // 2, 4, or 'final' (represented as 0 or 8)
  trials: Trial[]; // All 12 chromatic notes tested
  passed: boolean; // >= 90% accuracy AND rt_avg within threshold
  accuracy: number;
  rt_avg: number;
  timestamp: string;
  scheduled_for: string; // ISO date when test was done
}

/**
 * Proficiency record for individual note
 * Tracks accuracy and reaction time per note for analytical dashboards
 */
export interface NoteProficiency {
  note: ChromaticNote;
  accuracy: number; // Percentage 0-100
  rt_avg: number; // Average RT in ms
  rt_min: number;
  rt_max: number;
  trial_count: number;
  last_updated: string;
}

/**
 * User profile
 * Central data structure holding all training progress and history
 */
export interface User {
  id: string;
  protocol_version: 'wong-2025-v1';
  created_at: string;
  current_level: number; // 1-10
  sessions: Session[];
  retention_tests: RetentionTest[];
  proficiency_map: { [note in ChromaticNote]: NoteProficiency };
  last_session_timestamp: string | null;
  mode: 'user' | 'research'; // UI mode
  training_history: {
    session_count: number;
    total_trials: number;
    started_at: string;
  };
}

/**
 * Protocol configuration
 * Defines the curriculum: which notes per level, RT thresholds, etc.
 */
export interface ProtocolConfig {
  version: 'wong-2025-v1';
  /**
   * Note sets per level
   * levelNoteSet[level] = ['C', 'D', 'E', ...] for that level
   * Index is 0-based (level 1 = index 0)
   */
  levelNoteSet: ChromaticNote[][];
  
  /**
   * RT thresholds per level (in milliseconds)
   * Max acceptable average RT to advance
   */
  rtThresholds: number[];
  
  /**
   * Minimum accuracy to advance (percentage)
   */
  minAccuracy: number;
  
  /**
   * Number of consecutive sessions required to meet criteria before advance
   */
  sessionsRequiredForAdvance: number;
  
  /**
   * Trial timeout (ms) - user must respond within this time
   */
  trialTimeout: number;
  
  /**
   * Max trials per session
   */
  trialsPerSession: number;
  
  /**
   * Audio settings
   */
  audio: {
    noteDuration: number; // milliseconds
    a4_frequency: number; // Hz
    volume: number; // 0-1
  };
}

/**
 * State machine for protocol progression
 */
export type ProtocolState = 
  | 'idle' 
  | 'training_session_active' 
  | 'session_review' 
  | 'week2_retention_test' 
  | 'week4_retention_test' 
  | 'final_test' 
  | 'completed' 
  | 'failed';

/**
 * Progress tracking
 * Computed metadata about current standing
 */
export interface ProgressMetrics {
  level: number;
  sessions_at_level: number;
  last_session_accuracy: number;
  last_session_rt_avg: number;
  eligible_to_advance: boolean;
  days_training: number;
  retention_tests_passed: number;
}

/**
 * Research dashboard export
 * Aggregated data for analytical inspection
 */
export interface ResearchSnapshot {
  user_id: string;
  timestamp: string;
  protocol_state: ProtocolState;
  current_metric: ProgressMetrics;
  sessions: Session[];
  retention_snapshots: RetentionTest[];
  proficiency_by_note: NoteProficiency[];
  error_distribution: { [note in ChromaticNote]: number };
  rt_distribution: { note: ChromaticNote; rt_samples: number[] }[];
}

/**
 * Persistence Service - localStorage / in-memory
 * Handles user data storage and retrieval
 * Prepared for future MongoDB integration
 */

import type { User, Session, Trial, RetentionTest, NoteProficiency, ChromaticNote } from '../types';
import { CHROMATIC_NOTES } from '../types';
import { PROTOCOL_CONFIG } from '../protocol/config';
import { getUserStorageKeyByMode } from '../utils/app-mode';
import { getProtocolVariant } from '../utils/protocol-variant';

const STORAGE_KEY_USER = 'neuro_pitch_user_v1';
const STORAGE_KEY_SESSIONS = 'neuro_pitch_sessions_v1';
const STORAGE_KEY_TESTS = 'neuro_pitch_tests_v1';

function getScopedStorageKey(baseKey: string): string {
  return `${getUserStorageKeyByMode(baseKey)}_${getProtocolVariant()}`;
}

function createRandomAnchorNote(): ChromaticNote {
  const index = Math.floor(Math.random() * CHROMATIC_NOTES.length);
  return CHROMATIC_NOTES[index];
}

function normalizeUserData(rawUser: any, userId: string): User {
  const baseUser = initializeUser(rawUser?.id || userId);
  const source = rawUser && typeof rawUser === 'object' ? rawUser : {};
  const sourceProficiency =
    source.proficiency_map && typeof source.proficiency_map === 'object'
      ? source.proficiency_map
      : {};
  const mergedProficiency = { ...baseUser.proficiency_map };

  CHROMATIC_NOTES.forEach((note) => {
    const src = sourceProficiency[note] || {};
    mergedProficiency[note] = {
      note,
      accuracy: typeof src.accuracy === 'number' ? src.accuracy : 0,
      rt_avg: typeof src.rt_avg === 'number' ? src.rt_avg : 0,
      rt_min: typeof src.rt_min === 'number' ? src.rt_min : Infinity,
      rt_max: typeof src.rt_max === 'number' ? src.rt_max : 0,
      trial_count: typeof src.trial_count === 'number' ? src.trial_count : 0,
      last_updated:
        typeof src.last_updated === 'string'
          ? src.last_updated
          : new Date().toISOString(),
    };
  });

  return {
    ...baseUser,
    ...source,
    protocol_version: 'wong-2025-v1',
    protocol_variant:
      source.protocol_variant === 'v1' || source.protocol_variant === 'v2'
        ? source.protocol_variant
        : getProtocolVariant(),
    anchor_note: CHROMATIC_NOTES.includes(source.anchor_note) ? source.anchor_note : createRandomAnchorNote(),
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
    retention_tests: Array.isArray(source.retention_tests)
      ? source.retention_tests
      : [],
    proficiency_map: mergedProficiency,
    mode: source.mode === 'research' ? 'research' : 'user',
    training_history: {
      ...baseUser.training_history,
      ...(source.training_history && typeof source.training_history === 'object'
        ? source.training_history
        : {}),
    },
  };
}

/**
 * Initialize a new user with level 1
 */
export function initializeUser(userId: string): User {
  // Initialize proficiency map for all 12 notes
  const proficiencyMap: { [key in ChromaticNote]: NoteProficiency } = {} as any;
  
  CHROMATIC_NOTES.forEach((note) => {
    proficiencyMap[note] = {
      note,
      accuracy: 0,
      rt_avg: 0,
      rt_min: Infinity,
      rt_max: 0,
      trial_count: 0,
      last_updated: new Date().toISOString(),
    };
  });

  const user: User = {
    id: userId,
    protocol_version: 'wong-2025-v1',
    protocol_variant: getProtocolVariant(),
    created_at: new Date().toISOString(),
    anchor_note: createRandomAnchorNote(),
    current_level: 1, // Start at level 1
    sessions: [],
    retention_tests: [],
    proficiency_map: proficiencyMap,
    last_session_timestamp: null,
    mode: 'user',
    training_history: {
      session_count: 0,
      total_trials: 0,
      started_at: new Date().toISOString(),
    },
  };

  return user;
}

/**
 * Load user from localStorage, or init new if not found
 */
export function loadOrCreateUser(userId: string): User {
  try {
    const scopedKey = getScopedStorageKey(STORAGE_KEY_USER);
    const stored = localStorage.getItem(scopedKey);
    if (stored) {
      const user = JSON.parse(stored);
      // Validate protocol version
      if (user.protocol_version !== 'wong-2025-v1') {
        console.warn('Protocol version mismatch; creating new user');
        return initializeUser(userId);
      }

      const normalized = normalizeUserData(user, userId);
      // Persist normalized structure to keep backward compatibility stable
      saveUser(normalized);
      return normalized;
    }

    // Backward compatibility: migrate legacy unscoped profile if present
    const legacyStored = localStorage.getItem(STORAGE_KEY_USER);
    if (legacyStored) {
      const legacyUser = JSON.parse(legacyStored);
      const normalized = normalizeUserData(legacyUser, userId);
      localStorage.setItem(scopedKey, JSON.stringify(normalized));
      return normalized;
    }
  } catch (err) {
    console.error('Failed to load user from localStorage:', err);
  }

  return initializeUser(userId);
}

/**
 * Save user to localStorage
 */
export function saveUser(user: User): void {
  try {
    localStorage.setItem(getScopedStorageKey(STORAGE_KEY_USER), JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save user to localStorage:', err);
    // In production, could queue for backup save or warn user
  }
}

/**
 * Create a new session for the current level
 */
export function createSession(level: number): Session {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    level,
    trials: [],
    accuracy: 0,
    rt_avg: 0,
    timestamp: new Date().toISOString(),
    completed_at: null,
  };
}

/**
 * Create a new trial
 */
export function createTrial(
  trialNumber: number,
  note: string,
  octave: number,
  timbre: string,
  seed: string
): Trial {
  return {
    id: `trial_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    trial_number: trialNumber,
    note: note as any, // Type is validated elsewhere
    octave: octave as any,
    timbre: timbre as any,
    user_response: null,
    correct: null,
    reaction_time_ms: null,
    feedback: null,
    seed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Record user response to a trial
 * Returns updated trial with computed feedback
 */
export function recordTrialResponse(
  trial: Trial,
  userResponse: string,
  reactionTimeMs: number
): Trial {
  const isCorrect = userResponse.toUpperCase() === trial.note.toUpperCase();
  const rtThreshold = PROTOCOL_CONFIG.trialTimeout;
  
  // Determine feedback
  let feedback: 'correct' | 'incorrect' | 'slow';
  if (!isCorrect) {
    feedback = 'incorrect';
  } else if (reactionTimeMs > rtThreshold * 0.8) {
    // Feedback as "slow" if reaction time is > 80% of timeout
    feedback = 'slow';
  } else {
    feedback = 'correct';
  }

  return {
    ...trial,
    user_response: userResponse as any,
    correct: isCorrect,
    reaction_time_ms: reactionTimeMs,
    feedback,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Compute session metrics: accuracy and average RT
 */
export function computeSessionMetrics(trials: Trial[]): { accuracy: number; rt_avg: number } {
  if (trials.length === 0) {
    return { accuracy: 0, rt_avg: 0 };
  }

  const correctCount = trials.filter((t) => t.correct === true).length;
  const accuracy = (correctCount / trials.length) * 100;

  const respondedTrials = trials.filter((t) => t.reaction_time_ms !== null);
  const rt_avg =
    respondedTrials.length > 0
      ? respondedTrials.reduce((sum, t) => sum + (t.reaction_time_ms || 0), 0) /
        respondedTrials.length
      : 0;

  return { accuracy, rt_avg };
}

/**
 * Complete session: update metrics and save
 */
export function completeSession(session: Session): Session {
  const { accuracy, rt_avg } = computeSessionMetrics(session.trials);
  return {
    ...session,
    accuracy,
    rt_avg,
    completed_at: new Date().toISOString(),
  };
}

/**
 * Update user proficiency after session
 * Aggregates accuracy and RT stats per note
 */
export function updateProficiencyFromSession(user: User, session: Session): User {
  const newProficiency = { ...user.proficiency_map };

  session.trials.forEach((trial) => {
    if (trial.correct !== null && trial.reaction_time_ms !== null) {
      const note = trial.note;
      const current = newProficiency[note] || {
        note,
        accuracy: 0,
        rt_avg: 0,
        rt_min: Infinity,
        rt_max: 0,
        trial_count: 0,
        last_updated: new Date().toISOString(),
      };

      const newCount = current.trial_count + 1;
      const newAccuracy = (current.accuracy * current.trial_count + (trial.correct ? 100 : 0)) / newCount;
      const newRtAvg = (current.rt_avg * current.trial_count + trial.reaction_time_ms) / newCount;
      const newRtMin = Math.min(current.rt_min, trial.reaction_time_ms);
      const newRtMax = Math.max(current.rt_max, trial.reaction_time_ms);

      newProficiency[note] = {
        note,
        accuracy: newAccuracy,
        rt_avg: newRtAvg,
        rt_min: newRtMin,
        rt_max: newRtMax,
        trial_count: newCount,
        last_updated: new Date().toISOString(),
      };
    }
  });

  return {
    ...user,
    proficiency_map: newProficiency,
  };
}

/**
 * Check if user is eligible to advance to next level
 * Requires: 2 consecutive sessions meeting 90% acc + RT threshold
 */
export function canAdvanceLevel(user: User): boolean {
  const sessionsThisLevel = user.sessions.filter((s) => s.level === user.current_level);
  
  if (sessionsThisLevel.length < PROTOCOL_CONFIG.sessionsRequiredForAdvance) {
    return false;
  }

  // Check last 2 sessions
  const lastTwoSessions = sessionsThisLevel.slice(-PROTOCOL_CONFIG.sessionsRequiredForAdvance);
  const rtThreshold = PROTOCOL_CONFIG.rtThresholds[user.current_level - 1];
  const minAccuracy = PROTOCOL_CONFIG.minAccuracy;

  return lastTwoSessions.every(
    (session) => session.accuracy >= minAccuracy && session.rt_avg <= rtThreshold
  );
}

/**
 * Advance user to next level (if valid)
 */
export function advanceLevel(user: User): User {
  if (user.current_level >= 10 && canAdvanceLevel(user)) {
    // User has completed all levels
    return {
      ...user,
      current_level: 10, // Cap at level 10
    };
  }

  if (canAdvanceLevel(user)) {
    return {
      ...user,
      current_level: Math.min(user.current_level + 1, 10),
    };
  }

  return user;
}

/**
 * Create a retention test
 */
export function createRetentionTest(week: number): RetentionTest {
  return {
    id: `retention_${week}_${Date.now()}`,
    week,
    trials: [],
    passed: false,
    accuracy: 0,
    rt_avg: 0,
    timestamp: new Date().toISOString(),
    scheduled_for: new Date().toISOString(),
  };
}

/**
 * Complete retention test with metrics
 */
export function completeRetentionTest(test: RetentionTest, minAccuracy: number = 90): RetentionTest {
  const { accuracy, rt_avg } = computeSessionMetrics(test.trials);
  const rtThreshold = PROTOCOL_CONFIG.rtThresholds[9]; // Use final level threshold

  const passed = accuracy >= minAccuracy && rt_avg <= rtThreshold;

  return {
    ...test,
    accuracy,
    rt_avg,
    passed,
  };
}

/**
 * Export user data as JSON (for research/backup)
 */
export function exportUserData(user: User): string {
  return JSON.stringify(user, null, 2);
}

/**
 * Export user data as CSV (for analysis in spreadsheet tools)
 */
export function exportUserDataAsCSV(user: User): string {
  const lines: string[] = [];

  // Header
  lines.push('type,level,trial_number,note,octave,user_response,correct,reaction_time_ms,seed,timbre');

  // Sessions and trials
  user.sessions.forEach((session) => {
    session.trials.forEach((trial) => {
      lines.push(
        `session,${session.level},${trial.trial_number},${trial.note},${trial.octave},${
          trial.user_response || ''
        },${trial.correct || ''},${trial.reaction_time_ms || ''},${trial.seed},${trial.timbre}`
      );
    });
  });

  // Retention tests
  user.retention_tests.forEach((test) => {
    test.trials.forEach((trial) => {
      lines.push(
        `retention_test_week${test.week},${test.week},${trial.trial_number},${trial.note},${
          trial.octave
        },${trial.user_response || ''},${trial.correct || ''},${trial.reaction_time_ms || ''},${
          trial.seed
        },${trial.timbre}`
      );
    });
  });

  return lines.join('\n');
}

/**
 * Clear all user data (for debug/reset)
 * WARNING: This is destructive and should require explicit user consent
 */
export function clearAllUserData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_SESSIONS);
    localStorage.removeItem(STORAGE_KEY_TESTS);
    console.warn('All user data cleared');
  } catch (err) {
    console.error('Failed to clear user data:', err);
  }
}

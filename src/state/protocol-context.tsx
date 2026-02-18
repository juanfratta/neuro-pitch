/**
 * Protocol Context - Global state management for training protocol
 * Provides user state, session management, and protocol progression
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, Session, Trial, ProtocolState } from '../types';
import {
  loadOrCreateUser,
  saveUser,
  completeSession,
  updateProficiencyFromSession,
  advanceLevel,
  canAdvanceLevel,
  createRetentionTest,
  completeRetentionTest,
} from '../services/storage';
import { ProtocolStateMachine } from '../state/machine';
import { PROTOCOL_CONFIG, getNotesForLevel } from '../protocol/config';
import {
  createTrainingRandomizer,
  createTestRandomizer,
} from '../utils/randomization';

interface ProtocolContextType {
  // User data
  user: User | null;
  isLoading: boolean;

  // Current session
  currentSession: Session | null;
  sessionsAtCurrentLevel: number;
  consecutiveSuccessfulSessions: number;

  // State
  protocolState: ProtocolState;
  stateMachine: ProtocolStateMachine | null;

  // Session operations
  startSession: () => Promise<void>;
  addTrialToSession: (trial: Trial) => void;
  completeCurrentSession: () => Promise<void>;
  submitSessionResponse: (trialId: string, response: string, reactionTimeMs: number) => void;

  // Test operations
  startRetentionTest: (week: number) => Promise<void>;
  completeCurrentTest: () => Promise<void>;
  submitTestResponse: (trialId: string, response: string, reactionTimeMs: number) => void;

  // Data export
  exportData: (format: 'json' | 'csv') => string;

  // Debug/research mode
  setResearchMode: (enabled: boolean) => void;
  isResearchMode: boolean;
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

/**
 * Provider component for protocol context
 */
export const ProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [protocolState, setProtocolState] = useState<ProtocolState>('idle');
  const [stateMachine, setStateMachine] = useState<ProtocolStateMachine | null>(null);
  const [isResearchMode, setIsResearchMode] = useState(false);

  // Initialize user on mount
  useEffect(() => {
    const userId = `user_${Date.now()}`; // Simple local ID
    const loadedUser = loadOrCreateUser(userId);
    setUser(loadedUser);

    const machine = new ProtocolStateMachine(loadedUser);
    setStateMachine(machine);
    setProtocolState(machine.getState());
    setIsLoading(false);
  }, []);

  // Start a training session
  const startSession = useCallback(async () => {
    if (!user || !stateMachine) return;

    const notes = getNotesForLevel(user.current_level);
    createTrainingRandomizer(user.current_level, notes);

    const session = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      level: user.current_level,
      trials: [],
      accuracy: 0,
      rt_avg: 0,
      timestamp: new Date().toISOString(),
      completed_at: null,
    };
    setCurrentSession(session);

    stateMachine.setUser(user);
    stateMachine.transition('start_training');
    setProtocolState(stateMachine.getState());
  }, [user, stateMachine]);

  // Add trial to current session
  const addTrialToSession = useCallback((trial: Trial) => {
    if (!currentSession) return;

    setCurrentSession({
      ...currentSession,
      trials: [...currentSession.trials, trial],
    });
  }, [currentSession]);

  // Submit response to a trial
  const submitSessionResponse = useCallback(
    (trialId: string, response: string, reactionTimeMs: number) => {
      if (!currentSession) return;

      setCurrentSession((session) => {
        if (!session) return session;

        return {
          ...session,
          trials: session.trials.map((trial) => {
            if (trial.id === trialId) {
              return {
                ...trial,
                user_response: response as any,
                correct: response.toUpperCase() === trial.note,
                reaction_time_ms: reactionTimeMs,
                feedback:
                  response.toUpperCase() === trial.note
                    ? reactionTimeMs > PROTOCOL_CONFIG.trialTimeout * 0.8
                      ? 'slow'
                      : 'correct'
                    : 'incorrect',
              };
            }
            return trial;
          }),
        };
      });
    },
    [currentSession]
  );

  // Complete current session
  const completeCurrentSession = useCallback(async () => {
    if (!user || !currentSession || !stateMachine) return;

    const completedSession = completeSession(currentSession);
    let updatedUser: User = {
      ...user,
      sessions: [...user.sessions, completedSession],
      last_session_timestamp: new Date().toISOString(),
      training_history: {
        ...user.training_history,
        session_count: user.training_history.session_count + 1,
        total_trials:
          user.training_history.total_trials + completedSession.trials.length,
      },
    };

    // Update proficiency
    updatedUser = updateProficiencyFromSession(updatedUser, completedSession);

    // Check for level advancement
    if (canAdvanceLevel(updatedUser)) {
      updatedUser = advanceLevel(updatedUser);
    }

    setUser(updatedUser);
    saveUser(updatedUser);

    stateMachine.setUser(updatedUser);
    stateMachine.transition('complete_session');
    setProtocolState(stateMachine.getState());

    setCurrentSession(null);
  }, [user, currentSession, stateMachine]);

  // Start retention test
  const startRetentionTest = useCallback(
    async (week: number) => {
      if (!user || !stateMachine) return;

      createTestRandomizer();

      const test = createRetentionTest(week);
      // Cast to Session for UI purposes (they share same trial structure)
      setCurrentSession(test as any);

      stateMachine.setUser(user);
      stateMachine.transition(week === 2 ? 'take_week2_test' : 'take_week4_test');
      setProtocolState(stateMachine.getState());
    },
    [user, stateMachine]
  );

  // Submit response to test trial
  const submitTestResponse = useCallback(
    (trialId: string, response: string, reactionTimeMs: number) => {
      // Same as training response submission
      submitSessionResponse(trialId, response, reactionTimeMs);
    },
    [submitSessionResponse]
  );

  // Complete retention test
  const completeCurrentTest = useCallback(async () => {
    if (!user || !currentSession || !stateMachine) return;

    const completedTest = completeSession(currentSession);
    const test = completeRetentionTest(completedTest as any);

    const updatedUser: User = {
      ...user,
      retention_tests: [...user.retention_tests, test as any],
    };

    setUser(updatedUser);
    saveUser(updatedUser);

    stateMachine.setUser(updatedUser);
    stateMachine.transition('complete_test');
    setProtocolState(stateMachine.getState());

    setCurrentSession(null);
  }, [user, currentSession, stateMachine]);

  // Export data
  const exportData = useCallback(
    (format: 'json' | 'csv'): string => {
      if (!user) return '';

      if (format === 'json') {
        return JSON.stringify(user, null, 2);
      } else {
        // CSV export
        const lines: string[] = [];
        lines.push('type,level,trial_number,note,octave,user_response,correct,reaction_time,seed,timbre');

        user.sessions.forEach((session) => {
          session.trials.forEach((trial) => {
            lines.push(
              `session,${session.level},${trial.trial_number},${trial.note},${
                trial.octave
              },${trial.user_response || ''},${trial.correct || ''},${
                trial.reaction_time_ms || ''
              },${trial.seed},${trial.timbre}`
            );
          });
        });

        return lines.join('\n');
      }
    },
    [user]
  );

  // Set research mode
  const handleSetResearchMode = useCallback((enabled: boolean) => {
    setIsResearchMode(enabled);
  }, []);

  // Get sessions at current level
  const sessionsAtCurrentLevel = user
    ? user.sessions.filter((s) => s.level === user.current_level).length
    : 0;

  // Get consecutive successful sessions (≥90% accuracy from most recent)
  const consecutiveSuccessfulSessions = user
    ? (() => {
        const currentLevelSessions = user.sessions
          .filter((s) => s.level === user.current_level)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Most recent first

        let count = 0;
        for (const session of currentLevelSessions) {
          if (session.accuracy >= 90) {
            count++;
          } else {
            break; // Stop when we hit a session that didn't meet criteria
          }
        }
        return count;
      })()
    : 0;

  const value: ProtocolContextType = {
    user,
    isLoading,
    currentSession,
    sessionsAtCurrentLevel,
    consecutiveSuccessfulSessions,
    protocolState,
    stateMachine,
    startSession,
    addTrialToSession,
    completeCurrentSession,
    submitSessionResponse,
    startRetentionTest,
    completeCurrentTest,
    submitTestResponse,
    exportData,
    setResearchMode: handleSetResearchMode,
    isResearchMode,
  };

  return (
    <ProtocolContext.Provider value={value}>
      {children}
    </ProtocolContext.Provider>
  );
};

/**
 * Hook to use protocol context
 */
export const useProtocol = (): ProtocolContextType => {
  const context = useContext(ProtocolContext);
  if (!context) {
    throw new Error('useProtocol must be used within ProtocolProvider');
  }
  return context;
};

/**
 * Custom Hook: useSessionProgression
 * 
 * Manages session progression:
 * - Tracking current trial number (1-30)
 * - Adding trials to session
 * - Detecting session completion
 * 
 * Separates progression logic from audio/UI
 * Enables easy testing of advancement criteria
 */

import { useState, useCallback } from 'react';
import type { Trial } from '../types';

export interface UseSessionProgressionReturn {
  trials: Trial[];
  addTrial: (trial: Trial) => void;
  currentTrialNumber: number;
  isSessionComplete: boolean;
}

export const useSessionProgression = (totalTrials: number = 30): UseSessionProgressionReturn => {
  const [trials, setTrials] = useState<Trial[]>([]);

  // Add trial to session
  const addTrial = useCallback((trial: Trial) => {
    setTrials((prev) => [...prev, trial]);
  }, []);

  // Derived state (no need for additional state variables)
  const isSessionComplete = trials.length >= totalTrials;
  const currentTrialNumber = trials.length + 1;

  return {
    trials,
    addTrial,
    currentTrialNumber,
    isSessionComplete,
  };
};

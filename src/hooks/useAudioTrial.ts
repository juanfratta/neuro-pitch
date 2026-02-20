/**
 * Custom Hook: useAudioTrial
 * 
 * Manages the complete lifecycle of a single trial:
 * - Playing the audio note
 * - Capturing user response time
 * - Generating feedback (correct/incorrect/slow)
 * 
 * Decouples audio logic from UI rendering
 * Eliminates need for refs in parent component
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioEngine } from '../audio/engine';
import { PROTOCOL_CONFIG } from '../protocol/config';
import type { ChromaticNote, Octave, Timbre } from '../types';

export interface TrialParams {
  note: ChromaticNote;
  octave: Octave;
  timbre: Timbre;
  durationMs?: number;
}

export type TrialState = 'idle' | 'playing' | 'waiting_response' | 'feedback';
export type TrialFeedback = 'correct' | 'incorrect' | 'slow' | null;

export interface UseAudioTrialReturn {
  trialState: TrialState;
  feedback: TrialFeedback;
  isReady: boolean;
  playTrial: (params: TrialParams) => Promise<void>;
  submitResponse: (userNote: string) => { reactionTime: number; feedback: TrialFeedback };
}

export const useAudioTrial = (audioEngine: AudioEngine): UseAudioTrialReturn => {
  const [trialState, setTrialState] = useState<TrialState>('idle');
  const [feedback, setFeedback] = useState<TrialFeedback>(null);
  const [isReady, setIsReady] = useState(false);

  // Refs for managing trial state
  const currentTrialRef = useRef<TrialParams | null>(null);
  const responseStartTimeRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize on mount - cleanup timeouts on unmount
  useEffect(() => {
    setIsReady(true);

    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    };
  }, []);

  // Play a trial note
  const playTrial = useCallback(
    async (params: TrialParams): Promise<void> => {
      if (!isReady) return;

      currentTrialRef.current = params;
      setFeedback(null);
      setTrialState('playing');

      const noteDurationMs = params.durationMs ?? PROTOCOL_CONFIG.audio.noteDuration;

      void audioEngine
        .playNote(
          params.note,
          params.octave,
          params.timbre,
          noteDurationMs
        )
        .catch((err) => {
          console.error('Error playing note:', err);
        });

      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = setTimeout(() => {
        responseStartTimeRef.current = Date.now();
        setTrialState('waiting_response');
      }, noteDurationMs);
    },
    [isReady, audioEngine]
  );

  // Auto-submit if no response in time (managed separately to avoid circular dependency)
  useEffect(() => {
    if (trialState !== 'waiting_response') {
      // Clean up when leaving waiting_response state
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
      return;
    }

    // Set timeout only when entering waiting_response
    responseTimeoutRef.current = setTimeout(() => {
      // Submit with auto-response if timeout
      if (currentTrialRef.current && responseStartTimeRef.current) {
        audioEngine.stopAll();
        setFeedback('slow');
        setTrialState('feedback');

        feedbackTimeoutRef.current = setTimeout(() => {
          setTrialState('idle');
          setFeedback(null);
        }, 800);
      }
    }, PROTOCOL_CONFIG.trialTimeout);

    return () => {
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
    };
  }, [trialState, audioEngine]);

  // Submit user response
  const submitResponse = useCallback(
    (userNote: string): { reactionTime: number; feedback: TrialFeedback } => {
      if (!currentTrialRef.current || !responseStartTimeRef.current) {
        return { reactionTime: 0, feedback: null };
      }

      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      audioEngine.stopAll();

      const reactionTime = Date.now() - responseStartTimeRef.current;
      const isCorrect = userNote.toUpperCase() === currentTrialRef.current.note;

      const fb: TrialFeedback = isCorrect ? 'correct' : 'incorrect';

      setFeedback(fb);
      setTrialState('feedback');

      // Show feedback for 800ms then reset
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setTrialState('idle');
        setFeedback(null);
      }, 800);

      return { reactionTime, feedback: fb };
    },
    [audioEngine]
  );

  return {
    trialState,
    feedback,
    isReady,
    playTrial,
    submitResponse,
  };
};

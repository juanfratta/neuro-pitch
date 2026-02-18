/**
 * Training Session Component
 * Core UI for presenting trials and capturing user responses
 * 
 * Features:
 * - Displays audio note with chromatic note selection
 * - Captures reaction time
 * - Shows feedback (correct/incorrect/slow)
 * - Progresses through trials
 * - No gamification, minimal UI, scientific only
 */

import React, { useState, useEffect, useRef } from 'react';
import { useProtocol } from '../state/protocol-context';
import { getAudioEngine } from '../audio/engine';
import { RandomizationEngine, createTrainingRandomizer } from '../utils/randomization';
import { PROTOCOL_CONFIG, getNotesForLevel } from '../protocol/config';
import { createTrial } from '../services/storage';
import { SessionSummary } from './SessionSummary';
import '../styles/TrainingSession.css';

interface TrialUIState {
  status: 'playing' | 'waiting_response' | 'feedback' | 'next_trial' | 'completed';
  feedback: 'correct' | 'incorrect' | 'slow' | null;
  trialNumber: number;
  totalTrials: number;
}

export const TrainingSession: React.FC = () => {
  const { user, currentSession, submitSessionResponse, addTrialToSession, completeCurrentSession } =
    useProtocol();

  const [trialState, setTrialState] = useState<TrialUIState>({
    status: 'playing',
    feedback: null,
    trialNumber: 1,
    totalTrials: PROTOCOL_CONFIG.trialsPerSession,
  });

  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);
  const [sessionAccuracy, setSessionAccuracy] = useState<number>(0);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  const audioEngineRef = useRef(getAudioEngine());
  const randomizerRef = useRef<RandomizationEngine | null>(null);
  const currentTrialRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTrialsCountRef = useRef(0); // Track trials independent of state
  const isPlayingRef = useRef(false); // Prevent duplicate trial playback

  // Initialize randomizer and session
  useEffect(() => {
    if (!user || !currentSession) return;

    const notes = getNotesForLevel(user.current_level);
    randomizerRef.current = createTrainingRandomizer(user.current_level, notes);
    sessionTrialsCountRef.current = 0; // Reset counter

    // Reset trial state when new session starts
    isPlayingRef.current = false; // Reset flag
    setTrialState({
      status: 'playing',
      feedback: null,
      trialNumber: 1,
      totalTrials: PROTOCOL_CONFIG.trialsPerSession,
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user?.id, currentSession?.id]); // Only reset on actual session change

  // Auto-finalize session when all trials complete
  useEffect(() => {
    if (trialState.status !== 'completed') return;

    // Calculate session accuracy
    if (currentSession) {
      const correctResponses = currentSession.trials.filter(
        (trial) => trial.user_response === trial.note
      ).length;
      const accuracy = (correctResponses / currentSession.trials.length) * 100;
      setSessionAccuracy(accuracy);
      setShowSummary(true);
    }
  }, [trialState.status, currentSession]);

  // Auto-finalize after showing summary
  useEffect(() => {
    if (!showSummary) return;

    const timer = setTimeout(() => {
      completeCurrentSession();
    }, 4000); // Summary shows for 4 seconds

    return () => clearTimeout(timer);
  }, [showSummary, completeCurrentSession]);

  // Play note and prepare for next trial
  useEffect(() => {
    if (!currentSession || !user || !randomizerRef.current) return;
    if (trialState.status !== 'playing') return;
    if (isPlayingRef.current) return; // Prevent duplicate execution

    isPlayingRef.current = true;

    const playNextTrial = async () => {
      // Check if session complete
      if (sessionTrialsCountRef.current >= PROTOCOL_CONFIG.trialsPerSession) {
        setTrialState((prev) => ({
          ...prev,
          status: 'completed',
          feedback: null as any,
        }));
        return;
      }

      const trialNumber = sessionTrialsCountRef.current + 1;

      // Generate trial parameters
      const trialParams = randomizerRef.current!.generateTrial();

      // Create trial object
      const trial = createTrial(
        trialNumber,
        trialParams.note,
        trialParams.octave,
        trialParams.timbre,
        trialParams.seed
      );

      currentTrialRef.current = trial;
      addTrialToSession(trial);
      sessionTrialsCountRef.current += 1; // Increment counter

      // Update display
      setTrialState((prev) => ({
        ...prev,
        trialNumber,
      }));

      try {
        await audioEngineRef.current.playNote(
          trial.note,
          trial.octave,
          trial.timbre,
          PROTOCOL_CONFIG.audio.noteDuration
        );
      } catch (err) {
        console.error('Error playing note:', err);
      }

      // Transition to waiting for response AFTER audio finishes
      setResponseStartTime(Date.now());
      setSelectedNote(null);
      setTrialState((prev) => ({
        ...prev,
        status: 'waiting_response' as const,
        feedback: null,
      }));

      // Set timeout for slow response
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Auto-submit with "slow" feedback if no response in time
        handleSubmitResponse();
      }, PROTOCOL_CONFIG.trialTimeout);

      isPlayingRef.current = false; // Allow next trial
    };

    playNextTrial();
  }, [trialState.status]);

  // Handle user note selection
  const handleNoteClick = (note: string) => {
    if (trialState.status !== 'waiting_response' || !responseStartTime) return;

    setSelectedNote(note);

    // Submit immediately on selection
    handleSubmitResponse(note);
  };

  // Submit response
  const handleSubmitResponse = (selectedNoteOverride?: string) => {
    if (!currentTrialRef.current || !responseStartTime) return;

    const reactionTime = Date.now() - responseStartTime;
    const userNote = selectedNoteOverride || selectedNote || 'NONE';

    // Record response
    submitSessionResponse(currentTrialRef.current.id, userNote, reactionTime);

    // Determine feedback (only during training, not tests)
    const isCorrect = userNote.toUpperCase() === currentTrialRef.current.note;
    let fb: 'correct' | 'incorrect' | 'slow';

    if (!isCorrect) {
      fb = 'incorrect';
    } else if (reactionTime > PROTOCOL_CONFIG.trialTimeout * 0.8) {
      fb = 'slow';
    } else {
      fb = 'correct';
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    setTrialState((prev) => ({
      ...prev,
      status: 'feedback',
      feedback: fb,
    }));

    // Show feedback briefly then progress to next trial
    timerRef.current = setTimeout(() => {
      const isSessionComplete = sessionTrialsCountRef.current >= PROTOCOL_CONFIG.trialsPerSession;
      setTrialState((prev) => ({
        ...prev,
        status: isSessionComplete ? ('completed' as const) : ('playing' as const),
        feedback: null,
      }));
    }, 800); // Show feedback for 800ms
  };

  const feedbackLabels = {
    correct: 'Correcto',
    incorrect: 'Incorrecto',
    slow: 'Lento',
  };

  const feedbackColors = {
    correct: '#2ecc71', // Green
    incorrect: '#e74c3c', // Red
    slow: '#f39c12', // Orange
  };

  if (!user || !currentSession) {
    return <div className="training-session loading">Cargando sesión...</div>;
  }

  return (
    <div className="training-session">
      {/* Header */}
      <div className="session-header">
        <div className="level-indicator">
          Nivel {user.current_level} de 10
        </div>
        <div className="trial-indicator">
          {trialState.trialNumber} / {trialState.totalTrials}
        </div>
      </div>

      {/* Main display */}
      <div className="trial-display">
        {trialState.status === 'playing' && (
          <div className="playing-indicator">
            <div className="spinner"></div>
            <p>Escuchando...</p>
          </div>
        )}

        {trialState.status === 'waiting_response' && (
          <div className="response-prompt">
            <p>¿Qué nota escuchaste?</p>
            {selectedNote && (
              <div className="selected-note">{selectedNote}</div>
            )}
          </div>
        )}

        {trialState.status === 'feedback' && trialState.feedback && (
          <div
            className="feedback-display"
            style={{ borderColor: feedbackColors[trialState.feedback] }}
          >
            <p>
              {feedbackLabels[trialState.feedback]}
            </p>
          </div>
        )}

        {trialState.status === 'completed' && showSummary && (
          <SessionSummary
            accuracy={sessionAccuracy}
            trialsCompleted={currentSession?.trials.length || 0}
            onContinue={() => completeCurrentSession()}
          />
        )}
      </div>

      {/* Note selection buttons (only for current level notes) */}
      <div className="note-selection">
        {getNotesForLevel(user.current_level).map((note: string) => (
          <button
            key={note}
            className={`note-button ${selectedNote === note ? 'selected' : ''}`}
            onClick={() => handleNoteClick(note)}
            disabled={trialState.status !== 'waiting_response'}
          >
            {note}
          </button>
        ))}
      </div>

      {/* Protocol instruction banner */}
      <div className="protocol-instruction">
        <p>
          No cantar, tararear ni usar instrumentos. Escucha únicamente la nota aislada.
        </p>
      </div>
    </div>
  );
};

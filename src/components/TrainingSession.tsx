/**
 * Training Session Component - Refactored
 * 
 * Orchestrates the trial loop using:
 * - useAudioTrial: Handles audio playback + feedback
 * - useSessionProgression: Tracks trial progression
 * - Sub-components: TrialPlayback, NoteSelector, TrialFeedback
 * 
 * Only has 1 useEffect (initialization)
 * No refs, no duplicate code
 * Clean separation of concerns
 */

import React, { useState, useEffect, useRef } from 'react';
import { useProtocol } from '../state/protocol-context';
import { getAudioEngine } from '../audio/engine';
import { useAudioTrial } from '../hooks/useAudioTrial';
import { useSessionProgression } from '../hooks/useSessionProgression';
import { RandomizationEngine, createTrainingRandomizer } from '../utils/randomization';
import { PROTOCOL_CONFIG, getNotesForLevel } from '../protocol/config';
import { createTrial } from '../services/storage';
import { SessionSummary } from './SessionSummary';
import { TrialPlayback } from './TrialPlayback';
import { NoteSelector } from './TrialNoteSelector';
import { TrialFeedback } from './TrialFeedback';
import '../styles/TrainingSession.css';

export const TrainingSession: React.FC = () => {
  const { user, currentSession, submitSessionResponse, addTrialToSession, completeCurrentSession } =
    useProtocol();

  // Custom hooks for audio and session progression
  const audioEngine = getAudioEngine();
  const { trialState, feedback, playTrial, submitResponse, isReady } = useAudioTrial(audioEngine);
  const { trials, addTrial, currentTrialNumber, isSessionComplete } = useSessionProgression(
    PROTOCOL_CONFIG.trialsPerSession
  );

  // UI state only
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [currentTrialData, setCurrentTrialData] = useState<any>(null);

  // Track if we've started the session
  const hasStartedRef = useRef(false);
  const randomizerRef = useRef<RandomizationEngine | null>(null);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived values (no state needed)
  const levelNotes = getNotesForLevel(user?.current_level || 1);
  const sessionAccuracy =
    currentSession && currentSession.trials.length > 0
      ? (currentSession.trials.filter((t) => t.correct === true).length / currentSession.trials.length) * 100
      : 0;

  // Initialize randomizer once on mount
  useEffect(() => {
    if (!user || !currentSession) return;

    const notes = getNotesForLevel(user.current_level);
    randomizerRef.current = createTrainingRandomizer(user.current_level, notes);
    hasStartedRef.current = false; // Reset for new session

    return () => {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, [user?.id, currentSession?.id]);

  // Auto-play first trial when ready, then when feedback ends (idle state)
  useEffect(() => {
    if (!isReady || !randomizerRef.current) return;
    if (isSessionComplete) return;

    // First time: start the session
    if (!hasStartedRef.current && trialState === 'idle') {
      hasStartedRef.current = true;
      playNextTrial();
      return;
    }

    // Subsequent times: feedback ended, play next trial
    if (hasStartedRef.current && trialState === 'idle') {
      setSelectedNote(null);
      playNextTrial();
    }
  }, [isReady, trialState, isSessionComplete]);

  // Detect session completion and show summary
  useEffect(() => {
    if (!isSessionComplete) return;

    setShowSummary(true);

    // Auto-finalize after 4 seconds
    if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    summaryTimeoutRef.current = setTimeout(() => {
      completeCurrentSession();
    }, 4000);

    return () => {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, [isSessionComplete, completeCurrentSession]);

  // Generate and play next trial
  const playNextTrial = async () => {
    if (!randomizerRef.current || currentTrialNumber > PROTOCOL_CONFIG.trialsPerSession) return;

    // Generate trial parameters
    const trialParams = randomizerRef.current.generateTrial();

    // Create trial object
    const trial = createTrial(
      currentTrialNumber,
      trialParams.note,
      trialParams.octave,
      trialParams.timbre,
      trialParams.seed
    );

    setCurrentTrialData({
      note: trial.note,
      octave: trial.octave,
      timbre: trial.timbre,
      trialObject: trial,
    });

    // Add to session tracking
    addTrial(trial);
    addTrialToSession(trial);

    // Play audio
    await playTrial({
      note: trial.note,
      octave: trial.octave,
      timbre: trial.timbre,
    });
  };

  // Handle user note selection
  const handleNoteClick = (note: string) => {
    if (trialState !== 'waiting_response' || selectedNote) return;

    setSelectedNote(note);

    // Submit response via custom hook
    const { reactionTime } = submitResponse(note);

    // Record in protocol context
    if (currentTrialData?.trialObject) {
      submitSessionResponse(currentTrialData.trialObject.id, note, reactionTime);
    }
  };

  // Loading state
  if (!user || !currentSession) {
    return <div className="training-session loading">Cargando sesión...</div>;
  }

  // Show summary
  if (showSummary && isSessionComplete) {
    return (
      <SessionSummary
        accuracy={sessionAccuracy}
        trialsCompleted={trials.length}
        onContinue={() => completeCurrentSession()}
      />
    );
  }

  // Main trial rendering
  return (
    <div className="training-session">
      {/* Header */}
      <div className="session-header">
        <div className="level-indicator">Nivel {user.current_level} de 10</div>
        <div className="trial-indicator">
          {currentTrialNumber} / {PROTOCOL_CONFIG.trialsPerSession}
        </div>
      </div>

      {/* Main display */}
      <div className="trial-display">
        {trialState === 'playing' && currentTrialData && (
          <TrialPlayback />
        )}

        {trialState === 'waiting_response' && (
          <div className="response-prompt">
            <p>¿Qué nota escuchaste?</p>
            {selectedNote && <div className="selected-note">{selectedNote}</div>}
          </div>
        )}

        {trialState === 'feedback' && feedback && currentTrialData && (
          <TrialFeedback feedback={feedback} correctNote={currentTrialData.note} />
        )}
      </div>

      {/* Note selection buttons (only for current level notes) */}
      {trialState === 'waiting_response' && (
        <NoteSelector
          availableNotes={levelNotes}
          onSelect={handleNoteClick}
          disabled={selectedNote !== null}
          selectedNote={selectedNote}
        />
      )}

      {/* Protocol instruction banner */}
      <div className="protocol-instruction">
        <p>No cantar, tararear ni usar instrumentos. Escucha únicamente la nota aislada.</p>
      </div>
    </div>
  );
};

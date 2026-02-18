/**
 * Retention Test Component
 * Used for Week 2, Week 4, and Final assessments
 * 
 * Key differences from training:
 * - NO feedback given during test
 * - All 12 chromatic notes tested
 * - Different timbre in final test (generalization)
 * - Randomization with minimum octave gaps
 * - Strict scoring: pass only with 90%+ accuracy AND RT threshold
 */

import React, { useState, useEffect, useRef } from 'react';
import { useProtocol } from '../state/protocol-context';
import { getAudioEngine } from '../audio/engine';
import { createTestRandomizer } from '../utils/randomization';
import { CHROMATIC_NOTES, PROTOCOL_CONFIG } from '../protocol/config';
import { createTrial } from '../services/storage';
import '../styles/RetentionTest.css';

interface RetentionTestState {
  status: 'playing' | 'waiting_response' | 'complete';
  trialNumber: number;
  totalTrials: number;
  showResults: boolean;
  testMetrics: {
    accuracy: number;
    rtAvg: number;
    passed: boolean;
  } | null;
}

interface RetentionTestProps {
  week: number; // 2, 4, or 'final' (represented as 8)
  onTestComplete: () => void;
}

export const RetentionTest: React.FC<RetentionTestProps> = ({ week, onTestComplete }) => {
  const { user, currentSession, submitTestResponse, addTrialToSession } = useProtocol();

  const [testState, setTestState] = useState<RetentionTestState>({
    status: 'playing',
    trialNumber: 1,
    totalTrials: 12, // Always all 12 notes
    showResults: false,
    testMetrics: null,
  });

  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);

  const audioEngineRef = useRef(getAudioEngine());
  const randomizerRef = useRef(createTestRandomizer());
  const currentTrialRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play next trial
  useEffect(() => {
    if (!currentSession || !user) return;

    if (testState.trialNumber <= testState.totalTrials) {
      const playTrial = async () => {
        // Generate trial
        const trialParams = randomizerRef.current.generateTrial();

        const trial = createTrial(
          testState.trialNumber,
          trialParams.note,
          trialParams.octave,
          trialParams.timbre,
          trialParams.seed
        );

        currentTrialRef.current = trial;
        addTrialToSession(trial);

        setTestState((prev) => ({
          ...prev,
          status: 'playing',
        }));

        // Play audio
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

        // Wait for response
        setResponseStartTime(Date.now());
        setSelectedNote(null);
        setTestState((prev) => ({
          ...prev,
          status: 'waiting_response',
        }));

        // Auto-timeout
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          handleSubmitResponse();
        }, PROTOCOL_CONFIG.trialTimeout);
      };

      playTrial();
    } else {
      // Test complete
      computeAndShowResults();
    }
  }, [testState.trialNumber, currentSession, user, addTrialToSession]);

  // Handle note selection
  const handleNoteClick = (note: string) => {
    if (testState.status !== 'waiting_response' || !responseStartTime) return;

    setSelectedNote(note);
    handleSubmitResponse(note);
  };

  // Submit response (NO feedback shown)
  const handleSubmitResponse = (selectedNoteOverride?: string) => {
    if (!currentTrialRef.current || !responseStartTime) return;

    const reactionTime = Date.now() - responseStartTime;
    const userNote = selectedNoteOverride || selectedNote || 'NONE';

    submitTestResponse(currentTrialRef.current.id, userNote, reactionTime);

    if (timerRef.current) clearTimeout(timerRef.current);

    // No feedback shown; progress to next trial
    setTestState((prev) => ({
      ...prev,
      trialNumber: prev.trialNumber + 1,
    }));
  };

  // Compute test results
  const computeAndShowResults = () => {
    if (!currentSession) return;

    const trials = currentSession.trials;
    const correctCount = trials.filter((t) => t.correct === true).length;
    const accuracy = (correctCount / trials.length) * 100;

    const respondedTrials = trials.filter((t) => t.reaction_time_ms !== null);
    const rtAvg =
      respondedTrials.length > 0
        ? respondedTrials.reduce((sum, t) => sum + (t.reaction_time_ms || 0), 0) /
          respondedTrials.length
        : 0;

    const rtThreshold = PROTOCOL_CONFIG.rtThresholds[9]; // Use final level threshold
    const passed = accuracy >= 90 && rtAvg <= rtThreshold;

    setTestState((prev) => ({
      ...prev,
      showResults: true,
      testMetrics: {
        accuracy,
        rtAvg,
        passed,
      },
    }));
  };

  if (!user || !currentSession) {
    return <div className="retention-test loading">Cargando test...</div>;
  }

  const weekLabel = week === 8 ? 'Final' : `Semana ${week}`;

  return (
    <div className="retention-test">
      {/* Header */}
      <div className="test-header">
        <div className="test-title">Test de Retención - {weekLabel}</div>
        <div className="trial-progress">
          {testState.trialNumber} / {testState.totalTrials}
        </div>
      </div>

      {/* Main display */}
      <div className="test-display">
        {testState.status === 'playing' && (
          <div className="playing-indicator">
            <div className="spinner"></div>
            <p>Escuchando...</p>
          </div>
        )}

        {testState.status === 'waiting_response' && (
          <div className="response-prompt">
            <p>¿Qué nota escuchaste?</p>
            {selectedNote && <div className="selected-note">{selectedNote}</div>}
          </div>
        )}

        {testState.showResults && testState.testMetrics && (
          <div className={`test-results ${testState.testMetrics.passed ? 'passed' : 'failed'}`}>
            <h3>{testState.testMetrics.passed ? 'Test Aprobado' : 'Test No Aprobado'}</h3>
            <p>Precisión: {testState.testMetrics.accuracy.toFixed(1)}%</p>
            <p>Tiempo de reacción promedio: {testState.testMetrics.rtAvg.toFixed(0)}ms</p>
            <button className="continue-btn" onClick={onTestComplete}>
              Continuar
            </button>
          </div>
        )}
      </div>

      {/* Note selection (always visible) */}
      <div className="note-selection">
        {CHROMATIC_NOTES.map((note: string) => (
          <button
            key={note}
            className={`note-button ${selectedNote === note ? 'selected' : ''}`}
            onClick={() => handleNoteClick(note)}
            disabled={testState.status !== 'waiting_response' || testState.showResults}
          >
            {note}
          </button>
        ))}
      </div>

      {/* Instruction */}
      <div className="test-instruction">
        <p>
          Este test no incluye retroalimentación. Responde lo más rápido y preciso posible.
        </p>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import { createTrial } from '../services/storage';
import { getNotesForLevel, PROTOCOL_CONFIG } from '../protocol/config';
import { useProtocol } from '../state/protocol-context';
import { useAudioTrial } from '../hooks/useAudioTrial';
import { useSessionProgression } from '../hooks/useSessionProgression';
import { createTrainingRandomizer, RandomizationEngine } from '../utils/randomization';
import { NoteSelector } from './TrialNoteSelector';
import { TrialFeedback } from './TrialFeedback';
import { TrialPlayback } from './TrialPlayback';
import { SessionSummary } from './SessionSummary';

export const TrainingSession: React.FC = () => {
  const { user, currentSession, submitSessionResponse, addTrialToSession, completeCurrentSession } = useProtocol();
  const audioEngine = getAudioEngine();
  const { trialState, feedback, playTrial, submitResponse, isReady } = useAudioTrial(audioEngine);
  const { trials, addTrial } = useSessionProgression(PROTOCOL_CONFIG.trialsPerSession);

  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [currentTrialData, setCurrentTrialData] = useState<any>(null);

  const hasStartedRef = useRef(false);
  const randomizerRef = useRef<RandomizationEngine | null>(null);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedTrialKeyRef = useRef<string | null>(null);
  const trialsCountRef = useRef(0);
  const isFinishingSessionRef = useRef(false);

  const levelNotes = getNotesForLevel(user?.current_level || 1);
  const respondedTrialsCount =
    currentSession?.trials.filter((trial) => trial.user_response !== null).length ?? 0;
  const isSessionComplete = respondedTrialsCount >= PROTOCOL_CONFIG.trialsPerSession;
  const sessionScore =
    currentSession && currentSession.trials.length > 0
      ? (currentSession.trials.filter((trial) => trial.correct === true).length / currentSession.trials.length) * 100
      : 0;
  const displayedTrialNumber = currentTrialData?.trialObject?.trial_number ?? Math.min(trials.length + 1, PROTOCOL_CONFIG.trialsPerSession);
  const progressPercent = Math.min(100, Math.round((trials.length / PROTOCOL_CONFIG.trialsPerSession) * 100));

  useEffect(() => {
    if (!user || !currentSession) return;

    randomizerRef.current = createTrainingRandomizer(user.current_level, getNotesForLevel(user.current_level));
    hasStartedRef.current = false;
    playedTrialKeyRef.current = null;
    isFinishingSessionRef.current = false;

    return () => {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, [user?.id, currentSession?.id]);

  useEffect(() => {
    if (!isReady || !randomizerRef.current || isSessionComplete || isFinishingSessionRef.current) return;

    if (!hasStartedRef.current && trialState === 'idle') {
      hasStartedRef.current = true;
      playNextTrial();
      return;
    }

    if (hasStartedRef.current && trialState === 'idle') {
      setSelectedNote(null);
      playNextTrial();
    }
  }, [isReady, trialState, isSessionComplete]);

  useEffect(() => {
    // If trial timed out (no selection) ensure it is recorded in session state.
    if (!currentTrialData?.trialObject) return;
    if (trialState !== 'feedback' || selectedNote !== null) return;

    const trialId = currentTrialData.trialObject.id;
    const alreadySubmitted = currentSession?.trials.find((trial) => trial.id === trialId)?.user_response !== null;
    if (alreadySubmitted) return;

    submitSessionResponse(trialId, 'NONE', PROTOCOL_CONFIG.trialTimeout);
  }, [trialState, selectedNote, currentTrialData, currentSession, submitSessionResponse]);

  useEffect(() => {
    if (!isSessionComplete) return;
    if (trialState !== 'idle') return;
    audioEngine.stopAll();
    setShowSummary(true);

    if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    summaryTimeoutRef.current = setTimeout(() => {
      completeCurrentSession();
    }, 4000);

    return () => {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, [isSessionComplete, trialState, completeCurrentSession, audioEngine]);

  useEffect(() => {
    trialsCountRef.current = trials.length;
  }, [trials.length]);

  const playNextTrial = async () => {
    if (!randomizerRef.current || showSummary || isSessionComplete || isFinishingSessionRef.current) return;
    const nextTrialNumber = trialsCountRef.current + 1;
    if (nextTrialNumber > PROTOCOL_CONFIG.trialsPerSession) return;

    const trialKey = `${currentSession?.id}-${nextTrialNumber}`;
    if (playedTrialKeyRef.current === trialKey) return;
    playedTrialKeyRef.current = trialKey;

    const trialParams = randomizerRef.current.generateTrial();
    const trial = createTrial(nextTrialNumber, trialParams.note, trialParams.octave, trialParams.timbre, trialParams.seed);

    setCurrentTrialData({
      note: trial.note,
      octave: trial.octave,
      timbre: trial.timbre,
      trialObject: trial,
    });

    addTrial(trial);
    addTrialToSession(trial);

    await playTrial({
      note: trial.note,
      octave: trial.octave,
      timbre: trial.timbre,
    });
  };

  const handleNoteClick = (note: string) => {
    if (trialState !== 'waiting_response' || selectedNote) return;
    setSelectedNote(note);

    const { reactionTime } = submitResponse(note);
    if (currentTrialData?.trialObject) {
      if (currentTrialData.trialObject.trial_number >= PROTOCOL_CONFIG.trialsPerSession) {
        isFinishingSessionRef.current = true;
      }
      submitSessionResponse(currentTrialData.trialObject.id, note, reactionTime);
    }
  };

  if (!user || !currentSession) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando sesión...</p>
      </div>
    );
  }

  if (showSummary && isSessionComplete) {
    return <SessionSummary accuracy={sessionScore} trialsCompleted={trials.length} onContinue={() => completeCurrentSession()} />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Sesión activa</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">Nivel {user.current_level}</p>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {displayedTrialNumber} / {PROTOCOL_CONFIG.trialsPerSession}
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-cyan-500 transition-all dark:bg-cyan-400" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex min-h-[16rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/70 px-4 dark:border-slate-800 dark:bg-slate-900/60">
        {trialState === 'playing' && currentTrialData && <TrialPlayback />}

        {trialState === 'waiting_response' && (
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">¿Qué nota escuchaste?</p>
            {selectedNote && (
              <p className="mt-3 font-mono text-5xl font-semibold text-cyan-600 dark:text-cyan-300">{selectedNote}</p>
            )}
          </div>
        )}

        {trialState === 'feedback' && feedback && currentTrialData && <TrialFeedback feedback={feedback} correctNote={currentTrialData.note} />}
      </div>

      {trialState === 'waiting_response' && (
        <NoteSelector availableNotes={levelNotes} onSelect={handleNoteClick} disabled={selectedNote !== null} selectedNote={selectedNote} />
      )}

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Sin cantar ni tararear. Solo escucha y responde.
      </div>
    </div>
  );
};

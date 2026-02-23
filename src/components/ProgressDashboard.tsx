import React from 'react';
import { useProtocol } from '../state/protocol-context';
import { getNotesForLevelWithAnchor, PROTOCOL_CONFIG } from '../protocol/config';
import { getAppMode } from '../utils/app-mode';

export const ProgressDashboard: React.FC = () => {
  const { user, consecutiveSuccessfulSessions, protocolState } = useProtocol();
  const isParticipantMode = getAppMode() === 'participant';

  if (!user) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Cargando progreso...</div>;
  }

  const currentLevelNotes = getNotesForLevelWithAnchor(
    user.current_level,
    user.anchor_note,
    user.protocol_variant
  );
  const rtThreshold = PROTOCOL_CONFIG.rtThresholds[user.current_level - 1] || 0;
  const minAccuracy = PROTOCOL_CONFIG.minAccuracy;
  const sessionsRequired = PROTOCOL_CONFIG.sessionsRequiredForAdvance;

  const lastSession = user.sessions.at(-1) ?? null;
  const lastSessionScore = lastSession?.accuracy ?? 0;
  const lastSessionRT = lastSession?.rt_avg ?? 0;
  const overallScore =
    user.sessions.length > 0
      ? user.sessions.reduce((sum, session) => sum + session.accuracy, 0) / user.sessions.length
      : 0;

  const totalSessionsAtLevel = user.sessions.filter((session) => session.level === user.current_level).length;

  const meetsScore = lastSessionScore >= minAccuracy;
  const meetsRT = lastSessionRT <= rtThreshold;
  const meetsConsistency = consecutiveSuccessfulSessions >= sessionsRequired;
  const readyToAdvance = meetsScore && meetsRT && meetsConsistency;

  const progress = Math.min(100, Math.round((consecutiveSuccessfulSessions / sessionsRequired) * 100));

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Tu progreso</p>
        <div className="mt-2 flex items-end justify-between">
          {isParticipantMode ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Entrenamiento activo</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">sin pistas</p>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{user.current_level}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">de 10</p>
            </>
          )}
        </div>
        {!isParticipantMode && (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Notas activas: {currentLevelNotes.join(' · ')}</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Última sesión</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{lastSessionScore.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Aciertos</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Promedio general</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{overallScore.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Aciertos</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Constancia para avanzar</span>
            <span>{consecutiveSuccessfulSessions}/{sessionsRequired}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-cyan-500 transition-all dark:bg-cyan-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Checklist de nivel</p>
        <p className={`text-sm ${meetsScore ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {meetsScore ? 'OK' : 'Pendiente'} Aciertos mínimos: {minAccuracy}% ({lastSessionScore.toFixed(1)}%)
        </p>
        <p className={`text-sm ${meetsRT ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {meetsRT ? 'OK' : 'Pendiente'} Tiempo medio: ≤ {rtThreshold}ms ({lastSessionRT.toFixed(0)}ms)
        </p>
        <p className={`text-sm ${meetsConsistency ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {meetsConsistency ? 'OK' : 'Pendiente'} Sesiones consecutivas: {consecutiveSuccessfulSessions}/{sessionsRequired}
        </p>
      </section>

      <section className={`rounded-xl p-4 ${readyToAdvance ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
        <p className="text-sm font-semibold">{readyToAdvance ? 'Listo para avanzar de nivel' : 'Aún no cumples todos los requisitos'}</p>
        <p className="mt-1 text-xs opacity-80">
          Estado actual: {protocolState === 'idle' ? 'Listo para una nueva sesión' : protocolState}
        </p>
        <p className="mt-1 text-xs opacity-80">Sesiones completadas en este nivel: {totalSessionsAtLevel}</p>
      </section>
    </div>
  );
};

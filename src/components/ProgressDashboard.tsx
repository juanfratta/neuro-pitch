/**
 * Progress Dashboard - User Mode
 * Simple, minimal display of training progress
 * 
 * Shows:
 * - Current level (1-10)
 * - Sessions completed at current level
 * - Overall accuracy
 * - Next milestone (next level or test)
 * 
 * No gamification, no badges, no rankings
 */

import React from 'react';
import { useProtocol } from '../state/protocol-context';
import { PROTOCOL_CONFIG } from '../protocol/config';
import '../styles/ProgressDashboard.css';

export const ProgressDashboard: React.FC = () => {
  const { user, consecutiveSuccessfulSessions, protocolState } = useProtocol();

  if (!user) {
    return <div className="progress-dashboard loading">Cargando datos...</div>;
  }

  const currentLevelNotes = PROTOCOL_CONFIG.levelNoteSet[user.current_level - 1] || [];
  const rtThreshold = PROTOCOL_CONFIG.rtThresholds[user.current_level - 1] || 0;
  const minAccuracy = PROTOCOL_CONFIG.minAccuracy;

  // Get last session metrics
  const lastSession = user.sessions.length > 0 ? user.sessions[user.sessions.length - 1] : null;
  const lastSessionAccuracy = lastSession?.accuracy ?? 0;
  const lastSessionRT = lastSession?.rt_avg ?? 0;

  // Calculate overall stats
  const totalTrials = user.training_history.total_trials;
  const sessionCount = user.training_history.session_count;
  const overallAccuracy =
    user.sessions.length > 0
      ? user.sessions.reduce((sum, s) => sum + s.accuracy, 0) / user.sessions.length
      : 0;

  // Total sessions in current level (informational)
  const totalSessionsAtLevel = user.sessions.filter((s) => s.level === user.current_level).length;

  // Progress to next level
  const sessionsRequiredForAdvance = PROTOCOL_CONFIG.sessionsRequiredForAdvance;
  const progressToAdvance = Math.min(1.0, consecutiveSuccessfulSessions / sessionsRequiredForAdvance);

  // Determine what's required
  const meetsAccuracy = lastSessionAccuracy >= minAccuracy;
  const meetsRT = lastSessionRT <= rtThreshold;
  const hasEnoughSessions = consecutiveSuccessfulSessions >= sessionsRequiredForAdvance;

  return (
    <div className="progress-dashboard">
      {/* Level Section */}
      <section className="level-section">
        <h2>Nivel Actual</h2>
        <div className="level-display">
          <div className="level-number">{user.current_level}</div>
          <div className="level-of-total">de 10</div>
        </div>

        <div className="level-notes">
          <strong>Notas en este nivel:</strong> {currentLevelNotes.join(', ')}
        </div>

        <div className="level-criteria">
          <div className="criterion">
            <label>Precisión última sesión:</label>
            <div className={`value ${meetsAccuracy ? 'met' : 'not-met'}`}>
              {lastSessionAccuracy.toFixed(1)}% {meetsAccuracy && '✓'}
            </div>
          </div>
          <div className="criterion">
            <label>RT máximo:</label>
            <div className={`value ${meetsRT ? 'met' : 'not-met'}`}>
              {lastSessionRT.toFixed(0)}ms {meetsRT && '✓'}
            </div>
          </div>
          <div className="criterion">
            <label>Sesiones en este nivel:</label>
            <div className="value">
              {totalSessionsAtLevel}
            </div>
          </div>
        </div>
      </section>

      {/* Progression bar */}
      <section className="progress-bar-section">
        <label>Progreso a siguiente nivel</label>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressToAdvance * 100}%` }}></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <h3>Estadísticas</h3>
        <div className="stats-grid">
          <div className="stat-card highlighted">
            <div className="stat-label">Precisión general</div>
            <div className="stat-value">{overallAccuracy.toFixed(1)}%</div>
            <div className="stat-detail">promedio todas las sesiones</div>
          </div>
          <div className="stat-card highlighted">
            <div className="stat-label">Última sesión</div>
            <div className="stat-value">{lastSessionAccuracy.toFixed(1)}%</div>
            <div className="stat-detail">mejor indicador de progreso</div>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Sesiones completadas</div>
            <div className="stat-value">{sessionCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Trials totales</div>
            <div className="stat-value">{totalTrials}</div>
          </div>
        </div>
      </section>

      {/* Protocol State */}
      <section className="state-section">
        <div className="state-info">
          <strong>Estado:</strong> {protocolState === 'idle' ? 'Listo' : protocolState}
        </div>
      </section>

      {/* Level Advancement Status */}
      <section className="advancement-section">
        <h3>Requisitos para avanzar</h3>
        
        <div className="requirement-item">
          <label>Precisión mínima:</label>
          <div className={`requirement-status ${meetsAccuracy ? 'met' : 'unmet'}`}>
            {meetsAccuracy ? '✓' : '✗'} {minAccuracy}% (actual: {lastSessionAccuracy.toFixed(1)}%)
          </div>
        </div>

        <div className="requirement-item">
          <label>Tiempo de respuesta:</label>
          <div className={`requirement-status ${meetsRT ? 'met' : 'unmet'}`}>
            {meetsRT ? '✓' : '✗'} ≤ {rtThreshold}ms (actual: {lastSessionRT.toFixed(0)}ms)
          </div>
        </div>

        <div className="requirement-item">
          <label>Sesiones exitosas consecutivas:</label>
          <div className={`requirement-status ${hasEnoughSessions ? 'met' : 'unmet'}`}>
            {consecutiveSuccessfulSessions} / {sessionsRequiredForAdvance} (necesitas ≥90% accuracy)
          </div>
        </div>

        {/* Advancement Button */}
        <div className={`advancement-button ${hasEnoughSessions && meetsAccuracy && meetsRT ? 'enabled' : 'disabled'}`}>
          {hasEnoughSessions && meetsAccuracy && meetsRT ? (
            <p>✓ Completaste los 3 requisitos. ¡Estás listo para avanzar!</p>
          ) : (
            <p>Completa los 3 requisitos para desbloquear el siguiente nivel</p>
          )}
        </div>
      </section>
    </div>
  );
};

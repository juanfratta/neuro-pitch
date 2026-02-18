/**
 * Protocol Gate Component
 * Orchestrates the entire protocol flow
 * 
 * Manages:
 * - Session start/end
 * - Test scheduling
 * - Mode selection (user vs research)
 * - Navigation between states
 */

import React, { useEffect } from 'react';
import { useProtocol } from '../state/protocol-context';
import { TrainingSession } from './TrainingSession';
import { RetentionTest } from './RetentionTest';
import { ProgressDashboard } from './ProgressDashboard';
import { ResearchDashboard } from './ResearchDashboard';
import '../styles/ProtocolGate.css';

export const ProtocolGate: React.FC = () => {
  const {
    user,
    isLoading,
    protocolState,
    startSession,
    startRetentionTest,
    completeCurrentTest,
    setResearchMode,
    isResearchMode,
  } = useProtocol();

  useEffect(() => {
    // Auto-detect research mode if available
    if (!user) return;
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="protocol-gate loading">
        <div className="spinner"></div>
        <p>Inicializando aplicación...</p>
      </div>
    );
  }

  // Render based on protocol state
  const renderContent = () => {
    switch (protocolState) {
      case 'idle':
        return (
          <div className="gate-idle">
            <h2>Centro de Control</h2>
            <p>¿Qué deseas hacer?</p>

            <div className="action-buttons">
              <button className="primary-btn" onClick={startSession}>
                Iniciar Sesión de Entrenamiento
              </button>

              {user.sessions.length >= 30 && (
                <>
                  <button className="secondary-btn" onClick={() => startRetentionTest(2)}>
                    Test de Retención - Semana 2
                  </button>
                  <button className="secondary-btn" onClick={() => startRetentionTest(4)}>
                    Test de Retención - Semana 4
                  </button>
                </>
              )}

              {user.current_level === 10 && user.sessions.length >= 100 && (
                <button className="final-btn" onClick={() => startRetentionTest(8 as any)}>
                  Test Final Completo
                </button>
              )}
            </div>

            <div className="mode-selector">
              <label>
                <input
                  type="checkbox"
                  checked={isResearchMode}
                  onChange={(e) => setResearchMode(e.target.checked)}
                />
                Modo Investigación
              </label>
            </div>
          </div>
        );

      case 'training_session_active':
        return (
          <div className="gate-training">
            <TrainingSession />
          </div>
        );

      case 'week2_retention_test':
        return (
          <RetentionTest
            week={2}
            onTestComplete={completeCurrentTest}
          />
        );

      case 'week4_retention_test':
        return (
          <RetentionTest
            week={4}
            onTestComplete={completeCurrentTest}
          />
        );

      case 'final_test':
        return (
          <RetentionTest
            week={8}
            onTestComplete={completeCurrentTest}
          />
        );

      case 'completed':
        return (
          <div className="gate-completed">
            <h2>¡Protocolo Completado!</h2>
            <p>Has completado exitosamente el protocolo de entrenamiento Wong 2025.</p>
            <button onClick={() => window.location.reload()}>
              Reiniciar Aplicación
            </button>
          </div>
        );

      default:
        return (
          <div className="gate-unknown">
            <p>Estado desconocido: {protocolState}</p>
          </div>
        );
    }
  };

  return (
    <div className="protocol-gate">
      <div className="gate-container">
        {/* Main content area */}
        <div className="gate-content">
          {renderContent()}
        </div>

        {/* Sidebar: Dashboard (always visible unless in session) */}
        {!['training_session_active', 'week2_retention_test', 'week4_retention_test', 'final_test'].includes(
          protocolState
        ) && (
          <div className="gate-dashboard-sidebar">
            {isResearchMode ? <ResearchDashboard /> : <ProgressDashboard />}
          </div>
        )}
      </div>

      {/* Footer with metadata */}
      <footer className="gate-footer">
        <div className="footer-info">
          <span>Protocolo Wong 2025 v1</span>
          <span>Nivel: {user.current_level}/10</span>
          <span>Sesiones: {user.sessions.length}</span>
          <span>Estado: {protocolState}</span>
        </div>
      </footer>
    </div>
  );
};

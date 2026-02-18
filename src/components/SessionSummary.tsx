/**
 * Session Summary Component
 * Displays accuracy of the completed session
 * Shows before returning to level page
 */

import React, { useEffect } from 'react';
import '../styles/SessionSummary.css';

interface SessionSummaryProps {
  accuracy: number;
  trialsCompleted: number;
  onContinue: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  accuracy,
  trialsCompleted,
  onContinue,
}) => {
  // Auto-continue after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onContinue, 4000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  // Determine feedback based on accuracy
  let feedbackMessage = '';
  let feedbackClass = '';

  if (accuracy >= 90) {
    feedbackMessage = '¡Excelente! Cumpliste los requisitos de este nivel.';
    feedbackClass = 'excellent';
  } else if (accuracy >= 75) {
    feedbackMessage = 'Buen trabajo. Sigue practicando para mejorar.';
    feedbackClass = 'good';
  } else if (accuracy >= 60) {
    feedbackMessage = 'Continúa practicando para mejorar tu precisión.';
    feedbackClass = 'fair';
  } else {
    feedbackMessage = 'Necesitas más práctica. ¡No te desanimes!';
    feedbackClass = 'needs-work';
  }

  return (
    <div className={`session-summary ${feedbackClass}`}>
      <div className="summary-content">
        <h2>Sesión Completada</h2>

        <div className="accuracy-display">
          <div className="accuracy-label">Precisión</div>
          <div className="accuracy-value">{accuracy.toFixed(1)}%</div>
        </div>

        <div className="trials-info">
          <p>{trialsCompleted} intentos completados</p>
        </div>

        <div className="feedback-message">{feedbackMessage}</div>

        <div className="continue-prompt">
          <p>Volviendo a pantalla del nivel...</p>
        </div>
      </div>
    </div>
  );
};

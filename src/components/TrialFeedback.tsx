/**
 * Component: TrialFeedback
 * 
 * Displays feedback after user response
 * Shows:
 * - "Correct" (green) if user response matches note + reaction time < threshold
 * - "Slow" (orange) if correct but reaction time > threshold
 * - "Incorrect" (red) if user response doesn't match
 * 
 * Memoized for performance
 * Displays correctly reported note in feedback message
 */

import React from 'react';

interface TrialFeedbackProps {
  feedback: 'correct' | 'incorrect' | 'slow';
  correctNote: string;
}

export const TrialFeedback = React.memo<TrialFeedbackProps>(({ feedback, correctNote }) => {
  const feedbackLabels = {
    correct: '✓ Correcto',
    incorrect: `✗ Incorrecto, era ${correctNote}`,
    slow: '⏱️ Lento',
  };

  const feedbackColors = {
    correct: '#2ecc71', // Green
    incorrect: '#e74c3c', // Red
    slow: '#f39c12', // Orange
  };

  return (
    <div
      className="feedback-display"
      style={{ borderColor: feedbackColors[feedback] }}
    >
      <p>{feedbackLabels[feedback]}</p>
    </div>
  );
});

TrialFeedback.displayName = 'TrialFeedback';

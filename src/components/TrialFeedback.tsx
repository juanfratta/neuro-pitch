import React from 'react';

interface TrialFeedbackProps {
  feedback: 'correct' | 'incorrect' | 'slow';
  correctNote: string;
}

const feedbackUI = {
  correct: {
    title: 'Bien',
    detail: 'Respuesta correcta',
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  incorrect: {
    title: 'Casi',
    detail: 'La nota era',
    tone: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
  },
  slow: {
    title: 'Lento',
    detail: 'Tiempo agotado. La nota era',
    tone: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
  },
};

export const TrialFeedback = React.memo<TrialFeedbackProps>(({ feedback, correctNote }) => {
  const ui = feedbackUI[feedback];

  return (
    <div className={`rounded-xl border px-5 py-4 text-center ${ui.tone}`}>
      <p className="text-xl font-semibold">{ui.title}</p>
      <p className="mt-1 text-sm">
        {feedback === 'correct' ? ui.detail : `${ui.detail} ${correctNote}`}
      </p>
    </div>
  );
});

TrialFeedback.displayName = 'TrialFeedback';

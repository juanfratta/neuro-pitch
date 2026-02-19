import React, { useEffect } from 'react';

interface SessionSummaryProps {
  accuracy: number;
  trialsCompleted: number;
  onContinue: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({ accuracy, trialsCompleted, onContinue }) => {
  useEffect(() => {
    const timer = setTimeout(onContinue, 4000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  const tone =
    accuracy >= 90
      ? 'excelente'
      : accuracy >= 75
        ? 'bien'
        : accuracy >= 60
          ? 'en progreso'
          : 'a practicar';

  const message =
    accuracy >= 90
      ? 'Muy buena sesión. Mantén este ritmo.'
      : accuracy >= 75
        ? 'Vas bien. Una sesión más sólida y subes.'
        : accuracy >= 60
          ? 'Progreso estable. Enfócate en responder más rápido.'
          : 'Tómalo con calma. Repetir sesiones ayuda mucho.';

  return (
    <div className="flex min-h-[28rem] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Sesión terminada</p>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/70">
          <p className="text-xs text-slate-500 dark:text-slate-400">Resultado de hoy</p>
          <p className="mt-2 text-5xl font-semibold text-slate-900 dark:text-white">{accuracy.toFixed(1)}%</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Aciertos en {trialsCompleted} intentos</p>
        </div>
        <p className="mt-5 text-sm font-medium text-slate-700 dark:text-slate-200">{message}</p>
        <p className="mt-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{tone}</p>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">Volviendo al panel...</p>
      </div>
    </div>
  );
};

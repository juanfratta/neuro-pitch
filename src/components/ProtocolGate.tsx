import React, { useEffect, useState } from 'react';
import { useProtocol } from '../state/protocol-context';
import { TrainingSession } from './TrainingSession';
import { RetentionTest } from './RetentionTest';
import { ProgressDashboard } from './ProgressDashboard';
import { ResearchDashboard } from './ResearchDashboard';

type ThemeMode = 'light' | 'dark';

const getInitialTheme = (): ThemeMode => {
  const stored = localStorage.getItem('neuro_pitch_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

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
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('neuro_pitch_theme', theme);
  }, [theme]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Preparando tu entrenamiento...</p>
        </div>
      </div>
    );
  }

  const completedSessions = user.training_history.session_count;
  const canTakeWeek2 = completedSessions >= 15;
  const canTakeWeek4 = completedSessions >= 30;
  const canTakeFinal = completedSessions >= 45;

  const isActiveSession = ['training_session_active', 'week2_retention_test', 'week4_retention_test', 'final_test'].includes(protocolState);

  const renderContent = () => {
    switch (protocolState) {
      case 'idle':
        return (
          <div className="mx-auto flex min-h-[68vh] w-full max-w-2xl flex-col">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Entrena tu oído</h1>
                <p className="mx-auto max-w-xl text-sm text-slate-600 dark:text-slate-300">
                  Sesiones breves, notas aisladas y progreso real. En cada nivel escucharás solo las notas habilitadas.
                </p>
              </div>

              <div className="mt-7 grid w-full gap-3 sm:grid-cols-2">
                <button
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                  onClick={startSession}
                >
                  Empezar sesión
                </button>

                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => startRetentionTest(2)}
                  disabled={!canTakeWeek2}
                >
                  Prueba semana 2 {canTakeWeek2 ? '' : `(faltan ${15 - completedSessions})`}
                </button>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => startRetentionTest(4)}
                  disabled={!canTakeWeek4}
                >
                  Prueba semana 4 {canTakeWeek4 ? '' : `(faltan ${30 - completedSessions})`}
                </button>
                <button
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  onClick={() => startRetentionTest(8)}
                  disabled={!canTakeFinal}
                >
                  Prueba final {canTakeFinal ? '(repetible)' : `(faltan ${45 - completedSessions})`}
                </button>
              </div>
            </div>

            <div className="mt-auto flex w-full items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300">
                Protocolo Wong 2025
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                  checked={isResearchMode}
                  onChange={(e) => setResearchMode(e.target.checked)}
                />
                Modo investigación
              </label>
            </div>
          </div>
        );

      case 'training_session_active':
        return <TrainingSession />;

      case 'week2_retention_test':
        return <RetentionTest week={2} onTestComplete={completeCurrentTest} />;

      case 'week4_retention_test':
        return <RetentionTest week={4} onTestComplete={completeCurrentTest} />;

      case 'final_test':
        return <RetentionTest week={8} onTestComplete={completeCurrentTest} />;

      case 'completed':
        return (
          <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white/90 p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900/90">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Protocolo completado</h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Terminaste todo el recorrido. Si quieres volver a empezar, puedes reiniciar desde cero.
            </p>
            <button
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              onClick={() => window.location.reload()}
            >
              Reiniciar
            </button>
          </div>
        );

      default:
        return <p className="text-sm text-slate-500 dark:text-slate-400">Estado actual: {protocolState}</p>;
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.18),_transparent_38%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.28),_transparent_40%)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Absolute Pitch Trainer</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Nivel {user.current_level}/10</p>
          </div>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 md:p-6">
          {renderContent()}
        </section>

        {!isActiveSession && (
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
            {isResearchMode ? <ResearchDashboard /> : <ProgressDashboard />}
          </aside>
        )}
      </main>
    </div>
  );
};

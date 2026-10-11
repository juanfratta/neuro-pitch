import { useEffect, useState } from 'react';
import { UserDataProvider } from './state/UserDataContext';
import { Home } from './screens/Home';
import { TrainingFlow } from './screens/TrainingFlow';
import { TestFlow } from './screens/TestFlow';
import { readDevMode } from './utils/app-mode';
import { Card } from './components/ui';

type Screen = { name: 'home' } | { name: 'training' } | { name: 'test'; kind: 'pre' | 'post' };
type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem('neuro_pitch_theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // sin storage
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function Shell() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [devMode] = useState(readDevMode);
  const home = () => setScreen({ name: 'home' });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('neuro_pitch_theme', theme);
    } catch {
      // sin storage
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.18),_transparent_38%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.28),_transparent_40%)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Neuro Pitch</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Protocolo Wong et al. 2025</p>
          </div>
          {devMode && (
            <a
              href={window.location.pathname}
              title="Salir del modo desarrollo"
              className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
            >
              Modo desarrollo · salir
            </a>
          )}
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        {screen.name === 'home' && (
          <Home devMode={devMode} onTrain={() => setScreen({ name: 'training' })} onTest={(kind) => setScreen({ name: 'test', kind })} />
        )}
        {screen.name === 'training' && (
          <Card className="mx-auto max-w-3xl">
            <TrainingFlow onExit={home} devMode={devMode} />
          </Card>
        )}
        {screen.name === 'test' && (
          <Card className="mx-auto max-w-3xl">
            <TestFlow kind={screen.kind} onExit={home} devMode={devMode} />
          </Card>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <UserDataProvider>
      <Shell />
    </UserDataProvider>
  );
}

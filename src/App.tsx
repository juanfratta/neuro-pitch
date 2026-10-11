import { useEffect, useState } from 'react';
import { UserDataProvider } from './state/UserDataContext';
import { Home } from './screens/Home';
import { TrainingFlow } from './screens/TrainingFlow';
import { TestFlow } from './screens/TestFlow';
import { readDevMode } from './utils/app-mode';
import { Card } from './components/ui';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, currentLanguage, setLanguage } from './i18n';

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
  const { t, i18n } = useTranslation();
  const lang = currentLanguage(i18n.language);
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
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Neuro Pitch</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {devMode && (
              <a
                href={window.location.pathname}
                title={t('common.devExit')}
                className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
              >
                {t('common.devBadge')}
              </a>
            )}
            <div
              role="group"
              aria-label={t('common.language')}
              className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700"
            >
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  lang={code}
                  aria-pressed={lang === code}
                  onClick={() => setLanguage(code)}
                  className={`px-2.5 py-1.5 text-xs font-semibold uppercase transition ${
                    lang === code
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? t('common.themeDark') : t('common.themeLight')}
            </button>
          </div>
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

      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 pt-2">
        <a
          href="https://doi.org/10.3758/s13423-024-02620-2"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-slate-400 underline-offset-2 hover:underline dark:text-slate-500"
        >
          {t('common.basedOn')}
        </a>
      </footer>
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

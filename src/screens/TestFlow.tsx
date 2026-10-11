import { useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import { useTrialRunner } from '../hooks/useTrialRunner';
import { TEST_TIMBRES, generateTestSequence } from '../protocol/assessment';
import { CHROMAS } from '../protocol/notes';
import { TEST_WINDOW_MS } from '../protocol/params';
import { createRng } from '../protocol/rng';
import type { TrialRecord } from '../protocol/progression';
import type { Stimulus } from '../protocol/curriculum';
import { useUserData } from '../state/UserDataContext';
import { preTest, type TestKind, type TestRecord } from '../state/userData';
import { TrialPanel } from '../components/TrialPanel';
import { TestComparison } from '../components/TestComparison';
import { Button, Eyebrow } from '../components/ui';

type Step = 'intro' | 'loading' | 'running' | 'done';

export function TestFlow({ kind, onExit, devMode }: { kind: TestKind; onExit: () => void; devMode: boolean }) {
  const { data, recordTest } = useUserData();
  const [step, setStep] = useState<Step>('intro');
  const [headphones, setHeadphones] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [stimuli] = useState<Stimulus[]>(() => generateTestSequence(createRng()));
  const [result, setResult] = useState<TestRecord | null>(null);

  const begin = async () => {
    setStep('loading');
    setLoadError(null);
    try {
      const engine = getAudioEngine();
      await engine.unlock();
      await engine.preload(TEST_TIMBRES);
      setStartedAt(new Date());
      setStep('running');
    } catch (e) {
      console.error(e);
      setLoadError('No se pudieron cargar los sonidos. Revisá la conexión y probá de nuevo.');
      setStep('intro');
    }
  };

  const finish = (records: TrialRecord[]) => {
    setResult(recordTest(kind, startedAt, records));
    setStep('done');
  };

  const title = kind === 'pre' ? 'Test inicial' : 'Test de progreso';
  const pre = preTest(data);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>{title}</Eyebrow>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">144 notas · sin feedback</p>
        </div>
        {step !== 'running' && (
          <Button variant="ghost" onClick={onExit}>
            Salir
          </Button>
        )}
      </div>

      {(step === 'intro' || step === 'loading') && (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <p>
            {kind === 'pre'
              ? 'Antes de entrenar medimos dónde estás. Sin este punto de partida no hay forma de saber cuánto mejoraste.'
              : 'Repetimos el mismo test del inicio para medir el progreso real.'}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Vas a escuchar 144 notas sueltas: primero un bloque de piano y después uno de guitarra.</li>
            <li>Para cada una elegí su nombre entre las 12. Tenés hasta 5 segundos; respondé lo más rápido y preciso que puedas.</li>
            <li>No hay feedback. Es normal errar mucho, sobre todo al principio.</li>
            <li>Usá auriculares, en un lugar tranquilo. Nada de instrumentos, afinadores, apps ni cantar una nota de referencia.</li>
            <li>Dura unos 10 a 15 minutos. Hay una pausa entre los dos bloques.</li>
          </ul>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} />
            Tengo auriculares puestos y no voy a usar referencias
          </label>
          {loadError && <p className="text-rose-600 dark:text-rose-400">{loadError}</p>}
          <Button onClick={() => void begin()} disabled={!headphones || step === 'loading'}>
            {step === 'loading' ? 'Cargando sonidos…' : 'Empezar test'}
          </Button>
        </div>
      )}

      {step === 'running' && <TestRunner stimuli={stimuli} devMode={devMode} onDone={finish} />}

      {step === 'done' && result && (
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">Test terminado</p>
          <TestComparison pre={kind === 'post' ? pre : undefined} current={result} />
          <Button onClick={onExit}>{kind === 'pre' ? 'Empezar a entrenar' : 'Volver al inicio'}</Button>
        </div>
      )}
    </div>
  );
}

function TestRunner({ stimuli, devMode, onDone }: { stimuli: Stimulus[]; devMode: boolean; onDone: (r: TrialRecord[]) => void }) {
  const runner = useTrialRunner({ stimuli, windowMs: TEST_WINDOW_MS, feedback: false, onDone });
  const half = stimuli.length / 2;
  const atBreak = runner.index === half && runner.phase === 'ready';
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Bloque {runner.index < half ? '1: piano' : '2: guitarra'}
      </p>
      {atBreak && (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Pausa. Terminó el bloque de piano; el que sigue es de guitarra. Seguí cuando quieras.
        </p>
      )}
      <TrialPanel runner={runner} options={[...CHROMAS]} feedback={false} windowMs={TEST_WINDOW_MS} devMode={devMode} />
    </div>
  );
}

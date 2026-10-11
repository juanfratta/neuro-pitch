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
import { useTranslation } from 'react-i18next';

type Step = 'intro' | 'loading' | 'running' | 'done';

export function TestFlow({ kind, onExit, devMode }: { kind: TestKind; onExit: () => void; devMode: boolean }) {
  const { data, recordTest } = useUserData();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('intro');
  const [headphones, setHeadphones] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [stimuli] = useState<Stimulus[]>(() => generateTestSequence(createRng()));
  const [result, setResult] = useState<TestRecord | null>(null);

  const begin = async () => {
    setStep('loading');
    setLoadError(false);
    try {
      const engine = getAudioEngine();
      await engine.unlock();
      await engine.preload(TEST_TIMBRES);
      setStartedAt(new Date());
      setStep('running');
    } catch (e) {
      console.error(e);
      setLoadError(true);
      setStep('intro');
    }
  };

  const finish = (records: TrialRecord[]) => {
    setResult(recordTest(kind, startedAt, records));
    setStep('done');
  };

  const title = kind === 'pre' ? t('test.pre') : t('test.post');
  const pre = preTest(data);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>{title}</Eyebrow>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{t('test.subtitle')}</p>
        </div>
        {step !== 'running' && (
          <Button variant="ghost" onClick={onExit}>
            {t('common.exit')}
          </Button>
        )}
      </div>

      {(step === 'intro' || step === 'loading') && (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <p>
            {kind === 'pre' ? t('test.introPre') : t('test.introPost')}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('test.bullet1')}</li>
            <li>{t('test.bullet2')}</li>
            <li>{t('test.bullet3')}</li>
            <li>{t('test.bullet4')}</li>
            <li>{t('test.bullet5')}</li>
          </ul>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} />
            {t('test.headphones')}
          </label>
          {loadError && <p className="text-rose-600 dark:text-rose-400">{t('test.loadError')}</p>}
          <Button onClick={() => void begin()} disabled={!headphones || step === 'loading'}>
            {step === 'loading' ? t('test.loading') : t('test.start')}
          </Button>
        </div>
      )}

      {step === 'running' && <TestRunner stimuli={stimuli} devMode={devMode} onDone={finish} />}

      {step === 'done' && result && (
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">{t('test.done')}</p>
          <TestComparison pre={kind === 'post' ? pre : undefined} current={result} />
          <Button variant="accent" onClick={onExit}>
            {kind === 'pre' ? t('test.startTraining') : t('common.backHome')}
          </Button>
        </div>
      )}
    </div>
  );
}

function TestRunner({ stimuli, devMode, onDone }: { stimuli: Stimulus[]; devMode: boolean; onDone: (r: TrialRecord[]) => void }) {
  const runner = useTrialRunner({ stimuli, windowMs: TEST_WINDOW_MS, feedback: false, onDone });
  const half = stimuli.length / 2;
  const atBreak = runner.index === half && runner.phase === 'ready';
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {runner.index < half ? t('test.block1') : t('test.block2')}
      </p>
      {atBreak && (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {t('test.break')}
        </p>
      )}
      <TrialPanel runner={runner} options={[...CHROMAS]} feedback={false} windowMs={TEST_WINDOW_MS} devMode={devMode} />
    </div>
  );
}

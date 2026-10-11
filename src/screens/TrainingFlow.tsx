import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import { useTrialRunner } from '../hooks/useTrialRunner';
import { answerOptions, generateSpecialStimuli, generateTrainingStimuli, type Stimulus } from '../protocol/curriculum';
import { OUT_OF_BOUND, displayNote, type Answer, type Chroma } from '../protocol/notes';
import {
  SHEPARD_DURATION_MS,
  SPECIAL_EXERCISE_EVERY_ATTEMPTS,
  SPECIAL_EXERCISE_FEEDBACK_TRIALS,
  SPECIAL_EXERCISE_NO_FEEDBACK_TRIALS,
  TRIALS_PER_ATTEMPT,
  baseWindowMs,
} from '../protocol/params';
import {
  attemptParams,
  canRetreat,
  specialExerciseDue,
  summarize,
  weakestChroma,
  type AttemptSummary,
  type Outcome,
  type TrialRecord,
} from '../protocol/progression';
import { createRng } from '../protocol/rng';
import { useUserData } from '../state/UserDataContext';
import { coldPassAvailability, formatDuration, recentLevelTrials, type AttemptKind } from '../state/userData';
import { SamplePlayer } from '../components/SamplePlayer';
import { AnswerGuide } from '../components/AnswerGuide';
import { TrialPanel } from '../components/TrialPanel';
import { Button, Eyebrow } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../i18n/format';

const PitchHelix = lazy(() => import('../components/PitchHelix'));

type Step =
  | { name: 'intro' }
  | { name: 'shepard' }
  | { name: 'running' }
  | { name: 'summary'; summary: AttemptSummary; outcome: Outcome | null; passed: boolean }
  | { name: 'special-intro'; target: Chroma }
  | { name: 'special-running'; target: Chroma; phase: 'feedback' | 'no-feedback' }
  | { name: 'special-summary'; target: Chroma; summary: AttemptSummary };

export function TrainingFlow({ onExit, devMode }: { onExit: () => void; devMode: boolean }) {
  const { data, recordAttempt, retreat } = useUserData();
  const { t } = useTranslation();
  const now = useNow(1000);
  const [sessionStart] = useState(() => Date.now());
  const [step, setStep] = useState<Step>({ name: 'intro' });
  const [heardSamples, setHeardSamples] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const [attemptStart, setAttemptStart] = useState(() => new Date());

  const progress = data.progress;
  const params = attemptParams(progress);
  const isColdPass = progress.awaitingColdPass;
  const cold = coldPassAvailability(data, new Date(now));
  const blocked = progress.completed || (isColdPass && !cold.available && !devMode);

  const stimuli = useMemo<Stimulus[]>(
    () => generateTrainingStimuli(createRng(), params.trained, TRIALS_PER_ATTEMPT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attemptKey, progress.stage]
  );

  const begin = async () => {
    const engine = getAudioEngine();
    await engine.unlock();
    void engine.preload(['piano-train']);
    setAttemptStart(new Date());
    if (heardSamples && !params.feedback) setStep({ name: 'shepard' });
    else setStep({ name: 'running' });
  };

  const finishAttempt = (records: TrialRecord[]) => {
    const summary = summarize(records);
    const result = recordAttempt({
      kind: 'level',
      startedAt: attemptStart,
      windowMs: params.windowMs,
      feedback: params.feedback,
      trials: records,
      summary,
    });
    setStep({ name: 'summary', summary, outcome: result.outcome, passed: result.passed });
  };

  const nextAttempt = () => {
    setHeardSamples(false);
    setAttemptKey((k) => k + 1);
    if (specialExerciseDue(data.progress)) {
      const target = weakestChroma(recentLevelTrials(data, SPECIAL_EXERCISE_EVERY_ATTEMPTS), params.trained);
      setStep({ name: 'special-intro', target });
      return;
    }
    setStep({ name: 'intro' });
  };

  const sessionMs = now - sessionStart;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow>{t('training.eyebrow')}</Eyebrow>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('common.notes', { count: params.trained.length })} · {t('common.levelOf', { level: progress.level, total: 24 })}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <p>{t('training.session', { time: formatDuration(sessionMs) })}</p>
          <Button variant="ghost" className="mt-1 px-2 py-1 text-xs" onClick={() => { getAudioEngine().stopAll(); onExit(); }}>
            {t('common.exit')}
          </Button>
        </div>
      </div>

      {step.name === 'intro' && (
        <div className="listening-room space-y-6 rounded-2xl p-5 sm:p-7">
          {blocked ? (
            <p className="text-sm text-[var(--np-mist)]">
              {progress.completed
                ? t('training.alreadyCompleted')
                : `${cold.reason ? t(`availability.${cold.reason}`) : ''} ${t('home.remaining', { time: formatDuration(cold.waitMs) })}`}
            </p>
          ) : (
            <>
              {isColdPass && (
                <p className="rounded-xl border border-[var(--np-brass)] p-4 text-sm">
                  {t('training.coldNotice')}
                </p>
              )}

              <AnswerGuide trained={params.trained} windowMs={params.windowMs} feedback={params.feedback} />

              <p className="border-t border-[var(--np-track)] pt-5 text-sm text-[var(--np-mist)]">
                {t('training.passRequirement', { accuracy: params.minAccuracy, trials: TRIALS_PER_ATTEMPT })}
                {progress.failedAtLevel > 0 && ` ${t('training.attemptsSoFar', { count: progress.failedAtLevel })}`}
              </p>

              {!isColdPass && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{t('training.samplesTitle')}</p>
                  <p className="text-xs text-[var(--np-mist)]">
                    {t('training.samplesHint')}
                    {!params.feedback && ` ${t('training.samplesShepardHint')}`}
                  </p>
                  <SamplePlayer notes={params.trained} onPlayed={() => setHeardSamples(true)} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="accent" className="px-8 py-3 text-base" onClick={() => void begin()}>
                  {t('training.start')}
                </Button>
                {canRetreat(progress) && (
                  <Button variant="secondary" onClick={retreat}>
                    {t('training.retreat')}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {step.name === 'shepard' && <ShepardStep devMode={devMode} onDone={() => setStep({ name: 'running' })} />}

      {step.name === 'running' && (
        <AttemptRunner
          key={`attempt-${attemptKey}`}
          stimuli={stimuli}
          options={answerOptions(params.trained)}
          windowMs={params.windowMs}
          feedback={params.feedback}
          devMode={devMode}
          onDone={finishAttempt}
        />
      )}

      {step.name === 'summary' && (
        <SummaryView
          summary={step.summary}
          title={step.passed ? t('training.passed') : t('training.failed')}
          message={step.outcome ? t(`training.outcome.${step.outcome}`) : ''}
          actions={
            <>
              {!data.progress.completed && (
                <Button variant="accent" onClick={nextAttempt}>
                  {t('training.continue')}
                </Button>
              )}
              <Button variant="secondary" onClick={onExit}>
                {t('common.backHome')}
              </Button>
            </>
          }
        />
      )}

      {step.name === 'special-intro' && (
        <div className="listening-room space-y-4 rounded-2xl p-5 sm:p-7">
          <p className="font-display text-2xl font-semibold">{t('training.special.title', { note: displayNote(step.target) })}</p>
          <p className="text-[15px] leading-relaxed">
            {t('training.special.body', {
              note: displayNote(step.target),
              withFeedback: SPECIAL_EXERCISE_FEEDBACK_TRIALS,
              withoutFeedback: SPECIAL_EXERCISE_NO_FEEDBACK_TRIALS,
            })}
          </p>
          <Button variant="accent" onClick={() => { setAttemptStart(new Date()); setStep({ name: 'special-running', target: step.target, phase: 'feedback' }); }}>
            {t('training.special.start')}
          </Button>
        </div>
      )}

      {step.name === 'special-running' && (
        <SpecialRunner
          key={`${step.target}-${step.phase}`}
          target={step.target}
          trained={params.trained}
          phase={step.phase}
          devMode={devMode}
          onDone={(records) => {
            const summary = summarize(records);
            const kind: AttemptKind = step.phase === 'feedback' ? 'special-feedback' : 'special-no-feedback';
            recordAttempt({
              kind,
              startedAt: attemptStart,
              windowMs: specialWindow(params.trained.length, step.phase),
              feedback: step.phase === 'feedback',
              trials: records,
              summary,
            });
            setAttemptStart(new Date());
            if (step.phase === 'feedback') setStep({ name: 'special-running', target: step.target, phase: 'no-feedback' });
            else setStep({ name: 'special-summary', target: step.target, summary });
          }}
        />
      )}

      {step.name === 'special-summary' && (
        <SummaryView
          summary={step.summary}
          title={t('training.special.doneTitle', { note: displayNote(step.target) })}
          message={t('training.special.doneBody')}
          actions={
            <>
              <Button variant="accent" onClick={() => setStep({ name: 'intro' })}>
                {t('training.special.backToLevel')}
              </Button>
              <Button variant="secondary" onClick={onExit}>
                {t('common.backHome')}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}

function specialWindow(trainedCount: number, phase: 'feedback' | 'no-feedback'): number {
  return Math.round(baseWindowMs(trainedCount) * (phase === 'feedback' ? 1.5 : 1));
}

function AttemptRunner(props: {
  stimuli: Stimulus[];
  options: Answer[];
  windowMs: number;
  feedback: boolean;
  devMode: boolean;
  onDone: (records: TrialRecord[]) => void;
}) {
  const runner = useTrialRunner({ stimuli: props.stimuli, windowMs: props.windowMs, feedback: props.feedback, onDone: props.onDone });
  return <TrialPanel runner={runner} options={props.options} feedback={props.feedback} windowMs={props.windowMs} devMode={props.devMode} />;
}

function SpecialRunner(props: {
  target: Chroma;
  trained: Chroma[];
  phase: 'feedback' | 'no-feedback';
  devMode: boolean;
  onDone: (records: TrialRecord[]) => void;
}) {
  const count = props.phase === 'feedback' ? SPECIAL_EXERCISE_FEEDBACK_TRIALS : SPECIAL_EXERCISE_NO_FEEDBACK_TRIALS;
  const [stimuli] = useState(() => generateSpecialStimuli(createRng(), props.target, props.trained, count));
  const windowMs = specialWindow(props.trained.length, props.phase);
  const feedback = props.phase === 'feedback';
  const runner = useTrialRunner({ stimuli, windowMs, feedback, onDone: props.onDone });
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t('training.special.question', {
          note: displayNote(props.target),
          mode: feedback ? t('common.withFeedback') : t('common.withoutFeedback'),
        })}
      </p>
      <TrialPanel runner={runner} options={[props.target, OUT_OF_BOUND]} feedback={feedback} windowMs={windowMs} devMode={props.devMode} />
    </div>
  );
}

function ShepardStep({ onDone, devMode }: { onDone: () => void; devMode: boolean }) {
  const [startedAt] = useState(() => Date.now());
  const now = useNow(250);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const engine = getAudioEngine();
    let cancelled = false;
    void engine.playShepard().then(() => !cancelled && onDoneRef.current());
    return () => {
      cancelled = true;
      engine.stopShepard();
    };
  }, []);

  const remaining = Math.max(0, SHEPARD_DURATION_MS - (now - startedAt));
  const { t } = useTranslation();
  return (
    <div className="listening-room relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-6 text-center">
      <Suspense fallback={<div style={{ height: 280 }} />}>
        <PitchHelix mode="shepard" height={280} className="w-full" />
      </Suspense>
      <p className="font-display text-2xl font-semibold">{t('training.shepard.title')}</p>
      <p className="max-w-md text-sm text-[var(--np-mist)]">{t('training.shepard.body')}</p>
      <p className="font-display text-3xl tabular-nums">{Math.ceil(remaining / 1000)} s</p>
      {devMode && (
        <Button variant="ghost" onClick={() => { getAudioEngine().stopShepard(); onDone(); }}>
          {t('training.shepard.skip')}
        </Button>
      )}
    </div>
  );
}

export function SummaryView({
  summary,
  title,
  message,
  actions,
}: {
  summary: AttemptSummary;
  title: string;
  message: string;
  actions: React.ReactNode;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const stats = [
    {
      label: t('training.summary.accuracy'),
      value: `${summary.accuracy.toFixed(0)}%`,
      hint: t('training.summary.ofTotal', { correct: summary.correct, total: summary.total }),
    },
    {
      label: t('training.summary.meanError'),
      value: summary.meanErrorSemitones === null ? '—' : fmt.number(summary.meanErrorSemitones, 2),
      hint: t('training.summary.semitones'),
    },
    {
      label: t('training.summary.rt'),
      value: summary.meanCorrectRtMs === null ? '—' : `${fmt.seconds(summary.meanCorrectRtMs)} s`,
      hint: t('training.summary.sinceOnset'),
    },
  ];
  return (
    <div className="listening-room space-y-6 rounded-2xl p-5 sm:p-7">
      <div>
        <p className="font-display text-3xl font-semibold">{title}</p>
        <p className="mt-1 text-sm text-[var(--np-mist)]">{message}</p>
      </div>
      <dl className="grid grid-cols-3 gap-4 border-y border-[var(--np-track)] py-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-[var(--np-mist)]">{stat.label}</dt>
            <dd className="font-display mt-1 text-3xl font-semibold tabular-nums">{stat.value}</dd>
            <dd className="text-xs text-[var(--np-muted)]">{stat.hint}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

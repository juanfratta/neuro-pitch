import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import { useTrialRunner } from '../hooks/useTrialRunner';
import { answerOptions, generateSpecialStimuli, generateTrainingStimuli, introductionOrder, type Stimulus } from '../protocol/curriculum';
import { OUT_OF_BOUND, type Answer, type Chroma } from '../protocol/notes';
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
  globalLevel,
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
import { TrialPanel } from '../components/TrialPanel';
import { Button, Eyebrow, Stat } from '../components/ui';
import { useNow } from '../hooks/useNow';

const PitchHelix = lazy(() => import('../components/PitchHelix'));

type Step =
  | { name: 'intro' }
  | { name: 'shepard' }
  | { name: 'running' }
  | { name: 'summary'; summary: AttemptSummary; outcome: Outcome | null; passed: boolean }
  | { name: 'special-intro'; target: Chroma }
  | { name: 'special-running'; target: Chroma; phase: 'feedback' | 'no-feedback' }
  | { name: 'special-summary'; target: Chroma; summary: AttemptSummary };

const OUTCOME_TEXT: Record<Outcome, string> = {
  failed: 'No alcanzaste el mínimo. Se repite el nivel.',
  passed: 'Nivel aprobado.',
  jumped: 'Sacaste 90% o más: saltás los niveles intermedios.',
  'stage-up': 'Etapa completa: se suma una nota nueva.',
  'final-streak': 'Pase del nivel final. Hacen falta 3 seguidos.',
  'awaiting-cold-pass': 'Tres pases seguidos. Ahora 12 h sin entrenar y un único intento en frío.',
  'cold-pass-failed': 'El pase en frío no salió. Hay que volver a juntar 3 pases seguidos.',
  completed: 'Completaste el protocolo.',
};

export function TrainingFlow({ onExit, devMode }: { onExit: () => void; devMode: boolean }) {
  const { data, recordAttempt, retreat } = useUserData();
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
          <Eyebrow>Entrenamiento</Eyebrow>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {params.trained.length} {params.trained.length === 1 ? 'nota' : 'notas'} · nivel {progress.level} de 24
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <p>Sesión: {formatDuration(sessionMs)}</p>
          <Button variant="ghost" className="mt-1 px-2 py-1 text-xs" onClick={() => { getAudioEngine().stopAll(); onExit(); }}>
            Salir
          </Button>
        </div>
      </div>

      {step.name === 'intro' && (
        <div className="space-y-5">
          {blocked ? (
            <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {progress.completed ? 'Ya completaste el protocolo.' : `${cold.reason} Falta ${formatDuration(cold.waitMs)}.`}
            </p>
          ) : (
            <>
              {isColdPass && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Pase final en frío: un solo intento, sin muestras previas. Si sale, el protocolo queda completo.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Para pasar" value={`${params.minAccuracy}%`} />
                <Stat label="Respuesta" value={`${(params.windowMs / 1000).toFixed(2)} s`} hint="desde que suena" />
                <Stat label="Feedback" value={params.feedback ? 'Sí' : 'No'} />
                <Stat label="Nivel global" value={`${globalLevel(progress)}/288`} />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Vas a escuchar las notas que estás aprendiendo y también notas vecinas. Si el sonido no es ninguna de tus
                  notas, la respuesta es <span className="font-semibold">Fuera de rango</span>.
                </p>
                {answerOptions(params.trained).includes(OUT_OF_BOUND) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Próxima nota a aprender: {introductionOrder()[params.trained.length] ?? '—'}
                  </p>
                )}
              </div>

              {!isColdPass && (
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Muestras (opcional)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Elegí una nota para escucharla en sus tres octavas.
                    {!params.feedback && ' Como este nivel no tiene feedback, si escuchás muestras va a sonar un tono de 20 s para borrar la referencia antes de empezar.'}
                  </p>
                  <SamplePlayer notes={params.trained} onPlayed={() => setHeardSamples(true)} />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void begin()}>Empezar intento</Button>
                {canRetreat(progress) && (
                  <Button variant="secondary" onClick={retreat}>
                    Volver a un nivel más fácil
                  </Button>
                )}
              </div>
              {progress.failedAtLevel > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Intentos sin pasar en este nivel: {progress.failedAtLevel}</p>
              )}
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
          title={step.passed ? 'Aprobado' : 'No aprobado'}
          message={step.outcome ? OUTCOME_TEXT[step.outcome] : ''}
          actions={
            <>
              {!data.progress.completed && <Button onClick={nextAttempt}>Seguir</Button>}
              <Button variant="secondary" onClick={onExit}>
                Volver al inicio
              </Button>
            </>
          }
        />
      )}

      {step.name === 'special-intro' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Ejercicio sobre tu nota más floja: <span className="font-semibold">{step.target}</span>. Vas a escuchar tonos y
            responder si es {step.target} o no. Primero {SPECIAL_EXERCISE_FEEDBACK_TRIALS} trials con feedback y después{' '}
            {SPECIAL_EXERCISE_NO_FEEDBACK_TRIALS} sin feedback.
          </p>
          <Button onClick={() => { setAttemptStart(new Date()); setStep({ name: 'special-running', target: step.target, phase: 'feedback' }); }}>
            Empezar ejercicio
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
          title={`Ejercicio de ${step.target} terminado`}
          message="Resultado de la parte sin feedback. Este ejercicio no aprueba ni desaprueba: sirve para afinar la nota más floja."
          actions={
            <>
              <Button onClick={() => setStep({ name: 'intro' })}>Volver al nivel</Button>
              <Button variant="secondary" onClick={onExit}>
                Volver al inicio
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
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        ¿Es {props.target}? {feedback ? '(con feedback)' : '(sin feedback)'} — si no lo es, respondé Fuera de rango.
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
  return (
    <div className="listening-room relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-6 text-center">
      <Suspense fallback={<div style={{ height: 280 }} />}>
        <PitchHelix mode="shepard" height={280} className="w-full" />
      </Suspense>
      <p className="font-display text-2xl font-semibold">Limpiando la referencia</p>
      <p className="max-w-md text-sm text-[var(--np-mist)]">
        Este tono baja sin parar, como la espiral: nunca llega a una nota fija. Así lo que escuchaste en las muestras no
        queda como referencia para el nivel sin feedback.
      </p>
      <p className="font-display text-3xl tabular-nums">{Math.ceil(remaining / 1000)} s</p>
      {devMode && (
        <Button variant="ghost" onClick={() => { getAudioEngine().stopShepard(); onDone(); }}>
          dev: saltear
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
  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Aciertos" value={`${summary.accuracy.toFixed(0)}%`} hint={`${summary.correct}/${summary.total}`} />
        <Stat
          label="Error medio"
          value={summary.meanErrorSemitones === null ? '—' : `${summary.meanErrorSemitones.toFixed(2)} st`}
          hint="en semitonos"
        />
        <Stat label="Tiempo (aciertos)" value={summary.meanCorrectRtMs === null ? '—' : `${(summary.meanCorrectRtMs / 1000).toFixed(2)} s`} />
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

import { introductionOrder, trainedSet } from '../protocol/curriculum';
import { displayNote } from '../protocol/notes';
import { LEVELS_PER_STAGE, TARGET_TOTAL_HOURS, TARGET_WEEKLY_HOURS, TOTAL_STAGES } from '../protocol/params';
import { attemptParams, globalLevel } from '../protocol/progression';
import { useUserData } from '../state/UserDataContext';
import {
  coldPassAvailability,
  formatDuration,
  lastPostTest,
  postTestAvailability,
  preTest,
  streakDays,
  totalTrainingMs,
  weekTrainingMs,
} from '../state/userData';
import { useNow } from '../hooks/useNow';
import { TestComparison } from '../components/TestComparison';
import { DevPanel } from '../components/DevPanel';
import { Button, Card, Eyebrow, ProgressBar, Stat } from '../components/ui';
import { lazy, Suspense } from 'react';
import { noteAccuracy } from '../state/userData';

// Three.js se carga aparte: no suma peso a las pantallas de entrenamiento.
const PitchHelix = lazy(() => import('../components/PitchHelix'));

interface Props {
  devMode: boolean;
  onTrain: () => void;
  onTest: (kind: 'pre' | 'post') => void;
}

export function Home({ devMode, onTrain, onTest }: Props) {
  const { data } = useUserData();
  const now = new Date(useNow(30_000));
  const pre = preTest(data);

  if (!pre && !devMode) {
    return (
      <div className="listening-room mx-auto max-w-2xl space-y-4 rounded-2xl p-6">
        <Suspense fallback={<div style={{ height: 340 }} />}>
          <PitchHelix mode="map" learned={[]} next="F" height={340} />
        </Suspense>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Oído absoluto de adulto, con método</h1>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--np-mist)]">
          <p>
            El entrenamiento sigue el protocolo de Wong y colegas (2025): se aprende de a una nota, distinguiéndola de sus
            vecinas, con exigencia y velocidad crecientes, hasta cubrir las 12.
          </p>
          <p>
            En ese estudio, músicos adultos que entrenaron unas 20 horas en 8 semanas aprendieron a nombrar en promedio 7
            notas al 90% de acierto y en menos de 2 segundos. Dos de cada doce llegaron a las 12. Es un trabajo largo y el
            avance es gradual.
          </p>
          <p>
            En la hélice, cada vuelta es una octava y cada columna es una nota. Lo que se entrena es la columna: reconocer
            la nota en cualquier octava.
          </p>
          <p>Primero hacemos un test inicial para saber desde dónde arrancás.</p>
        </div>
        <Button variant="accent" onClick={() => onTest('pre')}>
          Hacer el test inicial
        </Button>
      </div>
    );
  }

  const progress = data.progress;
  const params = attemptParams(progress);
  const order = introductionOrder();
  const trained = trainedSet(progress.stage);
  const totalMs = totalTrainingMs(data);
  const weekMs = weekTrainingMs(data, now);
  const streak = streakDays(data, now);
  const cold = coldPassAvailability(data, now);
  const post = postTestAvailability(data, now);
  const lastPost = lastPostTest(data);
  const accuracy = noteAccuracy(data);
  const recent = data.attempts.filter((a) => a.kind === 'level').slice(-5).reverse();

  const trainLabel = progress.completed ? 'Protocolo completo' : progress.awaitingColdPass ? 'Pase final en frío' : 'Entrenar';
  const trainDisabled = progress.completed || (progress.awaitingColdPass && !cold.available && !devMode);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="listening-room grid items-center gap-2 overflow-hidden rounded-2xl p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="order-2 space-y-4 md:order-1">
            <p className="font-display text-4xl font-semibold leading-[1.05] tracking-tight">
              {trained.length} {trained.length === 1 ? 'nota' : 'notas'}
              <span className="block text-2xl text-[var(--np-mist)]">
                nivel {progress.level} de {LEVELS_PER_STAGE}
              </span>
            </p>
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--np-track)]">
                <div className="h-full rounded-full bg-[var(--np-brass)]" style={{ width: `${(globalLevel(progress) / 288) * 100}%` }} />
              </div>
              <p className="text-xs tabular-nums text-[var(--np-mist)]">
                Recorrido total: {globalLevel(progress)} de {LEVELS_PER_STAGE * TOTAL_STAGES} niveles
              </p>
            </div>
            <p className="text-sm leading-relaxed text-[var(--np-mist)]">
              Este nivel pide {params.minAccuracy}% de aciertos, respondiendo en menos de {(params.windowMs / 1000).toFixed(2)} s,{' '}
              {params.feedback ? 'con feedback' : 'sin feedback'}.
              {order[trained.length] && ` La próxima nota es ${displayNote(order[trained.length])}.`}
              {progress.awaitingColdPass && ' Te falta el pase final: un intento en frío después de 12 h sin entrenar.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="accent" onClick={onTrain} disabled={trainDisabled} className="px-8 py-3 text-base">
                {trainLabel}
              </Button>
              {progress.awaitingColdPass && !cold.available && (
                <span className="text-xs text-[var(--np-mist)]">Disponible en {formatDuration(cold.waitMs)}</span>
              )}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <Suspense fallback={<div style={{ height: 380 }} />}>
              <PitchHelix mode="map" learned={trained} next={order[trained.length] ?? null} accuracy={accuracy} height={380} className="cursor-grab active:cursor-grabbing" />
            </Suspense>
          </div>
        </section>

        <Card className="space-y-4">
          <Eyebrow>Tests</Eyebrow>
          {pre ? (
            <TestComparison pre={lastPost ? pre : undefined} current={lastPost ?? pre} />
          ) : (
            <p className="text-sm text-slate-500">Sin test inicial (modo desarrollo).</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!pre && (
              <Button variant="secondary" onClick={() => onTest('pre')}>
                Hacer test inicial
              </Button>
            )}
            {pre && (
              <Button variant="secondary" onClick={() => onTest('post')} disabled={!post.available && !devMode}>
                Test de progreso
              </Button>
            )}
            {pre && !post.available && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {post.reason}
                {post.waitMs > 0 && ` Falta ${formatDuration(post.waitMs)}.`}
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-3">
          <Eyebrow>Constancia</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Esta semana" value={formatDuration(weekMs)} hint={`meta: ${TARGET_WEEKLY_HOURS} h`} />
            <Stat label="Racha" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} hint="se corta tras 2 días sin entrenar" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Meta semanal</span>
              <span>{Math.min(100, Math.round((weekMs / (TARGET_WEEKLY_HOURS * 3_600_000)) * 100))}%</span>
            </div>
            <ProgressBar value={(weekMs / (TARGET_WEEKLY_HOURS * 3_600_000)) * 100} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total entrenado</span>
              <span>
                {formatDuration(totalMs)} de {TARGET_TOTAL_HOURS} h
              </span>
            </div>
            <ProgressBar value={(totalMs / (TARGET_TOTAL_HOURS * 3_600_000)) * 100} />
          </div>
        </Card>

        {recent.length > 0 && (
          <Card className="space-y-2">
            <Eyebrow>Últimos intentos</Eyebrow>
            <ul className="space-y-1 text-sm tabular-nums">
              {recent.map((a) => (
                <li key={a.startedAt} className="flex justify-between text-slate-700 dark:text-slate-200">
                  <span>
                    Etapa {a.stage} · nivel {a.level}
                  </span>
                  <span className={a.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                    {a.summary.accuracy.toFixed(0)}% {a.passed ? '✓' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {devMode && <DevPanel />}
      </div>
    </div>
  );
}

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
import { useTranslation } from 'react-i18next';
import { useFormat } from '../i18n/format';
import { POST_TEST_MIN_HOURS } from '../protocol/params';
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
  const { t } = useTranslation();
  const fmt = useFormat();
  const now = new Date(useNow(30_000));
  const pre = preTest(data);

  if (!pre && !devMode) {
    return (
      <div className="listening-room mx-auto max-w-2xl space-y-5 rounded-2xl p-5 sm:p-7">
        <Suspense fallback={<div style={{ height: 260 }} />}>
          <PitchHelix mode="map" learned={[]} next="F" height={260} />
        </Suspense>
        <h1 className="font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl">{t('welcome.title')}</h1>
        <p className="text-[15px] leading-relaxed text-[var(--np-mist)]">{t('welcome.lead')}</p>

        <dl className="grid grid-cols-3 gap-3 border-y border-[var(--np-track)] py-4">
          {(
            [
              ['statHours', 'statHoursLabel'],
              ['statNotes', 'statNotesLabel'],
              ['statAll', 'statAllLabel'],
            ] as const
          ).map(([value, label]) => (
            <div key={value}>
              <dt className="sr-only">{t(`welcome.${label}`)}</dt>
              <dd className="font-display text-2xl font-semibold text-[var(--np-brass)] sm:text-3xl">{t(`welcome.${value}`)}</dd>
              <dd className="mt-0.5 text-xs leading-snug text-[var(--np-mist)]">{t(`welcome.${label}`)}</dd>
            </div>
          ))}
        </dl>

        <p className="text-sm">{t('welcome.honest')}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="accent" className="px-7 py-3 text-base" onClick={() => onTest('pre')}>
            {t('welcome.cta')}
          </Button>
          <span className="text-xs text-[var(--np-mist)]">{t('welcome.ctaHint')}</span>
        </div>

        <details className="group rounded-xl border border-[var(--np-track)] px-4 py-3 text-sm">
          <summary className="cursor-pointer list-none font-semibold marker:hidden">
            <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>
              ›
            </span>
            {t('welcome.moreTitle')}
          </summary>
          <div className="mt-3 space-y-2 leading-relaxed text-[var(--np-mist)]">
            <p>{t('welcome.more1')}</p>
            <p>{t('welcome.more2')}</p>
            <p>{t('welcome.more3')}</p>
          </div>
        </details>
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

  const trainLabel = progress.completed ? t('home.completed') : progress.awaitingColdPass ? t('home.coldPass') : t('home.train');
  const nextNote = order[trained.length];
  const postReason = post.reason
    ? t(`availability.${post.reason}`, { min: POST_TEST_MIN_HOURS, have: fmt.number(post.hours ?? 0, 1) })
    : '';
  const trainDisabled = progress.completed || (progress.awaitingColdPass && !cold.available && !devMode);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="listening-room grid items-center gap-2 overflow-hidden rounded-2xl p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="order-2 space-y-4 md:order-1">
            <p className="font-display text-4xl font-semibold leading-[1.05] tracking-tight">
              {t('common.notes', { count: trained.length })}
              <span className="block text-2xl text-[var(--np-mist)]">
                {t('common.levelOf', { level: progress.level, total: LEVELS_PER_STAGE })}
              </span>
            </p>
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--np-track)]">
                <div className="h-full rounded-full bg-[var(--np-brass)]" style={{ width: `${(globalLevel(progress) / 288) * 100}%` }} />
              </div>
              <p className="text-xs tabular-nums text-[var(--np-mist)]">
                {t('home.totalProgress', { current: globalLevel(progress), total: LEVELS_PER_STAGE * TOTAL_STAGES })}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-[var(--np-mist)]">
              {t('home.levelRequires', {
                accuracy: params.minAccuracy,
                seconds: fmt.seconds(params.windowMs),
                feedback: params.feedback ? t('common.withFeedback') : t('common.withoutFeedback'),
              })}
              {nextNote && ` ${t('home.nextNote', { note: displayNote(nextNote) })}`}
              {progress.awaitingColdPass && ` ${t('home.coldPending')}`}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="accent" onClick={onTrain} disabled={trainDisabled} className="px-8 py-3 text-base">
                {trainLabel}
              </Button>
              {progress.awaitingColdPass && !cold.available && (
                <span className="text-xs text-[var(--np-mist)]">{t('home.availableIn', { time: formatDuration(cold.waitMs) })}</span>
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
          <Eyebrow>{t('home.tests')}</Eyebrow>
          {pre ? (
            <TestComparison pre={lastPost ? pre : undefined} current={lastPost ?? pre} />
          ) : (
            <p className="text-sm text-slate-500">{t('home.noPreTestDev')}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!pre && (
              <Button variant="secondary" onClick={() => onTest('pre')}>
                {t('home.takePreTest')}
              </Button>
            )}
            {pre && (
              <Button variant="secondary" onClick={() => onTest('post')} disabled={!post.available && !devMode}>
                {t('home.progressTest')}
              </Button>
            )}
            {pre && !post.available && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {postReason}
                {post.waitMs > 0 && ` ${t('home.remaining', { time: formatDuration(post.waitMs) })}`}
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-3">
          <Eyebrow>{t('home.consistency')}</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('home.thisWeek')} value={formatDuration(weekMs)} hint={t('home.goal', { hours: TARGET_WEEKLY_HOURS })} />
            <Stat label={t('home.streak')} value={t('home.streakDays', { count: streak })} hint={t('home.streakHint')} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{t('home.weeklyGoal')}</span>
              <span>{Math.min(100, Math.round((weekMs / (TARGET_WEEKLY_HOURS * 3_600_000)) * 100))}%</span>
            </div>
            <ProgressBar value={(weekMs / (TARGET_WEEKLY_HOURS * 3_600_000)) * 100} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{t('home.totalTrained')}</span>
              <span>{t('home.totalOf', { time: formatDuration(totalMs), hours: TARGET_TOTAL_HOURS })}</span>
            </div>
            <ProgressBar value={(totalMs / (TARGET_TOTAL_HOURS * 3_600_000)) * 100} />
          </div>
        </Card>

        {recent.length > 0 && (
          <Card className="space-y-2">
            <Eyebrow>{t('home.recentAttempts')}</Eyebrow>
            <ul className="space-y-1 text-sm tabular-nums">
              {recent.map((a) => (
                <li key={a.startedAt} className="flex justify-between text-slate-700 dark:text-slate-200">
                  <span>{t('home.attemptRow', { stage: a.stage, level: a.level })}</span>
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

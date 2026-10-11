import { answerOptions } from '../protocol/curriculum';
import { OUT_OF_BOUND, displayNote, type Chroma } from '../protocol/notes';
import { ChromaWheel } from './ChromaWheel';
import { Trans, useTranslation } from 'react-i18next';
import { useFormat } from '../i18n/format';

interface Props {
  trained: Chroma[];
  windowMs: number;
  feedback: boolean;
}

/** Cómo responder, con la misma rueda que se va a usar. */
export function AnswerGuide({ trained, windowMs, feedback }: Props) {
  const options = answerOptions(trained);
  const hasOutOfBound = options.includes(OUT_OF_BOUND);
  const single = trained.length === 1;
  const only = displayNote(trained[0]);
  const { t } = useTranslation();
  const fmt = useFormat();
  const bold = { b: <strong /> };

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[15rem]">
        <ChromaWheel
          preview
          options={options}
          phase="ready"
          trialIndex={0}
          windowMs={windowMs}
          feedback={false}
          lastRecord={null}
          onListen={() => {}}
          onAnswer={() => {}}
        />
      </div>

      <div className="space-y-3 text-[15px] leading-relaxed">
        <p className="font-display text-xl font-semibold">{t('guide.title')}</p>
        {hasOutOfBound ? (
          <ol className="space-y-2">
            <li className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--np-brass)]" aria-hidden />
              <span>
                {single ? (
                  <Trans i18nKey="guide.single" values={{ note: only }} components={bold} />
                ) : (
                  t('guide.many', { notes: fmt.list(trained.map(displayNote)) })
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--np-lavender)]" aria-hidden />
              <span>
                <Trans i18nKey={single ? 'guide.outSingle' : 'guide.outMany'} values={{ note: only }} components={bold} />
              </span>
            </li>
          </ol>
        ) : (
          <p>{t('guide.allNotes')}</p>
        )}
        <p className="text-sm text-[var(--np-mist)]">
          {hasOutOfBound && `${t('guide.neighbors')} ${t('guide.center')} `}
          {t('guide.time', { seconds: fmt.seconds(windowMs) })} {feedback ? t('guide.feedbackOn') : t('guide.feedbackOff')}
        </p>
      </div>
    </div>
  );
}

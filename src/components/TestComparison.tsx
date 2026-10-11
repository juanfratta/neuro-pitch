import type { AttemptSummary } from '../protocol/progression';
import type { TestRecord } from '../state/userData';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../i18n/format';

const TIMBRES = ['piano-test', 'guitar-test'] as const;

/**
 * Las tres métricas del paper, por timbre: acierto (azar = 8,3%), error medio en
 * semitonos (azar ≈ 3) y tiempo de los aciertos. Si hay test inicial, se compara.
 */
export function TestComparison({ pre, current }: { pre?: TestRecord; current: TestRecord }) {
  const { t } = useTranslation();
  const format = useFormat();
  const fmt = {
    acc: (s: AttemptSummary) => `${format.number(s.accuracy, 1)}%`,
    err: (s: AttemptSummary) => (s.meanErrorSemitones === null ? '—' : format.number(s.meanErrorSemitones, 2)),
    rt: (s: AttemptSummary) => (s.meanCorrectRtMs === null ? '—' : `${format.seconds(s.meanCorrectRtMs)} s`),
  };
  const label = { 'piano-test': t('comparison.piano'), 'guitar-test': t('comparison.guitar') };
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">{t('comparison.timbre')}</th>
              <th className="py-2 pr-3 font-medium">{t('comparison.accuracy')}</th>
              <th className="py-2 pr-3 font-medium">{t('comparison.error')}</th>
              <th className="py-2 font-medium">{t('comparison.time')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-800 dark:text-slate-100">
            {TIMBRES.map((timbre) => {
              const now = current.report.byTimbre[timbre];
              const before = pre?.report.byTimbre[timbre];
              if (!now) return null;
              return (
                <tr key={timbre} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2 pr-3">{label[timbre]}</td>
                  <td className="py-2 pr-3">
                    {fmt.acc(now)}
                    {before && <span className="ml-1 text-xs text-slate-500">{t('comparison.before', { value: fmt.acc(before) })}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {fmt.err(now)}
                    {before && <span className="ml-1 text-xs text-slate-500">{t('comparison.before', { value: fmt.err(before) })}</span>}
                  </td>
                  <td className="py-2">
                    {fmt.rt(now)}
                    {before && <span className="ml-1 text-xs text-slate-500">{t('comparison.before', { value: fmt.rt(before) })}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('comparison.reference')}
      </p>
    </div>
  );
}

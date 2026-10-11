import type { AttemptSummary } from '../protocol/progression';
import type { TestRecord } from '../state/userData';

const TIMBRE_LABEL: Record<string, string> = {
  'piano-test': 'Piano',
  'guitar-test': 'Guitarra (no entrenada)',
};

const fmt = {
  acc: (s: AttemptSummary) => `${s.accuracy.toFixed(1)}%`,
  err: (s: AttemptSummary) => (s.meanErrorSemitones === null ? '—' : s.meanErrorSemitones.toFixed(2)),
  rt: (s: AttemptSummary) => (s.meanCorrectRtMs === null ? '—' : `${(s.meanCorrectRtMs / 1000).toFixed(2)} s`),
};

/**
 * Las tres métricas del paper, por timbre: acierto (azar = 8,3%), error medio en
 * semitonos (azar ≈ 3) y tiempo de los aciertos. Si hay test inicial, se compara.
 */
export function TestComparison({ pre, current }: { pre?: TestRecord; current: TestRecord }) {
  const rows = Object.keys(TIMBRE_LABEL);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">Timbre</th>
              <th className="py-2 pr-3 font-medium">Aciertos</th>
              <th className="py-2 pr-3 font-medium">Error (semitonos)</th>
              <th className="py-2 font-medium">Tiempo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-800 dark:text-slate-100">
            {rows.map((timbre) => {
              const now = current.report.byTimbre[timbre];
              const before = pre?.report.byTimbre[timbre];
              if (!now) return null;
              return (
                <tr key={timbre} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2 pr-3">{TIMBRE_LABEL[timbre]}</td>
                  <td className="py-2 pr-3">
                    {fmt.acc(now)}
                    {before && <span className="ml-1 text-xs text-slate-500">(antes {fmt.acc(before)})</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {fmt.err(now)}
                    {before && <span className="ml-1 text-xs text-slate-500">(antes {fmt.err(before)})</span>}
                  </td>
                  <td className="py-2">
                    {fmt.rt(now)}
                    {before && <span className="ml-1 text-xs text-slate-500">(antes {fmt.rt(before)})</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Referencia: adivinando al azar se acierta 8,3% y el error medio ronda los 3 semitonos. En el estudio, el grupo pasó
        de 13,9% a 31,7% de aciertos y de 2,62 a 1,50 semitonos de error con piano.
      </p>
    </div>
  );
}

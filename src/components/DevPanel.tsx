import { useState } from 'react';
import { useUserData } from '../state/UserDataContext';
import { expandTrial } from '../state/userData';
import { LEVELS_PER_STAGE, TOTAL_STAGES } from '../protocol/params';
import { Button, Card, Eyebrow } from './ui';
import { readRevealAnswers, setRevealAnswers } from '../utils/app-mode';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DevPanel() {
  const { data, setProgress, reset, replace } = useUserData();
  const [stage, setStage] = useState(data.progress.stage);
  const [level, setLevel] = useState(data.progress.level);
  const [reveal, setReveal] = useState(readRevealAnswers);

  const exportCsv = () => {
    const lines = ['source,kind,stage,level,trial,midi,chroma,octave,timbre,expected,answer,rt_ms,correct'];
    data.attempts.forEach((a) =>
      a.trials.map(expandTrial).forEach((t, i) =>
        lines.push(
          ['training', a.kind, a.stage, a.level, i + 1, t.stimulus.midi, t.stimulus.chroma, t.stimulus.octave, t.stimulus.timbre, t.stimulus.expected, t.answer ?? '', t.rtMs ?? '', t.correct ? 1 : 0].join(',')
        )
      )
    );
    data.tests.forEach((test) =>
      test.trials.map(expandTrial).forEach((t, i) =>
        lines.push(
          ['test', test.kind, '', '', i + 1, t.stimulus.midi, t.stimulus.chroma, t.stimulus.octave, t.stimulus.timbre, t.stimulus.expected, t.answer ?? '', t.rtMs ?? '', t.correct ? 1 : 0].join(',')
        )
      )
    );
    download('neuro-pitch-trials.csv', lines.join('\n'), 'text/csv');
  };

  return (
    <Card className="space-y-3 border-dashed">
      <Eyebrow>Modo desarrollo</Eyebrow>
      <div className="flex items-center gap-2 text-sm">
        <label>
          Etapa{' '}
          <input type="number" min={1} max={TOTAL_STAGES} value={stage} onChange={(e) => setStage(Number(e.target.value))} className="w-14 rounded border px-1 dark:bg-slate-900" />
        </label>
        <label>
          Nivel{' '}
          <input type="number" min={1} max={LEVELS_PER_STAGE} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-14 rounded border px-1 dark:bg-slate-900" />
        </label>
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setProgress({ ...data.progress, stage, level, failedAtLevel: 0 })}>
          Aplicar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => replace({ ...data, lastTrainingAt: new Date(Date.now() - 13 * 3_600_000).toISOString() })}>
          Simular 13 h sin entrenar
        </Button>
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => download('neuro-pitch.json', JSON.stringify(data, null, 2), 'application/json')}>
          Exportar JSON
        </Button>
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={exportCsv}>
          Exportar CSV
        </Button>
        <Button variant="ghost" className="px-2 py-1 text-xs text-rose-600" onClick={() => window.confirm('¿Borrar todo el progreso?') && reset()}>
          Borrar datos
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={reveal}
          onChange={(e) => {
            setRevealAnswers(e.target.checked);
            setReveal(e.target.checked);
          }}
        />
        <span>
          Mostrar la respuesta en cada trial
          <span className="block text-xs text-slate-500">Solo para probar la app: con esto prendido el entrenamiento no sirve.</span>
        </span>
      </label>
      <a href={window.location.pathname} className="inline-block text-xs font-semibold text-slate-600 underline dark:text-slate-300">
        Salir del modo desarrollo
      </a>
    </Card>
  );
}

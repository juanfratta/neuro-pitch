import { answerOptions } from '../protocol/curriculum';
import { OUT_OF_BOUND, displayNote, type Chroma } from '../protocol/notes';
import { ChromaWheel } from './ChromaWheel';

interface Props {
  trained: Chroma[];
  windowMs: number;
  feedback: boolean;
}

function listNotes(notes: Chroma[]): string {
  const names = notes.map(displayNote);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** Cómo responder, con la misma rueda que se va a usar. */
export function AnswerGuide({ trained, windowMs, feedback }: Props) {
  const options = answerOptions(trained);
  const hasOutOfBound = options.includes(OUT_OF_BOUND);
  const single = trained.length === 1;
  const only = displayNote(trained[0]);

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
        <p className="font-display text-xl font-semibold">Cómo responder</p>
        {hasOutOfBound ? (
          <ol className="space-y-2">
            <li className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--np-brass)]" aria-hidden />
              <span>
                {single ? (
                  <>
                    Si suena <strong>{only}</strong>, tocá {only}.
                  </>
                ) : (
                  <>
                    Si suena una de tus notas ({listNotes(trained)}), tocá cuál es.
                  </>
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--np-lavender)]" aria-hidden />
              <span>
                Si suena {single ? `otra nota que no es ${only}` : 'una nota que no es ninguna de las tuyas'}, tocá el
                centro de la rueda: <strong>fuera de rango</strong>. No hace falta saber qué nota es.
              </span>
            </li>
          </ol>
        ) : (
          <p>Tocá la nota que suena.</p>
        )}
        <p className="text-sm text-[var(--np-mist)]">
          {hasOutOfBound &&
            'Las notas que no son tuyas son vecinas, a uno o dos semitonos, así que se parecen a propósito: el ejercicio es reconocer la tuya entre ellas. '}
          {hasOutOfBound && 'El centro es Escuchar antes de cada nota y fuera de rango mientras suena, así no tenés que mover la mano. '}
          Tenés {(windowMs / 1000).toFixed(2).replace('.', ',')} s desde que empieza a sonar; si no respondés, cuenta como
          error. {feedback ? 'Después de cada respuesta vas a ver si acertaste.' : 'Este nivel no muestra si acertaste: el resultado aparece al final.'}
        </p>
      </div>
    </div>
  );
}

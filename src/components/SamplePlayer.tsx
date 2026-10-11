import { useRef, useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import { OCTAVES, displayNote, toMidi, type Chroma } from '../protocol/notes';
import { createRng, shuffle } from '../protocol/rng';
import { useTranslation } from 'react-i18next';

const GAP_MS = 1100;

/**
 * Muestras antes de un nivel (paper): se elige una nota aprendida y suenan sus tres
 * octavas en orden aleatorio. Se puede repetir sin límite.
 */
export function SamplePlayer({ notes, onPlayed }: { notes: Chroma[]; onPlayed: () => void }) {
  const [playing, setPlaying] = useState<Chroma | null>(null);
  const rng = useRef(createRng());
  const { t } = useTranslation();

  const play = async (chroma: Chroma) => {
    if (playing) return;
    setPlaying(chroma);
    onPlayed();
    const engine = getAudioEngine();
    try {
      for (const octave of shuffle(rng.current, OCTAVES)) {
        await engine.playMidi(toMidi(chroma, octave), 'piano-train');
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    } finally {
      setPlaying(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {notes.map((note) => (
        <button
          key={note}
          onClick={() => void play(note)}
          disabled={playing !== null}
          aria-label={t('samples.listen', { note: displayNote(note) })}
          className={`font-display h-12 min-w-12 rounded-full border px-3 text-lg font-semibold transition disabled:cursor-not-allowed ${
            playing === note
              ? 'border-[var(--np-brass)] bg-[var(--np-brass)] text-[var(--np-on-accent)]'
              : 'border-[var(--np-brass)] bg-[var(--np-surface)] text-[var(--np-brass)] hover:brightness-110 disabled:opacity-50'
          }`}
        >
          {displayNote(note)}
        </button>
      ))}
    </div>
  );
}

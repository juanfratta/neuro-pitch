import { useRef, useState } from 'react';
import { getAudioEngine } from '../audio/engine';
import { OCTAVES, toMidi, type Chroma } from '../protocol/notes';
import { createRng, shuffle } from '../protocol/rng';

const GAP_MS = 1100;

/**
 * Muestras antes de un nivel (paper): se elige una nota aprendida y suenan sus tres
 * octavas en orden aleatorio. Se puede repetir sin límite.
 */
export function SamplePlayer({ notes, onPlayed }: { notes: Chroma[]; onPlayed: () => void }) {
  const [playing, setPlaying] = useState<Chroma | null>(null);
  const rng = useRef(createRng());

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
          className={`min-w-14 rounded-xl border px-3 py-2 font-semibold transition disabled:cursor-not-allowed ${
            playing === note
              ? 'border-cyan-500 bg-cyan-500 text-slate-950'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
          }`}
        >
          {note}
        </button>
      ))}
    </div>
  );
}

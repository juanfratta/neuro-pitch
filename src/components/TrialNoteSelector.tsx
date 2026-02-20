import React from 'react';

interface NoteSelectorProps {
  availableNotes: string[];
  onSelect: (note: string) => void;
  disabled: boolean;
  selectedNote: string | null;
}

export const NoteSelector: React.FC<NoteSelectorProps> = ({
  availableNotes,
  onSelect,
  disabled,
  selectedNote,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {availableNotes.map((note) => (
        <button
          key={note}
          className={`rounded-xl border px-3 py-3 text-center font-semibold transition ${
            selectedNote === note
              ? 'border-cyan-500 bg-cyan-500 text-slate-950 shadow-[0_0_0_1px_rgba(6,182,212,0.2)] dark:border-cyan-400 dark:bg-cyan-400'
              : 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100 dark:border-cyan-900/60 dark:bg-cyan-950/35 dark:text-cyan-200 dark:hover:bg-cyan-900/45'
          } ${
            disabled
              ? 'cursor-default border-dashed border-slate-400 bg-slate-200 text-slate-500 opacity-100 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-800/90'
              : 'cursor-pointer'
          }`}
          onClick={() => {
            if (disabled) return;
            onSelect(note);
          }}
          aria-disabled={disabled}
          aria-pressed={selectedNote === note}
        >
          {note}
        </button>
      ))}
    </div>
  );
};

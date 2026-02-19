import React from 'react';

interface NoteSelectorProps {
  availableNotes: string[];
  onSelect: (note: string) => void;
  disabled: boolean;
  selectedNote: string | null;
}

export const NoteSelector = React.memo<NoteSelectorProps>(
  ({ availableNotes, onSelect, disabled, selectedNote }) => {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {availableNotes.map((note) => (
          <button
            key={note}
            className={`rounded-xl border px-3 py-3 text-center font-semibold transition ${
              selectedNote === note
                ? 'border-cyan-500 bg-cyan-500 text-slate-950 dark:border-cyan-400 dark:bg-cyan-400'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
            } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
            onClick={() => onSelect(note)}
            disabled={disabled}
          >
            {note}
          </button>
        ))}
      </div>
    );
  }
);

NoteSelector.displayName = 'NoteSelector';

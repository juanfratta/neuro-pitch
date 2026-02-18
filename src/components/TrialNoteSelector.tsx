/**
 * Component: NoteSelector
 * 
 * Displays buttons for all notes available at current level
 * Handles user input (note selection)
 * Disabled state prevents multiple responses
 * Memoized for performance
 * 
 * Props:
 * - availableNotes: string[] (e.g., ['D#', 'F#', 'B'])
 * - onSelect: callback when user clicks note
 * - disabled: disable all buttons (waiting for response)
 * - selectedNote: highlight selected note
 */

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
      <div className="note-selection">
        {availableNotes.map((note) => (
          <button
            key={note}
            className={`note-button ${selectedNote === note ? 'selected' : ''}`}
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

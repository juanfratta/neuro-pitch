/**
 * Component: TrialPlayback
 * 
 * Displays "listening..." indicator while audio plays
 * Memoized to prevent unnecessary re-renders
 * 
 * Pure visual component (audio is handled by useAudioTrial)
 */

import React from 'react';
export const TrialPlayback = React.memo(() => {
  return (
    <div className="trial-playback">
      <div className="spinner"></div>
      <p>Escuchando...</p>
    </div>
  );
});

TrialPlayback.displayName = 'TrialPlayback';

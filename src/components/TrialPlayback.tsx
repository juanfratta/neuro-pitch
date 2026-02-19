import React from 'react';

export const TrialPlayback = React.memo(() => {
  return (
    <div className="text-center">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-400" />
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Escuchando nota...</p>
    </div>
  );
});

TrialPlayback.displayName = 'TrialPlayback';

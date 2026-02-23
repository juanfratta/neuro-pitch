export type AppMode = 'participant' | 'developer';

const APP_MODE_STORAGE_KEY = 'neuro_pitch_app_mode';
const DEFAULT_APP_MODE: AppMode = 'participant';

export function getAppMode(): AppMode {
  if (typeof window === 'undefined') return DEFAULT_APP_MODE;

  const stored = localStorage.getItem(APP_MODE_STORAGE_KEY);
  if (stored === 'participant' || stored === 'developer') {
    return stored;
  }

  return DEFAULT_APP_MODE;
}

export function setAppMode(mode: AppMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
}

export function getUserStorageKeyByMode(baseKey: string): string {
  return `${baseKey}_${getAppMode()}`;
}


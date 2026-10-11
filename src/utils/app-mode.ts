/**
 * Modo desarrollo: muestra la nota esperada en cada trial, permite saltear esperas y
 * mover el progreso a mano. Se activa con ?dev=1 y se apaga con ?dev=0.
 */
const DEV_KEY = 'neuro_pitch_dev';

export function readDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  const param = new URLSearchParams(window.location.search).get('dev');
  try {
    if (param === '1') localStorage.setItem(DEV_KEY, '1');
    if (param === '0') localStorage.removeItem(DEV_KEY);
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return param === '1';
  }
}

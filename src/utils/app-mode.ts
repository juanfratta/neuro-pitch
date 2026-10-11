/**
 * Modo desarrollo: permite saltear esperas, mover el progreso a mano y exportar datos.
 * Se activa con ?dev=1 en la URL; sacándolo, se apaga.
 *
 * Mostrar la respuesta esperada en cada trial es una opción aparte, apagada por defecto,
 * porque arruina el entrenamiento: solo sirve para probar la app.
 */
/** Clave que usaban versiones anteriores para dejar el modo desarrollo guardado. */
const LEGACY_DEV_KEY = 'neuro_pitch_dev';

/**
 * El modo desarrollo vive solo en la URL: no se guarda. Así nadie queda en modo
 * desarrollo sin saberlo por haber entrado alguna vez con ?dev=1.
 */
export function readDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(LEGACY_DEV_KEY);
  } catch {
    // sin storage
  }
  return new URLSearchParams(window.location.search).get('dev') === '1';
}

const REVEAL_KEY = 'neuro_pitch_dev_reveal';

export function readRevealAnswers(): boolean {
  try {
    return localStorage.getItem(REVEAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRevealAnswers(value: boolean): void {
  try {
    if (value) localStorage.setItem(REVEAL_KEY, '1');
    else localStorage.removeItem(REVEAL_KEY);
  } catch {
    // sin storage
  }
}

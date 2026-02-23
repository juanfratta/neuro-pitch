export type ProtocolVariant = 'v1' | 'v2';

const PROTOCOL_VARIANT_STORAGE_KEY = 'neuro_pitch_protocol_variant';
const DEFAULT_PROTOCOL_VARIANT: ProtocolVariant = 'v2';

export function getProtocolVariant(): ProtocolVariant {
  if (typeof window === 'undefined') return DEFAULT_PROTOCOL_VARIANT;

  const stored = localStorage.getItem(PROTOCOL_VARIANT_STORAGE_KEY);
  if (stored === 'v1' || stored === 'v2') {
    return stored;
  }

  return DEFAULT_PROTOCOL_VARIANT;
}

export function setProtocolVariant(variant: ProtocolVariant): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROTOCOL_VARIANT_STORAGE_KEY, variant);
}


/**
 * Idiomas: español e inglés.
 * Por defecto se toma el idioma del navegador (es-* → español, cualquier otro → inglés).
 * Si la persona elige uno a mano, se guarda y tiene prioridad.
 */
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import es, { type Messages } from './es';
import en from './en';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'neuro_pitch_lang';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Messages };
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    supportedLngs: LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      // Solo se guarda la elección manual (setLanguage), no la detección automática.
      caches: [],
    },
  });

function syncHtmlLang(lng: string) {
  document.documentElement.lang = currentLanguage(lng);
}
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export function currentLanguage(lng: string = i18n.language): Language {
  return lng?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function setLanguage(lng: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // sin storage: el cambio vale para esta sesión
  }
  void i18n.changeLanguage(lng);
}

export default i18n;

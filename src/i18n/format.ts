import { useTranslation } from 'react-i18next';
import { currentLanguage } from './index';

/** Formatos que dependen del idioma: separador decimal y listas ("A, B y C" / "A, B, and C"). */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = currentLanguage(i18n.language) === 'es' ? 'es-AR' : 'en-US';
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return {
    locale,
    number,
    seconds: (ms: number, digits = 2) => number(ms / 1000, digits),
    list: (items: string[]) => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items),
  };
}

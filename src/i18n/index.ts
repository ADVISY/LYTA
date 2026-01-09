import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['fr', 'de', 'it', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  en: 'English',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  en: '🇬🇧',
};

const resources = {
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  en: { translation: en },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,
    
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'preferred_language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;

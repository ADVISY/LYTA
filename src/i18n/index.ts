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

const extractLeafKey = (key: string) => {
  const withoutNs = key.includes(":") ? key.split(":").slice(1).join(":") : key;
  return withoutNs.split(".").pop() || withoutNs;
};

const humanize = (raw: string) => {
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const MISSING_KEY_OVERRIDES: Record<SupportedLanguage, Record<string, string>> = {
  fr: { system: "Système", activeCount: "Actifs", inactiveCount: "Inactifs" },
  en: { system: "System", activeCount: "Active", inactiveCount: "Inactive" },
  de: { system: "System", activeCount: "Aktiv", inactiveCount: "Inaktiv" },
  it: { system: "Sistema", activeCount: "Attivi", inactiveCount: "Inattivi" },
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

    returnNull: false,
    returnEmptyString: false,

    // Never show raw translation keys in the UI.
    parseMissingKeyHandler: (key) => {
      const lang = (i18n.language?.split('-')[0] || 'fr') as SupportedLanguage;
      const leaf = extractLeafKey(key);
      return MISSING_KEY_OVERRIDES[lang]?.[leaf] ?? humanize(leaf);
    },
  });

export default i18n;

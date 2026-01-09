import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { type SupportedLanguage, SUPPORTED_LANGUAGES } from '@/i18n';

/**
 * Hook to manage language selection based on:
 * 1. User preference (stored in profiles.preferred_language)
 * 2. Tenant default language (stored in tenants.default_language)
 * 3. Browser preference
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { tenant } = useTenant();

  useEffect(() => {
    const initializeLanguage = async () => {
      // Check localStorage first (fastest)
      const storedLang = localStorage.getItem('preferred_language');
      if (storedLang && SUPPORTED_LANGUAGES.includes(storedLang as SupportedLanguage)) {
        if (i18n.language !== storedLang) {
          i18n.changeLanguage(storedLang);
        }
        return;
      }

      // If user is logged in, check their preference in DB
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_language')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.preferred_language && 
              SUPPORTED_LANGUAGES.includes(profile.preferred_language as SupportedLanguage)) {
            i18n.changeLanguage(profile.preferred_language);
            localStorage.setItem('preferred_language', profile.preferred_language);
            return;
          }
        } catch (error) {
          console.error('Error fetching user language preference:', error);
        }
      }

      // Fall back to tenant default language
      if (tenant?.default_language && 
          SUPPORTED_LANGUAGES.includes(tenant.default_language as SupportedLanguage)) {
        i18n.changeLanguage(tenant.default_language);
        localStorage.setItem('preferred_language', tenant.default_language);
        return;
      }

      // Default to French if nothing else is set
      if (!i18n.language || !SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)) {
        i18n.changeLanguage('fr');
      }
    };

    initializeLanguage();
  }, [user, tenant, i18n]);

  const setLanguage = async (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('preferred_language', lang);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_language: lang })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error saving language preference:', error);
      }
    }
  };

  return {
    currentLanguage: i18n.language as SupportedLanguage,
    setLanguage,
    t: i18n.t,
  };
}

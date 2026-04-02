import { useEffect, useRef } from 'react';
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
  
  // Track if we've already initialized to prevent re-runs
  const initializedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const lastTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only re-initialize if user or tenant actually changed
    const userId = user?.id ?? null;
    const tenantId = tenant?.id ?? null;
    
    if (
      initializedRef.current &&
      lastUserIdRef.current === userId &&
      lastTenantIdRef.current === tenantId
    ) {
      return;
    }
    
    lastUserIdRef.current = userId;
    lastTenantIdRef.current = tenantId;

    const initializeLanguage = async () => {
      // Check localStorage first (fastest)
      const storedLang = localStorage.getItem('preferred_language');
      if (storedLang && SUPPORTED_LANGUAGES.includes(storedLang as SupportedLanguage)) {
        if (i18n.language !== storedLang) {
          i18n.changeLanguage(storedLang);
        }
        initializedRef.current = true;
        return;
      }

      // If user is logged in, check their preference in DB
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          // Cast to access the new column (types may not be synced yet)
          const preferredLang = (profile as any)?.preferred_language;
          if (preferredLang && SUPPORTED_LANGUAGES.includes(preferredLang as SupportedLanguage)) {
            i18n.changeLanguage(preferredLang);
            localStorage.setItem('preferred_language', preferredLang);
            initializedRef.current = true;
            return;
          }
        } catch (error) {
          console.error('Error fetching user language preference:', error);
        }
      }

      // Fall back to tenant default language (cast for new column)
      const tenantDefaultLang = (tenant as any)?.default_language;
      if (tenantDefaultLang && SUPPORTED_LANGUAGES.includes(tenantDefaultLang as SupportedLanguage)) {
        i18n.changeLanguage(tenantDefaultLang);
        localStorage.setItem('preferred_language', tenantDefaultLang);
        initializedRef.current = true;
        return;
      }

      // Default to French if nothing else is set
      const currentLang = i18n.language?.split('-')[0];
      if (!currentLang || !SUPPORTED_LANGUAGES.includes(currentLang as SupportedLanguage)) {
        i18n.changeLanguage('fr');
      }
      initializedRef.current = true;
    };

    initializeLanguage();
  }, [user?.id, tenant?.id]); // Only depend on IDs, not full objects

  const setLanguage = async (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('preferred_language', lang);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_language: lang } as any)
          .eq('id', user.id);
      } catch (error) {
        console.error('Error saving language preference:', error);
      }
    }
  };

  const currentLang = (i18n.language?.split('-')[0] || 'fr') as SupportedLanguage;
  const displayLang = SUPPORTED_LANGUAGES.includes(currentLang) ? currentLang : 'fr';

  return {
    currentLanguage: displayLang,
    setLanguage,
    t: i18n.t,
  };
}

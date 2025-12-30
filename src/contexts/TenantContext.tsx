import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: string;
  branding?: {
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    display_name: string | null;
  };
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  isLoading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  tenantId: null,
  isLoading: true,
  error: null,
});

export const useTenant = () => useContext(TenantContext);

/**
 * Extracts tenant slug from the current URL
 * Supports:
 * - Subdomains: advisy.lyta.ch → "advisy"
 * - Query param for dev: ?tenant=advisy → "advisy"
 * - localhost with query param: localhost:8080?tenant=advisy → "advisy"
 */
function getTenantSlugFromUrl(): string | null {
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);
  
  // 1. Check query param first (for development/testing)
  const tenantParam = searchParams.get('tenant');
  if (tenantParam) {
    return tenantParam;
  }
  
  // 2. Check subdomain
  // Skip for localhost, lovable preview domains, and IP addresses
  if (
    hostname === 'localhost' ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovableproject.com') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }
  
  // Extract subdomain from hostname like "advisy.lyta.ch"
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Ignore common subdomains
    if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  return null;
}

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      const slug = getTenantSlugFromUrl();
      
      // No subdomain detected - this is the main platform
      if (!slug) {
        setIsLoading(false);
        return;
      }

      try {
        // Use RPC function to fetch tenant branding (works without authentication)
        const { data: brandingData, error: brandingError } = await supabase
          .rpc('get_tenant_branding_by_slug', { p_slug: slug });

        if (brandingError) {
          console.error('Error fetching tenant branding:', brandingError);
          setError('Erreur lors du chargement du cabinet');
          setIsLoading(false);
          return;
        }

        // RPC returns an array, get first result
        const tenantBranding = Array.isArray(brandingData) ? brandingData[0] : brandingData;

        if (!tenantBranding || !tenantBranding.tenant_id) {
          setError(`Cabinet "${slug}" non trouvé`);
          setIsLoading(false);
          return;
        }

        if (tenantBranding.tenant_status === 'suspended') {
          setError('Ce cabinet est actuellement suspendu');
          setIsLoading(false);
          return;
        }

        console.log('Tenant branding loaded:', { 
          slug, 
          tenantBranding,
          logo_url: tenantBranding.logo_url 
        });

        const formattedTenant: Tenant = {
          id: tenantBranding.tenant_id,
          name: tenantBranding.tenant_name,
          slug: slug,
          email: '', // Not needed for branding display
          status: tenantBranding.tenant_status,
          branding: {
            logo_url: tenantBranding.logo_url || null,
            primary_color: tenantBranding.primary_color || null,
            secondary_color: tenantBranding.secondary_color || null,
            display_name: tenantBranding.display_name || null,
          },
        };

        setTenant(formattedTenant);
        
        // Apply tenant branding to CSS variables
        if (formattedTenant.branding?.primary_color) {
          document.documentElement.style.setProperty(
            '--tenant-primary', 
            formattedTenant.branding.primary_color
          );
        }
        if (formattedTenant.branding?.secondary_color) {
          document.documentElement.style.setProperty(
            '--tenant-secondary', 
            formattedTenant.branding.secondary_color
          );
        }

      } catch (err) {
        console.error('Error in tenant loading:', err);
        setError('Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ 
      tenant, 
      tenantId: tenant?.id || null, 
      isLoading, 
      error 
    }}>
      {children}
    </TenantContext.Provider>
  );
}

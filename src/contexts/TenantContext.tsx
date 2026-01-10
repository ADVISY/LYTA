import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TenantPlan, isModuleEnabled } from "@/config/plans";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: string;
  plan?: TenantPlan;
  planStatus?: 'active' | 'suspended';
  billingStatus?: 'paid' | 'trial' | 'past_due' | 'canceled';
  seatsIncluded?: number;
  seatsPrice?: number;
  branding?: {
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    display_name: string | null;
    company_address?: string | null;
    company_phone?: string | null;
    company_email?: string | null;
    company_website?: string | null;
  };
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  isLoading: boolean;
  error: string | null;
  hasClientPortal: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  tenantId: null,
  isLoading: true,
  error: null,
  hasClientPortal: false,
});

export const useTenant = () => useContext(TenantContext);

/**
 * Converts hex color to HSL string for CSS variables
 */
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

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
          plan: (tenantBranding.tenant_plan as TenantPlan) || 'start',
          branding: {
            logo_url: tenantBranding.logo_url || null,
            primary_color: tenantBranding.primary_color || null,
            secondary_color: tenantBranding.secondary_color || null,
            display_name: tenantBranding.display_name || null,
            company_address: tenantBranding.company_address || null,
            company_phone: tenantBranding.company_phone || null,
            company_email: tenantBranding.company_email || null,
            company_website: tenantBranding.company_website || null,
          },
        };

        // Update page title dynamically based on tenant
        const displayName = formattedTenant.branding?.display_name || formattedTenant.name;
        document.title = `${displayName} - CRM Assurances`;

        setTenant(formattedTenant);
        
        // Update favicon dynamically based on tenant logo
        // Force browser to refresh favicon by removing ALL existing favicons
        const allFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        allFavicons.forEach(favicon => favicon.remove());
        
        const newFavicon = document.createElement('link');
        newFavicon.id = 'dynamic-favicon';
        newFavicon.rel = 'icon';
        
        if (formattedTenant.branding?.logo_url) {
          // Use tenant logo with cache-busting timestamp
          const logoUrl = formattedTenant.branding.logo_url;
          const separator = logoUrl.includes('?') ? '&' : '?';
          newFavicon.href = `${logoUrl}${separator}v=${Date.now()}`;
          
          // Detect type based on URL extension
          if (logoUrl.toLowerCase().includes('.png')) {
            newFavicon.type = 'image/png';
          } else if (logoUrl.toLowerCase().includes('.svg')) {
            newFavicon.type = 'image/svg+xml';
          } else if (logoUrl.toLowerCase().includes('.ico')) {
            newFavicon.type = 'image/x-icon';
          } else {
            newFavicon.type = 'image/png';
          }
        } else {
          // No tenant logo - use default LYTA favicon
          newFavicon.href = `/favicon.png?v=${Date.now()}`;
          newFavicon.type = 'image/png';
        }
        
        document.head.appendChild(newFavicon);
        
        // Log for debugging
        console.log('Favicon updated:', newFavicon.href.substring(0, 100));
        
        // Apply tenant branding to CSS variables (convert hex to HSL for Tailwind)
        if (formattedTenant.branding?.primary_color) {
          const primaryHsl = hexToHsl(formattedTenant.branding.primary_color);
          document.documentElement.style.setProperty('--primary', primaryHsl);
          document.documentElement.style.setProperty('--primary-light', primaryHsl);
          document.documentElement.style.setProperty('--ring', primaryHsl);
          document.documentElement.style.setProperty('--crm-sidebar-active', primaryHsl);
          
          // Also set accent based on primary
          document.documentElement.style.setProperty('--accent-foreground', primaryHsl);
        }
        
        if (formattedTenant.branding?.secondary_color) {
          const secondaryHsl = hexToHsl(formattedTenant.branding.secondary_color);
          document.documentElement.style.setProperty('--secondary', secondaryHsl);
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

  // Check if tenant has client portal module
  const hasClientPortal = tenant?.plan ? isModuleEnabled(tenant.plan, 'client_portal') : false;

  return (
    <TenantContext.Provider value={{ 
      tenant, 
      tenantId: tenant?.id || null, 
      isLoading, 
      error,
      hasClientPortal
    }}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Plan configuration - Source of truth for feature gating
 * Maps plans to enabled modules
 */

export type TenantPlan = 'start' | 'pro' | 'prime' | 'founder';

export type PlanModule = 
  | 'clients'
  | 'contracts'
  | 'commissions'
  | 'statements'
  | 'membership'
  | 'payroll'
  | 'emailing'
  | 'automation'
  | 'mandate_automation'
  | 'client_portal'
  | 'advanced_dashboard'
  | 'advanced_settings'
  | 'qr_invoice'
  | 'ia_scan';

export interface PlanConfig {
  name: string;
  displayName: string;
  modules: PlanModule[];
  description: string;
  monthlyPrice: number;
  seatsIncluded: number;
  extraSeatPrice: number;
  stripeProductId: string;
  stripePriceId: string;
}

/**
 * Plan definitions with included modules
 */
export const PLAN_CONFIGS: Record<TenantPlan, PlanConfig> = {
  start: {
    name: 'start',
    displayName: 'Start',
    description: 'Pour démarrer',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership'],
    monthlyPrice: 69,
    seatsIncluded: 1,
    extraSeatPrice: 20,
    stripeProductId: 'prod_TjgUGx2FNdlhas',
    stripePriceId: 'price_1SmDBeF7ZITS358AgETS41f5',
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Pour les cabinets établis',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership', 'payroll', 'emailing', 'advanced_dashboard'],
    monthlyPrice: 150,
    seatsIncluded: 1,
    extraSeatPrice: 20,
    stripeProductId: 'prod_TjgmLXohud7WAb',
    stripePriceId: 'price_1SmDSmF7ZITS358AmnGzuosw',
  },
  prime: {
    name: 'prime',
    displayName: 'Prime',
    description: 'L\'expérience complète',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership', 'payroll', 'emailing', 'automation', 'mandate_automation', 'client_portal', 'advanced_dashboard', 'advanced_settings', 'qr_invoice', 'ia_scan'],
    monthlyPrice: 250,
    seatsIncluded: 1,
    extraSeatPrice: 20,
    stripeProductId: 'prod_TjgrBLxInrbnSd',
    stripePriceId: 'price_1SmDU7F7ZITS358ARd44a4sb',
  },
  founder: {
    name: 'founder',
    displayName: 'Prime Founder',
    description: 'Offre de lancement 6 mois',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership', 'payroll', 'emailing', 'automation', 'mandate_automation', 'client_portal', 'advanced_dashboard', 'advanced_settings', 'qr_invoice', 'ia_scan'],
    monthlyPrice: 150,
    seatsIncluded: 1,
    extraSeatPrice: 20,
    stripeProductId: 'prod_Tk0TPGFCuYQu3Q',
    stripePriceId: 'price_1SmWSCF7ZITS358Au8LylsBw',
  },
};

/**
 * Module display names for UI (fallback values - prefer translated keys)
 * These are fallback values used when translations are not available
 */
export const MODULE_DISPLAY_NAMES: Record<PlanModule, string> = {
  clients: 'Gestion des clients',
  contracts: 'Gestion des contrats',
  commissions: 'Commissions',
  statements: 'Décomptes',
  membership: 'Adhésions',
  payroll: 'Masse salariale',
  emailing: 'Emailing & Campagnes',
  automation: 'Automatisations',
  mandate_automation: 'Automation mandats',
  client_portal: 'Espace client',
  advanced_dashboard: 'Dashboard avancé',
  advanced_settings: 'Paramètres avancés',
  qr_invoice: 'Factures QR',
  ia_scan: 'IA Scan Documents',
};

/**
 * Translation keys for modules - to be used with i18n t() function
 */
export const MODULE_TRANSLATION_KEYS: Record<PlanModule, string> = {
  clients: 'planModules.clientManagement',
  contracts: 'planModules.contractManagement',
  commissions: 'planModules.commissions',
  statements: 'planModules.statements',
  membership: 'planModules.memberships',
  payroll: 'planModules.payroll',
  emailing: 'planModules.emailCampaigns',
  automation: 'planModules.automations',
  mandate_automation: 'planModules.mandateAutomation',
  client_portal: 'planModules.clientPortal',
  advanced_dashboard: 'dashboard.title',
  advanced_settings: 'settings.title',
  qr_invoice: 'planModules.qrInvoices',
  ia_scan: 'planModules.iaScan',
};

/**
 * Module icons (lucide icon names)
 */
export const MODULE_ICONS: Record<PlanModule, string> = {
  clients: 'Users',
  contracts: 'FileCheck',
  commissions: 'DollarSign',
  statements: 'FileText',
  membership: 'UserPlus',
  payroll: 'Wallet',
  emailing: 'Mail',
  automation: 'Zap',
  mandate_automation: 'FileSignature',
  client_portal: 'Globe',
  advanced_dashboard: 'LayoutDashboard',
  advanced_settings: 'Settings',
  qr_invoice: 'QrCode',
  ia_scan: 'Sparkles',
};

/**
 * Get enabled modules for a plan
 */
export function getEnabledModules(plan: TenantPlan): PlanModule[] {
  return PLAN_CONFIGS[plan]?.modules || PLAN_CONFIGS.start.modules;
}

/**
 * Check if a module is enabled for a plan
 */
export function isModuleEnabled(plan: TenantPlan, module: PlanModule): boolean {
  const enabledModules = getEnabledModules(plan);
  return enabledModules.includes(module);
}

/**
 * Get all available plans in order
 */
export function getPlansInOrder(): TenantPlan[] {
  return ['start', 'pro', 'prime', 'founder'];
}

/**
 * Get plan upgrade path
 */
export function getUpgradePath(currentPlan: TenantPlan): TenantPlan | null {
  const plans = getPlansInOrder();
  const currentIndex = plans.indexOf(currentPlan);
  if (currentIndex < plans.length - 1) {
    return plans[currentIndex + 1];
  }
  return null;
}

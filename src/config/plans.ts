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
  | 'client_portal';

export interface PlanConfig {
  name: string;
  displayName: string;
  modules: PlanModule[];
  description: string;
}

/**
 * Plan definitions with included modules
 */
export const PLAN_CONFIGS: Record<TenantPlan, PlanConfig> = {
  start: {
    name: 'start',
    displayName: 'Start',
    description: 'Essentiel pour démarrer',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership'],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Pour les équipes en croissance',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership', 'payroll', 'emailing'],
  },
  prime: {
    name: 'prime',
    displayName: 'Prime',
    description: 'Automatisation complète',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership', 'payroll', 'emailing', 'automation', 'mandate_automation', 'client_portal'],
  },
  founder: {
    name: 'founder',
    displayName: 'Founder',
    description: 'Accès complet - Early adopter',
    modules: ['clients', 'contracts', 'commissions', 'statements', 'membership', 'payroll', 'emailing', 'automation', 'mandate_automation', 'client_portal'],
  },
};

/**
 * Module display names for UI
 */
export const MODULE_DISPLAY_NAMES: Record<PlanModule, string> = {
  clients: 'Gestion des clients',
  contracts: 'Gestion des contrats',
  commissions: 'Commissions',
  statements: 'Relevés & Décomptes',
  membership: 'Adhésions',
  payroll: 'Masse salariale',
  emailing: 'Emailing & Campagnes',
  automation: 'Automatisations',
  mandate_automation: 'Automation mandats',
  client_portal: 'Portail client',
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

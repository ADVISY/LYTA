import { useMemo } from "react";
import { useClients } from "./useClients";
import { usePolicies } from "./usePolicies";
import { useCommissions } from "./useCommissions";
import { useCommissionParts } from "./useCommissionParts";
import { useAgents } from "./useAgents";
import { useAuth } from "./useAuth";

export interface PerformanceData {
  id: string;
  name: string;
  role: 'agent' | 'manager';
  managerId: string | null;
  clientsCount: number;
  contractsCount: number;
  contractsActive: number;
  contractsPending: number;
  totalPremiumsMonthly: number;
  totalPremiumsYearly: number;
  totalCommissions: number;
  paidCommissions: number;
  pendingCommissions: number;
  conversionRate: number; // % of prospects converted to active
}

export interface TeamPerformance {
  managerId: string;
  managerName: string;
  teamMembers: PerformanceData[];
  totals: {
    clientsCount: number;
    contractsCount: number;
    totalPremiumsMonthly: number;
    totalCommissions: number;
  };
}

export function usePerformance() {
  const { user } = useAuth();
  const { clients, loading: clientsLoading } = useClients();
  const { policies, loading: policiesLoading } = usePolicies();
  const { commissions, loading: commissionsLoading } = useCommissions();
  const { agents, loading: agentsLoading } = useAgents();

  const loading = clientsLoading || policiesLoading || commissionsLoading || agentsLoading;

  // Get all collaborators (agents + managers)
  const collaborators = useMemo(() => {
    return clients.filter(c => c.type_adresse === 'collaborateur');
  }, [clients]);

  // Get client-type entries only
  const clientEntries = useMemo(() => {
    return clients.filter(c => c.type_adresse === 'client');
  }, [clients]);

  // Calculate performance for each collaborator
  const individualPerformance = useMemo(() => {
    return collaborators.map(collab => {
      // Clients assigned to this collaborator
      const assignedClients = clientEntries.filter(c => c.assigned_agent_id === collab.id);
      const activeClients = assignedClients.filter(c => c.status === 'actif');
      const prospects = assignedClients.filter(c => c.status === 'prospect');
      
      // Policies for assigned clients
      const clientIds = assignedClients.map(c => c.id);
      const assignedPolicies = policies.filter(p => clientIds.includes(p.client_id));
      const activePolicies = assignedPolicies.filter(p => p.status === 'active');
      const pendingPolicies = assignedPolicies.filter(p => p.status === 'pending');
      
      // Calculate premiums
      const totalPremiumsMonthly = assignedPolicies.reduce((sum, p) => sum + (p.premium_monthly || 0), 0);
      const totalPremiumsYearly = assignedPolicies.reduce((sum, p) => sum + (p.premium_yearly || 0), 0);
      
      // Commissions for this collaborator's policies
      const policyIds = assignedPolicies.map(p => p.id);
      const collabCommissions = commissions.filter(c => policyIds.includes(c.policy_id));
      const totalCommissions = collabCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
      const paidCommissions = collabCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
      const pendingCommissions = collabCommissions.filter(c => c.status !== 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
      
      // Conversion rate
      const conversionRate = (prospects.length + activeClients.length) > 0 
        ? (activeClients.length / (prospects.length + activeClients.length)) * 100 
        : 0;

      const isManager = collaborators.some(c => c.manager_id === collab.id);

      return {
        id: collab.id,
        name: `${collab.first_name || ''} ${collab.last_name || ''}`.trim() || 'Sans nom',
        role: isManager ? 'manager' : 'agent',
        managerId: collab.manager_id,
        clientsCount: assignedClients.length,
        contractsCount: assignedPolicies.length,
        contractsActive: activePolicies.length,
        contractsPending: pendingPolicies.length,
        totalPremiumsMonthly,
        totalPremiumsYearly,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
        conversionRate: Math.round(conversionRate),
      } as PerformanceData;
    });
  }, [collaborators, clientEntries, policies, commissions]);

  // Group by teams (by manager)
  const teamPerformance = useMemo(() => {
    const managers = collaborators.filter(c => 
      collaborators.some(other => other.manager_id === c.id)
    );

    return managers.map(manager => {
      const teamMembers = individualPerformance.filter(p => p.managerId === manager.id);
      const managerPerf = individualPerformance.find(p => p.id === manager.id);
      
      // Include manager's own performance in team totals
      const allTeamPerf = managerPerf ? [managerPerf, ...teamMembers] : teamMembers;

      return {
        managerId: manager.id,
        managerName: `${manager.first_name || ''} ${manager.last_name || ''}`.trim() || 'Sans nom',
        teamMembers,
        totals: {
          clientsCount: allTeamPerf.reduce((sum, p) => sum + p.clientsCount, 0),
          contractsCount: allTeamPerf.reduce((sum, p) => sum + p.contractsCount, 0),
          totalPremiumsMonthly: allTeamPerf.reduce((sum, p) => sum + p.totalPremiumsMonthly, 0),
          totalCommissions: allTeamPerf.reduce((sum, p) => sum + p.totalCommissions, 0),
        },
      } as TeamPerformance;
    });
  }, [collaborators, individualPerformance]);

  // Company-wide totals
  const companyTotals = useMemo(() => {
    return {
      clientsCount: clientEntries.length,
      activeClients: clientEntries.filter(c => c.status === 'actif').length,
      contractsCount: policies.length,
      activeContracts: policies.filter(p => p.status === 'active').length,
      pendingContracts: policies.filter(p => p.status === 'pending').length,
      totalPremiumsMonthly: policies.reduce((sum, p) => sum + (p.premium_monthly || 0), 0),
      totalPremiumsYearly: policies.reduce((sum, p) => sum + (p.premium_yearly || 0), 0),
      totalCommissions: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
      paidCommissions: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0),
      pendingCommissions: commissions.filter(c => c.status !== 'paid').reduce((sum, c) => sum + (c.amount || 0), 0),
      collaboratorsCount: collaborators.length,
    };
  }, [clientEntries, policies, commissions, collaborators]);

  // Get current user's performance (if they are a collaborator)
  const myPerformance = useMemo(() => {
    if (!user) return null;
    
    // Find collaborator linked to current user
    const myCollab = collaborators.find(c => c.user_id === user.id);
    if (!myCollab) return null;
    
    return individualPerformance.find(p => p.id === myCollab.id) || null;
  }, [user, collaborators, individualPerformance]);

  // Get my team (if I'm a manager)
  const myTeam = useMemo(() => {
    if (!user) return null;
    
    const myCollab = collaborators.find(c => c.user_id === user.id);
    if (!myCollab) return null;
    
    return teamPerformance.find(t => t.managerId === myCollab.id) || null;
  }, [user, collaborators, teamPerformance]);

  return {
    loading,
    individualPerformance,
    teamPerformance,
    companyTotals,
    myPerformance,
    myTeam,
    collaborators,
  };
}

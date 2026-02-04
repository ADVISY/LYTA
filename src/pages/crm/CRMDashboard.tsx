import { useUserRole } from "@/hooks/useUserRole";
import { useClients } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { usePerformance } from "@/hooks/usePerformance";
import { useCommissionParts } from "@/hooks/useCommissionParts";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingScans } from "@/hooks/usePendingScans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, FileText, DollarSign, TrendingUp, 
  Loader2, BarChart3, Heart, Shield,
  Trophy, Star, Crown, Target, Zap, Award,
  Calendar, Filter, Bell, Medal, Flame,
  CheckCircle, Clock, AlertCircle, ChevronRight, RefreshCw, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type PeriodFilter = 'all' | 'week' | 'month' | 'quarter' | 'year';
type ChartViewMode = 'prime' | 'ca_estime' | 'ca_realise';

// Auto-refresh interval in milliseconds (60 seconds)
const AUTO_REFRESH_INTERVAL = 60000;

export default function CRMDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, isAdmin, isManager, isAgent, isPartner, isClient } = useUserRole();
  const { can, dashboardScope, commissionScope, isLoading: permissionsLoading } = usePermissions();
  const { clients, loading: clientsLoading, fetchClients } = useClients();
  const { policies, loading: policiesLoading, fetchPolicies } = usePolicies();
  const { commissions, loading: commissionsLoading, fetchCommissions } = useCommissions();
  const { loading: performanceLoading, companyTotals, myPerformance, myTeam, individualPerformance, teamPerformance } = usePerformance();
  const { fetchAllParts, fetchPartsForAgent } = useCommissionParts();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { scans: pendingScans } = usePendingScans();
  const pendingScanCount = pendingScans.filter(s => s.status === 'completed' || s.status === 'processing').length;

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('prime');
  const [allCommissionParts, setAllCommissionParts] = useState<any[]>([]);
  const [myCommissionParts, setMyCommissionParts] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  
  // Auto-refresh ref
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        fetchClients(),
        fetchPolicies(),
        fetchCommissions(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [fetchClients, fetchPolicies, fetchCommissions]);

  // Setup auto-refresh - use refs to avoid dependency issues
  const fetchClientsRef = useRef(fetchClients);
  const fetchPoliciesRef = useRef(fetchPolicies);
  const fetchCommissionsRef = useRef(fetchCommissions);
  
  // Keep refs updated
  useEffect(() => {
    fetchClientsRef.current = fetchClients;
    fetchPoliciesRef.current = fetchPolicies;
    fetchCommissionsRef.current = fetchCommissions;
  });
  
  // Setup auto-refresh with stable interval
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      // Silent background refresh (no loading indicator)
      Promise.all([
        fetchClientsRef.current(),
        fetchPoliciesRef.current(),
        fetchCommissionsRef.current(),
      ]).catch(console.error);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []); // Empty deps - interval set once on mount
  // Get current user's collaborator record
  const myCollaborator = useMemo(() => {
    if (!user) return null;
    return clients.find(c => c.user_id === user.id && c.type_adresse === 'collaborateur');
  }, [clients, user]);

  // Fetch commission parts based on role
  useEffect(() => {
    const loadParts = async () => {
      setPartsLoading(true);
      
      if (dashboardScope === 'global' || commissionScope === 'all') {
        const parts = await fetchAllParts();
        setAllCommissionParts(parts);
        setMyCommissionParts(parts);
      } else if (myCollaborator) {
        const parts = await fetchPartsForAgent(myCollaborator.id);
        setMyCommissionParts(parts);
        
        if (dashboardScope === 'team' && myTeam) {
          const teamParts = [...parts];
          for (const member of myTeam.teamMembers) {
            const memberParts = await fetchPartsForAgent(member.id);
            teamParts.push(...memberParts);
          }
          setAllCommissionParts(teamParts);
        } else {
          setAllCommissionParts(parts);
        }
      }
      
      setPartsLoading(false);
    };
    
    if (!clientsLoading && !permissionsLoading) {
      loadParts();
    }
  }, [dashboardScope, commissionScope, myCollaborator, myTeam, clientsLoading, permissionsLoading]);

  const loading = clientsLoading || policiesLoading || commissionsLoading || performanceLoading || partsLoading || permissionsLoading;

  // Period date range - with proper time boundaries
  const periodRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'all':
        // Very old date to now - includes everything
        return { 
          start: new Date(2000, 0, 1), 
          end: new Date(2100, 11, 31, 23, 59, 59, 999) 
        };
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        monthEnd.setHours(23, 59, 59, 999);
        return { start: monthStart, end: monthEnd };
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999);
        return { start: quarterStart, end: quarterEnd };
      case 'year':
        return { 
          start: new Date(now.getFullYear(), 0, 1), 
          end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) 
        };
      default:
        const defaultStart = startOfMonth(now);
        const defaultEnd = endOfMonth(now);
        defaultEnd.setHours(23, 59, 59, 999);
        return { start: defaultStart, end: defaultEnd };
    }
  }, [periodFilter]);

  // Filter policies based on scope and filters
  const filteredPolicies = useMemo(() => {
    let filtered = policies;

    if (dashboardScope === 'personal' && myCollaborator) {
      const myClientIds = clients.filter(c => c.assigned_agent_id === myCollaborator.id).map(c => c.id);
      filtered = filtered.filter(p => myClientIds.includes(p.client_id));
    } else if (dashboardScope === 'team' && myTeam) {
      const teamMemberIds = [myCollaborator?.id, ...myTeam.teamMembers.map(m => m.id)].filter(Boolean);
      const teamClientIds = clients.filter(c => teamMemberIds.includes(c.assigned_agent_id)).map(c => c.id);
      filtered = filtered.filter(p => teamClientIds.includes(p.client_id));
    }

    if (agentFilter !== 'all') {
      const agentClientIds = clients.filter(c => c.assigned_agent_id === agentFilter).map(c => c.id);
      filtered = filtered.filter(p => agentClientIds.includes(p.client_id));
    }

    if (productFilter !== 'all') {
      filtered = filtered.filter(p => {
        const type = (p.product_type || '').toLowerCase();
        if (productFilter === 'lca') {
          return type.includes('lamal') || type.includes('lca') || type.includes('maladie') || 
                 type.includes('complémentaire') || type.includes('complementaire') || 
                 type.includes('health') || type.includes('multi');
        }
        if (productFilter === 'vie') {
          return type.includes('vie') || type.includes('life') || type.includes('pilier') || type.includes('3a') || type.includes('3b');
        }
        return true;
      });
    }

    return filtered;
  }, [policies, dashboardScope, myCollaborator, myTeam, clients, agentFilter, productFilter]);

  // Period filtered policies
  const periodPolicies = useMemo(() => {
    return filteredPolicies.filter(p => {
      const date = new Date(p.created_at);
      return isWithinInterval(date, periodRange);
    });
  }, [filteredPolicies, periodRange]);

  // Calculate commission from real commissions data (coherent with CRM)
  const realCommissions = useMemo(() => {
    const periodCommissions = commissions.filter(c => {
      const date = new Date(c.created_at);
      return isWithinInterval(date, periodRange);
    });

    const totalAmount = periodCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const paidAmount = periodCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingAmount = periodCommissions.filter(c => c.status !== 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);

    return { total: totalAmount, paid: paidAmount, pending: pendingAmount, count: periodCommissions.length };
  }, [commissions, periodRange]);

  // Helper function to determine product category for CA calculation
  // Analyzes both product_type and products_data for multi-product contracts
  const getPolicyCategory = (p: any): 'lca' | 'vie' | 'non_vie' | 'hypo' => {
    const type = (p.product_type || '').toLowerCase();
    
    // Direct VIE detection
    if (type.includes('vie') || type.includes('life') || type.includes('pilier') || type.includes('3a') || type.includes('3b')) {
      return 'vie';
    }
    
    // Direct health detection
    if (type.includes('health') || type.includes('lamal') || type.includes('lca') || type.includes('maladie') || 
        type.includes('complémentaire') || type.includes('complementaire')) {
      return 'lca';
    }
    
    // For 'multi' contracts, analyze products_data to determine category
    if (type === 'multi' && p.products_data && Array.isArray(p.products_data) && p.products_data.length > 0) {
      const categories = p.products_data.map((prod: any) => (prod.category || '').toLowerCase());
      
      // Check if any product is health/LCA
      const hasHealth = categories.some((cat: string) => 
        cat === 'health' || cat.includes('lamal') || cat.includes('lca') || 
        cat.includes('santé') || cat.includes('sante') || cat.includes('maladie')
      );
      if (hasHealth) return 'lca';
      
      // Check if any product is VIE
      const hasVie = categories.some((cat: string) => 
        cat === 'life' || cat.includes('vie') || cat.includes('pilier') || 
        cat.includes('3a') || cat.includes('3b') || cat.includes('prévoyance')
      );
      if (hasVie) return 'vie';
    }
    
    // HYPO detection
    if (type.includes('hypo') || type.includes('hypothécaire') || type.includes('hypothecaire')) {
      return 'hypo';
    }
    
    // Default to non_vie for other products (home, auto, legal, etc.)
    return 'non_vie';
  };

  // Calculate CA using real commissions from database - ONLY ACTIVE CONTRACTS
  // LCA: monthly_premium * 16, VIE: use actual commission amounts from DB
  const calculateCA = useMemo(() => {
    let lcaTotal = 0;
    let vieTotal = 0;
    let nonVieTotal = 0;
    let hypoTotal = 0;

    // Only include active contracts for CA calculation
    const activePeriodPolicies = periodPolicies.filter(p => p.status === 'active');

    activePeriodPolicies.forEach(p => {
      const category = getPolicyCategory(p);
      const monthlyPremium = p.premium_monthly || (p.premium_yearly || 0) / 12;

      // VIE/Life products - use real commission from commissions table
      if (category === 'vie') {
        const policyCommission = commissions.find(c => c.policy_id === p.id);
        if (policyCommission) {
          vieTotal += policyCommission.amount || 0;
        }
      } else if (category === 'lca') {
        // LCA/Health products: monthly premium * 16
        lcaTotal += monthlyPremium * 16;
      } else if (category === 'hypo') {
        hypoTotal += monthlyPremium * 16;
      } else {
        // NON-VIE products (home, auto, legal, etc.)
        nonVieTotal += monthlyPremium * 16;
      }
    });

    return { lca: lcaTotal, vie: vieTotal, nonVie: nonVieTotal, hypo: hypoTotal, total: lcaTotal + vieTotal + nonVieTotal + hypoTotal };
  }, [periodPolicies, commissions]);

  // Calculate CA estimé (from ALL active contracts) - this is the automatic estimated turnover
  const calculateCAEstime = useMemo(() => {
    const activePolices = filteredPolicies.filter(p => p.status === 'active');
    let lcaTotal = 0;
    let vieTotal = 0;
    let nonVieTotal = 0;
    let hypoTotal = 0;

    activePolices.forEach(p => {
      const category = getPolicyCategory(p);
      const monthlyPremium = p.premium_monthly || (p.premium_yearly || 0) / 12;
      const yearlyPremium = p.premium_yearly || monthlyPremium * 12;

      if (category === 'vie') {
        // VIE: use commission if available, otherwise estimate 5% of yearly premium
        const policyCommission = commissions.find(c => c.policy_id === p.id);
        vieTotal += policyCommission?.amount || (yearlyPremium * 0.05);
      } else if (category === 'lca') {
        // LCA/Health: monthly * 16 formula
        lcaTotal += monthlyPremium * 16;
      } else if (category === 'hypo') {
        // HYPO: 1% of yearly
        hypoTotal += yearlyPremium * 0.01;
      } else {
        // NON-VIE: 15% of yearly
        nonVieTotal += yearlyPremium * 0.15;
      }
    });

    return { lca: lcaTotal, vie: vieTotal, nonVie: nonVieTotal, hypo: hypoTotal, total: lcaTotal + vieTotal + nonVieTotal + hypoTotal };
  }, [filteredPolicies, commissions]);

  // Calculate CA réalisé (CA en vigueur) = ONLY paid commissions - this is actual realized turnover
  const calculateCARealise = useMemo(() => {
    const paidCommissions = commissions.filter(c => c.status === 'paid');
    let lcaTotal = 0;
    let vieTotal = 0;
    let nonVieTotal = 0;
    let hypoTotal = 0;

    paidCommissions.forEach(c => {
      // Find the policy to determine category
      const policy = filteredPolicies.find(p => p.id === c.policy_id);
      if (!policy) return;

      const category = getPolicyCategory(policy);
      const amount = Number(c.amount || 0);

      if (category === 'vie') {
        vieTotal += amount;
      } else if (category === 'lca') {
        lcaTotal += amount;
      } else if (category === 'hypo') {
        hypoTotal += amount;
      } else {
        nonVieTotal += amount;
      }
    });

    return { lca: lcaTotal, vie: vieTotal, nonVie: nonVieTotal, hypo: hypoTotal, total: lcaTotal + vieTotal + nonVieTotal + hypoTotal };
  }, [filteredPolicies, commissions]);

  // Backward compatible alias
  const calculateCAEnVigueur = calculateCAEstime;

  // Commissions by period (for display)
  const commissionsByPeriod = useMemo(() => {
    const periodCommissions = commissions.filter(c => {
      const date = new Date(c.created_at);
      return isWithinInterval(date, periodRange);
    });

    // Group by month/year
    const grouped = periodCommissions.reduce((acc, c) => {
      const date = new Date(c.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[key]) {
        acc[key] = { total: 0, paid: 0, pending: 0, count: 0 };
      }
      acc[key].total += c.amount || 0;
      acc[key].count++;
      if (c.status === 'paid') {
        acc[key].paid += c.amount || 0;
      } else {
        acc[key].pending += c.amount || 0;
      }
      return acc;
    }, {} as Record<string, { total: number; paid: number; pending: number; count: number }>);

    return { grouped, list: periodCommissions };
  }, [commissions, periodRange]);

  // KPI Stats - Using real data (only active contracts)
  const kpiStats = useMemo(() => {
    const activeContracts = filteredPolicies.filter(p => p.status === 'active').length;
    // Only count active contracts for period stats
    const activePeriodPolicies = periodPolicies.filter(p => p.status === 'active');
    const periodContracts = activePeriodPolicies.length;
    
    // Count LCA contracts (LAMal, health, multi, complémentaire) - only active
    const lcaContracts = activePeriodPolicies.filter(p => {
      const type = (p.product_type || '').toLowerCase();
      return type.includes('lamal') || type.includes('lca') || type.includes('maladie') || 
             type.includes('complémentaire') || type.includes('complementaire') || 
             type.includes('health') || type.includes('multi');
    }).length;
    
    // Count VIE contracts (life, pilier, 3a, 3b) - only active
    const vieContracts = activePeriodPolicies.filter(p => {
      const type = (p.product_type || '').toLowerCase();
      return type.includes('vie') || type.includes('life') || type.includes('pilier') || 
             type.includes('3a') || type.includes('3b');
    }).length;

    return {
      activeContracts,
      periodContracts,
      lcaContracts,
      vieContracts,
      caEstimated: calculateCA.total,
      caEnVigueur: calculateCAEnVigueur.total,
      totalCommission: realCommissions.total,
      paidCommission: realCommissions.paid,
      pendingCommission: realCommissions.pending,
    };
  }, [filteredPolicies, periodPolicies, calculateCA, calculateCAEnVigueur, realCommissions]);

  // Top performers with real contract counts - Enhanced for podium (only active contracts)
  const topPerformers = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const collaborateurs = clients.filter(c => c.type_adresse === 'collaborateur');
    // Only count active contracts
    const activePolicies = policies.filter(p => p.status === 'active');
    
    const agentScores = collaborateurs.map(agent => {
      const agentClientIds = clients.filter(c => c.assigned_agent_id === agent.id).map(c => c.id);
      const monthContracts = activePolicies.filter(p => {
        const date = new Date(p.start_date);
        return agentClientIds.includes(p.client_id) && 
               date.getMonth() === currentMonth && 
               date.getFullYear() === currentYear;
      }).length;

      // Calculate commission for this agent from real data
      const agentCommissions = commissions.filter(c => {
        const policy = activePolicies.find(p => p.id === c.policy_id);
        if (!policy) return false;
        const client = clients.find(cl => cl.id === policy.client_id);
        return client?.assigned_agent_id === agent.id;
      });
      const totalCommission = agentCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

      return {
        id: agent.id,
        name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Agent',
        photoUrl: (agent as any).photo_url || null,
        monthContracts,
        totalCommission,
        initials: `${(agent.first_name || 'A')[0]}${(agent.last_name || 'G')[0]}`.toUpperCase(),
      };
    }).filter(a => a.monthContracts > 0);

    return agentScores.sort((a, b) => b.monthContracts - a.monthContracts).slice(0, 5);
  }, [clients, policies, commissions]);

  // Employee of the month
  const employeeOfMonth = topPerformers[0] || null;

  // Manager of the month (only active contracts)
  const managerOfMonth = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    // Only count active contracts
    const activePolicies = policies.filter(p => p.status === 'active');

    const managerScores = teamPerformance.map(team => {
      const teamMemberIds = [team.managerId, ...team.teamMembers.map(m => m.id)];
      const teamClientIds = clients.filter(c => teamMemberIds.includes(c.assigned_agent_id)).map(c => c.id);
      const monthContracts = activePolicies.filter(p => {
        const date = new Date(p.start_date);
        return teamClientIds.includes(p.client_id) && 
               date.getMonth() === currentMonth && 
               date.getFullYear() === currentYear;
      }).length;

      const manager = clients.find(c => c.id === team.managerId);

      return {
        name: team.managerName,
        id: team.managerId,
        monthContracts,
        teamSize: team.teamMembers.length,
        photoUrl: (manager as any)?.photo_url || null,
        initials: team.managerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      };
    }).filter(m => m.monthContracts > 0);

    return managerScores.sort((a, b) => b.monthContracts - a.monthContracts)[0] || null;
  }, [teamPerformance, clients, policies]);

  // Get available years from policies (from earliest to current year + 1 for future contracts)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    
    // Add years from all policies (use creation date to reflect entries made this year)
    policies.forEach(p => {
      const year = new Date(p.created_at).getFullYear();
      years.add(year);
    });
    
    // Always include current year
    years.add(currentYear);
    
    // Sort years descending
    return Array.from(years).sort((a, b) => b - a);
  }, [policies]);

  // Monthly chart data - filtered by selected year - STACKED BAR with LCA, VIE, NON-VIE, HYPO
  const monthlyChartData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    // Include all active contracts for the selected year
    const activePolicies = filteredPolicies.filter(p => p.status === 'active');
    const activePoliciesById = new Map(activePolicies.map(p => [p.id, p] as const));

    return months.map((month, i) => {
      // Match contracts for this month in selected year
      const monthPolicies = activePolicies.filter(p => {
        // Use creation date so newly entered contracts impact the current year's performance
        const date = new Date(p.created_at);
        return date.getFullYear() === chartYear && date.getMonth() === i;
      });

      // Real commissions for this month in selected year
      const monthCommissions = commissions.filter(c => {
        const date = new Date((c as any).date || c.created_at);
        return date.getFullYear() === chartYear && date.getMonth() === i;
      });
      const monthPaidCommissions = monthCommissions.filter(c => c.status === 'paid');

      // Initialize values for each product category
      let lcaPrime = 0, viePrime = 0, nonViePrime = 0, hypoPrime = 0;
      let lcaCAEstime = 0, vieCAEstime = 0, nonVieCAEstime = 0, hypoCAEstime = 0;
      let lcaCARealise = 0, vieCARealise = 0, nonVieCARealise = 0, hypoCARealise = 0;

      monthPolicies.forEach(p => {
        const category = getPolicyCategory(p);
        const monthlyPremium = p.premium_monthly || (p.premium_yearly || 0) / 12;
        const yearlyPremium = p.premium_yearly || monthlyPremium * 12;
        
        // Find the commission for this policy
        const policyCommission = commissions.find(c => c.policy_id === p.id);
        const commissionAmount = policyCommission?.amount || 0;

        // Categorize by product type using unified function
        if (category === 'hypo') {
          // HYPO - Hypothèques
          hypoPrime += yearlyPremium;
          hypoCAEstime += yearlyPremium * 0.01; // Estimation 1%
        } else if (category === 'vie') {
          // VIE - Life insurance
          viePrime += yearlyPremium;
          vieCAEstime += commissionAmount || yearlyPremium * 0.05; // Use real or estimate 5%
        } else if (category === 'lca') {
          // LCA - Health insurance (uses monthly * 16 formula)
          lcaPrime += yearlyPremium;
          lcaCAEstime += monthlyPremium * 16; // LCA formula: monthly * 16
        } else {
          // NON-VIE - All other (auto, property, liability, legal, etc.)
          nonViePrime += yearlyPremium;
          nonVieCAEstime += yearlyPremium * 0.15; // Estimation 15%
        }
      });

      // CA réalisé: bucket by commission date (and only paid commissions)
      monthPaidCommissions.forEach(c => {
        const policy = activePoliciesById.get(c.policy_id);
        if (!policy) return;

        const category = getPolicyCategory(policy);
        const amount = Number(c.amount || 0);

        if (category === 'hypo') {
          hypoCARealise += amount;
        } else if (category === 'vie') {
          vieCARealise += amount;
        } else if (category === 'lca') {
          lcaCARealise += amount;
        } else {
          nonVieCARealise += amount;
        }
      });

      // Return data based on chart view mode
      return { 
        month, 
        // Prime values
        lcaPrime: Math.round(lcaPrime),
        viePrime: Math.round(viePrime),
        nonViePrime: Math.round(nonViePrime),
        hypoPrime: Math.round(hypoPrime),
        // CA estimé values
        lcaCAEstime: Math.round(lcaCAEstime),
        vieCAEstime: Math.round(vieCAEstime),
        nonVieCAEstime: Math.round(nonVieCAEstime),
        hypoCAEstime: Math.round(hypoCAEstime),
        // CA réalisé values
        lcaCARealise: Math.round(lcaCARealise),
        vieCARealise: Math.round(vieCARealise),
        nonVieCARealise: Math.round(nonVieCARealise),
        hypoCARealise: Math.round(hypoCARealise),
        // Computed values for display based on mode
        lca: chartViewMode === 'prime' ? Math.round(lcaPrime) : chartViewMode === 'ca_estime' ? Math.round(lcaCAEstime) : Math.round(lcaCARealise),
        vie: chartViewMode === 'prime' ? Math.round(viePrime) : chartViewMode === 'ca_estime' ? Math.round(vieCAEstime) : Math.round(vieCARealise),
        nonVie: chartViewMode === 'prime' ? Math.round(nonViePrime) : chartViewMode === 'ca_estime' ? Math.round(nonVieCAEstime) : Math.round(nonVieCARealise),
        hypo: chartViewMode === 'prime' ? Math.round(hypoPrime) : chartViewMode === 'ca_estime' ? Math.round(hypoCAEstime) : Math.round(hypoCARealise),
        // Total for tooltip
        total: chartViewMode === 'prime' 
          ? Math.round(lcaPrime + viePrime + nonViePrime + hypoPrime)
          : chartViewMode === 'ca_estime'
            ? Math.round(lcaCAEstime + vieCAEstime + nonVieCAEstime + hypoCAEstime)
            : Math.round(lcaCARealise + vieCARealise + nonVieCARealise + hypoCARealise),
      };
    });
  }, [filteredPolicies, commissions, chartYear, chartViewMode]);

  // Custom tooltip for stacked bar chart
  const CustomStackedTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const total = (data?.lca || 0) + (data?.vie || 0) + (data?.nonVie || 0) + (data?.hypo || 0);
      
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-foreground mb-2">{label} {chartYear}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-rose-500">LCA</span>
              <span className="font-medium">{formatCurrency(data?.lca || 0)} CHF</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-500">VIE</span>
              <span className="font-medium">{formatCurrency(data?.vie || 0)} CHF</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-emerald-500">NON-VIE</span>
              <span className="font-medium">{formatCurrency(data?.nonVie || 0)} CHF</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-violet-500">HYPO</span>
              <span className="font-medium">{formatCurrency(data?.hypo || 0)} CHF</span>
            </div>
            <div className="border-t border-border pt-1 mt-1">
              <div className="flex justify-between gap-4 font-semibold">
                <span className="text-foreground">TOTAL</span>
                <span>{formatCurrency(total)} CHF</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value);
  };

  // Get available agents for filter (based on scope)
  const availableAgents = useMemo(() => {
    let agents = clients.filter(c => c.type_adresse === 'collaborateur');
    
    if (dashboardScope === 'team' && myTeam && myCollaborator) {
      const teamIds = [myCollaborator.id, ...myTeam.teamMembers.map(m => m.id)];
      agents = agents.filter(a => teamIds.includes(a.id));
    } else if (dashboardScope === 'personal' && myCollaborator) {
      agents = agents.filter(a => a.id === myCollaborator.id);
    }

    return agents;
  }, [clients, dashboardScope, myTeam, myCollaborator]);

  // Can see financial data?
  const canSeeFinancials = dashboardScope === 'global' || isAdmin;

  const periodLabels: Record<PeriodFilter, string> = {
    all: t('common.all'),
    week: t('dashboard.thisWeek'),
    month: t('dashboard.thisMonth'),
    quarter: t('dashboard.thisQuarter'),
    year: t('dashboard.thisYear'),
  };

  // Recent notifications (last 5)
  const recentNotifications = notifications.slice(0, 5);

  const getNotificationIcon = (kind: string) => {
    switch (kind) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header with Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
              {dashboardScope === 'personal' && ` • ${t('dashboard.globalView').replace('globale', 'personnelle')}`}
              {dashboardScope === 'team' && ` • ${t('dashboard.globalView').replace('globale', 'équipe')}`}
              {dashboardScope === 'global' && ` • ${t('dashboard.globalView')}`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isManualRefreshing}
            className="h-9"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isManualRefreshing && "animate-spin")} />
            {isManualRefreshing ? t('common.loading') : t('common.refresh')}
          </Button>

          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-[140px] h-9">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="week">{t('common.week')}</SelectItem>
              <SelectItem value="month">{t('common.month')}</SelectItem>
              <SelectItem value="quarter">{t('common.quarter')}</SelectItem>
              <SelectItem value="year">{t('common.year')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('dashboard.filterByProduct')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dashboard.allProducts')}</SelectItem>
              <SelectItem value="lca">{t('dashboard.lca')}</SelectItem>
              <SelectItem value="vie">{t('dashboard.vie')}</SelectItem>
            </SelectContent>
          </Select>

          {availableAgents.length > 1 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('dashboard.filterByAgent')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.allAgents')}</SelectItem>
                {availableAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">{t('common.loading')}</span>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Contracts Deposited */}
            <Card className="border shadow-sm bg-gradient-to-br from-violet-500/10 to-violet-600/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.depositedContracts')}</p>
                    <p className="text-3xl font-bold">{kpiStats.periodContracts}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-200">
                        <Heart className="h-3 w-3 mr-1" />
                        LCA: {kpiStats.lcaContracts}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">
                        <Shield className="h-3 w-3 mr-1" />
                        VIE: {kpiStats.vieContracts}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-500/20">
                    <FileText className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Contracts */}
            <Card className="border shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.activeContracts')}</p>
                    <p className="text-3xl font-bold">{kpiStats.activeContracts}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('dashboard.total', { count: filteredPolicies.length })}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <Target className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CA Estimated = Commissions en attente */}
            {(canSeeFinancials || commissionScope !== 'none') && (
              <Card className="border shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-600/5">
                <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.estimatedCA')}</p>
                    <p className="text-3xl font-bold">{formatCurrency(realCommissions.pending)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('commissions.pending')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/20">
                      <DollarSign className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CA en Vigueur = Commissions payées */}
            {(canSeeFinancials || commissionScope !== 'none') && (
              <Card className="border shadow-sm bg-gradient-to-br from-teal-500/10 to-teal-600/5">
                <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.currentCA')}</p>
                    <p className="text-3xl font-bold">{formatCurrency(realCommissions.paid)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('commissions.paid')}
                    </p>
                    </div>
                    <div className="p-3 rounded-xl bg-teal-500/20">
                      <TrendingUp className="h-6 w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pending Scans Widget */}
          {pendingScanCount > 0 && (
            <Card 
              className="border shadow-sm bg-gradient-to-br from-cyan-500/10 to-blue-600/5 cursor-pointer hover:shadow-md transition-all group"
              onClick={() => navigate('/crm/propositions')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.iaScanDeposits')}</p>
                    <p className="text-3xl font-bold">{pendingScanCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('dashboard.pendingScans')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-cyan-500/20 group-hover:scale-110 transition-transform">
                      <Sparkles className="h-6 w-6 text-cyan-600" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Commissions by Period */}
          {commissionScope !== 'none' && commissionsByPeriod.list.length > 0 && (
            <Card className="border shadow-sm bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">{t('dashboard.commissions')}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {commissionsByPeriod.list.length} {t('dashboard.commissions').toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Total */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-200/50">
                    <p className="text-xs text-muted-foreground mb-1">{t('common.total')}</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(realCommissions.total)} CHF</p>
                  </div>
                  {/* Paid */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-200/50">
                    <p className="text-xs text-muted-foreground mb-1">{t('commissions.paid')}</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(realCommissions.paid)} CHF</p>
                  </div>
                  {/* Pending */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-200/50">
                    <p className="text-xs text-muted-foreground mb-1">{t('commissions.pending')}</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(realCommissions.pending)} CHF</p>
                  </div>
                  {/* Count */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-200/50">
                    <p className="text-xs text-muted-foreground mb-1">{t('common.total')}</p>
                    <p className="text-2xl font-bold text-violet-600">{realCommissions.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Real Commissions from database - Compact Card (only if no commissions in period) */}
          {commissionScope !== 'none' && commissionsByPeriod.list.length === 0 && (
            <Card className="border shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-600/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.commissions')}</p>
                    <p className="text-3xl font-bold">{formatCurrency(kpiStats.totalCommission)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-emerald-600">
                        ✓ {formatCurrency(kpiStats.paidCommission)}
                      </span>
                      <span className="text-xs text-amber-600">
                        ~ {formatCurrency(kpiStats.pendingCommission)}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <Zap className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Column - Chart */}
            <div className="space-y-6 lg:col-span-2">
              {/* Combined Chart: Contracts + CA */}
              <Card className="border shadow-sm bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-semibold">{t('dashboard.performance', { year: chartYear })}</CardTitle>
                      <Select value={chartYear.toString()} onValueChange={(v) => setChartYear(parseInt(v))}>
                        <SelectTrigger className="w-[100px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableYears.map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year} {year === new Date().getFullYear() && '(actuel)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                      <button
                        onClick={() => setChartViewMode('prime')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                          chartViewMode === 'prime' 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Prime
                      </button>
                      <button
                        onClick={() => setChartViewMode('ca_estime')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                          chartViewMode === 'ca_estime' 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        CA estimé
                      </button>
                      <button
                        onClick={() => setChartViewMode('ca_realise')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                          chartViewMode === 'ca_realise' 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        CA réalisé (payé)
                      </button>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-rose-500" />
                      <span>LCA</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span>VIE</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-emerald-500" />
                      <span>NON-VIE</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-violet-500" />
                      <span>HYPO</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v) => {
                            if (v >= 1000) {
                              return `${new Intl.NumberFormat('fr-CH').format(v / 1000)}'000`;
                            }
                            return new Intl.NumberFormat('fr-CH').format(v);
                          }}
                        />
                        <Tooltip content={<CustomStackedTooltip />} />
                        <Bar 
                          dataKey="lca" 
                          stackId="stack"
                          fill="hsl(340 82% 52%)"
                          name="LCA"
                        />
                        <Bar 
                          dataKey="vie" 
                          stackId="stack"
                          fill="hsl(217 91% 60%)"
                          name="VIE"
                        />
                        <Bar 
                          dataKey="nonVie" 
                          stackId="stack"
                          fill="hsl(142 76% 36%)"
                          name="NON-VIE"
                        />
                        <Bar 
                          dataKey="hypo" 
                          stackId="stack"
                          fill="hsl(262 83% 58%)"
                          name="HYPO"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Stats - shows TOTALS based on mode */}
                  {canSeeFinancials && (
                    <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t">
                      <div className="text-center p-2.5 rounded-xl bg-rose-500/10">
                        <p className="text-[9px] text-muted-foreground">LCA</p>
                        <p className="text-sm font-bold text-rose-600">
                          {formatCurrency(
                            chartViewMode === 'prime'
                              ? monthlyChartData.reduce((s, m) => s + m.lcaPrime, 0)
                              : chartViewMode === 'ca_estime'
                                ? calculateCAEstime.lca
                                : calculateCARealise.lca
                          )} CHF
                        </p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-blue-500/10">
                        <p className="text-[9px] text-muted-foreground">VIE</p>
                        <p className="text-sm font-bold text-blue-600">
                          {formatCurrency(
                            chartViewMode === 'prime'
                              ? monthlyChartData.reduce((s, m) => s + m.viePrime, 0)
                              : chartViewMode === 'ca_estime'
                                ? calculateCAEstime.vie
                                : calculateCARealise.vie
                          )} CHF
                        </p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-emerald-500/10">
                        <p className="text-[9px] text-muted-foreground">NON-VIE</p>
                        <p className="text-sm font-bold text-emerald-600">
                          {formatCurrency(
                            chartViewMode === 'prime'
                              ? monthlyChartData.reduce((s, m) => s + m.nonViePrime, 0)
                              : chartViewMode === 'ca_estime'
                                ? calculateCAEstime.nonVie
                                : calculateCARealise.nonVie
                          )} CHF
                        </p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-violet-500/10">
                        <p className="text-[9px] text-muted-foreground">HYPO</p>
                        <p className="text-sm font-bold text-violet-600">
                          {formatCurrency(
                            chartViewMode === 'prime'
                              ? monthlyChartData.reduce((s, m) => s + m.hypoPrime, 0)
                              : chartViewMode === 'ca_estime'
                                ? calculateCAEstime.hypo
                                : calculateCARealise.hypo
                          )} CHF
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Motivation Message for Agents */}
              {dashboardScope === 'personal' && myPerformance && (
                <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-primary/20">
                        <Flame className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {kpiStats.periodContracts >= 5 
                            ? "🔥 Excellent travail ce mois !" 
                            : kpiStats.periodContracts >= 3 
                              ? "👍 Bon rythme, continue !"
                              : "💪 C'est parti pour un super mois !"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {kpiStats.periodContracts} contrat{kpiStats.periodContracts > 1 ? 's' : ''} ce mois • 
                          Objectif : 10 contrats • Commission: {formatCurrency(kpiStats.totalCommission)} CHF
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Notifications */}
            <div className="space-y-6">
              {/* Recent Notifications */}
              <Card className="border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-500" />
                      <CardTitle className="text-sm font-semibold">{t('notifications.title')}</CardTitle>
                    </div>
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {recentNotifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('notifications.noNotifications')}
                    </p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {recentNotifications.map(notif => (
                          <div 
                            key={notif.id}
                            className={cn(
                              "flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                              notif.read_at ? "bg-muted/30" : "bg-blue-50 dark:bg-blue-950/20",
                              "hover:bg-muted/50"
                            )}
                            onClick={() => !notif.read_at && markAsRead(notif.id)}
                          >
                            <div className="mt-0.5">
                              {getNotificationIcon(notif.kind)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm truncate",
                                !notif.read_at && "font-medium"
                              )}>
                                {notif.title}
                              </p>
                              {notif.message && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {notif.message}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                              </p>
                            </div>
                            {!notif.read_at && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats (Team view for managers) */}
              {dashboardScope === 'team' && myTeam && (
                <Card className="border shadow-sm bg-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-violet-500" />
                      <CardTitle className="text-sm font-semibold">Mon équipe</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {myTeam.teamMembers.slice(0, 5).map(member => (
                        <div 
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className="text-xs">
                                {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{member.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {member.contractsCount}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Bottom Section - Podium and Employee/Manager of Month */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* PODIUM */}
            <Card className="border shadow-sm bg-card overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-sm font-semibold">Podium du mois</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(), 'MMMM yyyy', { locale: fr })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {topPerformers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Pas encore de données ce mois
                  </p>
                ) : (
                  <>
                    {/* Podium visual */}
                    <div className="flex justify-center items-end gap-4 mb-4 h-[140px]">
                      {/* 2nd place */}
                      {topPerformers[1] && (
                        <div className="flex flex-col items-center">
                          <Avatar className="w-12 h-12 border-2 border-gray-400 mb-1">
                            {topPerformers[1].photoUrl ? (
                              <AvatarImage src={topPerformers[1].photoUrl} />
                            ) : null}
                            <AvatarFallback className="bg-gray-100 text-gray-700 font-bold text-sm">
                              {topPerformers[1].initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="w-20 h-16 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t-lg flex items-center justify-center">
                            <Medal className="h-6 w-6 text-gray-600" />
                          </div>
                          <span className="text-xs font-medium mt-1 truncate max-w-[80px]">
                            {topPerformers[1].name.split(' ')[0]}
                          </span>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">
                            {topPerformers[1].monthContracts} contrats
                          </Badge>
                        </div>
                      )}

                      {/* 1st place */}
                      {topPerformers[0] && (
                        <div className="flex flex-col items-center -mt-4">
                          <div className="relative">
                            <Avatar className="w-14 h-14 border-3 border-amber-400 mb-1">
                              {topPerformers[0].photoUrl ? (
                                <AvatarImage src={topPerformers[0].photoUrl} />
                              ) : null}
                              <AvatarFallback className="bg-amber-100 text-amber-700 font-bold">
                                {topPerformers[0].initials}
                              </AvatarFallback>
                            </Avatar>
                            <Crown className="h-5 w-5 text-amber-500 absolute -top-3 left-1/2 -translate-x-1/2" />
                          </div>
                          <div className="w-20 h-24 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-lg flex items-center justify-center">
                            <Trophy className="h-8 w-8 text-amber-700" />
                          </div>
                          <span className="text-sm font-semibold mt-1 truncate max-w-[90px]">
                            {topPerformers[0].name.split(' ')[0]}
                          </span>
                          <Badge className="text-[10px] mt-0.5 bg-amber-500">
                            {topPerformers[0].monthContracts} contrats
                          </Badge>
                        </div>
                      )}

                      {/* 3rd place */}
                      {topPerformers[2] && (
                        <div className="flex flex-col items-center">
                          <Avatar className="w-11 h-11 border-2 border-orange-400 mb-1">
                            {topPerformers[2].photoUrl ? (
                              <AvatarImage src={topPerformers[2].photoUrl} />
                            ) : null}
                            <AvatarFallback className="bg-orange-100 text-orange-700 font-bold text-sm">
                              {topPerformers[2].initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="w-20 h-12 bg-gradient-to-t from-orange-300 to-orange-200 rounded-t-lg flex items-center justify-center">
                            <Medal className="h-5 w-5 text-orange-600" />
                          </div>
                          <span className="text-xs font-medium mt-1 truncate max-w-[80px]">
                            {topPerformers[2].name.split(' ')[0]}
                          </span>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">
                            {topPerformers[2].monthContracts} contrats
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Remaining performers */}
                    {topPerformers.slice(3).length > 0 && (
                      <div className="space-y-1 pt-2 border-t">
                        {topPerformers.slice(3).map((performer, i) => (
                          <div 
                            key={performer.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground w-4">{i + 4}</span>
                              <Avatar className="w-7 h-7">
                                {performer.photoUrl ? (
                                  <AvatarImage src={performer.photoUrl} />
                                ) : null}
                                <AvatarFallback className="text-xs">
                                  {performer.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{performer.name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {performer.monthContracts}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Employee & Manager of the Month */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border shadow-sm bg-gradient-to-br from-amber-500/5 to-amber-500/10">
                <CardContent className="p-4 text-center">
                  <Crown className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Employé du mois</p>
                  {employeeOfMonth ? (
                    <>
                      <Avatar className="w-16 h-16 mx-auto my-3 border-2 border-amber-400">
                        {employeeOfMonth.photoUrl ? (
                          <AvatarImage src={employeeOfMonth.photoUrl} />
                        ) : null}
                        <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-lg">
                          {employeeOfMonth.initials}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium truncate">{employeeOfMonth.name}</p>
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        {employeeOfMonth.monthContracts} contrats
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-4">À déterminer</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-gradient-to-br from-violet-500/5 to-violet-500/10">
                <CardContent className="p-4 text-center">
                  <Award className="h-6 w-6 text-violet-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Manager du mois</p>
                  {managerOfMonth ? (
                    <>
                      <Avatar className="w-16 h-16 mx-auto my-3 border-2 border-violet-400">
                        {managerOfMonth.photoUrl ? (
                          <AvatarImage src={managerOfMonth.photoUrl} />
                        ) : null}
                        <AvatarFallback className="bg-violet-100 text-violet-700 font-bold text-lg">
                          {managerOfMonth.initials}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium truncate">{managerOfMonth.name}</p>
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        {managerOfMonth.monthContracts} contrats (équipe)
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-4">À déterminer</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

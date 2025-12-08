import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronsUpDown, Search, User, FileCheck, Plus, Trash2, Users, Percent, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, Client } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { useCommissionParts } from "@/hooks/useCommissionParts";
import { useCollaborateursCommission, Collaborateur } from "@/hooks/useCollaborateursCommission";
import { supabase } from "@/integrations/supabase/client";

const commissionSchema = z.object({
  policy_id: z.string().min(1, "Veuillez sélectionner un contrat"),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  type: z.string().min(1, "Veuillez sélectionner un type"),
  status: z.string().default("due"),
  date: z.string().optional(),
  notes: z.string().optional(),
});

type CommissionFormValues = z.infer<typeof commissionSchema>;

interface PartAgent {
  agent_id: string;
  agent_name: string;
  rate: number;
  amount: number;
  isManager?: boolean;
}

interface CommissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CommissionForm({ open, onOpenChange, onSuccess }: CommissionFormProps) {
  const { clients, fetchClients } = useClients();
  const { policies, fetchPolicies } = usePolicies();
  const { createCommission } = useCommissions();
  const { addMultipleParts } = useCommissionParts();
  const { collaborateurs: agents, getManagerForCollaborateur: getManagerForAgent } = useCollaborateursCommission();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMandat, setHasMandat] = useState(false);
  const [checkingMandat, setCheckingMandat] = useState(false);
  
  // Commission parts state
  const [commissionParts, setCommissionParts] = useState<PartAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [newPartRate, setNewPartRate] = useState<number>(0);

  const form = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      policy_id: "",
      amount: 0,
      type: "acquisition",
      status: "due",
      date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });
  
  // Get commission type from selected policy (LCA or VIE)
  const selectedPolicyId = form.watch("policy_id");
  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);
  const productCategory = selectedPolicy?.product?.category?.toLowerCase() || "";
  const isLCA = productCategory.includes("health") || productCategory.includes("santé") || productCategory.includes("lca");
  const isVIE = productCategory.includes("life") || productCategory.includes("vie") || productCategory.includes("3e pilier") || productCategory.includes("pilier");

  const watchedAmount = form.watch("amount");
  const watchedType = form.watch("type");
  const totalAmount = typeof watchedAmount === 'number' ? watchedAmount : parseFloat(String(watchedAmount)) || 0;
  const totalAssignedRate = commissionParts.reduce((sum, p) => sum + p.rate, 0);
  const remainingRate = 100 - totalAssignedRate;

  // Check if client has a signed mandat de gestion
  useEffect(() => {
    const checkMandat = async () => {
      if (!selectedClient) {
        setHasMandat(false);
        return;
      }
      
      setCheckingMandat(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('id')
          .eq('owner_id', selectedClient.id)
          .eq('owner_type', 'client')
          .eq('doc_kind', 'mandat_gestion')
          .limit(1);
        
        if (error) throw error;
        setHasMandat(data && data.length > 0);
      } catch (error) {
        console.error("Error checking mandat:", error);
        setHasMandat(false);
      } finally {
        setCheckingMandat(false);
      }
    };
    
    checkMandat();
  }, [selectedClient]);

  useEffect(() => {
    if (open) {
      fetchClients();
      fetchPolicies();
    }
  }, [open]);

  // Recalculate amounts when total amount changes
  useEffect(() => {
    setCommissionParts(prev => prev.map(p => ({
      ...p,
      amount: (totalAmount * p.rate) / 100
    })));
  }, [totalAmount]);

  // Auto-add assigned agent and manager when policy is selected
  useEffect(() => {
    if (!selectedClient || !selectedPolicyId || commissionParts.length > 0) return;
    
    // Get client's assigned agent
    const assignedAgentId = selectedClient.assigned_agent_id;
    if (!assignedAgentId) return;
    
    const agent = agents.find(a => a.id === assignedAgentId);
    if (!agent) return;
    
    // Determine rate based on product type
    let agentRate = 0;
    if (isLCA && agent.commission_rate_lca) {
      agentRate = agent.commission_rate_lca;
    } else if (isVIE && agent.commission_rate_vie) {
      agentRate = agent.commission_rate_vie;
    } else if (agent.commission_rate) {
      agentRate = agent.commission_rate;
    }
    
    if (agentRate <= 0) return;
    
    const partsToAdd: PartAgent[] = [];
    
    // Add agent part
    partsToAdd.push({
      agent_id: agent.id,
      agent_name: getAgentName(agent),
      rate: agentRate,
      amount: (totalAmount * agentRate) / 100,
      isManager: false
    });
    
    // Add manager part if exists
    const manager = getManagerForAgent(agent.id);
    if (manager) {
      // Manager rates are stored on the MANAGER record, not on the agent
      let managerRate = 0;
      if (isLCA && manager.manager_commission_rate_lca) {
        managerRate = manager.manager_commission_rate_lca;
      } else if (isVIE && manager.manager_commission_rate_vie) {
        managerRate = manager.manager_commission_rate_vie;
      }
      
      if (managerRate > 0) {
        partsToAdd.push({
          agent_id: manager.id,
          agent_name: `${getAgentName(manager)} (Manager)`,
          rate: managerRate,
          amount: (totalAmount * managerRate) / 100,
          isManager: true
        });
      }
    }
    
    if (partsToAdd.length > 0) {
      setCommissionParts(partsToAdd);
    }
  }, [selectedPolicyId, selectedClient, agents, isLCA, isVIE]);

  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
    const companyName = (client.company_name || '').toLowerCase();
    const email = (client.email || '').toLowerCase();
    return fullName.includes(query) || companyName.includes(query) || email.includes(query);
  });

  const clientPolicies = selectedClient 
    ? policies.filter(p => p.client_id === selectedClient.id)
    : [];

  const getClientName = (client: Client) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Sans nom';
  };

  const getAgentName = (agent: Collaborateur) => {
    return `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || 'Inconnu';
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setClientOpen(false);
    form.setValue("policy_id", "");
  };

  const handleAddPart = () => {
    if (!selectedAgentId) return;
    
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;
    
    // Check if agent already added
    if (commissionParts.some(p => p.agent_id === selectedAgentId)) {
      return;
    }

    // Get agent's rate based on product type, or use newPartRate if no default rate
    let agentRate = newPartRate;
    if (agentRate <= 0) {
      if (isLCA && agent.commission_rate_lca) {
        agentRate = agent.commission_rate_lca;
      } else if (isVIE && agent.commission_rate_vie) {
        agentRate = agent.commission_rate_vie;
      } else if (agent.commission_rate) {
        agentRate = agent.commission_rate;
      }
    }
    
    if (agentRate <= 0 || agentRate > remainingRate) return;

    const newPart: PartAgent = {
      agent_id: selectedAgentId,
      agent_name: getAgentName(agent),
      rate: agentRate,
      amount: (totalAmount * agentRate) / 100,
      isManager: false
    };

    let partsToAdd: PartAgent[] = [newPart];

    // Auto-add manager commission if agent has a manager
    const manager = getManagerForAgent(selectedAgentId);
    if (manager && !commissionParts.some(p => p.agent_id === manager.id)) {
      // Calculate manager's rate based on product type
      let managerRate = 0;
      if (isLCA && manager.manager_commission_rate_lca) {
        managerRate = manager.manager_commission_rate_lca;
      } else if (isVIE && manager.manager_commission_rate_vie) {
        managerRate = manager.manager_commission_rate_vie;
      }
      
      if (managerRate > 0) {
        const totalRateWithManager = agentRate + managerRate;
        if (totalRateWithManager <= remainingRate) {
          const managerPart: PartAgent = {
            agent_id: manager.id,
            agent_name: `${getAgentName(manager)} (Manager)`,
            rate: managerRate,
            amount: (totalAmount * managerRate) / 100,
            isManager: true
          };
          partsToAdd.push(managerPart);
        }
      }
    }

    setCommissionParts(prev => [...prev, ...partsToAdd]);
    setSelectedAgentId("");
    setNewPartRate(0);
  };

  const handleUpdatePartRate = (agentId: string, newRate: number) => {
    const otherPartsRate = commissionParts
      .filter(p => p.agent_id !== agentId)
      .reduce((sum, p) => sum + p.rate, 0);
    
    if (newRate + otherPartsRate > 100) return;

    setCommissionParts(prev => prev.map(p => 
      p.agent_id === agentId 
        ? { ...p, rate: newRate, amount: (totalAmount * newRate) / 100 }
        : p
    ));
  };

  const handleRemovePart = (agentId: string) => {
    setCommissionParts(prev => prev.filter(p => p.agent_id !== agentId));
  };

  const onSubmit = async (values: CommissionFormValues) => {
    try {
      setLoading(true);
      
      // Create the commission with total_amount
      const commission = await createCommission({
        policy_id: values.policy_id,
        amount: values.amount,
        total_amount: values.amount,
        type: values.type,
        status: values.status,
        date: values.date || null,
        notes: values.notes || null,
      });
      
      // Add commission parts if any
      if (commission && commissionParts.length > 0) {
        const partsToInsert = commissionParts.map(p => ({
          commission_id: commission.id,
          agent_id: p.agent_id,
          rate: p.rate,
          amount: p.amount
        }));
        
        await addMultipleParts(partsToInsert);
      }
      
      form.reset();
      setSelectedClient(null);
      setSearchQuery("");
      setCommissionParts([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating commission:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedClient(null);
    setSearchQuery("");
    setCommissionParts([]);
    onOpenChange(false);
  };

  // Filter out already selected agents
  const availableAgents = agents.filter(a => !commissionParts.some(p => p.agent_id === a.id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle commission</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client Search */}
            <div className="space-y-2">
              <Label>Rechercher un client</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientOpen}
                    className="w-full justify-between"
                  >
                    {selectedClient ? (
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {getClientName(selectedClient)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Rechercher par nom, prénom...
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Rechercher un client..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>Aucun client trouvé</CommandEmpty>
                      <CommandGroup>
                        {filteredClients.slice(0, 10).map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.id}
                            onSelect={() => handleSelectClient(client)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{getClientName(client)}</span>
                              {client.email && (
                                <span className="text-xs text-muted-foreground">{client.email}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Policy Selection */}
            {selectedClient && (
              <FormField
                control={form.control}
                name="policy_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contrat</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un contrat" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientPolicies.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Aucun contrat pour ce client
                          </div>
                        ) : (
                          clientPolicies.map((policy) => (
                            <SelectItem key={policy.id} value={policy.id}>
                              <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4" />
                                <span>{policy.policy_number || 'Sans numéro'}</span>
                                <span className="text-muted-foreground">
                                  - {policy.product?.name || policy.product_type || 'Produit'}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant total (CHF)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de commission</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="acquisition">Acquisition</SelectItem>
                        <SelectItem value="renewal">Renouvellement</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                        <SelectItem 
                          value="gestion" 
                          disabled={!hasMandat}
                        >
                          Gestion (annuelle)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Warning if gestion selected without mandat */}
            {watchedType === "gestion" && !hasMandat && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  Mandat de gestion requis pour ce type de commission. Veuillez d'abord créer un mandat de gestion pour ce client.
                </p>
              </div>
            )}

            {/* Info about mandat */}
            {selectedClient && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm",
                hasMandat 
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-muted border border-border text-muted-foreground"
              )}>
                <FileCheck className="h-4 w-4 flex-shrink-0" />
                {checkingMandat ? (
                  <span>Vérification du mandat de gestion...</span>
                ) : hasMandat ? (
                  <span>✓ Mandat de gestion signé - Commission de gestion autorisée</span>
                ) : (
                  <span>Pas de mandat de gestion signé - Les commissions de gestion sont désactivées</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="due">À payer</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="paid">Payée</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Commission Parts Section */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Répartition de la commission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                  <span>Total: <strong>{totalAmount.toFixed(2)} CHF</strong> (100%)</span>
                  <span className={remainingRate < 0 ? "text-destructive" : "text-muted-foreground"}>
                    Restant: <strong>{remainingRate.toFixed(1)}%</strong> ({((totalAmount * remainingRate) / 100).toFixed(2)} CHF)
                  </span>
                </div>

                {/* Existing Parts */}
                {commissionParts.length > 0 && (
                  <div className="space-y-2">
                    {commissionParts.map((part) => (
                      <div 
                        key={part.agent_id} 
                        className={cn(
                          "flex items-center gap-3 p-3 border rounded-lg",
                          part.isManager 
                            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" 
                            : "bg-card"
                        )}
                      >
                        <div className="flex-1">
                          <p className={cn("font-medium", part.isManager && "text-amber-700 dark:text-amber-400")}>
                            {part.agent_name}
                          </p>
                          {part.isManager && (
                            <p className="text-xs text-amber-600">Commission équipe automatique</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={part.rate}
                            onChange={(e) => handleUpdatePartRate(part.agent_id, Number(e.target.value))}
                            className="w-20 text-right"
                            min={0}
                            max={100}
                            step={0.5}
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                        <div className="w-24 text-right font-medium">
                          {part.amount.toFixed(2)} CHF
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemovePart(part.agent_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Part */}
                {remainingRate > 0 && availableAgents.length > 0 && (
                  <div className="flex items-end gap-3 pt-2 border-t">
                    <div className="flex-1">
                      <Label className="text-xs mb-1.5 block">Collaborateur</Label>
                      <Select 
                        value={selectedAgentId} 
                        onValueChange={(agentId) => {
                          setSelectedAgentId(agentId);
                          // Auto-fill rate based on agent's configured rates
                          const agent = agents.find(a => a.id === agentId);
                          if (agent) {
                            let defaultRate = agent.commission_rate || 0;
                            // Use specific rate based on product type
                            if (isLCA && agent.commission_rate_lca) {
                              defaultRate = agent.commission_rate_lca;
                            } else if (isVIE && agent.commission_rate_vie) {
                              defaultRate = agent.commission_rate_vie;
                            }
                            // Cap at remaining rate
                            setNewPartRate(Math.min(defaultRate, remainingRate));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{getAgentName(agent)}</span>
                                {(isLCA && agent.commission_rate_lca) ? (
                                  <span className="text-xs text-blue-600 ml-2">({agent.commission_rate_lca}% LCA)</span>
                                ) : (isVIE && agent.commission_rate_vie) ? (
                                  <span className="text-xs text-emerald-600 ml-2">({agent.commission_rate_vie}% VIE)</span>
                                ) : agent.commission_rate ? (
                                  <span className="text-xs text-muted-foreground ml-2">({agent.commission_rate}%)</span>
                                ) : null}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Label className="text-xs mb-1.5 block">Pourcentage</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={newPartRate || ""}
                          onChange={(e) => setNewPartRate(Number(e.target.value))}
                          placeholder="0"
                          min={0}
                          max={remainingRate}
                          step={0.5}
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddPart}
                      disabled={!selectedAgentId || newPartRate <= 0}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {availableAgents.length === 0 && commissionParts.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Tous les collaborateurs ont été assignés
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notes sur cette commission..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading || !selectedClient}>
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

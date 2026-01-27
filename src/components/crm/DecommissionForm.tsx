import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronsUpDown, Search, AlertTriangle, MinusCircle, User, FileCheck, Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommissions, Commission } from "@/hooks/useCommissions";
import { useCommissionParts } from "@/hooks/useCommissionParts";
import { useCollaborateursCommission, Collaborateur } from "@/hooks/useCollaborateursCommission";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PartAgent {
  agent_id: string;
  agent_name: string;
  rate: number;
  amount: number;
}

interface DecommissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function DecommissionForm({ open, onOpenChange, onSuccess }: DecommissionFormProps) {
  const { t } = useTranslation();
  const { commissions, fetchCommissions, createCommission } = useCommissions();
  const { fetchCommissionParts, addMultipleParts } = useCommissionParts();
  const { collaborateurs: agents } = useCollaborateursCommission();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(false);
  const [decommissionAmount, setDecommissionAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Original commission parts
  const [originalParts, setOriginalParts] = useState<PartAgent[]>([]);
  const [decommissionParts, setDecommissionParts] = useState<PartAgent[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCommissions();
    }
  }, [open]);

  // Load original commission parts when commission is selected
  useEffect(() => {
    const loadParts = async () => {
      if (!selectedCommission) {
        setOriginalParts([]);
        setDecommissionParts([]);
        return;
      }
      
      setLoadingParts(true);
      const parts = await fetchCommissionParts(selectedCommission.id);
      
      const partsWithNames = parts.map(p => ({
        agent_id: p.agent_id,
        agent_name: getAgentName(agents.find(a => a.id === p.agent_id)),
        rate: Number(p.rate),
        amount: Number(p.amount)
      }));
      
      setOriginalParts(partsWithNames);
      // Calculate decommission parts based on the new amount
      updateDecommissionParts(partsWithNames, decommissionAmount || Number(selectedCommission.amount));
      setLoadingParts(false);
    };
    
    loadParts();
  }, [selectedCommission]);

  // Update decommission parts when amount changes
  useEffect(() => {
    if (originalParts.length > 0 && decommissionAmount > 0) {
      updateDecommissionParts(originalParts, decommissionAmount);
    }
  }, [decommissionAmount]);

  const updateDecommissionParts = (parts: PartAgent[], amount: number) => {
    const newParts = parts.map(p => ({
      ...p,
      amount: (amount * p.rate) / 100
    }));
    setDecommissionParts(newParts);
  };

  // Filter commissions that can be decommissioned (paid ones)
  const filteredCommissions = commissions.filter(commission => {
    if (commission.type === 'decommission') return false; // Can't decommission a decommission
    
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const clientName = commission.policy?.client?.company_name || 
      `${commission.policy?.client?.first_name || ''} ${commission.policy?.client?.last_name || ''}`;
    const productName = commission.policy?.product?.name || '';
    const policyNumber = commission.policy?.policy_number || '';
    
    return clientName.toLowerCase().includes(query) || 
           productName.toLowerCase().includes(query) ||
           policyNumber.toLowerCase().includes(query);
  });

  const getClientName = (commission: Commission) => {
    if (!commission.policy?.client) return 'Client inconnu';
    if (commission.policy.client.company_name) return commission.policy.client.company_name;
    return `${commission.policy.client.first_name || ''} ${commission.policy.client.last_name || ''}`.trim() || 'Sans nom';
  };

  const getAgentName = (agent: Collaborateur | undefined) => {
    if (!agent) return 'Inconnu';
    return `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || 'Inconnu';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  const handleSelectCommission = (commission: Commission) => {
    setSelectedCommission(commission);
    setDecommissionAmount(Number(commission.amount) || 0);
    setCommissionOpen(false);
  };

  const onSubmit = async () => {
    if (!selectedCommission || decommissionAmount <= 0) return;
    
    try {
      setLoading(true);
      
      // Create decommission with negative amount
      const decommission = await createCommission({
        policy_id: selectedCommission.policy_id,
        amount: -decommissionAmount, // Negative amount for decommission
        total_amount: -decommissionAmount,
        type: 'decommission',
        status: 'paid', // Decommissions are immediately applied
        date: date || null,
        notes: notes || `Décommission de la commission du ${selectedCommission.date ? format(new Date(selectedCommission.date), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}. ${selectedCommission.notes || ''}`,
      });
      
      // Add decommission parts (negative amounts)
      if (decommission && decommissionParts.length > 0) {
        const partsToInsert = decommissionParts.map(p => ({
          commission_id: decommission.id,
          agent_id: p.agent_id,
          rate: p.rate,
          amount: -p.amount // Negative amounts
        }));
        
        await addMultipleParts(partsToInsert);
      }
      
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating decommission:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCommission(null);
    setSearchQuery("");
    setDecommissionAmount(0);
    setNotes("");
    setDate(new Date().toISOString().split('T')[0]);
    setOriginalParts([]);
    setDecommissionParts([]);
    onOpenChange(false);
  };

  const statusLabels: Record<string, string> = {
    due: t('decommission.statusDue'),
    pending: t('decommission.statusPending'),
    paid: t('decommission.statusPaid')
  };

  const typeLabels: Record<string, string> = {
    acquisition: t('decommission.typeAcquisition'),
    renewal: t('decommission.typeRenewal'),
    bonus: t('decommission.typeBonus'),
    gestion: t('decommission.typeGestion')
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <MinusCircle className="h-5 w-5" />
            {t('decommission.title')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t('decommission.warning')}</p>
              <p className="text-sm">{t('decommission.warningMessage')}</p>
            </div>
          </div>

          {/* Commission Search */}
          <div className="space-y-2">
            <Label>{t('decommission.searchLabel')}</Label>
            <Popover open={commissionOpen} onOpenChange={setCommissionOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={commissionOpen}
                  className="w-full justify-between h-auto py-3"
                >
                  {selectedCommission ? (
                    <div className="flex flex-col items-start gap-1">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {getClientName(selectedCommission)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(Number(selectedCommission.amount))} - {typeLabels[selectedCommission.type || 'acquisition']} - {selectedCommission.date ? format(new Date(selectedCommission.date), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      {t('decommission.searchPlaceholder')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder={t('decommission.searchCommission')} 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>{t('decommission.noCommissionFound')}</CommandEmpty>
                    <CommandGroup>
                      {filteredCommissions.slice(0, 15).map((commission) => (
                        <CommandItem
                          key={commission.id}
                          value={commission.id}
                          onSelect={() => handleSelectCommission(commission)}
                          className="flex flex-col items-start gap-1 py-3"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Check
                              className={cn(
                                "h-4 w-4 flex-shrink-0",
                                selectedCommission?.id === commission.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{getClientName(commission)}</span>
                                <Badge variant="outline" className="text-xs">
                                  {statusLabels[commission.status] || commission.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{commission.policy?.product?.name || 'Produit'}</span>
                                <span>•</span>
                                <span>{commission.policy?.policy_number || 'N/A'}</span>
                                <span>•</span>
                                <span>{typeLabels[commission.type || 'acquisition']}</span>
                              </div>
                            </div>
                            <span className="font-semibold text-emerald-600">
                              {formatCurrency(Number(commission.amount))}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Commission Details */}
          {selectedCommission && (
            <>
              <Card className="border-dashed bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    {t('decommission.originalCommission')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('decommission.client')}:</span>
                      <span className="ml-2 font-medium">{getClientName(selectedCommission)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('decommission.amount')}:</span>
                      <span className="ml-2 font-medium text-emerald-600">{formatCurrency(Number(selectedCommission.amount))}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('decommission.type')}:</span>
                      <span className="ml-2 font-medium">{typeLabels[selectedCommission.type || 'acquisition']}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('decommission.date')}:</span>
                      <span className="ml-2 font-medium">
                        {selectedCommission.date ? format(new Date(selectedCommission.date), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t('decommission.product')}:</span>
                      <span className="ml-2 font-medium">{selectedCommission.policy?.product?.name || 'N/A'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Decommission Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('decommission.amountToDecommission')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={decommissionAmount}
                    onChange={(e) => setDecommissionAmount(Number(e.target.value))}
                    max={Number(selectedCommission.amount)}
                    min={0.01}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('decommission.maxAmount')}: {formatCurrency(Number(selectedCommission.amount))}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t('decommission.decommissionDate')}</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Decommission Parts Preview */}
              {decommissionParts.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <Users className="h-4 w-4" />
                      {t('decommission.deductionByCollaborator')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {loadingParts ? (
                      <p className="text-sm text-muted-foreground">{t('decommission.loading')}</p>
                    ) : (
                      decommissionParts.map((part) => (
                        <div 
                          key={part.agent_id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background border"
                        >
                          <div>
                            <p className="font-medium">{part.agent_name}</p>
                            <p className="text-xs text-muted-foreground">{part.rate}%</p>
                          </div>
                          <span className="font-semibold text-destructive">
                            - {formatCurrency(part.amount)}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                      <span className="font-medium">{t('decommission.totalDecommission')}</span>
                      <span className="font-bold text-lg text-destructive">
                        - {formatCurrency(decommissionAmount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>{t('decommission.notesOptional')}</Label>
                <Textarea
                  placeholder={t('decommission.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('decommission.cancel')}
            </Button>
            <Button 
              onClick={onSubmit} 
              disabled={loading || !selectedCommission || decommissionAmount <= 0}
              variant="destructive"
            >
              {loading ? t('common.saving') : t('decommission.create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

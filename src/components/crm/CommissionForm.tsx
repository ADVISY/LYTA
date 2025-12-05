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
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Search, User, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, Client } from "@/hooks/useClients";
import { usePolicies, Policy } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";

const commissionSchema = z.object({
  policy_id: z.string().min(1, "Veuillez sélectionner un contrat"),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  type: z.string().min(1, "Veuillez sélectionner un type"),
  status: z.string().default("due"),
  date: z.string().optional(),
  notes: z.string().optional(),
});

type CommissionFormValues = z.infer<typeof commissionSchema>;

interface CommissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CommissionForm({ open, onOpenChange, onSuccess }: CommissionFormProps) {
  const { clients, fetchClients } = useClients();
  const { policies, fetchPolicies } = usePolicies();
  const { createCommission } = useCommissions();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (open) {
      fetchClients();
      fetchPolicies();
    }
  }, [open]);

  // Filter clients based on search
  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
    const companyName = (client.company_name || '').toLowerCase();
    const email = (client.email || '').toLowerCase();
    return fullName.includes(query) || companyName.includes(query) || email.includes(query);
  });

  // Filter policies for selected client
  const clientPolicies = selectedClient 
    ? policies.filter(p => p.client_id === selectedClient.id)
    : [];

  const getClientName = (client: Client) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Sans nom';
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setClientOpen(false);
    form.setValue("policy_id", ""); // Reset policy selection
  };

  const onSubmit = async (values: CommissionFormValues) => {
    try {
      setLoading(true);
      await createCommission({
        policy_id: values.policy_id,
        amount: values.amount,
        type: values.type,
        status: values.status,
        date: values.date || null,
        notes: values.notes || null,
      });
      
      form.reset();
      setSelectedClient(null);
      setSearchQuery("");
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
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

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (CHF)</FormLabel>
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
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      rows={3}
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

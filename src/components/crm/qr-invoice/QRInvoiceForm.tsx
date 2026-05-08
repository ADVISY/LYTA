import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserPlus, Search } from "lucide-react";
import { useClients, Client } from "@/hooks/useClients";
import { useTenant } from "@/contexts/TenantContext";
import { CreateInvoiceData } from "@/hooks/useQRInvoices";
import { cn } from "@/lib/utils";
import { InvoiceItemsEditor, InvoiceItemDraft, sumItemsHT } from "@/components/crm/qr-invoice/InvoiceItemsEditor";

const invoiceSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(1, "Nom du client requis"),
  client_address: z.string().optional(),
  client_postal_code: z.string().optional(),
  client_city: z.string().optional(),
  client_country: z.string().default('CH'),
  client_email: z.string().email().optional().or(z.literal('')),
  vat_rate: z.number().default(7.7),
  is_vat_included: z.boolean().default(false),
  invoice_date: z.string(),
  due_date: z.string(),
  location: z.string().optional(),
  object: z.string().optional(),
  notes: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface QRInvoiceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateInvoiceData) => Promise<void>;
  initialData?: Partial<InvoiceFormData>;
}

export function QRInvoiceForm({ open, onClose, onSubmit, initialData }: QRInvoiceFormProps) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const { clients, loading: loadingClients } = useClients("client");
  const [submitting, setSubmitting] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [items, setItems] = useState<InvoiceItemDraft[]>([]);

  const defaultLocation = tenant?.branding?.company_address?.split(',')[0] || '';

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      client_country: 'CH',
      vat_rate: 7.7,
      is_vat_included: false,
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      location: defaultLocation,
      ...initialData,
    },
  });

  const watchVatRate = form.watch('vat_rate');
  const watchIsVatIncluded = form.watch('is_vat_included');

  // Calculate VAT amounts from the sum of all invoice items
  const vatCalculation = useMemo(() => {
    const subtotal = sumItemsHT(items);
    const rate = watchVatRate || 0;

    if (watchIsVatIncluded) {
      // The subtotal of items already includes VAT
      const ht = subtotal / (1 + rate / 100);
      const vat = subtotal - ht;
      return { ht: Math.round(ht * 100) / 100, vat: Math.round(vat * 100) / 100, ttc: Math.round(subtotal * 100) / 100 };
    } else {
      const vat = subtotal * rate / 100;
      const ttc = subtotal + vat;
      return { ht: Math.round(subtotal * 100) / 100, vat: Math.round(vat * 100) / 100, ttc: Math.round(ttc * 100) / 100 };
    }
  }, [items, watchVatRate, watchIsVatIncluded]);

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 50);
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.first_name?.toLowerCase().includes(search) ||
      c.last_name?.toLowerCase().includes(search) ||
      c.company_name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [clients, clientSearch]);

  // Auto-fill the "object" field with the first item's description (gives a
  // sensible default that the user can still override).
  useEffect(() => {
    const firstDesc = items.find((it) => it.description.trim())?.description.trim();
    if (firstDesc && !form.getValues("object")) {
      form.setValue("object", firstDesc);
    }
  }, [items, form]);

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const name = client.company_name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
      form.setValue('client_id', clientId);
      form.setValue('client_name', name);
      form.setValue('client_address', client.address || '');
      form.setValue('client_postal_code', client.postal_code || '');
      form.setValue('client_city', client.city || '');
      form.setValue('client_country', client.country || 'CH');
      form.setValue('client_email', client.email || '');
      setShowNewClient(false);
    }
  };

  const handleSubmit = async (data: InvoiceFormData) => {
    // Validate items
    const validItems = items.filter((it) => it.description.trim() && it.quantity > 0 && it.unit_price >= 0);
    if (validItems.length === 0) {
      form.setError("root", { message: "Ajoute au moins une ligne de facturation valide." });
      return;
    }

    setSubmitting(true);
    try {
      const firstItem = validItems[0];
      const invoiceData: CreateInvoiceData = {
        client_id: data.client_id || null,
        client_name: data.client_name,
        client_address: data.client_address,
        client_postal_code: data.client_postal_code,
        client_city: data.client_city,
        client_country: data.client_country,
        client_email: data.client_email || undefined,
        // For backwards compatibility with existing reports/PDFs, we keep
        // service_type/description filled from the first line. The full breakdown
        // lives in the new invoice_items table.
        service_type: validItems.length === 1 ? "autre" : "multi_lignes",
        service_description: firstItem.description,
        amount_ht: vatCalculation.ht,
        vat_rate: data.vat_rate,
        vat_amount: vatCalculation.vat,
        amount_ttc: vatCalculation.ttc,
        is_vat_included: data.is_vat_included,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        location: data.location,
        object: data.object,
        notes: data.notes,
        items: validItems.map((it, idx) => ({
          service_id: it.service_id,
          description: it.description.trim(),
          quantity: it.quantity,
          unit_price: it.unit_price,
          sort_order: idx,
        })),
      };

      await onSubmit(invoiceData);
      form.reset();
      setItems([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('qrInvoice.createInvoice')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                {t('qrInvoice.clientSection')}
              </h3>

              {!showNewClient ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('qrInvoice.searchClient')}
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {clientSearch && (
                    <Card>
                      <CardContent className="p-2 max-h-48 overflow-y-auto">
                        {loadingClients ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </div>
                        ) : filteredClients.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {t('qrInvoice.noClientsFound')}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => handleClientSelect(client.id)}
                                className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors"
                              >
                                <p className="font-medium">
                                  {client.company_name || `${client.first_name} ${client.last_name}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {client.email || client.city}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewClient(true)}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t('qrInvoice.createQuickClient')}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('qrInvoice.clientName')} *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_address"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('qrInvoice.clientAddress')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('qrInvoice.postalCode')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('qrInvoice.city')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_email"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('qrInvoice.clientEmail')}</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewClient(false)}
                    className="col-span-2"
                  >
                    {t('qrInvoice.selectExistingClient')}
                  </Button>
                </div>
              )}

              {form.watch('client_name') && !showNewClient && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="font-medium">{form.watch('client_name')}</p>
                    <p className="text-sm text-muted-foreground">
                      {form.watch('client_address')}, {form.watch('client_postal_code')} {form.watch('client_city')}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Lignes de facturation (multi-items) */}
            <InvoiceItemsEditor items={items} onChange={setItems} />

            <Separator />

            {/* TVA Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                TVA et total
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vat_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('qrInvoice.vatRate')} (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex items-end pb-2 space-x-2">
                  <Switch
                    id="vat-included"
                    checked={form.watch('is_vat_included')}
                    onCheckedChange={(checked) => form.setValue('is_vat_included', checked)}
                  />
                  <Label htmlFor="vat-included">{t('qrInvoice.vatIncluded')}</Label>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('qrInvoice.amountHT')}</span>
                    <span className="font-medium tabular-nums">{vatCalculation.ht.toFixed(2)} CHF</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t('qrInvoice.vatAmount')} ({watchVatRate}%)</span>
                    <span className="font-medium tabular-nums">{vatCalculation.vat.toFixed(2)} CHF</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>{t('qrInvoice.amountTTC')}</span>
                    <span className="tabular-nums">{vatCalculation.ttc.toFixed(2)} CHF</span>
                  </div>
                </CardContent>
              </Card>

              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                {t('qrInvoice.invoiceDetails')}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('qrInvoice.location')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('qrInvoice.invoiceDate')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('qrInvoice.dueDate')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="object"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('qrInvoice.object')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('qrInvoice.notes')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder={t('qrInvoice.notesPlaceholder')} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  t('qrInvoice.createAndGenerate')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

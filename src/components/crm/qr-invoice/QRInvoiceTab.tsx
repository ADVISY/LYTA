import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Lock, FileText } from "lucide-react";
import { useQRInvoices, QRInvoice, CreateInvoiceData } from "@/hooks/useQRInvoices";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useToast } from "@/hooks/use-toast";
import { QRInvoiceList, QRInvoiceForm, QRInvoicePreview } from "@/components/crm/qr-invoice";

export default function QRInvoiceTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasModule } = usePlanFeatures();
  const {
    invoices,
    loading,
    createInvoice,
    updateInvoiceStatus,
  } = useQRInvoices();

  // Check access
  const hasQRInvoiceAccess = hasModule('qr_invoice');

  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<QRInvoice | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [duplicateData, setDuplicateData] = useState<Partial<CreateInvoiceData> | undefined>();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          invoice.invoice_number.toLowerCase().includes(search) ||
          invoice.client_name.toLowerCase().includes(search) ||
          invoice.service_type.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && invoice.status !== statusFilter) {
        return false;
      }

      // Period filter
      if (periodFilter !== 'all') {
        const invoiceDate = new Date(invoice.invoice_date);
        const now = new Date();
        
        if (periodFilter === 'thisMonth') {
          if (invoiceDate.getMonth() !== now.getMonth() || 
              invoiceDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (periodFilter === 'thisYear') {
          if (invoiceDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [invoices, searchTerm, statusFilter, periodFilter]);

  // Handlers
  const handleCreateInvoice = async (data: CreateInvoiceData) => {
    const invoice = await createInvoice(data);
    if (invoice) {
      toast({
        title: t('qrInvoice.created'),
        description: t('qrInvoice.createdDescription', { number: invoice.invoice_number }),
      });
      setShowCreateForm(false);
      setDuplicateData(undefined);
      // Open preview
      setSelectedInvoice(invoice);
      setShowPreview(true);
    }
  };

  const handleView = (invoice: QRInvoice) => {
    setSelectedInvoice(invoice);
    setShowPreview(true);
  };

  const handleDownload = (invoice: QRInvoice) => {
    setSelectedInvoice(invoice);
    setShowPreview(true);
  };

  const handleSend = async (invoice: QRInvoice) => {
    // For now, just mark as sent - email sending would be implemented via edge function
    const success = await updateInvoiceStatus(invoice.id, 'sent');
    if (success) {
      toast({
        title: t('qrInvoice.sent'),
        description: t('qrInvoice.sentDescription'),
      });
    }
  };

  const handleDuplicate = (invoice: QRInvoice) => {
    setDuplicateData({
      client_id: invoice.client_id || undefined,
      client_name: invoice.client_name,
      client_address: invoice.client_address || undefined,
      client_postal_code: invoice.client_postal_code || undefined,
      client_city: invoice.client_city || undefined,
      client_country: invoice.client_country || 'CH',
      client_email: invoice.client_email || undefined,
      service_type: invoice.service_type,
      service_description: invoice.service_description || undefined,
      amount_ht: invoice.amount_ht,
      vat_rate: invoice.vat_rate,
      is_vat_included: invoice.is_vat_included,
      location: invoice.location || undefined,
      object: invoice.object || undefined,
      notes: invoice.notes || undefined,
    });
    setShowCreateForm(true);
  };

  const handleMarkPaid = async (invoice: QRInvoice) => {
    const success = await updateInvoiceStatus(invoice.id, 'paid');
    if (success) {
      toast({
        title: t('qrInvoice.markedPaid'),
        description: t('qrInvoice.markedPaidDescription'),
      });
      setShowPreview(false);
    }
  };

  const handleCancel = async (invoice: QRInvoice) => {
    const success = await updateInvoiceStatus(invoice.id, 'cancelled');
    if (success) {
      toast({
        title: t('qrInvoice.cancelled'),
        description: t('qrInvoice.cancelledDescription'),
      });
    }
  };

  const handleGenerate = async () => {
    if (!selectedInvoice) return;
    const success = await updateInvoiceStatus(selectedInvoice.id, 'generated');
    if (success) {
      toast({
        title: t('qrInvoice.generated'),
        description: t('qrInvoice.generatedDescription'),
      });
    }
  };

  const handleSendFromPreview = async () => {
    if (!selectedInvoice) return;
    await handleSend(selectedInvoice);
    setShowPreview(false);
  };

  // Locked state for non-premium plans
  if (!hasQRInvoiceAccess) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{t('qrInvoice.moduleLocked')}</h3>
              <p className="text-muted-foreground mt-1">
                {t('qrInvoice.moduleLockedDescription')}
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/crm/abonnement">{t('qrInvoice.upgradePlan')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('qrInvoice.title')}</h2>
          <p className="text-muted-foreground">{t('qrInvoice.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('qrInvoice.createInvoice')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">{t('common.search')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('qrInvoice.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('qrInvoice.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="draft">{t('qrInvoice.statusDraft')}</SelectItem>
                <SelectItem value="generated">{t('qrInvoice.statusGenerated')}</SelectItem>
                <SelectItem value="sent">{t('qrInvoice.statusSent')}</SelectItem>
                <SelectItem value="paid">{t('qrInvoice.statusPaid')}</SelectItem>
                <SelectItem value="overdue">{t('qrInvoice.statusOverdue')}</SelectItem>
                <SelectItem value="cancelled">{t('qrInvoice.statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('qrInvoice.filterByPeriod')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.allTime')}</SelectItem>
                <SelectItem value="thisMonth">{t('time.thisMonth')}</SelectItem>
                <SelectItem value="thisYear">{t('time.thisYear')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardContent className="pt-6">
          <QRInvoiceList
            invoices={filteredInvoices}
            loading={loading}
            onView={handleView}
            onDownload={handleDownload}
            onSend={handleSend}
            onDuplicate={handleDuplicate}
            onMarkPaid={handleMarkPaid}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Form Dialog */}
      <QRInvoiceForm
        open={showCreateForm}
        onClose={() => {
          setShowCreateForm(false);
          setDuplicateData(undefined);
        }}
        onSubmit={handleCreateInvoice}
        initialData={duplicateData}
      />

      {/* Preview Dialog */}
      <QRInvoicePreview
        invoice={selectedInvoice}
        open={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedInvoice(null);
        }}
        onGenerate={handleGenerate}
        onSend={handleSendFromPreview}
        onMarkPaid={() => selectedInvoice && handleMarkPaid(selectedInvoice)}
      />
    </div>
  );
}
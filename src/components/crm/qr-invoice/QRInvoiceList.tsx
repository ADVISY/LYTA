import React from "react";
import { useTranslation } from "react-i18next";
import { format, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Eye, 
  Download, 
  Send, 
  Copy, 
  MoreHorizontal, 
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { QRInvoice } from "@/hooks/useQRInvoices";
import { cn } from "@/lib/utils";

interface QRInvoiceListProps {
  invoices: QRInvoice[];
  loading: boolean;
  onView: (invoice: QRInvoice) => void;
  onDownload: (invoice: QRInvoice) => void;
  onSend: (invoice: QRInvoice) => void;
  onDuplicate: (invoice: QRInvoice) => void;
  onMarkPaid: (invoice: QRInvoice) => void;
  onCancel: (invoice: QRInvoice) => void;
}

const statusConfig: Record<QRInvoice['status'], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  generated: { label: 'Générée', variant: 'default' },
  sent: { label: 'Envoyée', variant: 'outline' },
  paid: { label: 'Payée', variant: 'default' },
  overdue: { label: 'En retard', variant: 'destructive' },
  cancelled: { label: 'Annulée', variant: 'secondary' },
};

export function QRInvoiceList({
  invoices,
  loading,
  onView,
  onDownload,
  onSend,
  onDuplicate,
  onMarkPaid,
  onCancel,
}: QRInvoiceListProps) {
  const { t } = useTranslation();

  // Check for overdue invoices
  const getDisplayStatus = (invoice: QRInvoice): QRInvoice['status'] => {
    if (invoice.status === 'generated' || invoice.status === 'sent') {
      if (isPast(new Date(invoice.due_date))) {
        return 'overdue';
      }
    }
    return invoice.status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('qrInvoice.noInvoices')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('qrInvoice.invoiceNumber')}</TableHead>
          <TableHead>{t('qrInvoice.client')}</TableHead>
          <TableHead>{t('qrInvoice.service')}</TableHead>
          <TableHead className="text-right">{t('qrInvoice.amount')}</TableHead>
          <TableHead>{t('qrInvoice.date')}</TableHead>
          <TableHead>{t('qrInvoice.dueDate')}</TableHead>
          <TableHead>{t('qrInvoice.status')}</TableHead>
          <TableHead className="text-right">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const displayStatus = getDisplayStatus(invoice);
          const config = statusConfig[displayStatus];
          
          return (
            <TableRow key={invoice.id}>
              <TableCell className="font-mono font-medium">
                {invoice.invoice_number}
              </TableCell>
              <TableCell>{invoice.client_name}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {invoice.service_type}
              </TableCell>
              <TableCell className="text-right font-medium">
                {invoice.amount_ttc.toLocaleString('fr-CH', { 
                  style: 'currency', 
                  currency: 'CHF' 
                })}
              </TableCell>
              <TableCell>
                {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: fr })}
              </TableCell>
              <TableCell className={cn(
                displayStatus === 'overdue' && "text-destructive font-medium"
              )}>
                {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr })}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={config.variant}
                  className={cn(
                    displayStatus === 'paid' && "bg-emerald-600 hover:bg-emerald-700 text-white",
                    displayStatus === 'overdue' && "bg-destructive text-destructive-foreground"
                  )}
                >
                  {config.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(invoice)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('common.view')}
                    </DropdownMenuItem>
                    {(invoice.status === 'generated' || invoice.status === 'sent' || invoice.status === 'paid') && (
                      <DropdownMenuItem onClick={() => onDownload(invoice)}>
                        <Download className="mr-2 h-4 w-4" />
                        {t('qrInvoice.downloadPdf')}
                      </DropdownMenuItem>
                    )}
                    {invoice.status === 'generated' && invoice.client_email && (
                      <DropdownMenuItem onClick={() => onSend(invoice)}>
                        <Send className="mr-2 h-4 w-4" />
                        {t('qrInvoice.send')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDuplicate(invoice)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t('qrInvoice.duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(invoice.status === 'generated' || invoice.status === 'sent' || displayStatus === 'overdue') && (
                      <DropdownMenuItem onClick={() => onMarkPaid(invoice)}>
                        <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                        {t('qrInvoice.markPaid')}
                      </DropdownMenuItem>
                    )}
                    {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                      <DropdownMenuItem 
                        onClick={() => onCancel(invoice)}
                        className="text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('qrInvoice.cancel')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
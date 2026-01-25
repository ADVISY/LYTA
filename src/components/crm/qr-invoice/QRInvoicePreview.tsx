import React, { useRef, useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, Printer, Send, CheckCircle, Loader2 } from "lucide-react";
import { QRInvoice } from "@/hooks/useQRInvoices";
import { useTenant } from "@/contexts/TenantContext";
import html2pdf from "html2pdf.js";

interface QRInvoicePreviewProps {
  invoice: QRInvoice | null;
  open: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
  onSend: () => Promise<void>;
  onMarkPaid: () => void;
}

// Swiss QR Bill reference generation (simplified)
function generateQRReference(invoiceNumber: string): string {
  // Remove non-numeric characters and pad
  const numericPart = invoiceNumber.replace(/\D/g, '').padStart(26, '0').slice(0, 26);
  // Simple checksum (mod 10 recursive)
  const weights = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const char of numericPart) {
    carry = weights[(carry + parseInt(char)) % 10];
  }
  const checkDigit = (10 - carry) % 10;
  return numericPart + checkDigit;
}

// Format IBAN for display
function formatIBAN(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

// Format reference for display
function formatReference(ref: string): string {
  return ref.replace(/(.{5})/g, '$1 ').trim();
}

export function QRInvoicePreview({
  invoice,
  open,
  onClose,
  onGenerate,
  onSend,
  onMarkPaid,
}: QRInvoicePreviewProps) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const printRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const tenantBranding = tenant?.branding;
  const tenantName = tenantBranding?.display_name || tenant?.name || 'Cabinet';
  const tenantAddress = tenantBranding?.company_address || '';
  const tenantPhone = tenantBranding?.company_phone || '';
  const tenantEmail = tenantBranding?.company_email || '';
  const tenantLogo = tenantBranding?.logo_url;
  const tenantIBAN = tenantBranding?.iban || tenantBranding?.qr_iban || '';
  const tenantVAT = tenantBranding?.vat_number || '';
  const primaryColor = tenantBranding?.primary_color || '#1a1a2e';

  const qrReference = useMemo(() => {
    if (!invoice) return '';
    return generateQRReference(invoice.invoice_number);
  }, [invoice]);

  // Generate QR code data for Swiss QR Bill
  const qrData = useMemo(() => {
    if (!invoice || !tenantIBAN) return '';
    
    const data = [
      'SPC', // QR Type
      '0200', // Version
      '1', // Coding
      tenantIBAN.replace(/\s/g, ''), // IBAN
      'K', // Address type (K = combined)
      tenantName, // Creditor name
      tenantAddress.split(',')[0] || '', // Street
      '', // Building number
      tenantAddress.split(',')[1]?.trim().split(' ')[0] || '', // Postal code
      tenantAddress.split(',')[1]?.trim().split(' ').slice(1).join(' ') || '', // City
      'CH', // Country
      '', // Ultimate creditor (empty for now)
      '', '', '', '', '', '', // Reserved fields
      invoice.amount_ttc.toFixed(2), // Amount
      'CHF', // Currency
      'K', // Debtor address type
      invoice.client_name, // Debtor name
      invoice.client_address || '', // Street
      '', // Building
      invoice.client_postal_code || '', // Postal
      invoice.client_city || '', // City
      invoice.client_country || 'CH', // Country
      'QRR', // Reference type
      qrReference, // Reference
      invoice.object || 'Facture', // Additional info
      'EPD', // Trailer
    ];
    
    return data.join('\n');
  }, [invoice, tenantIBAN, tenantName, tenantAddress, qrReference]);

  // Generate QR code image
  useEffect(() => {
    if (qrData && open) {
      QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 166, // ~46mm at 96dpi
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR Code generation error:', err));
    }
  }, [qrData, open]);

  const handleDownload = async () => {
    if (!printRef.current) return;
    
    setGenerating(true);
    try {
      const opt = {
        margin: 0,
        filename: `${invoice?.invoice_number || 'facture'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };
      
      await html2pdf().set(opt).from(printRef.current).save();
      
      if (invoice?.status === 'draft') {
        await onGenerate();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${invoice?.invoice_number || 'Facture'}</title>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('qrInvoice.preview')} - {invoice.invoice_number}</span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                {t('qrInvoice.print')}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t('qrInvoice.downloadPdf')}
              </Button>
              {invoice.status === 'generated' && invoice.client_email && (
                <Button 
                  size="sm" 
                  onClick={handleSend}
                  disabled={sending}
                  className="gap-2"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t('qrInvoice.send')}
                </Button>
              )}
              {(invoice.status === 'generated' || invoice.status === 'sent') && (
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={onMarkPaid}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {t('qrInvoice.markPaid')}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* PDF Preview */}
        <div 
          ref={printRef}
          className="bg-white shadow-lg mx-auto"
          style={{ 
            width: '210mm', 
            minHeight: '297mm',
            padding: '15mm',
            fontFamily: 'Arial, sans-serif',
            fontSize: '10pt',
            color: '#000'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20mm' }}>
            <div>
              {tenantLogo ? (
                <img 
                  src={tenantLogo} 
                  alt={tenantName}
                  style={{ maxHeight: '20mm', maxWidth: '50mm', objectFit: 'contain' }}
                />
              ) : (
                <h1 style={{ fontSize: '18pt', fontWeight: 'bold', color: primaryColor, margin: 0 }}>
                  {tenantName}
                </h1>
              )}
              <div style={{ marginTop: '5mm', fontSize: '9pt', color: '#666' }}>
                <p style={{ margin: '1mm 0' }}>{tenantAddress}</p>
                {tenantPhone && <p style={{ margin: '1mm 0' }}>Tél: {tenantPhone}</p>}
                {tenantEmail && <p style={{ margin: '1mm 0' }}>{tenantEmail}</p>}
                {tenantVAT && <p style={{ margin: '1mm 0' }}>N° TVA: {tenantVAT}</p>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0 0 3mm 0', color: primaryColor }}>
                FACTURE
              </h2>
              <p style={{ margin: '1mm 0', fontWeight: 'bold' }}>{invoice.invoice_number}</p>
              <p style={{ margin: '1mm 0' }}>Date: {format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: fr })}</p>
              <p style={{ margin: '1mm 0' }}>Échéance: {format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: fr })}</p>
            </div>
          </div>

          {/* Client Info */}
          <div style={{ marginBottom: '15mm' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '2mm' }}>{invoice.client_name}</p>
            {invoice.client_address && <p style={{ margin: '1mm 0' }}>{invoice.client_address}</p>}
            <p style={{ margin: '1mm 0' }}>
              {invoice.client_postal_code} {invoice.client_city}
            </p>
            <p style={{ margin: '1mm 0' }}>{invoice.client_country}</p>
          </div>

          {/* Object */}
          <div style={{ marginBottom: '10mm' }}>
            <p style={{ fontWeight: 'bold' }}>Objet: {invoice.object || invoice.service_type}</p>
          </div>

          {/* Invoice Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm' }}>
            <thead>
              <tr style={{ backgroundColor: primaryColor, color: '#fff' }}>
                <th style={{ padding: '3mm', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Description</th>
                <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #ddd', width: '25mm' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '3mm', borderBottom: '1px solid #eee' }}>
                  {invoice.service_type}
                  {invoice.service_description && (
                    <span style={{ display: 'block', fontSize: '9pt', color: '#666', marginTop: '1mm' }}>
                      {invoice.service_description}
                    </span>
                  )}
                </td>
                <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #eee' }}>
                  CHF {invoice.amount_ht.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15mm' }}>
            <table style={{ width: '80mm' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2mm' }}>Sous-total HT</td>
                  <td style={{ padding: '2mm', textAlign: 'right' }}>CHF {invoice.amount_ht.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '2mm' }}>TVA ({invoice.vat_rate}%)</td>
                  <td style={{ padding: '2mm', textAlign: 'right' }}>CHF {invoice.vat_amount.toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  <td style={{ padding: '3mm' }}>Total TTC</td>
                  <td style={{ padding: '3mm', textAlign: 'right' }}>CHF {invoice.amount_ttc.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ marginBottom: '10mm', padding: '3mm', backgroundColor: '#f9f9f9', borderRadius: '2mm' }}>
              <p style={{ margin: 0, fontSize: '9pt' }}>{invoice.notes}</p>
            </div>
          )}

          {/* Payment Info */}
          <div style={{ marginBottom: '10mm' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '2mm' }}>Informations de paiement</p>
            <p style={{ margin: '1mm 0', fontSize: '9pt' }}>
              IBAN: {formatIBAN(tenantIBAN)}
            </p>
            <p style={{ margin: '1mm 0', fontSize: '9pt' }}>
              Référence: {formatReference(qrReference)}
            </p>
          </div>

          {/* Location and Date */}
          <div style={{ marginTop: '15mm' }}>
            <p>{invoice.location}, le {format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: fr })}</p>
          </div>

          {/* QR Bill Section */}
          <div style={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '105mm',
            borderTop: '1px dashed #000',
            padding: '5mm',
            backgroundColor: '#fff',
            display: 'flex'
          }}>
            {/* Receipt (left part) */}
            <div style={{ width: '62mm', borderRight: '1px dashed #000', paddingRight: '5mm' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', margin: '0 0 3mm 0' }}>Récépissé</h3>
              
              <div style={{ marginBottom: '3mm' }}>
                <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Compte / Payable à</p>
                <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{formatIBAN(tenantIBAN)}</p>
                <p style={{ fontSize: '8pt', margin: 0 }}>{tenantName}</p>
                <p style={{ fontSize: '8pt', margin: 0 }}>{tenantAddress}</p>
              </div>
              
              <div style={{ marginBottom: '3mm' }}>
                <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Référence</p>
                <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{formatReference(qrReference)}</p>
              </div>
              
              <div style={{ marginBottom: '3mm' }}>
                <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Payable par</p>
                <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{invoice.client_name}</p>
                <p style={{ fontSize: '8pt', margin: 0 }}>{invoice.client_address}</p>
                <p style={{ fontSize: '8pt', margin: 0 }}>{invoice.client_postal_code} {invoice.client_city}</p>
              </div>
              
              <div style={{ marginTop: 'auto' }}>
                <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Monnaie</p>
                <div style={{ display: 'flex', gap: '10mm' }}>
                  <div>
                    <p style={{ fontSize: '6pt', margin: 0 }}>Monnaie</p>
                    <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: 0 }}>CHF</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '6pt', margin: 0 }}>Montant</p>
                    <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: 0 }}>{invoice.amount_ttc.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <p style={{ fontSize: '6pt', marginTop: '5mm' }}>Point de dépôt</p>
            </div>
            
            {/* Payment Part (right section) */}
            <div style={{ flex: 1, paddingLeft: '5mm' }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', margin: '0 0 3mm 0' }}>Section paiement</h3>
              
              <div style={{ display: 'flex', gap: '10mm' }}>
                {/* Swiss QR Code */}
                <div style={{ 
                  width: '46mm', 
                  height: '46mm', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#fff'
                }}>
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Swiss QR Code" 
                      style={{ width: '46mm', height: '46mm' }}
                    />
                  ) : (
                    <div style={{ 
                      width: '46mm', 
                      height: '46mm', 
                      border: '1px dashed #ccc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <p style={{ fontSize: '8pt', color: '#999' }}>QR</p>
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '3mm' }}>
                    <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Compte / Payable à</p>
                    <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{formatIBAN(tenantIBAN)}</p>
                    <p style={{ fontSize: '8pt', margin: 0 }}>{tenantName}</p>
                    <p style={{ fontSize: '8pt', margin: 0 }}>{tenantAddress}</p>
                  </div>
                  
                  <div style={{ marginBottom: '3mm' }}>
                    <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Référence</p>
                    <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{formatReference(qrReference)}</p>
                  </div>
                  
                  <div style={{ marginBottom: '3mm' }}>
                    <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Informations supplémentaires</p>
                    <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{invoice.object}</p>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '5mm' }}>
                <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Payable par</p>
                <p style={{ fontSize: '8pt', margin: '1mm 0' }}>{invoice.client_name}</p>
                <p style={{ fontSize: '8pt', margin: 0 }}>{invoice.client_address}</p>
                <p style={{ fontSize: '8pt', margin: 0 }}>{invoice.client_postal_code} {invoice.client_city}</p>
              </div>
              
              <div style={{ display: 'flex', gap: '20mm', marginTop: '5mm' }}>
                <div>
                  <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Monnaie</p>
                  <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: 0 }}>CHF</p>
                </div>
                <div>
                  <p style={{ fontSize: '6pt', fontWeight: 'bold', margin: 0 }}>Montant</p>
                  <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: 0 }}>{invoice.amount_ttc.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
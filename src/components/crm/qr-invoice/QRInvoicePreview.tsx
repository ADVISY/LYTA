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
import { Download, Printer, Send, CheckCircle, Loader2 } from "lucide-react";
import { QRInvoice } from "@/hooks/useQRInvoices";
import { useTenant } from "@/contexts/TenantContext";
import html2pdf from "html2pdf.js";

interface QRInvoicePreviewProps {
  invoice: QRInvoice | null;
  open: boolean;
  onClose: () => void;
  onGenerate: (pdfBlob?: Blob) => Promise<void>;
  onSend: () => Promise<void>;
  onMarkPaid: () => void;
}

// Swiss QR Bill reference generation
function generateQRReference(invoiceNumber: string): string {
  const numericPart = invoiceNumber.replace(/\D/g, '').padStart(26, '0').slice(0, 26);
  const weights = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const char of numericPart) {
    carry = weights[(carry + parseInt(char)) % 10];
  }
  const checkDigit = (10 - carry) % 10;
  return numericPart + checkDigit;
}

function formatIBAN(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

function formatReference(ref: string): string {
  return ref.replace(/(.{5})/g, '$1 ').trim();
}

// Format service type for display (capitalize, remove underscores/hyphens)
function formatServiceType(serviceType: string): string {
  if (!serviceType) return '';
  return serviceType
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const tenantBranding = tenant?.branding;
  const tenantName = tenantBranding?.display_name || tenant?.name || 'Cabinet';
  const tenantAddress = tenantBranding?.company_address || '';
  const tenantPhone = tenantBranding?.company_phone || '';
  const tenantEmail = tenantBranding?.company_email || '';
  const tenantLogo = tenantBranding?.logo_url;
  const tenantIBAN = tenantBranding?.iban || tenantBranding?.qr_iban || '';
  const tenantVAT = tenantBranding?.vat_number || '';
  const primaryColor = tenantBranding?.primary_color || '#0f172a';

  const qrReference = useMemo(() => {
    if (!invoice) return '';
    return generateQRReference(invoice.invoice_number);
  }, [invoice]);

  const qrData = useMemo(() => {
    if (!invoice || !tenantIBAN) return '';
    
    const data = [
      'SPC', '0200', '1',
      tenantIBAN.replace(/\s/g, ''),
      'K', tenantName,
      tenantAddress.split(',')[0] || '', '',
      tenantAddress.split(',')[1]?.trim().split(' ')[0] || '',
      tenantAddress.split(',')[1]?.trim().split(' ').slice(1).join(' ') || '',
      'CH', '', '', '', '', '', '',
      invoice.amount_ttc.toFixed(2), 'CHF',
      'K', invoice.client_name,
      invoice.client_address || '', '',
      invoice.client_postal_code || '',
      invoice.client_city || '',
      invoice.client_country || 'CH',
      'QRR', qrReference,
      invoice.object || 'Facture', 'EPD',
    ];
    
    return data.join('\n');
  }, [invoice, tenantIBAN, tenantName, tenantAddress, qrReference]);

  useEffect(() => {
    if (qrData && open) {
      QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 166,
        color: { dark: '#000000', light: '#ffffff' },
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
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };
      
      const pdfBlob = await html2pdf().set(opt).from(printRef.current).outputPdf('blob');
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opt.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (invoice?.status === 'draft') {
        await onGenerate(pdfBlob);
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

  const formattedServiceType = formatServiceType(invoice.service_type);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('qrInvoice.preview')} - {invoice.invoice_number}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                {t('qrInvoice.print')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t('qrInvoice.downloadPdf')}
              </Button>
              {invoice.status === 'generated' && invoice.client_email && (
                <Button size="sm" onClick={handleSend} disabled={sending} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('qrInvoice.send')}
                </Button>
              )}
              {(invoice.status === 'generated' || invoice.status === 'sent') && (
                <Button size="sm" variant="secondary" onClick={onMarkPaid} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('qrInvoice.markPaid')}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Professional PDF Preview */}
        <div 
          ref={printRef}
          style={{ 
            width: '210mm', 
            minHeight: '297mm',
            fontFamily: "'Poppins', 'Outfit', Arial, sans-serif",
            fontSize: '10pt',
            color: '#1a1a2e',
            backgroundColor: '#ffffff',
            position: 'relative',
            margin: '0 auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}
        >
          {/* Decorative Header Bar */}
          <div style={{ 
            height: '8mm', 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
            width: '100%'
          }} />

          {/* Main Content Area */}
          <div style={{ padding: '12mm 15mm 10mm 15mm' }}>
            {/* Header with Logo and Invoice Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15mm' }}>
              {/* Company Info Left */}
              <div style={{ flex: 1 }}>
                {tenantLogo ? (
                  <img 
                    src={tenantLogo} 
                    alt={tenantName}
                    crossOrigin="anonymous"
                    style={{ 
                      maxHeight: '18mm', 
                      maxWidth: '55mm', 
                      objectFit: 'contain',
                      marginBottom: '4mm'
                    }}
                  />
                ) : (
                  <div style={{ 
                    fontSize: '20pt', 
                    fontWeight: '700', 
                    color: primaryColor,
                    marginBottom: '4mm',
                    letterSpacing: '-0.5px'
                  }}>
                    {tenantName}
                  </div>
                )}
                <div style={{ fontSize: '8.5pt', color: '#64748b', lineHeight: '1.6' }}>
                  <div>{tenantAddress}</div>
                  {tenantPhone && <div>Tél: {tenantPhone}</div>}
                  {tenantEmail && <div>{tenantEmail}</div>}
                  {tenantVAT && <div style={{ marginTop: '2mm' }}>N° TVA: {tenantVAT}</div>}
                </div>
              </div>

              {/* Invoice Badge Right */}
              <div style={{ 
                textAlign: 'right',
                background: `linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}15 100%)`,
                padding: '6mm 8mm',
                borderRadius: '4mm',
                border: `1px solid ${primaryColor}20`
              }}>
                <div style={{ 
                  fontSize: '9pt', 
                  textTransform: 'uppercase', 
                  letterSpacing: '2px',
                  color: primaryColor,
                  fontWeight: '600',
                  marginBottom: '2mm'
                }}>
                  Facture
                </div>
                <div style={{ 
                  fontSize: '14pt', 
                  fontWeight: '700', 
                  color: primaryColor,
                  marginBottom: '4mm'
                }}>
                  {invoice.invoice_number}
                </div>
                <div style={{ fontSize: '8.5pt', color: '#64748b' }}>
                  <div><strong>Date:</strong> {format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: fr })}</div>
                  <div><strong>Échéance:</strong> {format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: fr })}</div>
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div style={{ 
              marginBottom: '12mm',
              padding: '5mm 6mm',
              backgroundColor: '#f8fafc',
              borderRadius: '3mm',
              borderLeft: `4px solid ${primaryColor}`
            }}>
              <div style={{ 
                fontSize: '7pt', 
                textTransform: 'uppercase', 
                letterSpacing: '1.5px',
                color: '#94a3b8',
                marginBottom: '2mm',
                fontWeight: '600'
              }}>
                Facturé à
              </div>
              <div style={{ fontSize: '11pt', fontWeight: '600', color: '#1e293b', marginBottom: '1mm' }}>
                {invoice.client_name}
              </div>
              <div style={{ fontSize: '9pt', color: '#64748b', lineHeight: '1.5' }}>
                {invoice.client_address && <div>{invoice.client_address}</div>}
                <div>{invoice.client_postal_code} {invoice.client_city}</div>
                <div>{invoice.client_country}</div>
              </div>
            </div>

            {/* Object */}
            <div style={{ marginBottom: '8mm' }}>
              <span style={{ 
                fontSize: '9pt', 
                fontWeight: '600', 
                color: primaryColor 
              }}>
                Objet: 
              </span>
              <span style={{ fontSize: '9pt', color: '#475569', marginLeft: '2mm' }}>
                {invoice.object || formattedServiceType}
              </span>
            </div>

            {/* Invoice Table */}
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              marginBottom: '8mm',
              fontSize: '9pt'
            }}>
              <thead>
                <tr>
                  <th style={{ 
                    padding: '4mm 5mm', 
                    textAlign: 'left', 
                    backgroundColor: primaryColor,
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '8.5pt',
                    letterSpacing: '0.5px',
                    borderRadius: '2mm 0 0 0'
                  }}>
                    Description
                  </th>
                  <th style={{ 
                    padding: '4mm 5mm', 
                    textAlign: 'right', 
                    backgroundColor: primaryColor,
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '8.5pt',
                    width: '30mm',
                    borderRadius: '0 2mm 0 0'
                  }}>
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ 
                    padding: '5mm', 
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#fafbfc'
                  }}>
                    <div style={{ fontWeight: '500', color: '#1e293b' }}>
                      {formattedServiceType}
                    </div>
                    {invoice.service_description && (
                      <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '1.5mm' }}>
                        {invoice.service_description}
                      </div>
                    )}
                  </td>
                  <td style={{ 
                    padding: '5mm', 
                    textAlign: 'right', 
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#fafbfc',
                    fontWeight: '500'
                  }}>
                    CHF {invoice.amount_ht.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10mm' }}>
              <div style={{ width: '75mm' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '2.5mm 0',
                  fontSize: '9pt',
                  color: '#64748b'
                }}>
                  <span>Sous-total HT</span>
                  <span>CHF {invoice.amount_ht.toFixed(2)}</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '2.5mm 0',
                  fontSize: '9pt',
                  color: '#64748b',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <span>TVA ({invoice.vat_rate}%)</span>
                  <span>CHF {invoice.vat_amount.toFixed(2)}</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '4mm 5mm',
                  marginTop: '2mm',
                  backgroundColor: primaryColor,
                  color: '#ffffff',
                  borderRadius: '2mm',
                  fontWeight: '700',
                  fontSize: '11pt'
                }}>
                  <span>Total TTC</span>
                  <span>CHF {invoice.amount_ttc.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div style={{ 
                marginBottom: '8mm', 
                padding: '4mm 5mm', 
                backgroundColor: '#fffbeb',
                borderRadius: '2mm',
                border: '1px solid #fde68a',
                fontSize: '8.5pt',
                color: '#92400e'
              }}>
                <strong>Note:</strong> {invoice.notes}
              </div>
            )}

            {/* Payment Info */}
            <div style={{ 
              marginBottom: '6mm',
              padding: '4mm 5mm',
              backgroundColor: '#f0fdf4',
              borderRadius: '2mm',
              border: '1px solid #bbf7d0'
            }}>
              <div style={{ 
                fontSize: '8pt', 
                fontWeight: '600', 
                color: '#166534',
                marginBottom: '2mm',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Informations de paiement
              </div>
              <div style={{ fontSize: '8.5pt', color: '#15803d' }}>
                <div><strong>IBAN:</strong> {formatIBAN(tenantIBAN)}</div>
                <div><strong>Référence:</strong> {formatReference(qrReference)}</div>
              </div>
            </div>

            {/* Location and Date */}
            <div style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '8mm' }}>
              {invoice.location}, le {format(new Date(invoice.invoice_date), 'dd MMMM yyyy', { locale: fr })}
            </div>
          </div>

          {/* QR Bill Section - Swiss Standard */}
          <div style={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '105mm',
            borderTop: '1px dashed #94a3b8',
            backgroundColor: '#ffffff',
            display: 'flex',
            fontFamily: 'Arial, sans-serif'
          }}>
            {/* Receipt (left part - 62mm) */}
            <div style={{ 
              width: '62mm', 
              borderRight: '1px dashed #94a3b8', 
              padding: '5mm',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ 
                fontSize: '11pt', 
                fontWeight: 'bold', 
                marginBottom: '3mm',
                color: '#000'
              }}>
                Récépissé
              </div>
              
              <div style={{ marginBottom: '3mm' }}>
                <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Compte / Payable à</div>
                <div style={{ fontSize: '8pt', marginTop: '1mm' }}>{formatIBAN(tenantIBAN)}</div>
                <div style={{ fontSize: '8pt' }}>{tenantName}</div>
                <div style={{ fontSize: '8pt' }}>{tenantAddress}</div>
              </div>
              
              <div style={{ marginBottom: '3mm' }}>
                <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Référence</div>
                <div style={{ fontSize: '8pt', marginTop: '1mm' }}>{formatReference(qrReference)}</div>
              </div>
              
              <div style={{ marginBottom: '3mm' }}>
                <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Payable par</div>
                <div style={{ fontSize: '8pt', marginTop: '1mm' }}>{invoice.client_name}</div>
                <div style={{ fontSize: '8pt' }}>{invoice.client_address}</div>
                <div style={{ fontSize: '8pt' }}>{invoice.client_postal_code} {invoice.client_city}</div>
              </div>
              
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: '8mm' }}>
                  <div>
                    <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Monnaie</div>
                    <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>CHF</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Montant</div>
                    <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{invoice.amount_ttc.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '6pt', marginTop: '4mm', color: '#000' }}>Point de dépôt</div>
              </div>
            </div>
            
            {/* Payment Part (right section) */}
            <div style={{ flex: 1, padding: '5mm' }}>
              <div style={{ 
                fontSize: '11pt', 
                fontWeight: 'bold', 
                marginBottom: '3mm',
                color: '#000'
              }}>
                Section paiement
              </div>
              
              <div style={{ display: 'flex', gap: '8mm' }}>
                {/* Swiss QR Code */}
                <div style={{ 
                  width: '46mm', 
                  height: '46mm', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: qrCodeDataUrl ? 'none' : '1px dashed #ccc'
                }}>
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Swiss QR Code" 
                      style={{ width: '46mm', height: '46mm' }}
                    />
                  ) : (
                    <div style={{ fontSize: '8pt', color: '#999' }}>QR</div>
                  )}
                </div>
                
                <div style={{ flex: 1, fontSize: '8pt' }}>
                  <div style={{ marginBottom: '3mm' }}>
                    <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Compte / Payable à</div>
                    <div style={{ marginTop: '1mm' }}>{formatIBAN(tenantIBAN)}</div>
                    <div>{tenantName}</div>
                    <div>{tenantAddress}</div>
                  </div>
                  
                  <div style={{ marginBottom: '3mm' }}>
                    <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Référence</div>
                    <div style={{ marginTop: '1mm' }}>{formatReference(qrReference)}</div>
                  </div>
                  
                  <div style={{ marginBottom: '3mm' }}>
                    <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Informations supplémentaires</div>
                    <div style={{ marginTop: '1mm' }}>{invoice.object || formattedServiceType}</div>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '5mm', fontSize: '8pt' }}>
                <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Payable par</div>
                <div style={{ marginTop: '1mm' }}>{invoice.client_name}</div>
                <div>{invoice.client_address}</div>
                <div>{invoice.client_postal_code} {invoice.client_city}</div>
              </div>
              
              <div style={{ display: 'flex', gap: '15mm', marginTop: '5mm' }}>
                <div>
                  <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Monnaie</div>
                  <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>CHF</div>
                </div>
                <div>
                  <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Montant</div>
                  <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{invoice.amount_ttc.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

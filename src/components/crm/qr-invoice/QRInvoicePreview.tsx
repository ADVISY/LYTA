import React, { useRef, useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
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
import { supabase } from "@/integrations/supabase/client";
import html2pdf from "html2pdf.js";

interface InvoiceItemRow {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}
import { 
  validateIBAN, 
  getIBANForQR, 
  getQRReferenceType, 
  generateQRReference,
  formatIBAN as formatIBANDisplay,
  formatQRReference
} from "@/lib/ibanUtils";

interface QRInvoicePreviewProps {
  invoice: QRInvoice | null;
  open: boolean;
  onClose: () => void;
  onGenerate: (pdfBlob?: Blob) => Promise<void>;
  onSend: () => Promise<void>;
  onMarkPaid: () => void;
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

// Convert image URL to base64 for PDF embedding
// Uses a proxy approach for external URLs that may have CORS issues
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    // If already base64, return as-is
    if (url.startsWith('data:')) return url;
    
    // For Supabase storage URLs, they should work with CORS
    // For external URLs, we need a different approach
    const isSupabaseUrl = url.includes('supabase') || url.includes('hjedkkpmfzhtdzotskiv');
    
    if (isSupabaseUrl) {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // For external URLs (like e-advisy.ch), use Image element approach
    // This can work if the server allows cross-origin image loading
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            console.warn('Canvas toDataURL failed (CORS):', e);
            resolve('');
          }
        } else {
          resolve('');
        }
      };
      img.onerror = () => {
        console.warn('Image failed to load:', url);
        resolve('');
      };
      img.src = url;
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return '';
  }
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
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [items, setItems] = useState<InvoiceItemRow[]>([]);

  // Fetch invoice items (multi-line breakdown). Falls back to a single-line
  // synthesized from the legacy fields if no rows exist.
  useEffect(() => {
    if (!invoice?.id) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("invoice_items")
        .select("id, description, quantity, unit_price, line_total, sort_order")
        .eq("invoice_id", invoice.id)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      const fetched = (data ?? []) as InvoiceItemRow[];
      if (fetched.length > 0) {
        setItems(fetched);
      } else {
        // Backwards compat for invoices created before invoice_items existed
        setItems([
          {
            id: "legacy",
            description: invoice.service_description || formatServiceType(invoice.service_type) || "Prestation",
            quantity: 1,
            unit_price: invoice.amount_ht,
            line_total: invoice.amount_ht,
            sort_order: 0,
          },
        ]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice?.id, invoice?.amount_ht, invoice?.service_description, invoice?.service_type]);

  const tenantBranding = tenant?.branding;
  const tenantName = tenantBranding?.display_name || tenant?.name || 'Cabinet';
  const tenantAddress = tenantBranding?.company_address || '';
  const tenantPhone = tenantBranding?.company_phone || '';
  const tenantEmail = tenantBranding?.company_email || '';
  const tenantLogo = tenantBranding?.logo_url;
  const rawIBAN = tenantBranding?.iban || tenantBranding?.qr_iban || '';
  const ibanValidation = validateIBAN(rawIBAN);
  const tenantIBAN = getIBANForQR(rawIBAN); // Get IBAN suitable for QR code
  const tenantVAT = tenantBranding?.vat_number || '';
  const primaryColor = tenantBranding?.primary_color || '#0f172a';
  const referenceType = getQRReferenceType(rawIBAN); // QRR, SCOR, or NON

  const qrReference = useMemo(() => {
    if (!invoice) return '';
    return generateQRReference(invoice.invoice_number);
  }, [invoice]);

  // Generate Swiss QR Bill payload according to SIX specs
  const qrData = useMemo(() => {
    if (!invoice || !tenantIBAN) return '';

    // 1) Préférence : utilise les nouveaux champs structurés (saisis séparément
    //    dans Paramètres > Cabinet depuis la migration tenant_branding split).
    // 2) Fallback : ancien parsing de company_address pour compat tenants qui
    //    n'ont pas encore re-saisi.
    const structuredPostal = (tenantBranding as any)?.company_postal_code as string | undefined;
    const structuredCity = (tenantBranding as any)?.company_city as string | undefined;

    let streetAndNumber: string;
    let postalCode: string;
    let city: string;

    if (structuredPostal && structuredCity) {
      streetAndNumber = tenantAddress; // company_address contient désormais juste la rue
      postalCode = structuredPostal;
      city = structuredCity;
    } else {
      // Legacy : tout-en-un dans tenantAddress, on essaie virgule puis regex sur 4 chiffres
      const addressParts = tenantAddress.split(',').map(s => s.trim());
      if (addressParts.length >= 2) {
        streetAndNumber = addressParts[0] || '';
        const postalCity = addressParts[1] || '';
        const postalMatch = postalCity.match(/^(\d{4})\s*(.*)$/);
        postalCode = postalMatch ? postalMatch[1] : '';
        city = postalMatch ? postalMatch[2] : postalCity;
      } else {
        // Pas de virgule : on cherche un NPA 4 chiffres n'importe où dans la chaîne
        const m = tenantAddress.match(/^(.*?)\s+(\d{4})\s+(.+)$/);
        if (m) {
          streetAndNumber = m[1].trim();
          postalCode = m[2];
          city = m[3].trim();
        } else {
          streetAndNumber = tenantAddress;
          postalCode = '';
          city = '';
        }
      }
    }
    
    // Determine reference based on IBAN type
    // QR-IBAN requires QRR, regular IBAN uses NON (or SCOR if creditor reference available)
    const refType = referenceType;
    const reference = refType === 'QRR' ? qrReference : '';
    
    // Swiss QR Bill SPC format (SIX standard)
    const lines = [
      'SPC',                          // QR Type
      '0200',                         // Version
      '1',                            // Coding Type (UTF-8)
      tenantIBAN,                     // IBAN (21 chars for QR, no spaces)
      'S',                            // Creditor address type (S = structured)
      tenantName.slice(0, 70),        // Creditor name (max 70)
      streetAndNumber.slice(0, 70),   // Street or address line 1
      '',                             // Building number (empty for combined)
      postalCode,                     // Postal code
      city.slice(0, 35),              // City
      'CH',                           // Country
      '',                             // Ultimate Creditor (7 empty lines)
      '',
      '',
      '',
      '',
      '',
      '',
      invoice.amount_ttc.toFixed(2),  // Amount
      'CHF',                          // Currency
      'S',                            // Debtor address type
      invoice.client_name.slice(0, 70),              // Debtor name
      (invoice.client_address || '').slice(0, 70),   // Debtor street
      '',                             // Debtor building
      invoice.client_postal_code || '',              // Debtor postal
      (invoice.client_city || '').slice(0, 35),      // Debtor city
      invoice.client_country || 'CH',                // Debtor country
      refType,                        // Reference type (QRR, SCOR, or NON)
      reference,                      // Payment reference (27 digits for QRR, empty for NON)
      (invoice.object || formatServiceType(invoice.service_type)).slice(0, 140), // Message
      'EPD',                          // End Payment Data
    ];
    
    return lines.join('\r\n');
  }, [invoice, tenantIBAN, tenantName, tenantAddress, qrReference, ibanValidation.isValid, referenceType]);

  // Load logo as base64 for PDF embedding
  useEffect(() => {
    if (tenantLogo && open) {
      imageUrlToBase64(tenantLogo)
        .then(setLogoBase64)
        .catch(() => setLogoBase64(''));
    }
  }, [tenantLogo, open]);

  // Generate QR code
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
    
    const printContent = DOMPurify.sanitize(printRef.current.innerHTML);
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
          <div style={{ padding: '8mm 15mm 6mm 15mm' }}>
            {/* Header with Logo and Invoice Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
            {/* Company Info Left */}
              <div style={{ flex: 1 }}>
                {/* Show logo if available, otherwise show company name as text */}
                {logoBase64 ? (
                  <img 
                    src={logoBase64} 
                    alt={tenantName}
                    style={{ 
                      maxHeight: '18mm', 
                      maxWidth: '50mm', 
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
              marginBottom: '6mm',
              padding: '4mm 6mm',
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
            <div style={{ marginBottom: '4mm' }}>
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
              marginBottom: '5mm',
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
                {/*
                  Compact row sizing — the QR-bill section is absolutely
                  pinned to the bottom 105 mm of the page, so the table
                  realistically has ~95 mm of vertical room. Tight padding
                  + slightly smaller body font lets us fit ~12-14 lines
                  before any overflow risk (vs ~7-8 with the previous
                  5 mm padding).
                */}
                {items.map((it, idx) => (
                  <tr key={it.id}>
                    <td
                      style={{
                        padding: '2.5mm 5mm',
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: idx % 2 === 0 ? '#fafbfc' : '#ffffff',
                        fontSize: '8.5pt',
                        verticalAlign: 'top',
                      }}
                    >
                      <div style={{ fontWeight: '500', color: '#1e293b', lineHeight: 1.35 }}>
                        {it.description}
                      </div>
                      {it.quantity !== 1 && (
                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '0.5mm' }}>
                          {it.quantity} × CHF {it.unit_price.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '2.5mm 5mm',
                        textAlign: 'right',
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: idx % 2 === 0 ? '#fafbfc' : '#ffffff',
                        fontWeight: '500',
                        fontSize: '8.5pt',
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      CHF {it.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5mm' }}>
              <div style={{ width: '75mm' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '1.5mm 0',
                  fontSize: '9pt',
                  color: '#64748b'
                }}>
                  <span>Sous-total HT</span>
                  <span>CHF {invoice.amount_ht.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '1.5mm 0',
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
                  padding: '3mm 5mm',
                  marginTop: '1.5mm',
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

            {/*
              Payment Info green box removed (Habib 09/05) — IBAN +
              référence are already printed in the QR-bill section
              below, the green box was a redundant duplicate that got
              cropped by the QR section after the spacing fix. We just
              keep the location + date line.
            */}

            {/* Location and Date */}
            <div style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '4mm' }}>
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
                <div style={{ fontSize: '8pt', marginTop: '1mm' }}>{formatIBANDisplay(tenantIBAN)}</div>
                <div style={{ fontSize: '8pt' }}>{tenantName}</div>
                <div style={{ fontSize: '8pt' }}>{tenantAddress}</div>
              </div>
              
              <div style={{ marginBottom: '3mm' }}>
                <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Référence</div>
                <div style={{ fontSize: '8pt', marginTop: '1mm' }}>{formatQRReference(qrReference)}</div>
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
                    <div style={{ marginTop: '1mm' }}>{formatIBANDisplay(tenantIBAN)}</div>
                    <div>{tenantName}</div>
                    <div>{tenantAddress}</div>
                  </div>
                  
                  <div style={{ marginBottom: '3mm' }}>
                    <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000' }}>Référence</div>
                    <div style={{ marginTop: '1mm' }}>{formatQRReference(qrReference)}</div>
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

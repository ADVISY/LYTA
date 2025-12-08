import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Printer, FileCheck, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Client } from "@/hooks/useClients";
import html2pdf from "html2pdf.js";
import SignaturePad from "./SignaturePad";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface MandatGestionFormProps {
  client: Client;
  onSaved?: () => void;
}

interface InsuranceInfo {
  rcMenage: string;
  auto: string;
  protectionJuridique: string;
  sante: string;
  vie3ePilier: string;
  autre: string;
}

const insuranceCompanies = [
  "Non",
  "Allianz Suisse",
  "AXA",
  "Baloise",
  "CSS",
  "Generali",
  "Groupe Mutuel",
  "Helsana",
  "Helvetia",
  "La Mobilière",
  "Sanitas",
  "Swica",
  "Swiss Life",
  "Sympany",
  "Vaudoise",
  "Visana",
  "Zurich",
  "Autre",
];

export default function MandatGestionForm({ client, onSaved }: MandatGestionFormProps) {
  const [insurances, setInsurances] = useState<InsuranceInfo>({
    rcMenage: "Non",
    auto: "Non",
    protectionJuridique: "Non",
    sante: "Non",
    vie3ePilier: "Non",
    autre: "Non",
  });
  const [autreCompany, setAutreCompany] = useState("");
  const [lieu, setLieu] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [signatureAdvisy, setSignatureAdvisy] = useState<string | null>(null);
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mandatRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const getClientName = () => {
    if (client.company_name) return client.company_name;
    return `${client.last_name || ""} ${client.first_name || ""}`.trim() || "N/A";
  };

  const getClientPrenom = () => {
    if (client.company_name) return client.company_name;
    return client.first_name || "N/A";
  };

  const getFullAddress = () => {
    return client.address || "N/A";
  };

  const getLocality = () => {
    const parts = [client.zip_code, client.city].filter(Boolean);
    return parts.join(" ") || "N/A";
  };

  const getBirthdate = () => {
    if (!client.birthdate) return "N/A";
    return format(new Date(client.birthdate), "dd.MM.yyyy");
  };

  const getInsurancesList = () => {
    const list: { type: string; company: string }[] = [];
    if (insurances.rcMenage !== "Non") list.push({ type: "RC Ménage", company: insurances.rcMenage });
    if (insurances.auto !== "Non") list.push({ type: "Assurance Auto", company: insurances.auto });
    if (insurances.protectionJuridique !== "Non") list.push({ type: "Protection Juridique", company: insurances.protectionJuridique });
    if (insurances.sante !== "Non") list.push({ type: "Assurance Santé", company: insurances.sante });
    if (insurances.vie3ePilier !== "Non") list.push({ type: "3e Pilier / Vie", company: insurances.vie3ePilier });
    if (insurances.autre !== "Non") list.push({ type: "Autre", company: insurances.autre === "Autre" ? autreCompany : insurances.autre });
    return list;
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!mandatRef.current) return null;
    
    const opt = {
      margin: [8, 10, 8, 10] as [number, number, number, number],
      filename: `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false
      },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const pdfBlob = await html2pdf().set(opt).from(mandatRef.current).output('blob');
    return pdfBlob;
  };

  const handleGeneratePDF = async () => {
    if (!mandatRef.current) return;
    
    const opt = {
      margin: [8, 10, 8, 10] as [number, number, number, number],
      filename: `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false
      },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(mandatRef.current).save();
  };

  const handleSaveMandat = async () => {
    if (!signatureAdvisy || !signatureClient) {
      toast({
        title: "Signatures requises",
        description: "Les deux signatures (Advisy et Client) sont nécessaires pour enregistrer le mandat.",
        variant: "destructive"
      });
      return;
    }

    if (!mandatRef.current) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord afficher l'aperçu du mandat.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Générer le PDF
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) throw new Error("Erreur lors de la génération du PDF");

      // Créer le nom du fichier
      const fileName = `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`;
      const fileKey = `mandats/${client.id}/${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileKey, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Créer l'entrée dans la table documents
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          owner_id: client.id,
          owner_type: 'client',
          file_name: fileName,
          file_key: fileKey,
          mime_type: 'application/pdf',
          size_bytes: pdfBlob.size,
          doc_kind: 'mandat_gestion',
          created_by: user?.id
        });

      if (docError) throw docError;

      toast({
        title: "Mandat enregistré",
        description: "Le mandat de gestion signé a été sauvegardé dans les documents du client."
      });

      // Callback pour rafraîchir la liste des documents
      onSaved?.();

    } catch (error: any) {
      console.error('Erreur sauvegarde mandat:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer le mandat.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!mandatRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mandat de Gestion - ${getClientName()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #000; }
            h1 { color: #1800AD; text-align: center; margin-bottom: 30px; }
            h2 { color: #1800AD; margin-top: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #1800AD; }
            .section { margin-bottom: 20px; }
            .field { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .signature-box { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-area { width: 45%; border-top: 1px solid #000; padding-top: 10px; text-align: center; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          ${mandatRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Créer un Mandat de Gestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informations client pré-remplies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-muted-foreground">Nom / Entreprise</Label>
              <p className="font-medium">{getClientName()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Prénom / Contact</Label>
              <p className="font-medium">{getClientPrenom()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Adresse</Label>
              <p className="font-medium">{getFullAddress()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Localité</Label>
              <p className="font-medium">{getLocality()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Date de naissance</Label>
              <p className="font-medium">{getBirthdate()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{client.email || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Téléphone</Label>
              <p className="font-medium">{client.mobile || client.phone || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Nationalité / Permis</Label>
              <p className="font-medium">{client.nationality || "N/A"} / {client.permit_type || "N/A"}</p>
            </div>
          </div>

          {/* Formulaire assurances actuelles */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Assurances actuelles du client</h3>
            <p className="text-sm text-muted-foreground">
              Indiquez les compagnies d'assurance actuelles du client. Sélectionnez "Non" si le client n'a pas cette assurance.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>RC Ménage</Label>
                <Select value={insurances.rcMenage} onValueChange={(v) => setInsurances({ ...insurances, rcMenage: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assurance Auto</Label>
                <Select value={insurances.auto} onValueChange={(v) => setInsurances({ ...insurances, auto: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Protection Juridique</Label>
                <Select value={insurances.protectionJuridique} onValueChange={(v) => setInsurances({ ...insurances, protectionJuridique: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assurance Santé (LAMal/LCA)</Label>
                <Select value={insurances.sante} onValueChange={(v) => setInsurances({ ...insurances, sante: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>3e Pilier / Assurance Vie</Label>
                <Select value={insurances.vie3ePilier} onValueChange={(v) => setInsurances({ ...insurances, vie3ePilier: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Autre assurance</Label>
                <Select value={insurances.autre} onValueChange={(v) => setInsurances({ ...insurances, autre: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {insurances.autre === "Autre" && (
                  <Input 
                    placeholder="Nom de la compagnie" 
                    value={autreCompany}
                    onChange={(e) => setAutreCompany(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Lieu de signature */}
          <div className="space-y-2">
            <Label>Lieu de signature</Label>
            <Input 
              placeholder="Ex: Genève, Lausanne, Sion..." 
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </div>

          {/* Signatures digitales */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Signatures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SignaturePad
                label="Signature e-Advisy Sàrl"
                onSignatureChange={setSignatureAdvisy}
                signature={signatureAdvisy}
              />
              <SignaturePad
                label="Signature du Mandant"
                onSignatureChange={setSignatureClient}
                signature={signatureClient}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
              {showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
            </Button>
            <Button onClick={handleGeneratePDF} className="gap-2">
              <FileDown className="h-4 w-4" />
              Télécharger PDF
            </Button>
            <Button onClick={handlePrint} variant="secondary" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
            <Button 
              onClick={handleSaveMandat} 
              disabled={isSaving || !signatureAdvisy || !signatureClient}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Enregistrement..." : "Enregistrer le mandat"}
            </Button>
          </div>
          {(!signatureAdvisy || !signatureClient) && (
            <p className="text-sm text-muted-foreground">
              Les deux signatures sont requises pour enregistrer le mandat.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Aperçu du mandat */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu du Mandat</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div 
              ref={mandatRef} 
              className="bg-white text-black mx-auto"
              style={{ 
                fontFamily: 'Arial, Helvetica, sans-serif', 
                lineHeight: 1.4,
                width: '190mm',
                fontSize: '11px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            >
              {/* ========== PAGE 1 ========== */}
              <div style={{ padding: '30px 35px', minHeight: '277mm', boxSizing: 'border-box', position: 'relative' }}>
                {/* En-tête */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '15px', borderBottom: '3px solid #1800AD' }}>
                  <div>
                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#1800AD' }}>e-Advisy</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>Sàrl • Courtier en assurances</div>
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '5px' }}>
                      Route de Chêne 5, 1207 Genève<br/>info@e-advisy.ch • www.e-advisy.ch
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', backgroundColor: '#1800AD', color: 'white', padding: '4px 12px', borderRadius: '12px', display: 'inline-block' }}>
                      Inscrit FINMA
                    </div>
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '5px' }}>
                      {format(new Date(), "dd.MM.yyyy")}
                    </div>
                  </div>
                </div>

                {/* Titre principal */}
                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1800AD', letterSpacing: '3px', margin: 0 }}>
                    MANDAT DE GESTION
                  </h1>
                  <div style={{ width: '80px', height: '3px', backgroundColor: '#1800AD', margin: '10px auto 0' }} />
                </div>

                {/* Mandant */}
                <div style={{ backgroundColor: '#f8f9fa', padding: '15px 20px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '20px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#666', marginBottom: '8px', letterSpacing: '2px', fontWeight: 'bold' }}>Le Mandant</div>
                  <div style={{ fontWeight: 'bold', color: '#1800AD', fontSize: '16px', marginBottom: '5px' }}>{getClientName()}</div>
                  <div style={{ fontSize: '12px', color: '#333', marginBottom: '3px' }}>{getFullAddress()}</div>
                  <div style={{ fontSize: '12px', color: '#333', marginBottom: '3px' }}>{getLocality()}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Né(e) le {getBirthdate()}</div>
                  {client.email && <div style={{ fontSize: '11px', color: '#666' }}>{client.email}</div>}
                  {(client.mobile || client.phone) && <div style={{ fontSize: '11px', color: '#666' }}>{client.mobile || client.phone}</div>}
                  <div style={{ fontSize: '11px', color: '#666' }}>Nationalité: {client.nationality || "—"} • Permis: {client.permit_type || "—"}</div>
                </div>

                {/* Logo Advisy central */}
                <div style={{ textAlign: 'center', margin: '30px 0', padding: '20px' }}>
                  <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#1800AD', letterSpacing: '2px' }}>ADVISY</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px', letterSpacing: '4px' }}>VOTRE COURTIER DE CONFIANCE</div>
                </div>

                {/* Mandataire */}
                <div style={{ backgroundColor: '#1800AD', color: 'white', padding: '15px 20px', borderRadius: '8px', marginBottom: '25px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '8px', letterSpacing: '2px', fontWeight: 'bold' }}>Le Mandataire</div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>e-Advisy Sàrl</div>
                  <div style={{ fontSize: '12px' }}>Route de Chêne 5</div>
                  <div style={{ fontSize: '12px' }}>1207 Genève, Suisse</div>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '5px' }}>info@e-advisy.ch • +41 22 XXX XX XX</div>
                </div>

                {/* Portefeuille d'assurances */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1800AD', marginBottom: '10px', paddingBottom: '5px', borderBottom: '2px solid #1800AD', letterSpacing: '1px' }}>
                    PORTEFEUILLE D'ASSURANCES ACTUEL
                  </div>
                  {getInsurancesList().length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1800AD', color: 'white' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold' }}>Type d'assurance</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold' }}>Compagnie actuelle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getInsurancesList().map((ins, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #e9ecef' }}>{ins.type}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #e9ecef', fontWeight: 600, color: '#1800AD' }}>{ins.company}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', textAlign: 'center', color: '#666', fontSize: '11px' }}>
                      Aucune assurance existante renseignée
                    </div>
                  )}
                </div>

                {/* Pied de page 1 */}
                <div style={{ textAlign: 'center', fontSize: '9px', color: '#999', borderTop: '1px solid #e9ecef', paddingTop: '10px', marginTop: 'auto' }}>
                  Page 1/2 • Mandat de Gestion • {getClientName()}
                </div>
              </div>

              {/* ========== PAGE 2 ========== */}
              <div style={{ padding: '30px 35px', minHeight: '277mm', boxSizing: 'border-box', pageBreakBefore: 'always' }}>
                {/* En-tête page 2 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #1800AD' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1800AD' }}>e-Advisy</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>Mandat de Gestion • {getClientName()}</div>
                </div>

                {/* Conditions du mandat */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1800AD', marginBottom: '12px', paddingBottom: '5px', borderBottom: '2px solid #1800AD', letterSpacing: '1px' }}>
                    CONDITIONS DU MANDAT
                  </div>

                  <div style={{ fontSize: '10px', lineHeight: 1.6, textAlign: 'justify' }}>
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>1. Objet du contrat :</strong> Le présent contrat est un mandat de gestion dans le domaine des assurances de tous types.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>2. Prestations :</strong> e-Advisy négocie les meilleurs contrats d'assurance en fonction des besoins du Mandant. Celui-ci donne procuration au courtier pour entreprendre toutes les démarches nécessaires à la modification, annulation ou conclusion de polices d'assurance.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>3. Statut :</strong> e-Advisy, inscrite auprès de la FINMA en tant que courtier indépendant, collabore de manière neutre avec les principaux assureurs autorisés en Suisse.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>4. Responsabilité :</strong> e-Advisy répond des négligences ou fautes en relation avec l'activité de conseil. Ces risques sont couverts par une assurance RC professionnelle.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>5. Obligations du Mandant :</strong> Le Mandant s'engage à fournir toutes les informations nécessaires et garde toute liberté dans le choix des assureurs.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>6. Rémunération :</strong> e-Advisy est uniquement rémunérée par les commissions versées par les assureurs. Aucun frais n'est facturé au Mandant.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>7. Procuration :</strong> Le Mandant autorise e-Advisy à obtenir tous types de renseignements auprès des assureurs, modifier les données personnelles et couvertures, et résilier les contrats d'assurance.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>8. Durée :</strong> Le mandat est valable dès signature jusqu'à révocation écrite. Il remplace tout mandat antérieur.</p>
                    
                    <p style={{ margin: '8px 0' }}><strong style={{ color: '#1800AD' }}>9. For juridique :</strong> Droit suisse applicable. For juridique à Genève.</p>
                  </div>
                </div>

                {/* Déclaration */}
                <div style={{ padding: '12px 15px', marginBottom: '20px', fontSize: '10px', fontStyle: 'italic', backgroundColor: '#f8f9fa', borderLeft: '4px solid #1800AD', borderRadius: '4px' }}>
                  Par sa signature, le Mandant confirme avoir reçu, lu et compris le présent document, met fin à tout mandat de gestion antérieur, et autorise e-Advisy à agir en son nom auprès des compagnies d'assurances.
                </div>

                {/* Date et lieu */}
                <div style={{ textAlign: 'center', marginBottom: '25px', fontSize: '12px' }}>
                  Fait à <strong>{lieu || "_______________"}</strong>, le <strong>{format(new Date(), "dd MMMM yyyy", { locale: fr })}</strong>
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', gap: '30px', marginBottom: '30px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: '90px', backgroundColor: '#fafafa', border: '2px dashed #1800AD', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                      {signatureAdvisy ? (
                        <img src={signatureAdvisy} alt="Signature e-Advisy" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ color: '#999', fontSize: '10px' }}>Signature e-Advisy</span>
                      )}
                    </div>
                    <div style={{ borderTop: '2px solid #1800AD', paddingTop: '8px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#1800AD' }}>e-Advisy Sàrl</div>
                      <div style={{ fontSize: '10px', color: '#666' }}>Le Mandataire</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: '90px', backgroundColor: '#fafafa', border: '2px dashed #1800AD', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                      {signatureClient ? (
                        <img src={signatureClient} alt="Signature Mandant" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ color: '#999', fontSize: '10px' }}>Signature du Mandant</span>
                      )}
                    </div>
                    <div style={{ borderTop: '2px solid #1800AD', paddingTop: '8px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#1800AD' }}>{getClientName()}</div>
                      <div style={{ fontSize: '10px', color: '#666' }}>Le Mandant</div>
                    </div>
                  </div>
                </div>

                {/* Pied de page final */}
                <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '15px', textAlign: 'center', fontSize: '9px', color: '#999' }}>
                  <div style={{ fontWeight: 'bold', color: '#1800AD', fontSize: '11px' }}>e-Advisy Sàrl</div>
                  <div>Route de Chêne 5 • 1207 Genève • Suisse</div>
                  <div>info@e-advisy.ch • www.e-advisy.ch</div>
                  <div style={{ marginTop: '8px' }}>Document généré le {format(new Date(), "dd.MM.yyyy 'à' HH:mm")} • Page 2/2</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

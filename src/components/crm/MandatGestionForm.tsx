import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Printer, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Client } from "@/hooks/useClients";
import html2pdf from "html2pdf.js";
import SignaturePad from "./SignaturePad";

interface MandatGestionFormProps {
  client: Client;
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

export default function MandatGestionForm({ client }: MandatGestionFormProps) {
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
  const mandatRef = useRef<HTMLDivElement>(null);

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
          </div>
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
                padding: '25px 30px',
                width: '190mm',
                minHeight: '277mm',
                fontSize: '11px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            >
              {/* En-tête compact */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #1800AD' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1800AD' }}>e-Advisy</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Sàrl • Courtier en assurances</div>
                  <div style={{ fontSize: '9px', color: '#999', marginTop: '4px' }}>
                    Route de Chêne 5, 1207 Genève • info@e-advisy.ch
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', backgroundColor: '#1800AD', color: 'white', padding: '3px 8px', borderRadius: '10px', display: 'inline-block' }}>
                    FINMA
                  </div>
                </div>
              </div>

              {/* Titre principal compact */}
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1800AD', letterSpacing: '2px', margin: 0 }}>
                  MANDAT DE GESTION
                </h1>
                <div style={{ width: '60px', height: '2px', backgroundColor: '#1800AD', margin: '6px auto 0' }} />
              </div>

              {/* Parties contractantes en ligne */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '12px' }}>
                <div style={{ flex: 1, backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '6px', border: '1px solid #e9ecef' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', color: '#666', marginBottom: '4px', letterSpacing: '1px' }}>Le Mandant</div>
                  <div style={{ fontWeight: 'bold', color: '#1800AD', fontSize: '12px' }}>{getClientName()}</div>
                  <div style={{ fontSize: '10px', color: '#333' }}>{getFullAddress()}, {getLocality()}</div>
                  <div style={{ fontSize: '9px', color: '#666' }}>Né(e) le {getBirthdate()}</div>
                  {client.email && <div style={{ fontSize: '9px', color: '#666' }}>{client.email}</div>}
                </div>
                <div style={{ flex: 1, backgroundColor: '#1800AD', color: 'white', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '4px', letterSpacing: '1px' }}>Le Mandataire</div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px' }}>e-Advisy Sàrl</div>
                  <div style={{ fontSize: '10px' }}>Route de Chêne 5, 1207 Genève</div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>Suisse</div>
                </div>
              </div>

              {/* Assurances actuelles compact */}
              {getInsurancesList().length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#1800AD', marginBottom: '5px', paddingBottom: '3px', borderBottom: '1px solid #1800AD' }}>
                    PORTEFEUILLE ACTUEL
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1800AD', color: 'white' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Compagnie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getInsurancesList().map((ins, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #e9ecef' }}>{ins.type}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid #e9ecef', fontWeight: 500 }}>{ins.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Articles du contrat compacts */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#1800AD', marginBottom: '5px', paddingBottom: '3px', borderBottom: '1px solid #1800AD' }}>
                  CONDITIONS DU MANDAT
                </div>

                <div style={{ fontSize: '9px', lineHeight: 1.4, textAlign: 'justify' }}>
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>1.</strong> <strong>Objet :</strong> Mandat de gestion dans le domaine des assurances de tous types.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>2.</strong> <strong>Prestations :</strong> e-Advisy négocie les meilleurs contrats en fonction des besoins du Mandant et obtient procuration pour modifier, annuler ou conclure des polices.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>3.</strong> <strong>Statut :</strong> Courtier indépendant inscrit FINMA, collaborant avec les principaux assureurs autorisés en Suisse.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>4.</strong> <strong>Responsabilité :</strong> Couverte par une assurance RC professionnelle.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>5.</strong> <strong>Obligations :</strong> Le Mandant fournit les informations nécessaires et garde toute liberté de choix.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>6.</strong> <strong>Rémunération :</strong> Commissions versées par les assureurs. Aucun frais au Mandant.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>7.</strong> <strong>Procuration :</strong> Obtenir renseignements, modifier données/couvertures, résilier contrats.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>8.</strong> <strong>Durée :</strong> Valable dès signature jusqu'à révocation écrite. Remplace tout mandat antérieur.</p>
                  
                  <p style={{ margin: '4px 0' }}><strong style={{ color: '#1800AD' }}>9.</strong> <strong>For juridique :</strong> Droit suisse. For à Genève.</p>
                </div>
              </div>

              {/* Déclaration compacte */}
              <div style={{ padding: '8px 10px', marginBottom: '12px', fontSize: '9px', fontStyle: 'italic', backgroundColor: '#f8f9fa', borderLeft: '3px solid #1800AD', borderRadius: '3px' }}>
                Par sa signature, le Mandant confirme avoir reçu, lu et compris ce document, met fin à tout mandat antérieur, et autorise e-Advisy à agir en son nom auprès des assureurs.
              </div>

              {/* Date et lieu */}
              <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '10px' }}>
                Fait à <strong>{lieu || "_______________"}</strong>, le <strong>{format(new Date(), "dd MMMM yyyy", { locale: fr })}</strong>
              </div>

              {/* Signatures côte à côte */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: '70px', backgroundColor: '#fafafa', border: '1px dashed #1800AD', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    {signatureAdvisy ? (
                      <img src={signatureAdvisy} alt="Signature e-Advisy" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: '#999', fontSize: '9px' }}>Signature e-Advisy</span>
                    )}
                  </div>
                  <div style={{ borderTop: '2px solid #1800AD', paddingTop: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#1800AD' }}>e-Advisy Sàrl</div>
                    <div style={{ fontSize: '8px', color: '#666' }}>Le Mandataire</div>
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: '70px', backgroundColor: '#fafafa', border: '1px dashed #1800AD', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    {signatureClient ? (
                      <img src={signatureClient} alt="Signature Mandant" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: '#999', fontSize: '9px' }}>Signature du Mandant</span>
                    )}
                  </div>
                  <div style={{ borderTop: '2px solid #1800AD', paddingTop: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#1800AD' }}>{getClientName()}</div>
                    <div style={{ fontSize: '8px', color: '#666' }}>Le Mandant</div>
                  </div>
                </div>
              </div>

              {/* Contact du mandant compact */}
              <div style={{ display: 'flex', gap: '15px', fontSize: '9px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '10px' }}>
                <div><span style={{ color: '#666' }}>Tél:</span> {client.mobile || client.phone || "—"}</div>
                <div><span style={{ color: '#666' }}>Email:</span> {client.email || "—"}</div>
                <div><span style={{ color: '#666' }}>Nat./Permis:</span> {client.nationality || "—"} / {client.permit_type || "—"}</div>
              </div>

              {/* Pied de page compact */}
              <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '8px', textAlign: 'center', fontSize: '8px', color: '#999' }}>
                <span style={{ fontWeight: 'bold', color: '#1800AD' }}>e-Advisy Sàrl</span> • Route de Chêne 5, 1207 Genève • info@e-advisy.ch • www.e-advisy.ch
                <br />Généré le {format(new Date(), "dd.MM.yyyy 'à' HH:mm")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

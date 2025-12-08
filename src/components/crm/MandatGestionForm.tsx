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
      margin: [10, 15, 10, 15] as [number, number, number, number],
      filename: `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
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
              className="bg-white text-black max-w-[210mm] mx-auto"
              style={{ 
                fontFamily: 'Georgia, "Times New Roman", serif', 
                lineHeight: 1.7,
                padding: '40px 50px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            >
              {/* En-tête avec design élégant */}
              <div className="flex justify-between items-start mb-10 pb-6" style={{ borderBottom: '3px solid #1800AD' }}>
                <div>
                  <img 
                    src="/lovable-uploads/ce98b523-cd01-48ac-bd35-5e801dd578ac.png" 
                    alt="e-Advisy" 
                    style={{ height: '60px', objectFit: 'contain' }}
                  />
                  <div className="text-xs text-gray-400 mt-3">
                    Route de Chêne 5 • 1207 Genève<br />
                    info@e-advisy.ch • www.e-advisy.ch
                  </div>
                </div>
                <div className="text-right">
                  <div 
                    className="text-xs px-3 py-1 rounded-full inline-block"
                    style={{ backgroundColor: '#1800AD', color: 'white' }}
                  >
                    COURTIER EN ASSURANCES
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Inscrit FINMA
                  </div>
                </div>
              </div>

              {/* Titre principal */}
              <div className="text-center mb-10">
                <h1 
                  className="text-3xl font-bold tracking-wide"
                  style={{ color: '#1800AD', letterSpacing: '0.1em' }}
                >
                  MANDAT DE GESTION
                </h1>
                <div className="w-24 h-1 mx-auto mt-3" style={{ backgroundColor: '#1800AD' }} />
              </div>

              {/* Parties contractantes */}
              <div className="grid grid-cols-2 gap-8 mb-10">
                <div 
                  className="p-5 rounded-lg"
                  style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef' }}
                >
                  <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">Le Mandant</div>
                  <div className="space-y-2 text-sm">
                    <p className="font-bold text-lg" style={{ color: '#1800AD' }}>{getClientName()}</p>
                    <p>{getFullAddress()}</p>
                    <p>{getLocality()}</p>
                    <p className="text-gray-600">Né(e) le {getBirthdate()}</p>
                    {client.email && <p className="text-gray-600">{client.email}</p>}
                    {(client.mobile || client.phone) && <p className="text-gray-600">{client.mobile || client.phone}</p>}
                  </div>
                </div>
                <div 
                  className="p-5 rounded-lg"
                  style={{ backgroundColor: '#1800AD', color: 'white' }}
                >
                  <div className="text-xs uppercase tracking-widest opacity-70 mb-3">Le Mandataire</div>
                  <div className="space-y-2 text-sm">
                    <p className="font-bold text-lg">e-Advisy Sàrl</p>
                    <p>Route de Chêne 5</p>
                    <p>1207 Genève</p>
                    <p className="opacity-80">Suisse</p>
                  </div>
                </div>
              </div>

              {/* Assurances actuelles */}
              {getInsurancesList().length > 0 && (
                <div className="mb-8">
                  <h2 
                    className="text-sm uppercase tracking-widest mb-4 pb-2"
                    style={{ color: '#1800AD', borderBottom: '2px solid #1800AD' }}
                  >
                    Portefeuille d'assurances actuel
                  </h2>
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1800AD', color: 'white' }}>
                        <th className="p-3 text-left font-medium">Type d'assurance</th>
                        <th className="p-3 text-left font-medium">Compagnie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getInsurancesList().map((ins, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                          <td className="p-3" style={{ borderBottom: '1px solid #e9ecef' }}>{ins.type}</td>
                          <td className="p-3 font-medium" style={{ borderBottom: '1px solid #e9ecef' }}>{ins.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Articles du contrat */}
              <div className="mb-8">
                <h2 
                  className="text-sm uppercase tracking-widest mb-4 pb-2"
                  style={{ color: '#1800AD', borderBottom: '2px solid #1800AD' }}
                >
                  Conditions du mandat
                </h2>

                <div className="space-y-4 text-sm" style={{ textAlign: 'justify' }}>
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>1.</span>
                    <p><strong>Objet du contrat :</strong> Le présent contrat est un mandat de gestion dans le domaine des assurances de tous types.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>2.</span>
                    <p><strong>Prestations :</strong> e-Advisy négocie les meilleurs contrats d'assurance en fonction des besoins du Mandant. Celui-ci donne procuration au courtier pour entreprendre toutes les démarches nécessaires à la modification, annulation ou conclusion de polices d'assurance.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>3.</span>
                    <p><strong>Statut :</strong> e-Advisy, inscrite auprès de la FINMA en tant que courtier indépendant, collabore de manière neutre avec les principaux assureurs autorisés en Suisse.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>4.</span>
                    <p><strong>Responsabilité :</strong> e-Advisy répond des négligences ou fautes en relation avec l'activité de conseil. Ces risques sont couverts par une assurance RC professionnelle.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>5.</span>
                    <p><strong>Obligations du Mandant :</strong> Le Mandant s'engage à fournir toutes les informations nécessaires et garde toute liberté dans le choix des assureurs.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>6.</span>
                    <p><strong>Rémunération :</strong> e-Advisy est uniquement rémunérée par les commissions versées par les assureurs. Aucun frais n'est facturé au Mandant.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>7.</span>
                    <div>
                      <p><strong>Procuration :</strong> Le Mandant autorise e-Advisy à :</p>
                      <ul className="list-disc ml-6 mt-2 space-y-1">
                        <li>Obtenir tous types de renseignements auprès des assureurs</li>
                        <li>Modifier les données personnelles et couvertures</li>
                        <li>Résilier les contrats d'assurance</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>8.</span>
                    <p><strong>Durée :</strong> Le mandat est valable dès signature jusqu'à révocation écrite. Il remplace tout mandat antérieur.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="font-bold" style={{ color: '#1800AD', minWidth: '24px' }}>9.</span>
                    <p><strong>For juridique :</strong> Droit suisse applicable. For juridique à Genève.</p>
                  </div>
                </div>
              </div>

              {/* Déclaration */}
              <div 
                className="p-4 mb-8 text-xs italic rounded"
                style={{ backgroundColor: '#f8f9fa', borderLeft: '4px solid #1800AD' }}
              >
                Par sa signature, le Mandant confirme avoir reçu, lu et compris le présent document, met fin à tout mandat de gestion antérieur, et autorise e-Advisy à agir en son nom auprès des compagnies d'assurances.
              </div>

              {/* Date et lieu */}
              <div className="mb-8 text-center">
                <p className="text-sm">
                  Fait à <strong>{lieu || "_______________"}</strong>, le <strong>{format(new Date(), "dd MMMM yyyy", { locale: fr })}</strong>
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 mb-8">
                <div className="text-center">
                  <div 
                    className="h-28 rounded-lg flex items-center justify-center mb-2"
                    style={{ 
                      backgroundColor: '#fafafa', 
                      border: '2px dashed #1800AD',
                      overflow: 'hidden'
                    }}
                  >
                    {signatureAdvisy ? (
                      <img 
                        src={signatureAdvisy} 
                        alt="Signature e-Advisy" 
                        className="max-h-24 max-w-full object-contain"
                        style={{ filter: 'contrast(1.2)' }}
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">Signature e-Advisy</span>
                    )}
                  </div>
                  <div className="pt-2" style={{ borderTop: '2px solid #1800AD' }}>
                    <p className="font-bold text-sm" style={{ color: '#1800AD' }}>e-Advisy Sàrl</p>
                    <p className="text-xs text-gray-500">Le Mandataire</p>
                  </div>
                </div>
                <div className="text-center">
                  <div 
                    className="h-28 rounded-lg flex items-center justify-center mb-2"
                    style={{ 
                      backgroundColor: '#fafafa', 
                      border: '2px dashed #1800AD',
                      overflow: 'hidden'
                    }}
                  >
                    {signatureClient ? (
                      <img 
                        src={signatureClient} 
                        alt="Signature Mandant" 
                        className="max-h-24 max-w-full object-contain"
                        style={{ filter: 'contrast(1.2)' }}
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">Signature du Mandant</span>
                    )}
                  </div>
                  <div className="pt-2" style={{ borderTop: '2px solid #1800AD' }}>
                    <p className="font-bold text-sm" style={{ color: '#1800AD' }}>{getClientName()}</p>
                    <p className="text-xs text-gray-500">Le Mandant</p>
                  </div>
                </div>
              </div>

              {/* Informations de contact du mandant */}
              <div 
                className="grid grid-cols-3 gap-4 text-xs p-4 rounded-lg"
                style={{ backgroundColor: '#f8f9fa' }}
              >
                <div>
                  <span className="text-gray-500">Téléphone</span>
                  <p className="font-medium">{client.mobile || client.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email</span>
                  <p className="font-medium">{client.email || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Nationalité / Permis</span>
                  <p className="font-medium">{client.nationality || "—"} / {client.permit_type || "—"}</p>
                </div>
              </div>

              {/* Pied de page */}
              <div 
                className="mt-10 pt-6 text-center text-xs text-gray-400"
                style={{ borderTop: '1px solid #e9ecef' }}
              >
                <p className="font-medium" style={{ color: '#1800AD' }}>e-Advisy Sàrl</p>
                <p>Route de Chêne 5 • 1207 Genève • Suisse</p>
                <p>info@e-advisy.ch • www.e-advisy.ch</p>
                <p className="mt-2">Document généré le {format(new Date(), "dd.MM.yyyy 'à' HH:mm")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

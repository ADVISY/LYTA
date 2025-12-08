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
          <CardContent>
            <div 
              ref={mandatRef} 
              className="bg-white text-black p-8 rounded-lg shadow-inner max-w-[210mm] mx-auto"
              style={{ fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}
            >
              {/* En-tête */}
              <div className="text-center mb-8">
                <div className="text-3xl font-bold" style={{ color: '#1800AD' }}>e-Advisy</div>
                <div className="text-lg text-gray-600">Sàrl</div>
              </div>

              <h1 className="text-2xl font-bold text-center mb-8" style={{ color: '#1800AD' }}>
                MANDAT DE GESTION
              </h1>

              {/* Parties */}
              <div className="mb-6">
                <p className="font-semibold">Entre, d'une part :</p>
                <div className="ml-4 mt-2 space-y-1">
                  <p><span className="font-medium">Nom / Entreprise :</span> {getClientName()}</p>
                  <p><span className="font-medium">Prénom / Contact :</span> {getClientPrenom()}</p>
                  <p><span className="font-medium">Rue :</span> {getFullAddress()}</p>
                  <p><span className="font-medium">Localité :</span> {getLocality()}</p>
                  <p><span className="font-medium">Date de naissance :</span> {getBirthdate()}</p>
                </div>
                <p className="mt-2 italic">Dénommé ci-après par « le mandant »</p>
              </div>

              <div className="mb-6">
                <p className="font-semibold">Et, d'autre part :</p>
                <div className="ml-4 mt-2 space-y-1">
                  <p className="font-bold">e-Advisy Sàrl</p>
                  <p>Route de Chêne 5</p>
                  <p>1207 Genève</p>
                </div>
                <p className="mt-2 italic">Dénommé ci-après par « le mandataire »</p>
              </div>

              {/* Assurances actuelles */}
              {getInsurancesList().length > 0 && (
                <div className="mb-6">
                  <h2 className="font-bold text-lg mb-2" style={{ color: '#1800AD' }}>
                    ASSURANCES ACTUELLES DU MANDANT
                  </h2>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">Type d'assurance</th>
                        <th className="border border-gray-300 p-2 text-left">Compagnie actuelle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getInsurancesList().map((ins, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 p-2">{ins.type}</td>
                          <td className="border border-gray-300 p-2">{ins.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Articles */}
              <h2 className="font-bold text-lg mb-4" style={{ color: '#1800AD' }}>
                LES PARTIES CONVIENNENT DE CE QUI SUIT :
              </h2>

              <div className="space-y-3 text-sm">
                <p><strong>1. Objet du contrat :</strong> le présent contrat est un mandat de gestion dans le domaine des assurances de tous types.</p>
                
                <p><strong>2. Prestations – Gestion du portefeuille d'assurances :</strong> e-Advisy négocie les meilleurs contrats d'assurance en fonction des besoins déterminés du Mandant. Celui-ci donne procuration au courtier pour – après entretien avec lui-même – entreprendre toutes les démarches nécessaires à la modification, annulation ou conclusion de polices d'assurance.</p>
                
                <p><strong>3. Informations à la clientèle :</strong> e-Advisy, inscrite auprès de la FINMA en tant que courtier indépendant, collabore avec des compagnies dans tous les domaines d'assurances et ce, de manière neutre. Des conventions de collaboration existent avec les principaux assureurs autorisés en Suisse (y compris les caisses maladie et fondations collectives).</p>
                
                <p><strong>4. Obligations de e-Advisy :</strong> e-Advisy n'effectue que les prestations prévues par le présent contrat ou qui découlent des instructions reçues par le Mandant.</p>
                
                <p><strong>5. Responsabilité :</strong> e-Advisy répond des négligences, des fautes ou des renseignements inexacts en relation avec l'activité de conseil en assurances. Ces risques sont couverts par une assurance responsabilité civile professionnelle.</p>
                
                <p><strong>6. Droits et obligations du Mandant :</strong> le Mandant s'engage à donner à e-Advisy toutes les informations nécessaires à la bonne exécution du présent contrat. Il s'engage notamment à informer e-Advisy de tout élément pouvant influencer les conditions offertes par les assureurs. Le Mandant garde toute liberté dans le choix des assureurs et des contrats d'assurance.</p>
                
                <p><strong>7. Rémunération :</strong> e-Advisy ne reçoit aucun salaire ou rémunération du Mandant dans le cadre du présent contrat. e-Advisy est uniquement rémunérée par le biais des commissions versées par les assureurs.</p>
                
                <p><strong>8. Procuration :</strong> le Mandant autorise e-Advisy à se procurer les renseignements suivants ou à procéder aux actes suivants dans le cadre de l'assurance auprès de tous ses partenaires :</p>
                <ul className="list-disc ml-8">
                  <li>Obtenir tous types de renseignements, y compris des données sensibles</li>
                  <li>Modifier des données personnelles</li>
                  <li>Modifier la couverture d'assurance</li>
                  <li>Résilier la couverture d'assurance</li>
                </ul>
                
                <p><strong>9. Confidentialité :</strong> sous réserve de la protection de leurs propres droits, les parties s'engagent à conserver la teneur de la présente convention confidentielle et à ne pas divulguer son contenu à des tiers sans le consentement exprès de l'une ou l'autre des parties.</p>
                
                <p><strong>10. Entrée en vigueur, durée, résiliation :</strong> le présent mandat est valable dès la date de signature et jusqu'à sa révocation écrite par une des deux parties. Il est conclu pour une période indéterminée et remplace tout mandat antérieur.</p>
                
                <p><strong>11. Droit applicable et for :</strong> le présent contrat est soumis au droit suisse, notamment aux articles 412 et suivants du Code des Obligations. Le for juridique est situé à Genève.</p>
              </div>

              <p className="mt-6 text-sm italic">
                Par sa signature, le Mandant : (I) n'autorise aucune transmission d'informations à son sujet à d'autres interlocuteurs que les compagnies d'assurances qui ont un lien contractuel avec lui ou qui sont susceptibles d'en avoir un ; (II) met fin à tout mandat de gestion d'assurances précédemment signé par ses soins ; (III) confirme avoir reçu, lu et compris le présent document et avoir pu poser toutes les questions y relatives.
              </p>

              {/* Signature */}
              <div className="mt-8">
                <p className="mb-6">
                  Ainsi fait à <strong>{lieu || "___________________"}</strong>, le <strong>{format(new Date(), "dd.MM.yyyy")}</strong>.
                </p>

                <div className="flex justify-between mt-12">
                  <div className="w-2/5">
                    <p className="font-semibold mb-12">e-Advisy Sàrl :</p>
                    <div className="border-t border-black pt-2">Signature</div>
                  </div>
                  <div className="w-2/5">
                    <p className="font-semibold mb-12">Le Mandant :</p>
                    <div className="border-t border-black pt-2">Signature</div>
                  </div>
                </div>

                <div className="mt-8 space-y-2">
                  <p><strong>Téléphone :</strong> {client.mobile || client.phone || "___________________"}</p>
                  <p><strong>Email :</strong> {client.email || "___________________"}</p>
                  <p><strong>Nationalité / permis :</strong> {client.nationality || "____"} / {client.permit_type || "____"}</p>
                </div>
              </div>

              {/* Pied de page */}
              <div className="mt-12 pt-4 border-t text-center text-xs text-gray-500">
                <p>e-Advisy Sàrl – Route de Chêne 5, 1207 Genève – info@e-advisy.ch – www.e-advisy.ch</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

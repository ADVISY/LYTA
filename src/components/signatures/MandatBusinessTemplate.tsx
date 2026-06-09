// MandatBusinessTemplate
// =======================
// Variante "client PRO" du mandat de gestion. Diffère de MandatTemplate
// (qui reste calibré particulier) sur trois points :
//   1. Le bloc "Le Mandant" affiche la raison sociale + IDE + RC + adresse
//      du siège (au lieu de nom/prénom/date de naissance/nationalité).
//   2. Les branches d'assurance ne sont plus les 5 perso (RC ménage, auto,
//      protection juridique, santé, 3e pilier) mais les 10 branches pro
//      remontées par Sammuel/Advisy :
//        LAA / LAAC / LPP / PG maladie / Santé Collective / RC pro /
//        Véhicules à moteur / Protection juridique / RC bâtiment /
//        Autres assurances choses
//   3. Le bloc signature côté Mandant indique la qualité du signataire :
//      "Pour <raison sociale>, représentée par <Prénom Nom>, en qualité de
//      <fonction>". Conforme aux usages suisses (art. 33 CO sur le pouvoir
//      de représentation).
//
// Le reste (clauses 1-7, branding cabinet, signature du Mandataire, mise
// en page) est strictement le même que MandatTemplate — c'est le même
// document juridique, juste avec une identité de mandant adaptée à une
// personne morale.
//
// La fonction signature_power (individual vs collective_2) est stockée en
// DB mais n'est PAS encore exploitée par ce template — l'itération actuelle
// gère une signature unique. Le support de la signature collective à 2
// (deux signataires distincts) viendra dans un second temps si besoin
// remonté par les cabinets.
import { forwardRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface MandatBusinessInsurances {
  laa: string;
  laac: string;
  lpp: string;
  pgMaladie: string;
  santeCollective: string;
  rcPro: string;
  vehiculesMoteur: string;
  protectionJuridique: string;
  rcBatiment: string;
  autresChoses: string;
}

export interface MandatBusinessTemplateData {
  // Tenant / broker branding (identique à MandatTemplate)
  companyName: string;
  companyLogo?: string | null;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  primaryColor?: string;

  // Identité de l'entreprise mandante
  clientCompanyName: string;        // Raison sociale (= clients.company_name)
  clientFullAddress: string;         // Adresse du siège
  clientLocality: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientIde?: string | null;         // CHE-XXX.XXX.XXX
  clientRcCanton?: string | null;
  clientRcNumber?: string | null;

  // Représentant légal qui signe pour l'entreprise
  legalRepFirstName: string;
  legalRepLastName: string;
  legalRepFunction: string;          // Administrateur unique, Directeur, Gérant, etc.
  signaturePower?: "individual" | "collective_2";

  // Portefeuille assurances pro (10 branches)
  insurances: MandatBusinessInsurances;
  autresChosesCompany?: string;      // Si "Autres" sélectionné, nom de la compagnie en clair

  // Contexte de signature
  lieu: string;
  signatureDate?: string;

  // Signatures (data URLs)
  signatureAdvisy?: string | null;
  signatureClient?: string | null;
}

const BRANCH_LABELS: Record<keyof MandatBusinessInsurances, string> = {
  laa:                  "LAA — Assurance accidents",
  laac:                 "LAAC — LAA complémentaire",
  lpp:                  "LPP — 2ᵉ pilier",
  pgMaladie:            "Perte de gain maladie",
  santeCollective:      "Santé collective",
  rcPro:                "RC professionnelle",
  vehiculesMoteur:      "Véhicules à moteur",
  protectionJuridique:  "Protection juridique",
  rcBatiment:           "RC bâtiment",
  autresChoses:         "Autres assurances choses",
};

export const MandatBusinessTemplate = forwardRef<HTMLDivElement, MandatBusinessTemplateData>((props, ref) => {
  const {
    companyName,
    companyLogo,
    companyAddress = "",
    companyPhone = "",
    companyEmail = "",
    companyWebsite = "",
    primaryColor = "#1800AD",
    clientCompanyName,
    clientFullAddress,
    clientLocality,
    clientEmail,
    clientPhone,
    clientIde,
    clientRcCanton,
    clientRcNumber,
    legalRepFirstName,
    legalRepLastName,
    legalRepFunction,
    signaturePower = "individual",
    insurances,
    autresChosesCompany = "",
    lieu,
    signatureDate,
    signatureAdvisy,
    signatureClient,
  } = props;

  const dateObj = signatureDate ? new Date(signatureDate) : new Date();

  // Construit la liste des assurances effectivement renseignées (≠ "Non").
  // Conserve l'ordre métier de la liste Sammuel.
  const orderedKeys: (keyof MandatBusinessInsurances)[] = [
    "laa", "laac", "lpp", "pgMaladie", "santeCollective",
    "rcPro", "vehiculesMoteur", "protectionJuridique", "rcBatiment", "autresChoses",
  ];
  const insuranceList = orderedKeys
    .filter((key) => insurances[key] && insurances[key] !== "Non")
    .map((key) => ({
      type: BRANCH_LABELS[key],
      company: key === "autresChoses" && insurances[key] === "Autre"
        ? (autresChosesCompany || "Autre")
        : insurances[key],
    }));

  const legalRepFullName = `${legalRepFirstName} ${legalRepLastName}`.trim();
  const signatureQuality = `Pour ${clientCompanyName}, représentée par ${legalRepFullName}, en qualité de ${legalRepFunction}`;

  // Le contenu des clauses 1-7 reste identique aux particuliers (le mandat
  // est le même document juridique). On ajuste juste la formulation de la
  // procuration (clause 6) pour mentionner "le Mandant et ses représentants
  // légaux" — plus précis qu'une personne morale "qui modifie ses données".
  const renderClauses = () => ([
    { title: "1. Objet du contrat", body: "Le présent contrat est un mandat de gestion dans le domaine des assurances de tous types." },
    { title: "2. Prestations", body: `${companyName} négocie les meilleurs contrats d'assurance en fonction des besoins du Mandant. Celui-ci donne procuration au courtier pour entreprendre toutes les démarches nécessaires.` },
    { title: "3. Statut FINMA", body: `${companyName}, inscrit auprès de la FINMA en tant que courtier indépendant, collabore de manière neutre avec les principaux assureurs autorisés en Suisse.` },
    { title: "4. Responsabilité", body: `${companyName} répond des négligences ou fautes en relation avec l'activité de conseil. Ces risques sont couverts par une assurance RC professionnelle.` },
    { title: "5. Rémunération", body: `${companyName} est uniquement rémunéré par les commissions versées par les assureurs. Aucun frais n'est facturé au Mandant.` },
    { title: "6. Procuration", body: `Le Mandant et ses représentants légaux autorisent ${companyName} à obtenir tous renseignements auprès des assureurs, modifier les données de l'entreprise et les couvertures souscrites, et résilier les contrats existants.` },
    { title: "7. Durée et for juridique", body: "Valable dès signature jusqu'à révocation écrite. Droit suisse applicable." },
  ]);

  return (
    <div
      ref={ref}
      className="bg-white text-black mx-auto"
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        lineHeight: 1.4,
        width: "190mm",
        fontSize: "11px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      {/* PAGE 1 */}
      <div style={{ padding: "30px 35px", boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
        {companyLogo && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", opacity: 0.06, pointerEvents: "none", zIndex: 0 }}>
            <img src={companyLogo} alt="" style={{ width: "400px", height: "auto" }} />
          </div>
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* En-tête cabinet */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", paddingBottom: "15px", borderBottom: `3px solid ${primaryColor}` }}>
            <div>
              {companyLogo && <img src={companyLogo} alt={companyName} style={{ height: "50px", width: "auto", marginBottom: "8px" }} />}
              <div style={{ fontSize: "9px", color: "#666" }}>
                {companyAddress && <>{companyAddress}<br /></>}
                {companyEmail}{companyWebsite ? ` • ${companyWebsite}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", backgroundColor: primaryColor, color: "white", padding: "4px 12px", borderRadius: "12px", display: "inline-block" }}>
                Inscrit FINMA
              </div>
              <div style={{ fontSize: "9px", color: "#666", marginTop: "5px" }}>{format(dateObj, "dd.MM.yyyy")}</div>
            </div>
          </div>

          {/* Titre */}
          <div style={{ textAlign: "center", marginBottom: "25px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: primaryColor, letterSpacing: "3px", margin: 0 }}>MANDAT DE GESTION</h1>
            <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "2px", marginTop: "6px" }}>Client entreprise</div>
            <div style={{ width: "80px", height: "3px", backgroundColor: primaryColor, margin: "10px auto 0" }} />
          </div>

          {/* Bloc Mandant — entreprise */}
          <div style={{ backgroundColor: "#f8f9fa", padding: "15px 20px", borderRadius: "8px", border: "1px solid #e9ecef", marginBottom: "20px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#666", marginBottom: "8px", letterSpacing: "2px", fontWeight: "bold" }}>Le Mandant — Personne morale</div>
            <div style={{ fontWeight: "bold", color: primaryColor, fontSize: "16px", marginBottom: "5px" }}>{clientCompanyName}</div>
            <div style={{ fontSize: "12px", color: "#333", marginBottom: "3px" }}>{clientFullAddress}</div>
            <div style={{ fontSize: "12px", color: "#333", marginBottom: "8px" }}>{clientLocality}</div>

            {clientIde && (
              <div style={{ fontSize: "11px", color: "#333" }}>
                <strong>N° IDE :</strong> {clientIde}
              </div>
            )}
            {(clientRcCanton || clientRcNumber) && (
              <div style={{ fontSize: "11px", color: "#333" }}>
                <strong>Registre du commerce :</strong>{" "}
                {clientRcCanton && <>canton de {clientRcCanton}</>}
                {clientRcCanton && clientRcNumber && " — "}
                {clientRcNumber && <>n° {clientRcNumber}</>}
              </div>
            )}
            {clientEmail && <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>{clientEmail}</div>}
            {clientPhone && <div style={{ fontSize: "11px", color: "#666" }}>{clientPhone}</div>}

            {/* Représentant légal */}
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #d0d0d0" }}>
              <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#666", marginBottom: "4px", letterSpacing: "1.5px", fontWeight: "bold" }}>Représenté(e) par</div>
              <div style={{ fontSize: "12px", color: "#333" }}>
                <strong>{legalRepFullName}</strong>
                {legalRepFunction && <> — {legalRepFunction}</>}
              </div>
              <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>
                Pouvoir de signature : {signaturePower === "collective_2" ? "collectif à deux" : "individuel"}
              </div>
            </div>
          </div>

          {/* Bloc Mandataire (cabinet) — identique au mandat privé */}
          <div style={{ backgroundColor: primaryColor, color: "white", padding: "15px 20px", borderRadius: "8px", marginBottom: "25px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.7, marginBottom: "8px", letterSpacing: "2px", fontWeight: "bold" }}>Le Mandataire</div>
            <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "5px" }}>{companyName}</div>
            {companyAddress && <div style={{ fontSize: "12px" }}>{companyAddress}</div>}
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "5px" }}>
              {companyEmail}{companyPhone ? ` • ${companyPhone}` : ""}
            </div>
          </div>

          {/* Portefeuille assurances pro */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: primaryColor, marginBottom: "10px", paddingBottom: "5px", borderBottom: `2px solid ${primaryColor}`, letterSpacing: "1px" }}>
              PORTEFEUILLE D'ASSURANCES ACTUEL — ENTREPRISE
            </div>
            {insuranceList.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ backgroundColor: primaryColor, color: "white" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "bold" }}>Branche</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "bold" }}>Compagnie actuelle</th>
                  </tr>
                </thead>
                <tbody>
                  {insuranceList.map((ins, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#f8f9fa" : "white" }}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #e9ecef" }}>{ins.type}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #e9ecef", fontWeight: 600, color: primaryColor }}>{ins.company}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px", textAlign: "center", color: "#666", fontSize: "11px" }}>
                Aucune assurance existante renseignée
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", fontSize: "9px", color: "#999", borderTop: "1px solid #e9ecef", paddingTop: "10px" }}>
            Page 1/2 • Mandat de Gestion — Entreprise • {clientCompanyName}
          </div>
        </div>
      </div>

      {/* PAGE 2 — Clauses + signatures */}
      <div style={{ padding: "30px 35px", boxSizing: "border-box", pageBreakBefore: "always", position: "relative", overflow: "hidden" }}>
        {companyLogo && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", opacity: 0.06, pointerEvents: "none", zIndex: 0 }}>
            <img src={companyLogo} alt="" style={{ width: "400px", height: "auto" }} />
          </div>
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "10px", borderBottom: `2px solid ${primaryColor}` }}>
            {companyLogo
              ? <img src={companyLogo} alt={companyName} style={{ height: "35px", width: "auto" }} />
              : <div style={{ fontWeight: "bold", color: primaryColor }}>{companyName}</div>}
            <div style={{ fontSize: "10px", color: "#666" }}>Mandat de Gestion — Entreprise • {clientCompanyName}</div>
          </div>

          <div style={{ marginBottom: "25px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: primaryColor, marginBottom: "15px", paddingBottom: "8px", borderBottom: `3px solid ${primaryColor}`, letterSpacing: "2px" }}>
              CONDITIONS DU MANDAT
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              {renderClauses().map((c, i) => (
                <div key={i} style={{ backgroundColor: "#f8f9fa", padding: "12px 15px", borderRadius: "6px", borderLeft: `4px solid ${primaryColor}` }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", color: primaryColor, marginBottom: "4px" }}>{c.title}</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.5, color: "#333" }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "12px 15px", marginBottom: "20px", fontSize: "10px", fontStyle: "italic", backgroundColor: "#f8f9fa", borderLeft: `4px solid ${primaryColor}`, borderRadius: "4px" }}>
            Par sa signature, {legalRepFullName}, agissant en qualité de {legalRepFunction} pour {clientCompanyName}, confirme avoir reçu, lu et compris le présent document, met fin à tout mandat de gestion antérieur, et autorise {companyName} à agir au nom de l'entreprise auprès des compagnies d'assurances.
          </div>

          <div style={{ textAlign: "center", marginBottom: "25px", fontSize: "12px" }}>
            Fait à <strong>{lieu || "_______________"}</strong>, le <strong>{format(dateObj, "dd MMMM yyyy", { locale: fr })}</strong>
          </div>

          {/* Signatures */}
          <div style={{ display: "flex", gap: "30px", marginBottom: "30px" }}>
            {/* Signature Mandataire (cabinet) — inchangée */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: "90px", backgroundColor: "#fafafa", border: `2px dashed ${primaryColor}`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                {signatureAdvisy ? (
                  <img src={signatureAdvisy} alt={`Signature ${companyName}`} style={{ maxHeight: "80px", maxWidth: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ color: "#999", fontSize: "10px" }}>Signature {companyName}</span>
                )}
              </div>
              <div style={{ borderTop: `2px solid ${primaryColor}`, paddingTop: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", color: primaryColor }}>{companyName}</div>
                <div style={{ fontSize: "10px", color: "#666" }}>Le Mandataire</div>
              </div>
            </div>

            {/* Signature Mandant (entreprise via représentant) */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: "90px", backgroundColor: "#fafafa", border: `2px dashed ${primaryColor}`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                {signatureClient ? (
                  <img src={signatureClient} alt={`Signature ${legalRepFullName}`} style={{ maxHeight: "80px", maxWidth: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ color: "#999", fontSize: "10px" }}>Signature du représentant</span>
                )}
              </div>
              <div style={{ borderTop: `2px solid ${primaryColor}`, paddingTop: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", color: primaryColor }}>{legalRepFullName}</div>
                <div style={{ fontSize: "9px", color: "#666", lineHeight: 1.3, marginTop: "2px" }}>
                  {signatureQuality}
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e9ecef", paddingTop: "15px", textAlign: "center", fontSize: "9px", color: "#999" }}>
            <div style={{ fontWeight: "bold", color: primaryColor, fontSize: "11px" }}>{companyName}</div>
            {companyAddress && <div>{companyAddress}</div>}
            <div>{companyEmail}{companyWebsite ? ` • ${companyWebsite}` : ""}</div>
            <div style={{ marginTop: "8px" }}>Document généré le {format(dateObj, "dd.MM.yyyy 'à' HH:mm")} • Page 2/2</div>
          </div>
        </div>
      </div>
    </div>
  );
});

MandatBusinessTemplate.displayName = "MandatBusinessTemplate";

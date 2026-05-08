// Render of the "Mandat de gestion" PDF body. Shared between the broker-side form
// and the public client signing page so both sides produce the same document.
import { forwardRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface MandatTemplateInsurances {
  rcMenage: string;
  auto: string;
  protectionJuridique: string;
  sante: string;
  vie3ePilier: string;
  autre: string;
}

export interface MandatTemplateData {
  // Tenant / broker branding
  companyName: string;
  companyLogo?: string | null;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  primaryColor?: string;

  // Client snapshot
  clientName: string;
  clientFullAddress: string;
  clientLocality: string;
  clientBirthdate: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientNationality?: string | null;
  clientPermitType?: string | null;

  // Insurance portfolio
  insurances: MandatTemplateInsurances;
  autreCompany?: string;

  // Signing context
  lieu: string;
  signatureDate?: string; // ISO; defaults to now

  // Signatures (data URLs)
  signatureAdvisy?: string | null;
  signatureClient?: string | null;
}

export const MandatTemplate = forwardRef<HTMLDivElement, MandatTemplateData>((props, ref) => {
  const {
    companyName,
    companyLogo,
    companyAddress = "",
    companyPhone = "",
    companyEmail = "",
    companyWebsite = "",
    primaryColor = "#1800AD",
    clientName,
    clientFullAddress,
    clientLocality,
    clientBirthdate,
    clientEmail,
    clientPhone,
    clientNationality,
    clientPermitType,
    insurances,
    autreCompany = "",
    lieu,
    signatureDate,
    signatureAdvisy,
    signatureClient,
  } = props;

  const dateObj = signatureDate ? new Date(signatureDate) : new Date();

  const insuranceList: { type: string; company: string }[] = [];
  if (insurances.rcMenage !== "Non") insuranceList.push({ type: "RC Ménage", company: insurances.rcMenage });
  if (insurances.auto !== "Non") insuranceList.push({ type: "Assurance Auto", company: insurances.auto });
  if (insurances.protectionJuridique !== "Non") insuranceList.push({ type: "Protection Juridique", company: insurances.protectionJuridique });
  if (insurances.sante !== "Non") insuranceList.push({ type: "Assurance Santé", company: insurances.sante });
  if (insurances.vie3ePilier !== "Non") insuranceList.push({ type: "3e Pilier / Vie", company: insurances.vie3ePilier });
  if (insurances.autre !== "Non") insuranceList.push({ type: "Autre", company: insurances.autre === "Autre" ? autreCompany : insurances.autre });

  const renderClauses = () => ([
    { title: "1. Objet du contrat", body: "Le présent contrat est un mandat de gestion dans le domaine des assurances de tous types." },
    { title: "2. Prestations", body: `${companyName} négocie les meilleurs contrats d'assurance en fonction des besoins du Mandant. Celui-ci donne procuration au courtier pour entreprendre toutes les démarches nécessaires.` },
    { title: "3. Statut FINMA", body: `${companyName}, inscrit auprès de la FINMA en tant que courtier indépendant, collabore de manière neutre avec les principaux assureurs autorisés en Suisse.` },
    { title: "4. Responsabilité", body: `${companyName} répond des négligences ou fautes en relation avec l'activité de conseil. Ces risques sont couverts par une assurance RC professionnelle.` },
    { title: "5. Rémunération", body: `${companyName} est uniquement rémunéré par les commissions versées par les assureurs. Aucun frais n'est facturé au Mandant.` },
    { title: "6. Procuration", body: `Le Mandant autorise ${companyName} à obtenir tous renseignements auprès des assureurs, modifier les données personnelles et couvertures, et résilier les contrats.` },
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

          <div style={{ textAlign: "center", marginBottom: "25px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: primaryColor, letterSpacing: "3px", margin: 0 }}>MANDAT DE GESTION</h1>
            <div style={{ width: "80px", height: "3px", backgroundColor: primaryColor, margin: "10px auto 0" }} />
          </div>

          <div style={{ backgroundColor: "#f8f9fa", padding: "15px 20px", borderRadius: "8px", border: "1px solid #e9ecef", marginBottom: "20px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#666", marginBottom: "8px", letterSpacing: "2px", fontWeight: "bold" }}>Le Mandant</div>
            <div style={{ fontWeight: "bold", color: primaryColor, fontSize: "16px", marginBottom: "5px" }}>{clientName}</div>
            <div style={{ fontSize: "12px", color: "#333", marginBottom: "3px" }}>{clientFullAddress}</div>
            <div style={{ fontSize: "12px", color: "#333", marginBottom: "3px" }}>{clientLocality}</div>
            <div style={{ fontSize: "11px", color: "#666" }}>Né(e) le {clientBirthdate}</div>
            {clientEmail && <div style={{ fontSize: "11px", color: "#666" }}>{clientEmail}</div>}
            {clientPhone && <div style={{ fontSize: "11px", color: "#666" }}>{clientPhone}</div>}
            <div style={{ fontSize: "11px", color: "#666" }}>Nationalité: {clientNationality || "—"} • Permis: {clientPermitType || "—"}</div>
          </div>

          <div style={{ backgroundColor: primaryColor, color: "white", padding: "15px 20px", borderRadius: "8px", marginBottom: "25px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.7, marginBottom: "8px", letterSpacing: "2px", fontWeight: "bold" }}>Le Mandataire</div>
            <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "5px" }}>{companyName}</div>
            {companyAddress && <div style={{ fontSize: "12px" }}>{companyAddress}</div>}
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "5px" }}>
              {companyEmail}{companyPhone ? ` • ${companyPhone}` : ""}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: primaryColor, marginBottom: "10px", paddingBottom: "5px", borderBottom: `2px solid ${primaryColor}`, letterSpacing: "1px" }}>
              PORTEFEUILLE D'ASSURANCES ACTUEL
            </div>
            {insuranceList.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ backgroundColor: primaryColor, color: "white" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "bold" }}>Type d'assurance</th>
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
            Page 1/2 • Mandat de Gestion • {clientName}
          </div>
        </div>
      </div>

      {/* PAGE 2 */}
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
            <div style={{ fontSize: "10px", color: "#666" }}>Mandat de Gestion • {clientName}</div>
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
            Par sa signature, le Mandant confirme avoir reçu, lu et compris le présent document, met fin à tout mandat de gestion antérieur, et autorise {companyName} à agir en son nom auprès des compagnies d'assurances.
          </div>

          <div style={{ textAlign: "center", marginBottom: "25px", fontSize: "12px" }}>
            Fait à <strong>{lieu || "_______________"}</strong>, le <strong>{format(dateObj, "dd MMMM yyyy", { locale: fr })}</strong>
          </div>

          <div style={{ display: "flex", gap: "30px", marginBottom: "30px" }}>
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
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: "90px", backgroundColor: "#fafafa", border: `2px dashed ${primaryColor}`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                {signatureClient ? (
                  <img src={signatureClient} alt="Signature Mandant" style={{ maxHeight: "80px", maxWidth: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ color: "#999", fontSize: "10px" }}>Signature du Mandant</span>
                )}
              </div>
              <div style={{ borderTop: `2px solid ${primaryColor}`, paddingTop: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", color: primaryColor }}>{clientName}</div>
                <div style={{ fontSize: "10px", color: "#666" }}>Le Mandant</div>
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

MandatTemplate.displayName = "MandatTemplate";

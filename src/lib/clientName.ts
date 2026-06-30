/**
 * getClientDisplayName — Nom à afficher pour un client, partout dans LYTA.
 *
 * Pourquoi ce helper : avant juin 2026, plusieurs fichiers (ClientDetail,
 * ClientsList, CommissionForm, MandatGestionForm, EmailComposer, etc.)
 * faisaient chacun leur propre logique :
 *
 *   if (client.company_name) return client.company_name;
 *   if (client.first_name || client.last_name) ...
 *
 * Problème : `company_name` est rempli même pour des PERSONNES PHYSIQUES
 * quand l'IA Scan ou le self-signup remplit le champ avec l'employeur
 * du client (cas vu en prod : SarCom Francis Sarret, courtier indépendant
 * dont le `company_name` a été collé avec son cabinet "SarCom, Francis
 * Sarret" alors que c'est une personne physique). Résultat : toutes les
 * pages affichaient "SarCom, Francis Sarret" au lieu de "Francis Sarret".
 *
 * La règle correcte :
 *   - Une SOCIÉTÉ (is_company = true) : on affiche company_name
 *   - Une PERSONNE PHYSIQUE : on affiche first_name + last_name
 *     (company_name est traité comme une métadonnée employeur, pas une identité)
 *   - Fallback ultime : si on n'a vraiment rien, on tombe sur company_name
 *     ou email pour ne pas afficher "Sans nom" inutilement.
 */

export interface ClientNameInput {
  is_company?: boolean | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
}

export function getClientDisplayName(
  client: ClientNameInput | null | undefined,
  fallback: string = "Sans nom",
): string {
  if (!client) return fallback;

  // Cas SOCIÉTÉ : on prend toujours company_name s'il est défini
  if (client.is_company === true && client.company_name) {
    return client.company_name.trim();
  }

  // Cas PERSONNE PHYSIQUE : prénom + nom
  const fullName = [client.first_name, client.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;

  // Fallback : pas de prénom/nom (fiche incomplète) → on tombe sur company_name
  // ou email pour avoir quelque chose à afficher au lieu de "Sans nom"
  if (client.company_name) return client.company_name.trim();
  if (client.email) return client.email.trim();

  return fallback;
}

/**
 * getClientShortName — Version courte (initiales ou prénom seul) pour les
 * avatars et badges. Si is_company, retourne les 2 premières lettres du
 * company_name. Sinon, prénom complet ou initiales si on n'a que le nom.
 */
export function getClientShortName(client: ClientNameInput | null | undefined): string {
  if (!client) return "?";
  if (client.is_company === true && client.company_name) {
    return client.company_name.trim().slice(0, 2).toUpperCase();
  }
  if (client.first_name) return client.first_name.trim();
  if (client.last_name) return client.last_name.trim();
  if (client.company_name) return client.company_name.trim().slice(0, 2).toUpperCase();
  return "?";
}

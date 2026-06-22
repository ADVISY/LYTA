# Sprint LYTA — Semaine du 22 au 26 juin 2026

> **Préparé** le 15 juin 2026 pour démarrage le 22 juin (lundi)
> **Mis à jour** le 22 juin 2026 — ajout session sécu phase 2 vendredi
> **Hypothèse de travail** : 1-2 signatures cabinets cette semaine (L'Agence25 + autres)
> **Si pas de signature** : on garde le sprint mais on baisse l'ambition (1 module au lieu de 4)

---

## ⚠️ Session sécurité phase 2 — Vendredi 26 juin (2-3h)

Fin du sprint = nettoyer les warnings Supabase Advisor remontés à 261
(vs 139 le 12 juin). Cible : redescendre à ~50 (le reste = SECURITY
DEFINER authenticated volontaires).

### Items à traiter
- ☐ Search_path figé sur les nouvelles fonctions (V1 diag, suivis triggers)
- ☐ V8 Régénérer types Supabase (5 min)
- ☐ V9 Audit vue `clients_safe` orpheline (drop ou documenter)
- ☐ Audit ciblé des 128 SECURITY DEFINER authenticated (catégoriser
  volontaires vs à durcir)
- ☐ Mise à jour `LYTA_Security_Audit_CONFIDENTIAL.md` (v1.2)
- ☐ Régénération PDF

### Items reportés (sprint suivant ou Q3)
- V4 Reset password redirect URL audit tenant-onboarding (4h)
- V6 Logs edge fn stack traces audit (4h)
- Pen test externe avant signature 5+ tenants

---

## 🎯 Vue d'ensemble

| Module | Effort | Cible deploy | Priorité |
|---|---|---|---|
| 1. Module Documents v2 (dossiers + visibilité) | 1 j | Mardi 23 soir | ⭐⭐⭐ Argument de vente |
| 2. DL en masse + renommage (suite Docs) | 1 j | Mercredi 24 soir | ⭐⭐⭐ |
| 3. Mobile Responsive v2 | 1 j | Jeudi 25 soir | ⭐⭐ |
| 4. Google Calendar OAuth | 5 j | Mardi 30 juin | ⭐⭐⭐ |
| 5. 3CX intégration | 4 j | Vendredi 3 juillet | ⭐⭐ |

**Total** : ~12 jours de dev → étalé sur 2 semaines (22 juin – 3 juillet)

---

## 1. 📁 Module Documents v2 — Dossiers + visibilité client

### Objectif métier
Permettre aux courtiers d'organiser les documents par dossiers (KYC, contrats, recherches LPP…) et de **masquer** certaines pièces au client final dans son espace portail.

### Migration DB

```sql
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  owner_type text NOT NULL CHECK (owner_type IN ('client','policy','contract','partner')),
  owner_id uuid NOT NULL,
  parent_folder_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  icon text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.documents
  ADD COLUMN folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL,
  ADD COLUMN visible_to_client boolean NOT NULL DEFAULT true;

CREATE INDEX idx_doc_folders_owner ON document_folders(owner_type, owner_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);

-- RLS document_folders : même policy que documents
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage folders" ON public.document_folders
  FOR ALL USING (
    public.is_king()
    OR (owner_type = 'client' AND public.can_access_client(owner_id))
    OR public.is_crm_member_of_tenant(tenant_id)
  )
  WITH CHECK (public.is_crm_member_of_tenant(tenant_id));

-- Côté portail client : filtrer visible_to_client
-- (ajouter la condition à la policy documents existante pour le rôle client)
```

### Composants front
- `DocumentFolderTree.tsx` : arborescence avec navigation breadcrumb
- `CreateFolderDialog.tsx` : modale création dossier (nom, couleur, icône, visible défaut)
- `DocumentMoveAction.tsx` : drag & drop ou menu contextuel "Déplacer vers..."
- `DocumentVisibilityToggle.tsx` : icône œil 👁/🚫 par document, bulk action
- Modif `useDocuments.tsx` : prise en compte folder_id + visible_to_client

### Templates auto à la création client
À l'INSERT d'un nouveau client, créer automatiquement 4 dossiers par défaut :
- 📁 **Pièces internes (KYC)** — masqué client par défaut
- 📁 **Contrats actifs** — visible client
- 📁 **Devis & propositions** — visible client
- 📁 **Communications** — visible client

→ Implémenter via trigger Postgres `AFTER INSERT ON clients` ou côté front au moment de la création.

### Critères de succès
- ✅ Un courtier peut créer/renommer/supprimer un dossier
- ✅ Un document peut être déplacé d'un dossier à l'autre (drag & drop OU bouton)
- ✅ Toggle œil sur un doc → invisible côté portail client immédiatement
- ✅ Côté portail client, les dossiers masqués n'apparaissent JAMAIS (même pas par URL directe → RLS)
- ✅ Bulk action : sélectionner 5 docs → "Masquer" en 1 clic

---

## 2. 📥 DL en masse + renommage (suite Documents)

### Téléchargement ZIP avec arborescence

**Bouton** "📥 Tout télécharger (ZIP)" sur la vue documents client.

**Modale de choix avant DL** :
- ☐ Tous les documents (vue courtier)
- ☐ Uniquement ceux visibles au client (pour envoi rapide)
- ☐ Inclure un index PDF récapitulatif

**Implémentation** :
- Lib : `jszip` côté front (npm install jszip)
- Pour chaque doc, fetch signed URL Supabase Storage → add to ZIP avec chemin folder/filename
- Progress bar si > 5 docs
- Nom du fichier : `Documents_[Prénom-Nom]_[YYYY-MM-DD].zip`

**Snippet de base** :
```tsx
import JSZip from 'jszip';

async function downloadAllDocuments(clientId: string, opts: { onlyVisible: boolean }) {
  const zip = new JSZip();
  const docs = await fetchDocuments(clientId, opts);
  
  for (const doc of docs) {
    const signed = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_key, 300);
    const blob = await fetch(signed.data.signedUrl).then(r => r.blob());
    const path = doc.folder ? `${doc.folder.name}/${doc.file_name}` : doc.file_name;
    zip.file(path, blob);
  }
  
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `Documents_${clientName}_${today}.zip`);
}
```

### Renommer document inline
- Double-clic sur le nom → input éditable
- Save → update `documents.file_name`
- `file_key` reste immutable (pas de manip Storage)
- Le ZIP DL utilise le nouveau nom

### Renommer dossier inline
- Double-clic sur le nom → input éditable
- Save → update `document_folders.name`
- Breadcrumb auto-refresh partout

### Bonus rapides
- Renommage en lot (préfixe/suffixe)
- Drag & drop d'un dossier entier depuis l'ordi vers LYTA (recrée arbo)
- ZIP chiffré par mot de passe (option)

---

## 3. 📱 Mobile Responsive v2

### Objectif
Rendre LYTA utilisable sur iPhone. Audit visuel du 15 juin 2026 sur
iPhone (17 screenshots dans `~/Desktop/Projects/LYTA/lyta mobile/`)
confirme 3 problèmes critiques :
  1. **Tableaux de listes illisibles** sur 5 pages (Clients, Collaborateurs,
     Commissions, Paramètres > Utilisateurs, Suivis)
  2. **Boutons d'action coupés à droite** (Dashboard, Fiche client,
     Commissions, Paramètres > Profil → "Changer le mot de pass…")
  3. **Topbar prend ~25% de l'écran** (logo trop gros + barre supérieure
     globe+ inutilisée)

### Pages à fixer (par priorité depuis audit screenshots)
| Page | Problème principal observé | Sévérité |
|---|---|---|
| **ClientsList** | Tableau coupé partout, noms tronqués gauche/droite | 🔴 P0 |
| **Paramètres > Utilisateurs** | Tableau coupé, rôles "Admi…" | 🔴 P0 |
| **Collaborateurs** liste | Tableau coupé, emails OK mais cols suivantes coupées | 🔴 P0 |
| **Commissions** liste | Tableau Montant coupé à droite + boutons d'action coupés | 🔴 P0 |
| **Fiche client > Suivis** | Cards KPI coupées + tableau coupé | 🔴 P0 |
| **Dashboard** | Bandeau "Vos clients vous attendent !" coupé + filtres graph | 🟠 P1 |
| **Fiche client header** | Bouton "Créer espac…" coupé | 🟠 P1 |
| **Topbar globale** | Logo trop gros + barre inutile au-dessus | 🟠 P1 |
| **Paramètres > Profil** | Bouton "Changer le mot de pass…" coupé | 🟠 P1 |
| **Portail client** | À auditer (non couvert dans les 17 screenshots) | 🟡 P2 |

### Solution
Nouveau composant générique `<ResponsiveDataTable>` :
- **Desktop** : table classique avec sort + filter (comportement actuel)
- **Mobile** : cards empilées verticalement avec :
  - Colonne `primary` en titre (ex: nom client)
  - 2-3 colonnes `secondary` en sous-titre
  - Badge statut à droite
  - Click → même action que click row desktop

### Layout mobile cible (ex: ClientsList)
```
┌────────────────────────────────────┐
│ 👤 Jean Dupont       ●  Prospect   │
│    jean.dupont@mail.com            │
│    Genève · LAMal · Agent: Habib   │
└────────────────────────────────────┘
```

### Pages à refactorer (par priorité)
1. **ClientsList** ⭐⭐⭐ (le plus visible)
2. **CRMSuivis** ⭐⭐⭐
3. **CRMCommissions** ⭐⭐⭐
4. **CRMCompta** ⭐⭐
5. **CRMCollaborateurs** ⭐⭐
6. **CRMRapports** ⭐
7. **CRMParametres** ⭐
8. **ClientDetail** (sous-tableaux) ⭐

### Hooks utilitaires
- `useBreakpoint()` → `"mobile" | "tablet" | "desktop"` (basé sur window.innerWidth + listener resize)

### Bonus optionnels
- Pull-to-refresh sur les listes
- Swipe action sur les cards (archiver / favori)
- Vue map clients avec cluster

---

## 4. 📅 Google Calendar OAuth

### Objectif
Permettre à chaque user LYTA de connecter son Google Calendar → bidirectionnel :
- Créer un RDV LYTA → événement Google auto
- Voir les événements Google dans la vue Calendrier LYTA
- Update / suppression sync

### Étapes techniques

**Google Cloud Console** :
1. Créer projet "LYTA Production"
2. Activer "Google Calendar API"
3. OAuth consent screen (interne ou public selon stratégie)
4. Credentials OAuth 2.0 Web Application
5. Redirect URI : `https://app.lyta.ch/auth/google/callback` + sub-domaines tenants

**Supabase** :
```sql
CREATE TABLE public.user_google_calendar_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  google_email text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  default_calendar_id text NOT NULL,
  scopes text[] NOT NULL,
  connected_at timestamptz DEFAULT now(),
  last_sync_at timestamptz,
  is_active boolean DEFAULT true
);
```

Stockage du refresh_token via **Supabase Vault** (chiffré).

**Edge functions** :
- `google-oauth-init` : génère l'URL OAuth + redirect
- `google-oauth-callback` : échange code → access+refresh tokens, stocke chiffré
- `google-calendar-create-event` : POST `/calendar/v3/calendars/{id}/events`
- `google-calendar-list-events` : GET avec timeMin/timeMax
- `google-calendar-update-event` : PATCH
- `google-calendar-delete-event` : DELETE
- `google-calendar-refresh-token` : helper qui régénère access token

**Front** :
- Page `Paramètres > Intégrations` avec section "Google Calendar"
- Bouton "Connecter Google Calendar"
- Statut connecté/déconnecté + email du compte
- Bouton "Déconnecter" (REVOKE Google + DELETE credentials)
- Toast "Sync en cours…" + "Sync OK"

### Scopes Google demandés
`https://www.googleapis.com/auth/calendar.events` (créer/modifier les events sans voir tous les events perso)

### Sécurité (nLPD / RGPD)
- L'user voit la liste des permissions accordées avant validation
- Déconnexion = REVOKE auprès de Google + DELETE credentials côté LYTA
- Logs d'audit des syncs (qui, quoi, quand) dans `audit_log`

### Effort
**5 jours** réparti :
- J1 : Setup Google Cloud + secrets Vault
- J2 : Edge fn callback + table credentials + RLS
- J3 : Edge fn create-event + sync sortant + tests
- J4 : Front (page intégrations + vue calendrier qui affiche events Google)
- J5 : Cas tombants (token expiré, refresh, déconnexion, multi-comptes)

---

## 5. ☎️ 3CX intégration

### Objectif
Brancher LYTA à la téléphonie 3CX (centrale VoIP utilisée par beaucoup de cabinets) pour :
1. **Click-to-call** depuis fiche client
2. **Pop-up appel entrant** : "Appel entrant de Jean Dupont (client)"
3. **Historique appels** dans la fiche client

### Modèle DB
```sql
CREATE TABLE public.tenant_3cx_credentials (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  pbx_url text NOT NULL,
  api_token_encrypted text NOT NULL,
  extension_default text,
  connected_by uuid REFERENCES auth.users(id),
  connected_at timestamptz DEFAULT now()
);

CREATE TABLE public.client_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id),
  direction text CHECK (direction IN ('inbound', 'outbound')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds int,
  extension text,
  caller_number text,
  callee_number text,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);
```

### Edge functions
- `3cx-connect` : valide les credentials PBX
- `3cx-webhook-call-event` : reçoit les events 3CX (call-start, call-end)
- `3cx-click-to-call` : déclenche un appel via API 3CX

### Front
- Section "3CX" dans Paramètres > Intégrations
- Bouton "Appeler" sur chaque fiche client (icône téléphone)
- Toast notif sur appel entrant avec lien fiche client
- Onglet "Appels" dans fiche client avec historique

### Effort
**4 jours**

---

## 📋 Planning détaillé

```
Lundi 22 juin
  09h-13h  Documents v2 — Migration DB + RLS + Hooks
  14h-18h  Documents v2 — Composant DocumentFolderTree + Drag&Drop

Mardi 23 juin
  09h-13h  Documents v2 — Toggle visibilité + Bulk + Templates auto
  14h-18h  Documents v2 — DL en masse ZIP + Renommage inline
  Soir     ✅ DEPLOY Documents v2

Mercredi 24 juin
  09h-13h  Mobile Responsive — ResponsiveDataTable + ClientsList
  14h-18h  Mobile Responsive — CRMSuivis + CRMCommissions

Jeudi 25 juin
  09h-13h  Mobile Responsive — CRMCompta + autres pages
  14h-18h  Mobile Responsive — Tests + ajustements
  Soir     ✅ DEPLOY Mobile Responsive v2

Vendredi 26 juin
  09h-18h  Google Calendar — Setup Google Cloud + Edge fn callback

Weekend 27-28 juin — repos

Lundi 29 juin
  09h-18h  Google Calendar — Edge fn create-event + sync sortant

Mardi 30 juin
  09h-18h  Google Calendar — Front intégrations + vue calendrier
  Soir     ✅ DEPLOY Google Calendar OAuth

Mercredi 1er juillet
  09h-18h  3CX — Setup + Edge fn connect + table credentials

Jeudi 2 juillet
  09h-18h  3CX — Webhook + Edge fn click-to-call

Vendredi 3 juillet
  09h-13h  3CX — Front + tests
  14h-18h  Tests généraux + bug fixes
  Soir     ✅ DEPLOY 3CX

→ Module complet "Hub d'intégrations" sorti, prêt pour relance commerciale rentrée août
```

---

## 🎯 Stratégie commerciale parallèle

| Semaine | Focus dev | Focus commercial |
|---|---|---|
| 22-26 juin | Documents + Mobile | Relance non-ouvreurs campagne, demos calées |
| 29 juin - 3 juil | Google Calendar + 3CX | Onboarding nouveaux clients signés |
| 6-31 juillet | Bug fixes, polish, doc | Vacances + onboarding clients |
| **18 août - rentrée** | **Sortie publique modules intégrations** | **Reprise prospection + cooptation** |

---

## ✅ Critères de succès du sprint

1. ✅ **2-3 nouvelles ventes signées avant le 29 juin** (cible : Advisy → 4 cabinets total)
2. ✅ **Documents v2 + Mobile + Google Calendar déployés en prod le 30 juin** (J-1 vacances)
3. ✅ **3CX en prod le 3 juillet** ou décalé semaine du 18 août selon priorité
4. ✅ **Au moins 1 cabinet pilote** sur Google Calendar avant les vacances
5. ✅ **NPS auto-mesuré** post-onboarding (à brancher dans LYTA)

---

## 🚨 Si pas de ventes cette semaine (plan B)

Si campagne email + cold call + démos = 0 vente d'ici vendredi 19 juin, on **réduit le sprint** :
- ✅ Garder Documents v2 + Mobile (différenciateurs critiques)
- ❌ Reporter Google Calendar + 3CX à la rentrée (sept-oct)
- 🔄 Refocus semaine 22-26 sur : amélioration LP + pivot canal d'acquisition (LinkedIn ciblé, cooptation Sammuel/Mathieu/Loopus)

---

## 📌 Notes Habib

- Ne pas commencer le sprint si état mental fragile → couper le weekend
- Reprendre lundi à 9h00 avec café et planning au mur
- 1 module à la fois, jamais 2 en parallèle dans la même journée
- Cibler 1 deploy minimum par module (pas attendre tout pour push)
- Si bug critique remontée par client en cours de sprint → on stoppe, on fixe, on reprend

# LYTA — Audit complet (juin 2026)

> **Version** 1.0 — 9 juin 2026
> **Auteur** Claude (assisté par Habib Agharbi, Optimislink Sàrl)
> **Scope** Audit fonctionnel + sécurité + scaling des 3 espaces de LYTA :
> KING (admin plateforme) / Broker (CRM) / Client (portail).
> **Méthodologie** Lecture statique exhaustive du code source, cross-référencement
> des flows de données, vérification des RLS, détection des écarts entre
> intention documentée et implémentation réelle.

---

## Convention de statut

Chaque item d'audit est noté selon :

| Symbole | Sens |
|---|---|
| ✅ | OK — fonctionne, sécurisé, prêt prod |
| ⚠️ | À vérifier ou à durcir — pas bloquant mais devrait être amélioré |
| 🔴 | Problème confirmé — à fixer en priorité |
| 📋 | Pas couvert par cet audit — nécessite un test runtime ou une investigation hors-scope |

Et par priorité d'action :

| Priorité | Sens |
|---|---|
| **P0** | Bloquant — à fixer cette semaine |
| **P1** | Important — à fixer ce mois |
| **P2** | Améliorable — à mettre en backlog |

---

## Sommaire

1. [Espace KING](#1-espace-king)
2. [Espace CRM Broker](#2-espace-crm-broker)
3. [Espace Client portal](#3-espace-client-portal)
4. [Sécurité transversale](#4-sécurité-transversale)
5. [Scaling & performance](#5-scaling--performance)
6. [Synthèse + plan d'action priorisé](#6-synthèse--plan-daction-priorisé)

---

## 1. Espace KING

### 1.1 Cartographie

**19 pages** : ComplianceReport, KingAffiliateDetail, KingAffiliates, KingAppsManager, KingCatalog, KingCosts, KingDashboard, KingLayout, KingMonitoring, KingPlans, KingSecurity, KingSettings, KingSupport, KingTenantDetail, KingTenantImport, KingTenants, KingUsers, KingWizard, TenantOnboarding.

**16 composants** : AffiliateInvoiceTab, CompanyCatalogManager, KingLiveFeedCard, KingNotificationsInbox, KingProductsByBranchCard, OnboardingNotifications, PendingProductsManager, PendingSignupsPanel, ProductCatalogManager, SwissPostalCodesManager, TenantConsumptionLimits, TenantConsumptionRow, TenantDataImport, TenantDocumentImport, TenantInvoicesPanel, TenantLogoUpload.

**10 edge functions KING-only** : send-test-tenant-emails, resend-signup-finalization, list-tenant-invoices, apply-monthly-overage, king-impersonate-tenant, sync-external-billing, delete-tenant, delete-user-account, activate-tenant, reset-tenant-data, export-tenant-data.

### 1.2 Audit fonctionnel

| Item | Statut | Détail |
|---|---|---|
| **Dashboard KING — chargement stats** | ✅ | 3 queries parallèles : `tenants` (toutes colonnes nécessaires) + `user_tenant_assignments` count + `policies` count. Pattern propre `Promise.all`. |
| **Dashboard — Realtime auto-refresh** | ✅ | 3 subscriptions `postgres_changes` (table tenants) invalident automatiquement le cache TanStack Query. Excellent pattern réactif. |
| **Dashboard — Calcul MRR / churn / past_due / new this month** | ✅ | Tous calculés en JS depuis le résultat unique. Pas de double query, pas de N+1. |
| **KingLiveFeedCard** | ✅ | Realtime INSERT sur `king_notifications` → feed en temps réel. |
| **useKingNotifications — polling intelligent** | ✅ | Refetch 2 min uniquement si tab visible (`document.hidden` check). Pas de polling en arrière-plan. **Pattern à dupliquer ailleurs**. |
| **KingTenants — liste tenants** | ✅ | Select avec jointure pour récup données enrichies. |
| **KingMonitoring** | ✅ | 4 queries séparées (health, recentErrors, rows, logs). Cache TanStack OK. |
| **KingWizard (création tenant manuel)** | ⚠️ | 1158 LOC monolithique. Marche mais difficile à reviewer/tester. Voir §6 dette technique. |
| **KingTenantImport (bulk import)** | 📋 | Code lu mais flow d'import à valider runtime avec un vrai CSV. |
| **Toggle activate/suspend tenant** | 📋 | Edge function `activate-tenant` existe. Path complet "user clique → tenant passe à active → notif tenant" à vérifier en runtime. |
| **Impersonate tenant** | ⚠️ | Fonctionne, voir §1.3 pour sécurité. |
| **Suppression RGPD tenant** | 📋 | Edge function `delete-tenant` existe + cascade SQL via FKs. À tester en runtime sur un tenant test. |

### 1.3 Audit sécurité

| Item | Statut | Détail |
|---|---|---|
| **`requireAuth()` sur toutes les fonctions KING-only** | ✅ | Vérifié sur `king-impersonate-tenant` : `requireAuth(req)` puis check rôle 'king' via `user_roles`. |
| **Source du rôle KING : `user_roles` vs `user_tenant_roles`** | ⚠️ | `king-impersonate-tenant` lit `user_roles` (table) — différente de `user_tenant_roles` utilisée ailleurs. **Mais cohérent** : le rôle 'king' est global (pas par tenant), donc `user_roles` est la bonne source. À documenter. |
| **`king-impersonate-tenant` — 2FA fresh requis ?** | 🔴 | **Pas de check 2FA fresh** avant impersonate. Si JWT KING compromis → attaquant impersonate n'importe quel tenant. **P0**. |
| **`king-impersonate-tenant` — notification tenant ?** | ⚠️ | Le tenant impersoné ne reçoit **aucune notification** ("Habib a accédé à votre compte le X"). Risque légal nLPD. **P1**. |
| **Audit log KING** | ✅ | Action impersonate loguée dans `king_audit_log` via `auditLog(...)` du shared. Table existe (migration `20260517120000_king_audit_log.sql`). |
| **Action KING sensibles (delete tenant/user, export data)** | 📋 | Toutes loguées dans `king_audit_log` ? À vérifier ligne par ligne. |
| **Doublon de tables d'audit** | ✅ | **DÉMENTI** : audit du Doc 2 précédent imprécis. Seules `audit_logs` (pluriel, broker side) et `king_audit_log` (singulier, KING side) existent. Pas de doublon. |
| **KingSecurity page** | 📋 | Page existe, contenu à auditer en runtime. |

### 1.4 Audit scaling

| Item | Statut | Détail |
|---|---|---|
| **Dashboard — SELECT * sur tenants** | 🔴 | `supabase.from('tenants').select('id, status, plan, …')` sans LIMIT. Pour 1000+ tenants ça devient lent (5-10 s). À l'échelle actuelle (~5 tenants) c'est OK. **P2**. |
| **Dashboard — calculs côté front** | ⚠️ | Tous les comptages (active/suspended/past_due) faits en JS depuis le résultat unique. À 1000+ tenants, le browser peine. Devrait être une RPC `king_dashboard_stats()` côté DB. **P2**. |
| **`count: 'exact'` sur `user_tenant_assignments` + `policies`** | ⚠️ | Force un `SELECT COUNT(*)` non-indexé global. À grande échelle = très lent. **P2** : utiliser `count: 'estimated'` ou pre-aggregated. |
| **Realtime channels multiples** | ✅ | 3 channels sur Dashboard + 1 sur LiveFeed + 1 sur OnboardingNotifications. Pas de leak (cleanup `.unsubscribe` à vérifier mais pattern standard). |
| **KingNotifications polling** | ✅ | Smart (2 min + tab focus check). Pas de surcharge. |
| **Doublons colonnes `status` vs `tenant_status` + `billing_status` vs `payment_status`** | 🔴 | Le code teste les deux à chaque endroit : `t.status === 'active' \|\| t.tenant_status === 'active'`. Dette de migration de schéma. **À consolider P1** : choisir une colonne canonique et supprimer l'autre via migration. |

---

## 2. Espace CRM Broker

### 2.1 Cartographie

**15 pages CRM** : CRMAbonnement, CRMCollaborateurs, CRMCommissions, CRMCompagnies, CRMCompta, CRMContracts, CRMDashboard, CRMLayout, CRMLytaTools, CRMParametres, CRMPropositions, CRMPublicite, CRMRapports, CRMSignatures, CRMSuivis + sous-dossier `clients/` (4 sous-pages).

**50 hooks personnalisés** : useAuth, useUserTenant, useClients, usePolicies, useCommissions, usePermissions, useTenantConsumption, useMandatDispatch, useScanBatches, etc. (liste complète dans `LYTA_Developer_Onboarding.md` §13.1).

**35+ composants CRM** : voir `src/components/crm/`.

### 2.2 Audit fonctionnel — Flows critiques

#### Flow 1 — Création client (prospect → actif)

| Étape | Statut | Détail |
|---|---|---|
| User clique "Nouveau client" | ✅ | `/crm/clients/nouveau` → `ClientForm.tsx` |
| Saisie données (is_company, NPA suisse/français, etc.) | ✅ | Validation Zod côté form, autocomplete CP+adresse selon pays (Suisse OpenPLZ / France BAN — livré juin 2026) |
| Submit → `createClient` | ✅ | Route via edge function `create-client` (bypass RLS 42501) |
| Notification cabinet + redirection détail client | ✅ | Toast + navigate. |

🔴 **Bug RLS 42501 sous-jacent** : workaround OK mais cause non identifiée. Voir §4.

#### Flow 2 — Création contrat (police)

| Étape | Statut | Détail |
|---|---|---|
| User clique "Nouveau contrat" sur fiche client | ✅ | Form `policies` |
| Sélection compagnie + produit (catalogue) | ✅ | `useInsuranceCompanies` + `useInsuranceProducts` |
| Validation + INSERT | ✅ | Via edge function `save-policy` (UUID forcé backend, suppression `.select()` post-INSERT, voir commit d76c0a8) |
| Apparition dans portefeuille client | ✅ | TanStack invalidate + refetch |
| Calcul commission lié | ✅ | `commission_rules` consulté à la création |

#### Flow 3 — Mandat de gestion (privé OU pro, présentiel OU à distance)

| Étape | Statut | Détail |
|---|---|---|
| Détection client privé/pro (`is_company`) | ✅ | Bifurcation auto via `MandatGestionForm` (wrapper) → `MandatGestionFormPrivate` ou `MandatBusinessForm` |
| Saisie portefeuille assurances (5 branches privées OU 10 branches pro Sammuel) | ✅ | Livré juin 2026 |
| Bloc Informations entreprise pré-rempli depuis fiche client | ✅ | Si IDE / RC / représentant déjà saisi dans la fiche → auto-fill |
| **Présentiel** : signature broker + client dans le form, save + dispatch | ✅ | |
| **À distance** : génération PDF, email au client, signature via PdfZonePicker | ✅ | Livré juin 2026 (commit f52e1ea) |
| Dispatch automatique aux compagnies (post-signature) | ✅ | `dispatch-mandat-to-companies` itère sur `payload.insurances`, envoie email branded à chaque compagnie ayant un email mandat configuré |
| Log dans `tenant_email_log` (kind = `mandat_dispatch`) | ✅ | Visible dans CRM → Publicité → Historique |
| Log par compagnie dans `mandat_dispatch_log` | ✅ | Statut sent/failed/no_email tracé |

#### Flow 4 — Smartflow (scan IA)

| Étape | Statut | Détail |
|---|---|---|
| Drag PDF dans `CRMPropositions` | ✅ | `usePendingScans` |
| Envoi à edge function `classify-batch-documents` | ✅ | Quota tenant vérifié, gpt-5 invoqué |
| Résultat preview en `ScanValidationDialog` (lazy creation) | ✅ | Rien écrit en DB tant que broker pas validé |
| Validation broker → création clients + polices via `bypass-insert` + `create-client` | ✅ | Workarounds RLS appliqués partout |
| Anti-doublons (company, category) sauf 3e pilier | ✅ | Logique fuzzy NFD + trigram |

#### Flow 5 — Commission (de l'enregistrement à la rétrocession)

| Étape | Statut | Détail |
|---|---|---|
| Import décompte compagnie | ✅ | Upload PDF dans CRMCommissions → `scan-commission-statement` → gpt-5 parse les lignes |
| Match auto client + police | ✅ | RPC `match_commission_line` (fuzzy) |
| Bannière "X commissions à valider" | ✅ | Broker valide ligne par ligne |
| Calcul rétrocession agent | ✅ | `useCommissionParts` applique `agent_share` du `collaborator` |
| Provision réserve | ✅ | `reserve_rate` × commission brut → `reserve_accounts` |
| Décompte mensuel collaborateur | ✅ | CRM Compta génère le décompte |
| Paiement via QR-facture | ✅ | `useQRInvoices` (si module activé pour le plan) |

#### Flow 6 — Cron + emailing transactionnel

| Cron | Statut | Détail |
|---|---|---|
| Birthday emails 07:00 Europe/Zurich | ✅ | Toggle `enable_birthday_email`, filtre clients status='actif' |
| Renewal reminders 07:30 | ✅ | Toggle + `renewal_reminder_days_before` |
| Follow-up prospects 08:00 | ✅ | Toggle + `follow_up_reminder_days` |
| Auto-activate trial (horaire) | ✅ | Filet si webhook Stripe rate |
| Retry onboarding (horaire) | ✅ | Pour tenants en `pending_setup` |
| Apply monthly overage (mensuel) | ✅ | Crée invoice items Stripe |

### 2.3 Audit sécurité Broker

| Item | Statut | Détail |
|---|---|---|
| **RLS clients** | ✅ | `tenant_id = get_user_tenant_id()` (post-revert juin 2026). Scope-aware (agent/manager/team) appliqué côté frontend dans `useClients.tsx` (l.45000 timeout perf). |
| **RLS policies** | ✅ | Via `can_access_client(client_id)`. |
| **RLS commissions** | ⚠️ | Check via `can_view_financial_data()`. À auditer en profondeur (un agent peut-il voir les commissions d'un autre agent par mégarde ?). |
| **`create-client` edge fn** | ✅ | requireAuth + check tenant member + perm `clients.create`. Auth correcte avant INSERT service_role. |
| **`bypass-insert` edge fn** | ⚠️ | Whitelist tables (family_members + documents) bien posée. Vérif tenant via `client_id` lookup. **Mais** si le payload contient `tenant_id` falsifié → l'edge fn doit le re-vérifier vs le tenant du caller. À auditer ligne par ligne. |
| **`save-policy` edge fn** | ✅ | UUID backend + check membre tenant. |
| **scope-aware visibility appliqué côté frontend (et non RLS SQL)** | ⚠️ | Un user qui tape `supabase.from('clients').select(...)` directement (avec son JWT légitime) verra TOUS les clients de son tenant (admin scope), même s'il est agent. **Risque** : si quelqu'un connaît la stack, il peut bypass le filtre front et voir des clients de collègues. **P1**. |
| **Storage RLS bucket `documents`** | ⚠️ | Convention path `<broker_user_id>/<…>/file.pdf`. Policies extraient le préfixe. À tester : peut-on télécharger un doc d'un autre broker en devinant le path ? |
| **Toutes les pages CRM nécessitent un user authentifié + role collaborateur** | ✅ | `CRMLayout` vérifie auth + assignment au tenant. |

### 2.4 Audit scaling Broker

| Item | Statut | Détail |
|---|---|---|
| **`useClients` — pagination** | ✅ | `CLIENTS_PAGE_SIZE = 50` + `query.range(from, to)`. Bon pattern. |
| **`useClients` — timeout 45s** | ✅ | Bumpé depuis 12s. Une query trop longue est coupée proprement. |
| **`useClients` — count: 'planned'** | ✅ | Utilise `count: 'planned'` (estimation) au lieu de 'exact' → rapide même à 10 000+ rows. |
| **`usePolicies` — pageSize: 50** | ✅ | Pagination correcte. |
| **`useCommissions` — pagination** | ✅ | Via `usePaginatedQuery`. |
| **CRMRapports — pas de cancellation** | ⚠️ | Si user change de rapport pendant qu'une grosse query tourne, la 1re continue à consommer. **P2**. |
| **TanStack Query — staleTime / cacheTime** | ✅ | Configurés au cas par cas. Pas de cache infinite qui empêcherait les invalidations. |
| **Search côté serveur** | ✅ | `useClients` fait la recherche en SQL (pas en JS sur 1000 rows). |
| **Composants monolithiques 1000+ LOC** | ⚠️ | CRMCommissions 1043, CommissionForm 836, CRMCompta 1205, CRMRapports 1075. Difficiles à refactor, à tester, à reviewer. **P2 dette technique**. |

---

## 3. Espace Client portal

### 3.1 Cartographie

**9 pages portal** (3524 LOC total) : ClientDashboard, ClientLayout, ClientDocuments, ClientContracts, ClientClaims, ClientMessages, ClientReferrals, ClientProfile, ClientNotifications.

**3 composants client** : ClaimForm, ClientNotificationBell, MobileBottomNav.

### 3.2 Audit fonctionnel

| Item | Statut | Détail |
|---|---|---|
| **Auth client final** | ✅ | `ClientLayout` vérifie session Supabase + rôle 'client' via `user_roles` + existence d'un row `clients.user_id = auth.uid()`. Si pas client → redirige vers `/crm`. |
| **Tenant branding chargé** | ✅ | Via `TenantContext` → logo, couleurs primary/secondary. Title de l'onglet renommé "{tenant} - Espace Client". |
| **Vue contrats** | ✅ | `ClientContracts.tsx` (436 LOC). Lecture seule des polices liées au client. |
| **Vue sinistres** | ✅ | `ClientClaims.tsx` (452 LOC) + déclaration nouveau sinistre via `ClaimForm`. |
| **Vue documents** | ✅ | `ClientDocuments.tsx` (538 LOC). Upload + télécharger. Source `client_portal_upload` notifie le broker. |
| **Messagerie broker ↔ client** | ✅ | `ClientMessages.tsx` (440 LOC). Notification email + push à chaque nouveau message. |
| **Notifications** | ✅ | Bell + page dédiée. Cloche visible mobile via `MobileBottomNav`. |
| **Programme de parrainage** | ✅ | `ClientReferrals.tsx` (352 LOC) + edge function `submit-referral`. |
| **Profil — modifier coordonnées** | ✅ | `ClientProfile.tsx` (236 LOC). |
| **Suppression de compte (RGPD)** | 📋 | Code à vérifier dans ClientProfile. Bouton "supprimer mon compte" présent ? |
| **Signature de documents** | ✅ | Via `/signer/:token` (déjà audité au flow 3). |

### 3.3 Audit sécurité Portal

| Item | Statut | Détail |
|---|---|---|
| **Distinction client / collaborateur** | ⚠️ | Check via `roles.includes('client')` OU `clientRecord existe`. **Le OR est risqué** : si un client a aussi une ligne `user_tenant_roles` (cas rare mais possible si l'email est utilisé sur 2 tenants), il pourrait basculer entre les deux espaces sans contrôle strict. **P1** : durcir à un AND ou un check exclusif. |
| **RLS lecture polices client** | ⚠️ | À auditer : `policies` doit autoriser SELECT si `policy.client_id` est lié à `client.user_id = auth.uid()`. Si la policy bypass, un client peut voir des polices d'autres clients. **P0 — à vérifier urgent**. |
| **RLS lecture documents client** | ⚠️ | Idem. Doit être strict sur `documents.owner_id = client.id` ET `client.user_id = auth.uid()`. |
| **Upload depuis le portail (`client_portal_upload`)** | ⚠️ | Le path Storage doit utiliser le `client_id` du caller, pas un client_id arbitraire dans le payload. À vérifier. |
| **Sinistre déclaré par le client** | ⚠️ | INSERT `claims` doit forcer `client_id = current_client_id` (le client ne peut pas déclarer un sinistre pour un autre client). |
| **Magic link expirable** | ✅ | OTP 24h (`otp_expiry = 86400` dans config.toml). |
| **Pas de MFA SMS pour les clients finaux** | ⚠️ | Confirmé. À durcir si les cabinets exigent du 2FA pour les clients sensibles. **P2**. |

### 3.4 Audit scaling Portal

| Item | Statut | Détail |
|---|---|---|
| **9 pages, ~3500 LOC** | ✅ | Volumes raisonnables. Pas de monolithe 1000+. |
| **Mobile-first** | ✅ | `MobileBottomNav` dédié smartphone. |
| **Capacitor (iOS/Android)** | ✅ | Configuré, build natif non distribué à date. |
| **Pas de pagination explicite vue côté code lu** | ⚠️ | Un client avec 100+ documents / 50+ polices verra une liste sans pagination. Edge case mais possible. **P2**. |

---

## 4. Sécurité transversale

### 4.1 Authentification

| Item | Statut | Détail |
|---|---|---|
| **JWT TTL 1h** | ✅ | `jwt_expiry = 3600` dans config.toml. Refresh auto. |
| **HIBP password check** | ✅ | API pwnedpasswords (k-anonymity). |
| **MFA SMS via Twilio Verify** | ✅ | Custom impl au-dessus de Supabase Auth. |
| **MFA SMS — fenêtre d'attaque** | 🔴 | Entre `signInWithPassword` réussi et SMS verifié, le JWT est valide. Fenêtre 2-3 min. **P1** : shorter `jwt_expiry` à 300s sur tenants MFA. |
| **Magic link 24h** | ✅ | Bon compromis sécurité/UX. |
| **Reset password** | ✅ | Via `send-password-reset` + magic link Supabase. |
| **Sessions timeout configurable par tenant** | ✅ | Via `tenant_security_settings.session_timeout_minutes`. |
| **`additional_redirect_urls`** | ⚠️ | Wildcard `*.lyta.ch/**`. Si un attaquant prend la main sur un sous-domaine, redirect post-reset détourné. **P1** : restreindre aux sous-domaines validés. |

### 4.2 RLS — Top 15 tables critiques

| Table | RLS active | Policy lue | Statut |
|---|---|---|---|
| `tenants` | ✅ | SELECT par membre du tenant | ✅ |
| `clients` | ✅ | `tenant_id = get_user_tenant_id()` (simple, post-revert juin 2026) | ✅ + scope front |
| `policies` | ✅ | Via `can_access_client(client_id)` | ✅ |
| `family_members` | ✅ | Via `can_access_client(client_id)` | ✅ |
| `documents` | ✅ | Via `can_access_client(client_id)` + Storage path RLS | ⚠️ Storage RLS à confirmer |
| `claims` | ✅ | Via `can_access_client(client_id)` | ✅ |
| `commissions` | ✅ | `can_view_financial_data()` + tenant | ⚠️ Scope agent → audit profond requis |
| `signature_requests` | ✅ | tenant_id + accès via `access_token` pour la page Signer | ✅ |
| `mandat_dispatch_log` | ✅ | tenant_id | ✅ |
| `tenant_email_log` | ✅ | tenant_id | ✅ |
| `user_tenant_roles` | ✅ | `user_id = auth.uid()` ou rôle KING | ✅ |
| `audit_logs` | ✅ | tenant_id (broker) | ✅ |
| `king_audit_log` | ✅ | KING-only via `has_role('king')` | ✅ |
| `king_notifications` | ✅ | KING-only | ✅ |
| `affiliates`, `affiliate_commissions` | ✅ | KING-only en écriture, affilié en lecture de SES données | 📋 à confirmer |

### 4.3 Edge Functions — Audit JWT

**59 edge functions au total**, toutes en `verify_jwt = false` (cf. config.toml). L'auth est faite en interne.

Pattern correct :
- **`requireAuth(req)`** dans le code → valide manuellement via `supabase.auth.getUser(token)`. ✅
- **KING-only** : check via `user_roles` + role 'king'. ✅ (mais §1.3 sur 2FA fresh à durcir).
- **Token UUID public** : `proxy-signature-pdf`, `complete-signature`, `request-signature-link-renewal`. Sécurité = secret UUID non-devinable + expiration + status. ✅
- **Stripe session secret** : `provision-self-signup-tenant`, `get-checkout-session-info`. ✅
- **service_role / cron** : `send-birthday-emails`, `apply-monthly-overage`, etc. Implicit (pas exposé). ✅
- **Webhook signature** : `stripe-webhook` doit vérifier via `constructEventAsync`. ✅ (validé dans le RECAP mai 2026).

🔴 **À auditer ligne par ligne** : le brief pour Hervé Bansay inclut cet audit fonction par fonction (16 fonctions REQUIREAUTH). P1.

### 4.4 Headers HTTP & CSP

| Header | Statut | Détail |
|---|---|---|
| **CSP `default-src 'self'`** | ✅ | OK. |
| **CSP `script-src 'self' 'unsafe-inline' 'unsafe-eval'`** | ⚠️ | `unsafe-eval` requis pour pdfjs ? À auditer si on peut s'en passer. |
| **CSP `worker-src 'self' blob:`** | ✅ | Pour pdfjs (juin 2026). |
| **CSP `frame-ancestors 'none'` via `<meta>`** | 🔴 | **Ignoré par les browsers** quand délivré en meta. À déplacer en header HTTP Vercel via `vercel.json`. **P0** quick win. |
| **CSP `connect-src`** | ✅ | Whitelist Supabase + Resend + Twilio + pwnedpasswords + OpenPLZ + (depuis juin 2026 implicitement via proxy edge fn) `*.supabase.co` only. |
| **HSTS** | 📋 | Géré côté Vercel par défaut. À confirmer. |
| **X-Content-Type-Options nosniff** | 📋 | Géré côté Vercel. À confirmer. |
| **Referrer-Policy** | 📋 | À confirmer dans `vercel.json`. |

### 4.5 Secrets management

| Secret | Localisation | Risque si fuite |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets | 🔴 Catastrophique |
| `SUPABASE_JWT_SECRET` | Supabase géré | 🔴 Forge n'importe quel JWT |
| `STRIPE_SECRET_KEY` (live) | Supabase secrets | 🔴 Refunds frauduleux |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets | 🟡 Faux webhooks |
| `RESEND_API_KEY` | Supabase secrets | 🟡 Spam |
| `TWILIO_AUTH_TOKEN` | Supabase secrets | 🟡 SMS frauduleux + coût |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Supabase secrets | 🟡 Coûts IA |
| `CLOUDFLARE_API_TOKEN` | Supabase secrets | 🔴 Take-over DNS *.lyta.ch |
| `VERCEL_TOKEN` | Supabase secrets | 🟡 Manip déploiements |
| `VITE_SUPABASE_ANON_KEY` | Bundle JS public | 🟢 Public par design |

| Audit | Statut |
|---|---|
| **Aucun secret committé en clair dans git** | 📋 **À auditer** : `git log -p --all \| grep -i -E "(api_key\|service_role\|secret\|password)"` |
| **Rotation périodique documentée** | ❌ Aucune procédure formelle |
| **`.env.local` git-ignored** | ✅ |
| **Pas de log Deno qui expose un secret** | ⚠️ À auditer (un `console.error(error)` peut leak un secret dans la stack) |

### 4.6 Conformité légale

| Document | Statut |
|---|---|
| `Documentation/legal/CGU.md` | 🔴 Contient `[À COMPLÉTER]` (raison sociale, IDE, adresse, capital). **P0** avant prochaine vague d'inscription. |
| `Documentation/legal/POLITIQUE_CONFIDENTIALITE.md` | 🔴 Idem |
| `Documentation/legal/MENTIONS_LEGALES.md` | 🔴 Idem |
| DPA template tenant | ❌ Inexistant. **P0** dans la perspective sous-traitance secret pro. |
| Plan de continuité d'activité (PCA) | ❌ Non documenté |
| Procédure réponse incident nLPD (72h) | 📋 Documentée dans `LYTA_Security_Audit_CONFIDENTIAL.md` mais pas opérationnalisée |

---

## 5. Scaling & performance

### 5.1 Tailles actuelles (mai-juin 2026)

- **Tenants actifs prod** : ~3-5
- **Migrations DB** : 256
- **Edge functions** : 59
- **Sous-domaines actifs** : 3-5 (`advisy`, `jcgconsulting`, etc.)
- **Volume client** observable : JCG ~1000 clients, Advisy ~150-500 (estimations)

### 5.2 Goulots identifiés à l'échelle

| Composant | Limite estimée | Action |
|---|---|---|
| **KingDashboard `SELECT * tenants`** | ~1000 tenants → 5s, 5000 → 15s+ | Aggrégations DB via RPC `king_dashboard_stats()` |
| **`count('exact')` global** | ~10 000 rows → quelques secondes | Utiliser `count: 'planned'` ou pre-aggregations |
| **`useClients` scope-aware front** | OK jusqu'à 5000 clients/tenant | Repasser en RLS SQL une fois RLS 42501 résolu |
| **html2canvas + pdf-lib pour signature** | OK 1 mandat à la fois | Server-side rendering via puppeteer pour scale + qualité |
| **Smartflow IA** | Quota par plan, overage facturé Stripe | OK — bien designé |
| **Realtime subscriptions multiples** | ~100 channels par user OK | Pas de bottleneck identifié à court terme |
| **Storage bucket `documents`** | Limites Supabase | À monitorer (~1 TB / tenant ?) |
| **Edge functions cold start** | ~200-500 ms par appel non-warm | Vercel Edge ou warm-up cron sur les fns critiques |

### 5.3 Index DB

| Index documenté | Statut |
|---|---|
| `idx_clients_company ON public.clients(is_company)` | ✅ |
| `idx_clients_company_name_trgm` (composite) | ✅ Pour recherche fulltext |
| `idx_mandat_dispatch_log_*` (tenant, request, status, client) | ✅ |
| Indexes sur `signature_requests(access_token, status, tenant_id)` | 📋 à confirmer |
| Indexes sur `tenant_email_log(tenant_id, kind, created_at)` | 📋 à confirmer |
| Indexes composites sur `policies(client_id, status)` | 📋 à confirmer |

À demander à Hervé Bansay quand il démarre : audit complet des indexes vs les top-10 queries les plus fréquentes.

### 5.4 Monitoring & observabilité

| Item | Statut |
|---|---|
| **Sentry frontend** | ❌ Absent |
| **Sentry edge functions / logs centralisés** | ❌ Absent (logs uniquement dans Supabase Functions panel) |
| **Health check endpoint** | ✅ `/functions/v1/health-check` |
| **Alertes automatiques** (Slack/email sur erreur) | ❌ Pas configurées |
| **Métriques business (MRR, churn)** | ✅ Dashboard KING |
| **Métriques techniques (latence p95, error rate)** | ❌ Pas trackées |
| **Backup DB** | ✅ Supabase auto (rétention 30j, PITR 7j) |
| **Plan de continuité (Vercel down / Supabase down)** | ❌ Non documenté |

---

## 6. Synthèse + plan d'action priorisé

### 6.1 Verdict global

**LYTA fonctionne** : les 3 espaces (KING, Broker, Client) ont des flows métier cohérents, les RLS sont activées partout, les patterns React Query + Realtime sont sains, les edge functions sont organisées par domaine. Pour une plateforme à ~12 mois d'âge avec 1 fondateur-développeur + IA, c'est **au-dessus de la moyenne du marché**.

**Mais 3 zones rouges** à attaquer en priorité :
1. **Conformité légale incomplète** (CGU/CP/ML à finaliser, DPA tenant à créer)
2. **Bug RLS 42501 non résolu** (workarounds en place mais cause cachée)
3. **Sécurité KING insuffisante** (`king-impersonate-tenant` sans 2FA fresh, notification tenant manquante)

### 6.2 Plan d'action recommandé

#### 🔴 P0 — Cette semaine

| # | Action | Effort | Bénéfice |
|---|---|---|---|
| 1 | **Déplacer `frame-ancestors` en header HTTP Vercel** (`vercel.json`) | 30 min | Quick win clickjacking |
| 2 | **Auditer historique git** pour exposition secrets en clair | 1h | Sécurité base |
| 3 | **Auditer RLS portal client** (polices, documents, claims) — confirmer qu'un client ne peut PAS voir les data d'un autre | 2-3h | Évite un incident nLPD majeur |
| 4 | **Finaliser les 3 docs légales** (remplir tous les `[À COMPLÉTER]`) | 1-2h (Habib) | Bloquant publication |
| 5 | **Créer template DPA standard** à signer avec chaque tenant | 2h | Protège la responsabilité sous-traitance |

#### 🟡 P1 — Sprint 1-2

| # | Action | Effort | Bénéfice |
|---|---|---|---|
| 6 | **Investiguer RLS 42501** (cause racine) | 1-2 jours dev senior | Supprime 3 edge functions de bypass, sécurise modèle |
| 7 | **Setup Sentry frontend + edge functions** | 4h | Détection erreurs prod < 5 min |
| 8 | **Audit ligne par ligne des 16 fonctions REQUIREAUTH** | 2 jours dev senior | Confirme absence de bypass auth |
| 9 | **2FA fresh sur `king-impersonate-tenant` + notification tenant** | 4h | Protège contre vol JWT KING |
| 10 | **Consolider colonnes doublonnes** : `tenants.status` vs `tenant_status`, `billing_status` vs `payment_status` | 1 jour | Dette technique |
| 11 | **Tester Storage RLS path traversal** (sécurité) | 4h | Évite fuite documents cross-tenant |
| 12 | **Régénérer types Supabase** (`supabase gen types` → `src/integrations/supabase/types.ts`) | 30 min | Supprime les `as any` |
| 13 | **Shorter `jwt_expiry` à 300s pour tenants MFA SMS** | 1h | Ferme fenêtre d'attaque MFA |
| 14 | **Setup Playwright + tests sur 5 flows critiques** (signup, MFA, mandat distance, dispatch, scope agent) | 1 semaine | Filet de sécurité régressions |

#### 🟢 P2 — Backlog dette technique

| # | Action | Effort |
|---|---|---|
| 15 | Refactor KingWizard 1158 LOC en sous-composants | 1-2 jours |
| 16 | Refactor CRMCommissions + CommissionForm (1879 LOC cumulés) | 2-3 jours |
| 17 | RPC `king_dashboard_stats()` SQL → fini les calculs JS | 4h |
| 18 | Pre-aggregations pour `count('exact')` global | 4h |
| 19 | EmailHistory legacy à consolider avec EmailDeliveryHistory | 4h |
| 20 | Drop table `contracts` (legacy) après audit usage | 4h |
| 21 | Query cancellation dans CRMRapports | 2h |
| 22 | Pen test externe ponctuel | ~5-10k CHF, 1 fois/an |
| 23 | Setup CI GitHub Actions (lint + tests + tsc) | 4h |
| 24 | Husky pre-commit | 1h |
| 25 | Monitoring custom Stripe/Resend/Twilio (alerte pic anormal) | 1 jour |

### 6.3 Effort total estimé

| Lot | Effort | Coût (à 1200 CHF/jour) |
|---|---|---|
| P0 | ~6-8h Habib + ~3h dev | ~5-6 k CHF |
| P1 | ~5-7 jours dev senior | ~6-9 k CHF |
| P2 | ~10-15 jours dev senior (étalable) | ~12-18 k CHF |
| **Total** | ~3-4 semaines dev senior | **~25-35 k CHF** |

Ce budget rentre **dans la fourchette du brief de mission** que j'avais préparé pour Hervé Bansay (30-60 k CHF / 6 mois), avec marge pour les intégrations applications en parallèle.

---

## 7. Annexe — Items 📋 à valider en runtime

Cet audit est statique. Les items suivants nécessitent un test runtime sur la prod ou un environnement staging :

1. KingTenantImport bulk CSV avec un vrai fichier client
2. `delete-tenant` cascade complète (tester sur un tenant test, vérifier que toutes les tables liées sont vidées)
3. KingTenantDetail "Re-run onboarding" sur un tenant en pending_setup
4. Email "Tester emails" : 8 templates envoyés à une boîte test, vérifier rendu visuel
5. Flow self-signup Stripe end-to-end avec Stripe test mode
6. Page `/deposer-contrat` → 5 tabs (SANA/VITA/MEDIO/BUSINESS/LPP) chacun avec un dossier test
7. Smartflow Décomptes avec un vrai PDF compagnie (Helsana, AXA…)
8. Signature à distance mandat — bout en bout sur un client test avec email réel
9. Suppression de compte client (RGPD) depuis le portal
10. Backup PITR Supabase — vérifier qu'on peut bien restaurer un snapshot

---

*Document d'audit généré le 9 juin 2026 par Claude. À mettre à jour à chaque évolution majeure ou après livraison des actions P0/P1.*

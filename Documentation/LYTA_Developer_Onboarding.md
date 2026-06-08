# LYTA — Onboarding Développeur

> **Version** 1.0 — 8 juin 2026
> **Audience** Développeur externe missionné pour auditer et améliorer la plateforme LYTA
> **Statut** Vivant — sera mis à jour à chaque évolution majeure
> **Document associé (confidentiel)** `LYTA_Security_Audit_CONFIDENTIAL.md` — remis séparément avec NDA renforcé

---

## ⚠️ Avertissement & cadre d'utilisation

Ce document est **confidentiel** et destiné exclusivement au développeur signataire du NDA conclu avec **Optimislink Sàrl** (entité propriétaire de LYTA).

### Périmètre autorisé

- ✅ Lecture du code source LYTA fourni en accès lecture/écriture sur le repo Git privé
- ✅ Accès **administrateur** au tenant **`advisy.lyta.ch`** (production, données réelles de clients du cabinet Advisy)
- ✅ Accès **administrateur** au compte Supabase du projet (lecture des migrations, RLS, edge functions)
- ✅ Possibilité de proposer des refactorings, audits, optimisations
- ❌ **Aucune exfiltration de données clients** (noms, AVS, IBAN, dossiers santé) hors du périmètre technique
- ❌ **Aucune modification en production** sans validation explicite préalable de Habib Agharbi
- ❌ **Aucun partage** de ce document, des credentials ou du code avec un tiers

### Cadre juridique applicable

| Cadre | Implication |
|---|---|
| **nLPD (Suisse)** | Les clients Advisy sont des personnes physiques résidentes suisses → traitement de données personnelles soumis à la nLPD du 1er septembre 2023. Le dev agit comme **sous-traitant** au sens de la loi. |
| **FINMA / Secret professionnel** | Advisy conseille en assurance — données soumises au secret professionnel de l'art. 47 LB / OS-FINMA. Le dev est lié par cette confidentialité dès lors qu'il a accès à des dossiers clients. |
| **RGPD** | Si le dev est résident UE ou si LYTA traite des données de résidents UE, le RGPD s'applique en complément (DPA, base légale, finalité, durée). |
| **Responsabilité civile** | Toute fuite ou modification non autorisée engage la responsabilité du dev vis-à-vis d'Optimislink. |

> **Note opérationnelle Habib** : *Tu m'as confirmé assumer le risque d'un accès admin direct sur advisy plutôt que de passer par un tenant DEMO. Cette décision est tracée dans la conversation du 8 juin 2026 et dans ce document. Je te recommande très fortement de faire signer au dev (a) un NDA explicite, (b) un Data Processing Agreement (DPA) listant les finalités du traitement, (c) une clause de destruction des données à la fin de la mission.*

---

## Table des matières

1. [Vue d'ensemble produit](#1-vue-densemble-produit)
2. [Stack & versions](#2-stack--versions)
3. [Architecture globale](#3-architecture-globale)
4. [Modèle de données](#4-modèle-de-données)
5. [Multi-tenancy & permissions](#5-multi-tenancy--permissions)
6. [Modules métier](#6-modules-métier)
7. [Edge Functions catalogue](#7-edge-functions-catalogue)
8. [Auth & Permissions (détail technique)](#8-auth--permissions-détail-technique)
9. [Déploiement](#9-déploiement)
10. [Conventions code](#10-conventions-code)
11. [Dette technique & bugs UX connus](#11-dette-technique--bugs-ux-connus)
12. [Roadmap](#12-roadmap)
13. [Annexes](#13-annexes)

---

## 1. Vue d'ensemble produit

### 1.1 Qu'est-ce que LYTA ?

**LYTA** est une plateforme SaaS multi-tenant à destination des **cabinets de courtage en assurance suisses** (et, à terme, à d'autres marchés). Elle outille les courtiers indépendants et les cabinets sur l'intégralité de leur métier :

- **Gestion clients** : carnet d'adresses, membres de famille, documents, suivis
- **Gestion contrats / polices** : portefeuille, échéances, primes, sinistres
- **Smartflow** : scan + classification IA de documents (polices, décomptes, attestations)
- **Mandats de gestion** : génération + signature à distance + dispatch automatisé aux compagnies
- **Commissions** : règles tarifaires par compagnie/produit, calcul, rétrocessions, décomptes
- **Communications** : emailing transactionnel, campagnes, SMS, notifications
- **Espace client** : portail propre à chaque client final (lecture seule + signature de docs)
- **Comparateur** (en préparation, voir Optimis) : moteur de comparaison de produits d'assurance

### 1.2 Modèle économique

- **SaaS B2B abonnement mensuel/annuel** géré via **Stripe**
- Tarification par **seats** (collaborateurs CRM) — voir `useTenantSeats.tsx` et `apply-monthly-overage`
- **Plans** : configurés dans la table `platform_plans` (Starter / Pro / Enterprise…)
- **Quotas** : par tenant et par module (ex: nombre de clients, nombre de contrats, nombre de scans IA/mois)
- **Modules activables** : `plan_modules` × `platform_modules` (un plan donne accès à un sous-ensemble de modules)
- **Règle critique facturation** : les `extra_users` correspondent aux **collaborateurs CRM uniquement**. Les **clients du portail espace-client sont illimités et gratuits**. Voir `lyta_pricing_users.md` dans la mémoire projet.

### 1.3 Acteurs & rôles

LYTA distingue trois grands types d'utilisateurs :

| Rôle | Description | Espace |
|---|---|---|
| **KING (Optimislink)** | Administrateur de la plateforme (Habib) — gestion des tenants, plans, facturation, support, monitoring | `app.lyta.ch/king/*` |
| **Collaborateur tenant** | Membre d'un cabinet (admin, manager, agent) | `<tenant>.lyta.ch/crm/*` (sous-domaine) |
| **Client final** | Client du cabinet, accède à son espace personnel | `<tenant>.lyta.ch/client/*` |

Détail rôles **collaborateurs** :
- **Admin** : accès complet au CRM du cabinet
- **Manager** : voit ses agents + ses propres clients
- **Agent** : voit uniquement ses clients assignés (scope `personal` ou `team`)

Détail des scopes dans la section [5. Multi-tenancy & permissions](#5-multi-tenancy--permissions).

### 1.4 URLs en production

| Environnement | URL |
|---|---|
| **App principale** | `https://app.lyta.ch` |
| **Sous-domaines tenants** | `https://<slug>.lyta.ch` (ex: `advisy.lyta.ch`, `jcgconsulting.lyta.ch`) |
| **Backup Vercel** | `https://lyta-xi.vercel.app` |
| **API Supabase** | `https://shxbcszukoegvvejcpsn.supabase.co` |
| **Edge Functions** | `https://shxbcszukoegvvejcpsn.supabase.co/functions/v1/<name>` |
| **Storage** | bucket `documents` (privé, RLS strict) |

### 1.5 État actuel (juin 2026)

- **Tenants actifs en production** : ~3-5 (dont `advisy`, `jcgconsulting`)
- **Stack vivante** depuis ~12 mois
- **Roadmap** : voir `Documentation/Roadmap_LYTA_Officielle.md` (vivant, 6 priorités)
- **Dette technique** : présente mais cartographiée — voir [section 11](#11-dette-technique--bugs-ux-connus)

---

## 2. Stack & versions

### 2.1 Frontend

| Domaine | Lib / framework | Version | Rôle |
|---|---|---|---|
| Build / dev | **Vite** | 5.4.19 | Bundler, dev server, HMR |
| Compilation | **@vitejs/plugin-react-swc** | 3.11 | SWC pour TS/JSX (plus rapide que Babel) |
| Lang | **TypeScript** | 5.8.3 | Strict mode, types Supabase auto-générés |
| UI core | **React** | 18.3.1 | Functional components + hooks |
| Routing | **react-router-dom** | 6.30.1 | Routing déclaratif avec layouts imbriqués |
| State serveur | **@tanstack/react-query** | 5.83 | Cache des queries Supabase, invalidation, optimistic updates |
| Forms | **react-hook-form** + **zod** | 7.61 / 3.25 | Validation déclarative |
| Styling | **Tailwind CSS** + **tailwind-merge** + **CVA** | 3.4 / 2.6 / 0.7 | Classes utilitaires + variantes |
| Composants | **shadcn/ui** sur **Radix UI** | radix 1.x-2.x | Primitives accessibles non-stylisées |
| Animations | **framer-motion** | 12.23 | Animations + transitions |
| Icônes | **lucide-react** | 0.462 | Pack d'icônes SVG |
| Toasts | **sonner** + Radix toast | 1.7 / 1.2 | Notifications |
| Tableaux | **recharts** | 2.15 | Graphiques (dashboards, rapports) |
| 3D | **three** + **@react-three/fiber** + **drei** | 0.160 / 8.18 / 9.122 | Effets visuels marketing (peu utilisé en CRM) |
| PDF | **pdf-lib** + **pdfjs-dist** | 1.17 / 4.7.76 | Génération PDF (mandat signé) + affichage PDF (signature à distance) |
| QR codes | **qrcode** | 1.5 | Génération QR-factures suisses |
| XLSX | **xlsx** | 0.18 | Import/export de listes (clients, commissions) |
| Date | **react-day-picker** | 8.10 | DatePicker UI |
| Sanitization | **dompurify** | 3.3 | Cleanup HTML user-generated (anti-XSS) |
| Theme | **next-themes** | 0.3 | Mode clair/sombre |
| Carousel | **embla-carousel-react** + autoplay | 8.6 | Onboarding tour, marketing |
| OTP input | **input-otp** | 1.4 | Saisie SMS 2FA |

### 2.2 Backend

| Domaine | Tech | Version |
|---|---|---|
| Database | **PostgreSQL** (Supabase managé) | 15.x |
| Auth | **Supabase Auth** (GoTrue) | géré Supabase |
| API | **PostgREST** auto-généré + **RPC functions** PL/pgSQL | géré Supabase |
| Edge runtime | **Deno** (Supabase Edge Functions) | Deno 1.x |
| Storage | **Supabase Storage** (S3-compatible) | géré Supabase |
| Realtime | **Supabase Realtime** (postgres_changes / broadcast) | géré Supabase |
| SDK client | **@supabase/supabase-js** | 2.81 |

### 2.3 Services tiers

| Service | Usage |
|---|---|
| **Resend** | Email transactionnel (invitations, notifications, dispatch mandat aux compagnies) |
| **Twilio Verify** | Vérification SMS (2FA, validation email pour invitations) |
| **Stripe** | Facturation abonnement tenants, webhooks |
| **OpenAI / Anthropic** | Classification IA des documents scannés (Smartflow) |
| **OpenPLZ / Swiss-post** | Validation codes postaux suisses, lookup d'adresses |
| **Vercel** | Hosting frontend (auto-deploy sur push GitHub) |
| **GitHub** | Repo privé `LYTA-git` |

### 2.4 Mobile

| Tech | Version | Statut |
|---|---|---|
| **Capacitor** (`@capacitor/core`, `android`, `ios`) | 8.0 | Configuré (`capacitor.config.ts` à la racine) mais build natif non-distribué à date. L'app PWA web suffit pour le mobile en pratique. |

### 2.5 Versions Node / Build

- **Node** : géré côté Vercel (LTS 20.x)
- **package manager** : `npm` (lockfile `package-lock.json` versionné)
- **Build prod** : `npm run build` (Vite → `dist/`)
- **Dev local** : `npm run dev` (Vite sur `localhost:5173` par défaut)
- **Lint** : `npm run lint` (ESLint 9 + typescript-eslint 8 + react-hooks plugin)

---

## 3. Architecture globale

### 3.1 Vue macro

```
┌──────────────────────────────────────────────────────────────────┐
│                       UTILISATEURS                                │
│  Habib (KING) │ Collaborateurs cabinets │ Clients finaux         │
└──────┬───────────────────┬──────────────────────┬─────────────────┘
       │                   │                      │
       ▼                   ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                  FRONTEND React (Vercel)                         │
│   app.lyta.ch / *.lyta.ch — Vite + React + TS + shadcn          │
│                                                                  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  src/pages/king  │  │  src/pages/crm  │  │ pages/client  │  │
│  └──────────────────┘  └─────────────────┘  └───────────────┘  │
└──────┬─────────────────────────────────────────────────────────────┘
       │ (supabase-js + invokeSupabaseFunction)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE (shxbcszukoegvvejcpsn)               │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐    │
│  │ PostgreSQL │  │ Edge Funcs   │  │ Storage (bucket       │    │
│  │ + RLS      │  │ (Deno) × 59  │  │  "documents")         │    │
│  └────────────┘  └──────────────┘  └───────────────────────┘    │
│  ┌────────────┐  ┌──────────────┐                                │
│  │   Auth     │  │  Realtime    │                                │
│  └────────────┘  └──────────────┘                                │
└──────┬─────────────────────────────────────────────────────────────┘
       │
       ▼ (calls sortants depuis Edge Functions)
┌──────────────────────────────────────────────────────────────────┐
│                    SERVICES TIERS                                │
│  Resend │ Twilio │ Stripe │ OpenAI/Anthropic │ OpenPLZ/Post     │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Structure des sources frontend

```
src/
├── pages/              # Routes top-level (15+ CRM, 19 KING, 9 client, 7 racines)
│   ├── crm/            # /crm/* — espace courtier
│   ├── king/           # /king/* — espace admin plateforme (Habib)
│   ├── client/         # /client/* — espace client final
│   ├── Connexion.tsx   # /connexion
│   ├── Signer.tsx      # /signer/:token — flow signature à distance
│   ├── DeposerContrat.tsx
│   ├── ResetPassword.tsx
│   ├── FinaliserInscription.tsx
│   └── NotFound.tsx
│
├── components/         # Composants réutilisables (~250+)
│   ├── ui/             # shadcn primitives (57 fichiers)
│   ├── crm/            # Composants spécifiques CRM (35 fichiers)
│   ├── crm/emails/     # Sous-modules : EmailHistory, etc.
│   ├── crm/clients/    # BulkAssignDialog, QuickContactDialog
│   ├── crm/publicite/  # EmailDeliveryHistory
│   ├── king/           # Composants KING (16 fichiers)
│   ├── signatures/     # MandatTemplate, PdfZonePicker, etc. (5 fichiers)
│   ├── client/         # ClaimForm, ClientNotificationBell, MobileBottomNav
│   ├── auth/           # SmsVerificationDialog
│   ├── quotas/         # TenantQuotaWidget
│   └── support/        # TenantSupportTickets
│
├── hooks/              # 50 hooks personnalisés (logique métier réutilisable)
│   ├── useAuth.tsx
│   ├── useUserTenant.tsx
│   ├── useClients.tsx
│   ├── usePolicies.tsx
│   ├── useCommissions.tsx
│   ├── usePermissions.tsx       # Calcul des droits selon rôle + scope
│   ├── useTenantConsumption.tsx # Quotas en temps réel
│   ├── useMandatDispatch.tsx
│   └── … (voir Annexe 13.1 pour liste complète)
│
├── lib/                # Utilitaires partagés
│   ├── edgeFunctions.ts    # wrapper invokeSupabaseFunction (gère erreurs uniformément)
│   ├── tenantUrls.ts       # Calcul sous-domaine selon tenant
│   ├── ibanUtils.ts        # Validation IBAN suisse
│   ├── documentUpload.ts   # Upload Supabase Storage avec compression
│   ├── audit.ts            # Log des actions sensibles
│   ├── policiesApi.ts      # Helpers polices/contrats
│   ├── clientNotifications.ts
│   ├── insuranceCompanyLogos.ts
│   ├── errorTranslations.ts
│   ├── sessionEnforcerStorage.ts
│   └── utils.ts            # cn(), classnames merger Tailwind
│
├── integrations/
│   └── supabase/
│       ├── client.ts       # Client supabase-js
│       └── types.ts        # Types auto-générés (Database, Tables, etc.)
│
├── App.tsx             # Provider tree + routing global
└── main.tsx            # Entry point Vite
```

### 3.3 Structure backend

```
supabase/
├── config.toml         # Config Supabase CLI (functions verify_jwt, auth settings)
├── migrations/         # 256 migrations SQL versionnées (timestamps croissants)
│   └── *.sql
└── functions/          # 59 edge functions Deno
    ├── _shared/        # cors.ts, logger.ts, requireAuth.ts, etc.
    ├── send-signature-invite/
    ├── proxy-signature-pdf/
    ├── dispatch-mandat-to-companies/
    ├── create-client/
    ├── … (voir section 7 pour catalogue)
```

### 3.4 Flux d'authentification (vue macro)

```
1. Utilisateur → /connexion → email + mot de passe
2. Frontend appelle supabase.auth.signInWithPassword
3. Supabase Auth retourne { session, user }
4. session.access_token (JWT) stocké en localStorage par supabase-js
5. Tous les appels supabase.from('xxx') incluent automatiquement le JWT
6. PostgREST décode le JWT → applique RLS basées sur auth.uid()
7. RLS policies consultent user_tenant_roles pour scoper l'accès
8. Si tenant mismatch → 0 row retourné (jamais d'erreur 403 — silent filter)
```

Détail dans la section [8. Auth & Permissions](#8-auth--permissions-détail-technique).

### 3.5 Pattern de routage tenant

LYTA utilise un **routing par sous-domaine** :

| URL | Comportement |
|---|---|
| `app.lyta.ch` | Landing + connexion KING |
| `app.lyta.ch/king/*` | Espace KING (admin plateforme) |
| `advisy.lyta.ch` | Auto-redirection vers la connexion du tenant `advisy` |
| `advisy.lyta.ch/crm/*` | Espace courtier du tenant `advisy` |
| `advisy.lyta.ch/client/*` | Espace client final (côté tenant) |
| `advisy.lyta.ch/signer/:token` | Page de signature publique (token uniquement, pas d'auth) |

Le sous-domaine est détecté côté frontend (`src/lib/tenantUrls.ts`) puis utilisé pour :
1. Résoudre le `tenant_id` via la table `tenants` (colonne `slug`)
2. Charger le branding (`tenant_branding` — logo, couleurs)
3. Filtrer toutes les queries Supabase via les RLS (qui s'appuient sur `user_tenant_roles`)

> **Important sécurité** : le sous-domaine **n'est PAS** la source de vérité du filtrage tenant — c'est juste l'UI. La vraie isolation est en RLS Postgres. Voir [section 8](#8-auth--permissions-détail-technique).

---

## 4. Modèle de données

### 4.1 Tables principales (90+ au total)

Listées par domaine fonctionnel. Pour chaque table : rôle, RLS scoping, points d'attention.

#### 4.1.1 Plateforme & Tenants

| Table | Rôle |
|---|---|
| `tenants` | Cabinets utilisateurs de LYTA (1 ligne par client SaaS). Colonnes clés : `id`, `slug`, `name`, `status`, `plan_id`, `stripe_customer_id` |
| `tenant_branding` | Logo, couleurs primaires/secondaires par tenant (sous-domaine) |
| `tenant_branches` | Agences/succursales d'un même tenant |
| `tenant_app_settings` | Settings configurables par tenant (préférences, intégrations) |
| `tenant_email_automation` | Configuration emails automatiques (anniversaires, échéances) |
| `tenant_email_log` | **Historique unifié des emails sortants** (transactionnels + dispatch + campagnes). Vue lue par `EmailDeliveryHistory.tsx`. |
| `tenant_feature_flags` | Flags par tenant pour activer des features en beta |
| `tenant_security_settings` | Config 2FA, durée sessions, IP allow-list, etc. |
| `tenant_consumption` | Métriques d'usage par tenant (pour facturation overage) |
| `tenant_overage_events` | Dépassements de quotas facturés |
| `tenant_quota_alerts` | Notifications de seuils atteints |
| `tenant_limits` | Limites par tenant (override des limites du plan) |
| `tenant_limits_audit` | Historique des modifications de limites |
| `tenant_billable_services` | Services additionnels facturables (ex: scans IA en sus) |
| `tenant_document_types` | Types de docs customisables par tenant |
| `tenant_product_commission_overrides` | Overrides de tarification commissions par produit/tenant |
| `tenant_roles` | Rôles personnalisés par tenant (en plus de admin/manager/agent) |
| `tenant_role_permissions` | Permissions granulaires associées aux rôles |
| `platform_plans` | Plans SaaS disponibles (Starter, Pro, Enterprise) |
| `platform_modules` | Modules activables (CRM Clients, Signatures, Smartflow…) |
| `plan_modules` | Mapping plan ↔ modules inclus |
| `plan_quotas` | Quotas par plan (max clients, max scans/mois, etc.) |
| `platform_usage_logs` | Audit cross-tenant des actions critiques (vu par KING) |
| `platform_settings` | Settings globaux de la plateforme |
| `pending_signups` | File d'attente des demandes d'inscription (avant validation par KING) |

#### 4.1.2 Utilisateurs & Permissions

| Table | Rôle |
|---|---|
| `profiles` | Profil utilisateur (id = `auth.users.id`, prénom, nom, photo, langue) |
| `user_roles` | Rôle global d'un user (ex: `king`) — **legacy, à vérifier vs `user_tenant_roles`** |
| `user_tenant_roles` | Rôle d'un user dans un tenant (`admin`, `manager`, `agent`) + scope (`global`, `team`, `personal`) |
| `user_tenant_assignments` | Assignments multi-tenants si un user appartient à plusieurs cabinets |
| `user_app_connections` | Connexions externes (ex: API tierces liées au compte user) |
| `collaborator_permissions` | Permissions granulaires par collaborateur (override des permissions du rôle) |

#### 4.1.3 CRM Clients

| Table | Rôle |
|---|---|
| `clients` | Le carnet de clients du cabinet (personnes physiques). Colonnes clés : `id`, `tenant_id`, `assigned_agent_id`, `first_name`, `last_name`, `email`, `phone`, `birth_date`, etc. |
| `family_members` | Membres du foyer rattachés à un client (conjoint, enfants). Peuvent eux-mêmes être des clients du cabinet. |
| `clients_safe` | **Vue PostgreSQL** retournant `clients` avec certaines colonnes masquées selon le scope (legacy ?) |
| `documents` | Documents attachés à un client (PDFs uploadés, scans, polices, mandats signés) |
| `document_categories` | Catégories de docs (Identité, Police, Décompte, Mandat…) |
| `document_templates` | Templates de docs pré-remplis utilisables par le cabinet |
| `document_reminders` | Rappels d'échéances liés aux documents (renouvellement carte ID, etc.) |
| `documents_expiring_soon` | **Vue** PostgreSQL listant les docs à échéance dans les 60 jours |

#### 4.1.4 Contrats / Polices

| Table | Rôle |
|---|---|
| `policies` | Polices d'assurance d'un client (vie, LAMal, RC, etc.). Liée à `clients` + `insurance_companies` + `insurance_products` |
| `contracts` | **Table legacy ?** À vérifier — possible alias historique de `policies` |
| `claims` | Sinistres déclarés sur une police |
| `claim_documents` | Documents joints à un sinistre |

#### 4.1.5 Compagnies & Produits d'assurance

| Table | Rôle |
|---|---|
| `insurance_companies` | Catalogue des compagnies (AXA, Helsana, Swiss Life…) — gérées par KING |
| `insurance_products` | Catalogue des produits par compagnie (LAMal Basis, LCA, 3a, 3b, LPP…) |
| `company_contacts` | Contacts dans une compagnie (email général, email mandat, téléphone) — utilisé par le dispatch mandat |

#### 4.1.6 Commissions & Comptabilité

| Table | Rôle |
|---|---|
| `commissions` | Commissions calculées sur les polices |
| `commission_rules` | Règles tarifaires par compagnie/produit (taux, plafonds) |
| `commission_tiers` | Paliers de tiering (volume → taux variable) |
| `commission_history` | Historique des modifications de règles |
| `commission_statements` | Décomptes mensuels/trimestriels reçus des compagnies |
| `commission_statement_lines` | Lignes individuelles des décomptes (après import OCR) |
| `retrocommissions` | Rétrocessions sur agents/sous-agents |
| `decomptes` | Décomptes payés aux collaborateurs (paie) |
| `decompte_lines` | Lignes de décomptes par collaborateur |
| `payouts` | Paiements aux agents externes ou apporteurs |
| `qr_invoices` | Factures QR suisses émises (clients ou collaborateurs) |
| `qr_invoice_logs` | Audit des QR-factures émises |
| `transactions` | Mouvements comptables génériques |
| `reserve_accounts` | Comptes de réserve (provisions retours commissions) |
| `reserve_transactions` | Mouvements sur les comptes de réserve |
| `invoice_items` | Items facturables (jamais nullable, business logic) |

#### 4.1.7 Signatures & Mandats

| Table | Rôle |
|---|---|
| `signature_requests` | Demandes de signature (mandat de gestion + docs importés). Colonnes clés : `access_token` (UUID public), `document_kind` (`mandat_gestion`, `imported`, `autre`), `status` (`draft`, `sent`, `viewed`, `signed`, `cancelled`, `refused`), `signature_zone` (jsonb coords normalisées), `preview_file_key`, `signed_file_key` |
| `mandat_dispatch_log` | Log par compagnie du dispatch d'un mandat signé (status, sent_at, erreur Resend) |

#### 4.1.8 Communications

| Table | Rôle |
|---|---|
| `tenant_email_log` | **Source de vérité historique emails sortants** (kind = `signature_invite`, `mandat_signed`, `mandat_dispatch`, `account_created`, `campaign`, `crm_email`, `lpp_search`, `transactional`…) |
| `scheduled_emails` | Emails programmés à envoyer (campaigns, anniversaires) |
| `email_templates` | Templates emails customisables par tenant |
| `sms_verifications` | Codes SMS Twilio en attente de vérification |
| `notifications` | Notifications in-app pour collaborateurs CRM |
| `messages` | Messages internes (chat ?) — à vérifier |
| `king_notifications` | Notifications pour Habib (alertes plateforme) |

#### 4.1.9 Smartflow / Scans

| Table | Rôle |
|---|---|
| `document_scans` | Scans uploadés en attente de classification |
| `document_scan_results` | Résultats OCR + IA (champs extraits) |
| `document_scan_audit` | Audit des actions sur les scans |
| `scan_batches` | Lots de scans (traitement en bulk) |
| `lpp_search_requests` | Recherches LPP (2e pilier) groupées |

#### 4.1.10 Workflows & IA

| Table | Rôle |
|---|---|
| `workflow_definitions` | Définitions de workflows automatisés (triggers + actions) |
| `workflow_executions` | Logs d'exécutions des workflows |
| `ai_conversations` | Conversations avec assistant IA |
| `ai_messages` | Messages individuels (rôle, content, tokens) |
| `ai_leads` | Leads générés par l'IA (prospects qualifiés) |
| `ai_rate_limits` | Quotas IA par tenant/user |

#### 4.1.11 Affiliés & Partenaires

| Table | Rôle |
|---|---|
| `affiliates` | Programme d'affiliation (apporteurs LYTA) |
| `affiliate_commissions` | Commissions versées aux affiliés |
| `partners` | Partenaires commerciaux (cabinets référencés) |

#### 4.1.12 Support & Audit

| Table | Rôle |
|---|---|
| `support_tickets` | Tickets support entre tenants et Habib |
| `support_ticket_messages` | Messages d'un ticket |
| `audit_logs` | Audit des actions sensibles (modifs critiques) |
| `king_audit_log` / `king_audit_logs` | Audit KING (double table — **legacy à consolider**) |
| `app_usage_logs` | Logs d'usage de l'app par les utilisateurs |
| `webhooks` | Webhooks sortants configurés par tenant |
| `webhook_logs` | Logs des webhooks émis |
| `api_rate_limits` | Rate limits par API endpoint |
| `external_apps` | Apps externes connectées (intégrations type Zapier custom) |

### 4.2 Conventions de nommage

- **Tables** : `snake_case` pluriel (`clients`, `signature_requests`)
- **Colonnes** : `snake_case` (`tenant_id`, `created_at`)
- **Foreign keys** : `<entity>_id` (`tenant_id`, `client_id`, `created_by`)
- **Timestamps** : `created_at`, `updated_at` (toujours `timestamptz`)
- **Soft delete** : pas systématique — vérifier au cas par cas (`deleted_at` quand utilisé)
- **JSONB** : pour payloads flexibles (`payload`, `metadata`, `settings`, `signature_zone`)
- **Énums Postgres** : utilisés pour `status`, `document_kind`, `role`, etc. (voir migrations)

### 4.3 Triggers & fonctions critiques

- `set_updated_at()` — trigger BEFORE UPDATE qui maintient `updated_at`
- `set_tenant_id_from_jwt()` — trigger BEFORE INSERT qui force `tenant_id` depuis le JWT (anti-injection)
- `can_access_client(client_uuid)` — fonction SECURITY DEFINER appelée par les RLS
- `get_user_tenant_id()` — retourne le tenant actif de l'utilisateur courant
- `my_collab_id_for_active_tenant()` — retourne l'ID collaborateur dans le tenant actif
- `_client_is_in_team(client_uuid, manager_uuid)` — vérifie si un client appartient à l'équipe d'un manager

> Pour l'audit complet des RLS, voir le **Doc 2 confidentiel** (Security Audit).

---

## 5. Multi-tenancy & permissions

### 5.1 Le principe

LYTA est **multi-tenant strict** : chaque cabinet vit dans le même cluster Postgres, isolé par RLS. **Aucune donnée ne doit jamais fuiter d'un tenant à un autre**, sauf via les outils KING explicitement prévus pour ça.

L'isolation repose sur **trois couches** :

1. **Sous-domaine** (UI uniquement, non-sécurisé) — détermine le branding et le tenant à charger
2. **JWT Supabase** (auth) — contient l'`auth.uid()` de l'utilisateur connecté
3. **RLS Postgres** (sécurité réelle) — filtre toutes les queries selon `user_tenant_roles`

### 5.2 Rôles et scopes

#### Rôles de base (table `user_tenant_roles.role`)

| Rôle | Description | Voit |
|---|---|---|
| `admin` | Administrateur du tenant | Tout le tenant |
| `manager` | Manager d'équipe | Lui-même + les agents qu'il supervise + leurs clients |
| `agent` | Agent commercial | Lui-même + ses clients assignés |
| `king` | Habib / Optimislink | Tous les tenants (read), opérations admin (write) |

#### Scopes (table `user_tenant_roles.scope`)

Le scope module la visibilité au sein du rôle :

| Scope | Effet |
|---|---|
| `global` | Voit toutes les données du tenant (typique pour admin) |
| `team` | Voit son équipe + ses subordonnés (typique pour manager) |
| `personal` | Voit uniquement ses propres données (typique pour agent) |

> **Exemple concret** : Stéphane (agent JCG) a `role = 'agent'` et `scope = 'personal'`. Il ne voit que ses clients assignés (`clients.assigned_agent_id = collab_id_de_stephane`). Voir l'incident timeout RLS résolu dans la session du 3 juin (`useClients.tsx` applique un filtre `or(assigned_agent_id.eq.<myCollabId>,id.eq.<myCollabId>)` côté front pour éviter la lenteur des RLS scope-aware en SQL).

### 5.3 Fonctions de scope (`useUserTenant`, `usePermissions`)

Le hook `useUserTenant()` (frontend) résout :
- `tenantId` (UUID du tenant actif)
- `myScope` (`'global' | 'team' | 'personal'`)
- `myCollabId` (UUID collaborateur dans ce tenant)
- `role`

Le hook `usePermissions()` calcule des **droits dérivés** (peut-il créer un client ? voir les commissions ? exporter ?) en fonction du rôle + scope + collaborator_permissions.

### 5.4 Routage et résolution tenant côté frontend

```typescript
// Pseudo-code de résolution du tenant actif
1. URL = "advisy.lyta.ch" → slug = "advisy"
2. supabase.from('tenants').select('id').eq('slug', 'advisy').single()
3. tenant.id stocké dans le contexte UserTenantContext
4. Toutes les queries qui ont besoin du tenant utilisent useUserTenant().tenantId
```

### 5.5 Multi-cabinets (un user dans plusieurs tenants)

Un même utilisateur peut être collaborateur dans plusieurs cabinets (table `user_tenant_assignments`). Dans ce cas :
- Switch tenant via UI (sélecteur en haut du CRM)
- Le tenant actif est stocké en localStorage + cookie (à vérifier dans `lib/tenantUrls.ts`)
- Les RLS s'appuient sur le tenant actif retourné par `get_user_tenant_id()`

### 5.6 Cas KING (Optimislink / Habib)

Habib (rôle `king`) a un accès cross-tenant pour les opérations plateforme :
- Lister/voir tous les tenants
- Activer/désactiver un tenant
- Voir les métriques d'usage
- Impersonate un tenant (edge function `king-impersonate-tenant` — à auditer pour traçabilité)
- Modifier les plans, quotas, facturation

Toutes les actions KING sont auditées dans `king_audit_logs` (et `king_audit_log` — doublon legacy à consolider).

### 5.7 Espace client final

Les clients finaux (table `clients`) **n'ont pas** d'authentification Supabase classique. Ils accèdent à leur espace via :
- **Magic link email** (provision via `send-client-message` ?)
- Token de session court (à confirmer dans `useAuth`)

Leur visibilité : uniquement leurs propres données (dossier, polices, sinistres, messages avec leur conseiller).

> **À auditer** : confirmer comment exactement le client final est authentifié et quelle RLS s'applique à lui (différente de celle des collaborateurs).

---

## 6. Modules métier

> 📋 **Cette section sera étoffée module par module dans les prochains points d'étape.**
>
> Modules planifiés (~18) :
>
> 1. Auth & Onboarding
> 2. CRM Clients
> 3. CRM Contracts / Polices
> 4. CRM Commissions
> 5. CRM Compagnies d'assurance
> 6. CRM Compta
> 7. CRM Smartflow / Propositions / Scan IA
> 8. CRM Signatures (mandat + imported + dispatch)
> 9. CRM Publicité (Emailing transactionnel + campagnes)
> 10. CRM Suivis (Tasks, Reminders, Birthdays)
> 11. CRM Rapports
> 12. CRM Collaborateurs & Abonnement (Stripe seats)
> 13. CRM LytaTools
> 14. LPP Search
> 15. Comparateur (en préparation)
> 16. Espace Client (portal)
> 17. KING (admin plateforme cross-tenant)
> 18. Affiliés

---

## 7. Edge Functions catalogue

> 📋 **À détailler** — 59 fonctions à documenter (rôle, auth, payload, dépendances, called by).

---

## 8. Auth & Permissions (détail technique)

> 📋 **À détailler** — Supabase Auth flow, JWT, MFA TOTP, sessions, reset password.

---

## 9. Déploiement

> 📋 **À détailler** — Vercel CI/CD, Supabase CLI, variables d'env, migrations, secrets, rollback.

---

## 10. Conventions code

> 📋 **À détailler** — naming, patterns React, hooks, gestion d'erreur, i18n.

---

## 11. Dette technique & bugs UX connus

> 📋 **À étoffer** au fur et à mesure de l'audit.

### 11.1 Bugs UX corrigés récemment (juin 2026)

- **RLS clients timeout 80s** (Stéphane JCG) → résolu via RLS simple + filtre côté frontend dans `useClients.tsx`
- **PDF signature CORS** sur sous-domaines tenants → edge function `proxy-signature-pdf` en CORS `*`
- **PDF worker pdfjs bloqué par CSP** → worker bundlé local via Vite `?url`
- **Inversion workflow signature mandat** (zone dessinée par broker au lieu de signataire) → corrigé : zone dessinée par signataire
- **Storage bucket 10MB → 25MB** + ajout HEIC/HEIF
- **Type-gen Supabase out-of-sync** : `get_signature_request_by_token`, `mark_signature_request_viewed` non typés → fallback `as any` ponctuel

### 11.2 Dette technique identifiée

- **Tables doublonnes** : `audit_log` vs `audit_logs`, `king_audit_log` vs `king_audit_logs` — consolider
- **`contracts` vs `policies`** : à vérifier si `contracts` est legacy
- **`clients_safe` vue** : usage actuel à confirmer
- **Authentification client final** : flow à documenter et auditer
- **`frame-ancestors` CSP** : délivré via meta donc ignoré, à déplacer en header HTTP Vercel
- **Worker statement_timeout 30s** : `ALTER ROLE authenticated SET statement_timeout = '30s'` — bon pour éviter les blocages mais peut couper des exports légitimes

---

## 12. Roadmap

Voir le document vivant **`Documentation/Roadmap_LYTA_Officielle.md`** (au format PDF aussi).

Roadmap LYTA officielle = 6 priorités (statut 🟢/🟡/🔴/📋 mis à jour à chaque session).

---

## 13. Annexes

### 13.1 Liste complète des hooks personnalisés (50)

```
useAffiliates, useAgents, useAuth, useCelebration, useClientMandatStatus,
useClientNotifications, useClients, useCollaborateurs, useCollaborateursCommission,
useCollaboratorPermissions, useCommissionParts, useCommissions, useCompanyContacts,
useCrmEmails, useDocuments, useEmailAutomation, useFamilyMembers, useForcedLogoutAfter,
useInsuranceCompanies, useInsuranceProducts, useKingNotifications, useLanguage,
useLytaTools, useMandatDispatch, useNotifications, usePaginatedQuery,
usePasswordCheck, usePendingProducts, usePendingScans, usePerformance, usePermissions,
usePlanFeatures, usePlatformSettings, usePolicies, useProductCatalog, useQRInvoices,
useScanBatches, useSessionTimeout, useStripeStats, useSuivis, useTenantBranches,
useTenantConsumption, useTenantLookups, useTenantRoles, useTenantSeats, useTheme,
useUserRole, useUserTenant, use-mobile, use-toast
```

### 13.2 Liste complète des edge functions (59)

```
activate-tenant, add-user-seat, ai-chat, apply-monthly-overage, bypass-insert,
cancel-tenant-subscription, check-slug-availability, classify-batch-documents,
complete-signature, create-checkout-session, create-client, create-collaborator,
create-tenant-admin, create-user-account, delete-tenant, delete-user-account,
deposit-contract, dispatch-mandat-to-companies, export-tenant-data,
get-checkout-session-info, get-signature-pdf-url, health-check,
king-impersonate-tenant, king-stripe-stats, list-tenant-invoices,
process-scheduled-emails, provision-self-signup-tenant, proxy-signature-pdf,
receive-tenant-request, request-signature-link-renewal, resend-signup-finalization,
reset-tenant-data, save-policy, scan-commission-statement, scan-document,
send-birthday-emails, send-claim-notification, send-client-message,
send-client-notification-email, send-contract-deposit-email, send-crm-email,
send-follow-up-reminders, send-lpp-search-requests, send-password-reset,
send-renewal-reminders, send-signature-invite, send-sms, send-test-tenant-emails,
send-verification-sms, stripe-webhook, submit-referral, swiss-address-lookup,
swiss-postal-code-lookup, sync-external-billing, sync-tenant-stripe,
tenant-onboarding, verify-partner-email, verify-sms-code
```

### 13.3 Glossaire

| Terme | Définition |
|---|---|
| **KING** | Espace d'administration de la plateforme LYTA (réservé à Optimislink / Habib) |
| **Tenant** | Cabinet utilisateur de LYTA (= 1 client SaaS) |
| **Collaborateur** | Membre d'un cabinet (admin / manager / agent) — facturé en seat |
| **Client** | Personne physique conseillée par un cabinet — non facturée |
| **Mandat de gestion** | Document juridique signé par un client autorisant le cabinet à agir en son nom auprès des compagnies |
| **Dispatch** | Envoi automatisé d'un mandat signé à toutes les compagnies en PJ |
| **Smartflow** | Module de scan + classification IA de documents |
| **LPP** | 2e pilier suisse (prévoyance professionnelle) |
| **LAMal / LCA** | Assurance maladie de base / complémentaire (Suisse) |
| **3a / 3b** | 3e pilier suisse (prévoyance individuelle liée / libre) |
| **RC** | Responsabilité civile |
| **Décompte** | Document mensuel/trimestriel des compagnies listant les commissions dues |
| **Rétrocession** | Reversement d'une partie de commission à un agent ou apporteur |
| **Seat** | Place de collaborateur (unité de facturation) |
| **Slug** | Identifiant URL d'un tenant (ex: `advisy`, `jcgconsulting`) |

### 13.4 Variables d'environnement requises

Voir le **Doc 2 confidentiel** pour les **valeurs**. Variables attendues :

#### Frontend (`.env.local` Vite)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### Edge Functions (Supabase secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (par tenant ou global)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SID`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGINS` (CSV des origines autorisées pour les fonctions ne forçant pas CORS `*`)

---

## ⏭️ Prochains points d'étape de ce document

Ce document est volontairement livré **en plusieurs passes** :

- **Passe 1 (livrée)** : Sections 1-5 (vue d'ensemble → multi-tenancy) + squelette du reste
- **Passe 2** : Modules métier 1-6 (Auth, Clients, Polices, Commissions, Compagnies, Compta)
- **Passe 3** : Modules métier 7-12 (Smartflow, Signatures, Publicité, Suivis, Rapports, Collaborateurs)
- **Passe 4** : Modules métier 13-18 (LytaTools, LPP, Comparateur, Client portal, KING, Affiliés)
- **Passe 5** : Edge Functions catalogue + Auth détail + Déploiement
- **Passe 6** : Conventions code + Dette technique complète + finalisation

Le Doc 2 confidentiel (`LYTA_Security_Audit_CONFIDENTIAL.md`) sera produit séparément après la Passe 6.

---

*Document généré le 8 juin 2026 par Habib Agharbi (Optimislink Sàrl). Tous droits réservés.*

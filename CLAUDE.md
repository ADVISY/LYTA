# CLAUDE.md — Mémoire de travail LYTA

> Ce fichier sert de contexte permanent pour Claude Code et tout collaborateur technique.
> À lire en début de chaque session. À mettre à jour après chaque change structurant.

---

## 🏢 Le projet

**LYTA** est un SaaS multi-tenant pour cabinets de courtage en assurances (Suisse). Chaque tenant = un cabinet (ex: Advisy). Chaque tenant a ses propres collaborateurs (admins, managers, agents, back-office) et ses propres clients finaux.

- **Owner produit** : Habib Gharbi
- **URL principale** : https://lyta.ch
- **Sous-domaines tenants** : `<slug>.lyta.ch` (ex: `advisy.lyta.ch`, `demo.lyta.ch`)
- **Repo Git** : https://github.com/ADVISY/LYTA (⚠️ actuellement public)

## 🧱 Stack technique

| Couche | Techno |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind + shadcn/ui + react-router-dom v6 |
| Backend | Supabase (Postgres + Auth + Edge Functions Deno) |
| Hosting | Vercel (frontend) — Supabase (backend) |
| Mobile | Capacitor (iOS / Android) — pas encore actif |
| Monitoring | (à mettre en place — voir Phase 2) |
| Paiements | Stripe |
| SMS | Twilio |
| Email | Resend |
| IA | Gateway compatible OpenAI (variable `AI_GATEWAY_API_KEY`) |
| DNS | Cloudflare |

## 🗂️ Structure du repo

```
LYTA/
├── src/
│   ├── App.tsx                       Routes principales
│   ├── pages/
│   │   ├── Connexion.tsx             Page login (3 espaces : client / team / king)
│   │   ├── ResetPassword.tsx
│   │   ├── crm/                      Espace équipe tenant (payant)
│   │   ├── client/                   Espace client final (gratuit)
│   │   └── king/                     Espace super-admin global
│   ├── components/
│   ├── hooks/                        useAuth, useUserTenant, useNotifications, etc.
│   ├── contexts/                     TenantContext (détection sous-domaine)
│   ├── integrations/supabase/        client.ts, config.ts
│   └── i18n/                         Traductions FR/EN/DE/IT
├── supabase/
│   ├── migrations/                   ~140+ migrations SQL chronologiques
│   └── functions/                    ~30 Edge Functions Deno
└── public/                           Assets statiques
```

## 👥 Les 3 espaces de l'application

| Espace | URL | Pour qui | Payant ? |
|---|---|---|---|
| **King** | `/king` | Super-admin global (Habib) | — |
| **CRM (équipe)** | `/crm` | Collaborateurs du tenant : admin, manager, agent, back-office, compta | ✅ Payant (siège Stripe) |
| **Client** | `/espace-client` | Clients finaux du cabinet | ❌ Gratuit |

## 🔐 Modèle de données — clés à connaître

- **`clients`** : table polymorphe via `type_adresse` ∈ {`client`, `collaborateur`, `partenaire`}. Statut via `status` ∈ {`prospect`, `actif`, `résilié`, `dormant`}.
- **`assigned_agent_id`** (sur clients) → l'agent qui suit le client (lui-même un collaborateur dans la même table)
- **`manager_id`** (sur clients) → le manager hiérarchique
- **`tenant_id`** : isolation multi-tenant systématique
- **`user_roles(user_id, role)`** : rôles app_role ∈ {`king`, `admin`, `manager`, `agent`, `backoffice`, `compta`, `partner`, `client`}
- **`user_tenant_assignments(user_id, tenant_id)`** : lien user ↔ tenant (un user peut être dans plusieurs tenants)
- **`tenant_roles` + `tenant_role_permissions`** : permissions modulaires par tenant
- **`notifications(user_id, tenant_id, kind, ...)`** : notifs polymorphes via `kind`

## 🚦 Zones rouges — ne JAMAIS toucher sans validation

- **RLS policies** dans `supabase/migrations/*` (~330 policies) — une erreur = fuite cross-tenant
- **`supabase/functions/_shared/auth.ts`** — brique d'auth de toutes les Edge Functions
- **`src/contexts/TenantContext.tsx`** — détection tenant via sous-domaine
- **`src/pages/Connexion.tsx`** — routing client / team / king
- **Edge Functions destructives** : `delete-tenant`, `reset-tenant-data`, `create-tenant-admin`, `stripe-webhook`, `tenant-onboarding`
- **Fonctions de sécurité PG** : `is_king()`, `get_user_tenant_id()`, `has_role()`

## 🟢 Zones vertes — où développer en sécurité

- `src/pages/crm/*` (dashboards, listes, détails)
- `src/pages/client/*` (portail client)
- `src/components/*` (UI génériques shadcn)
- Nouvelles features qui utilisent les hooks existants (`useClients`, `useUserTenant`, etc.)

## 🛡️ Sécurité — règles non négociables

1. **`SUPABASE_SERVICE_ROLE_KEY`** : jamais côté client. Vit uniquement dans les Edge Functions Supabase.
2. **`VITE_SUPABASE_PUBLISHABLE_KEY`** (anon key) : peut être public, protégée par RLS.
3. Toute insertion sensible (création user, tenant, contrat) passe par une Edge Function avec `requireAuth()`.
4. Les tenants doivent être isolés à 3 niveaux : RLS Postgres + filtre tenant_id côté hook + détection sous-domaine.
5. Avant toute migration SQL : tester sur staging si possible (voir section Workflow).

## 🔧 Commandes utiles

```bash
# Développement local
npm install
npm run dev                                # Vite sur http://localhost:8080

# Vérification TypeScript
npx tsc --noEmit -p tsconfig.app.json

# Build de production
npm run build

# Linter
npm run lint
```

## 🔑 Variables d'environnement

### ⚠️ DEUX projets Supabase distincts

| Environnement | URL | Quand l'utiliser |
|---|---|---|
| **PROD** (vrais clients) | `https://shxbcszukoegvvejcpsn.supabase.co` | Vercel `main` y est branché. Ne JAMAIS toucher en dev local sauf cas exceptionnel. |
| **STAGING** (bac à sable) | `https://vytplwvribjkecaysnxr.supabase.co` | C'est ICI qu'on développe en local. Aucun risque pour les vrais clients. |

### Frontend (`.env.local` à la racine — ignoré par Git)
Doit pointer vers STAGING par défaut :
```
VITE_SUPABASE_URL=https://vytplwvribjkecaysnxr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_v3xN07x***
```

⚠️ **Vérifier le `.env.local` au début de chaque session** — si l'URL pointe vers `shxbcszukoegvvejcpsn` (prod), corriger avant de lancer `npm run dev`.

### Vercel (Settings → Environment Variables)
Actuellement, **tous les environnements** (Production, Preview, Development) pointent vers PROD.
**Recommandation à mettre en place** : configurer Preview + Development sur staging pour que les PR previews ne touchent pas la prod.

### Edge Functions (Supabase Dashboard → Settings → Edge Functions)
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- `AI_GATEWAY_API_KEY`, `AI_GATEWAY_URL`, `AI_MODEL`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- `ALLOWED_ORIGINS`

## 🌿 Workflow Git

- **Branche principale** : `main` (déployée auto sur Vercel prod)
- **Pour chaque feature/fix** : branche `feature/<nom>` ou `fix/<nom>`
- **Pull Request** : créer une PR sur GitHub → Vercel génère un preview automatique
- **Merge** : seulement après validation manuelle sur l'URL preview
- **Convention de commit** : Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)

⚠️ **Ne jamais push directement sur `main`** sans avoir testé en preview.

## 🗃️ Migrations Supabase

- Format de nom : `YYYYMMDDHHMMSS_<description>.sql`
- Toujours **idempotentes** (`DROP IF EXISTS` avant CREATE, etc.)
- Documentées en commentaires en début de fichier (contexte, objectif, rollback)
- **Tester sur staging avant prod** (Phase 2 à mettre en place)

## 🧪 Comptes / tenants utiles

⚠️ Les tenants existent dans les **deux** Supabase (prod et staging). Selon le `.env.local`, on adresse l'un ou l'autre. Toujours vérifier !

- **`demo.lyta.ch`** : tenant de test (existe en prod ET staging) — utilisé pour tester les nouvelles features
- **`advisy.lyta.ch`** : tenant production avec vrais clients en prod — exists aussi en staging mais avec données de test

## 📝 Conventions de code

- TypeScript strict
- React fonctionnel avec hooks (pas de class components)
- shadcn/ui pour les composants UI (Dialog, Select, Card, etc.)
- Tailwind pour le style (pas de CSS modules)
- i18n via `useTranslation()` pour les chaînes user-facing
- Toasts via `useToast()` pour les notifications utilisateur
- Logs structurés via `console.log('[contexte]', { ...payload })` pour le debug

---

## 📜 Historique des changements significatifs

### Session 27-29 avril 2026 — Habib + Claude (contexte : reprise en main par Habib, avec ou sans Loopus Tech)

**Features livrées en local** :
1. **Module d'import prospects CSV/Excel** (`src/components/crm/clients/ProspectImportDialog.tsx`, `src/pages/crm/clients/ClientsList.tsx`) — wizard 4 étapes, mapping auto, dédoublonnage par email, modèle CSV téléchargeable. Statut : testé OK sur demo.
2. **Fix bug notifs côté client** (`src/hooks/useClientNotifications.tsx`) — ajout du filtre `tenant_id` qui manquait. Statut : testé OK.
3. **Fix bug notifs côté CRM** (`src/hooks/useNotifications.tsx`) — whitelist élargie pour inclure `success`, `info`, `warning` que les triggers utilisent. Statut : testé OK (11 notifs remontent sur advisy).
4. **Migration SQL — Dispatch staff notifications** (`supabase/migrations/20260427120000_dispatch_staff_notifications.sql`) — fonction `dispatch_staff_notification()` + 7 nouveaux triggers. Statut : codé, en attente d'application en BD.
5. **Feature "Recommande tes proches"** (`supabase/functions/submit-referral/index.ts`, `src/pages/client/ClientReferrals.tsx`, `src/App.tsx`, `src/pages/client/ClientLayout.tsx`) — page client avec hero marketing + formulaire + Edge Function. Statut : codé, Edge Function en attente de déploiement.
6. **Fix bug `create-user-account`** (`supabase/functions/create-user-account/index.ts`, lignes ~951 et ~1077) — ajout des checks d'erreur sur les `upsert`/`insert` `user_tenant_assignments` qui échouaient silencieusement. Statut : codé, en attente de redéploiement.

**Dépendance ajoutée** : `xlsx` (^0.18.5) pour parser Excel.

**Audits réalisés** :
- Sécurité globale (auth, RLS, multi-tenancy) : 🟢 bon état général
- Flow auth/onboarding : 🟡 plusieurs upsert non vérifiés (création user notamment)
- Système notifications staff : 🐛 bug du destinataire unique global identifié

**Bugs restants à investiguer ultérieurement** :
- Comptage des sièges (`create-user-account:609-622`) à vérifier — risque de comptabiliser les clients gratuits comme sièges payants
- Tables `ai_conversations`, `ai_messages`, `ai_leads` ont des policies `USING (true)` (pas d'isolation tenant) — voulu ou bug ?
- Restrictions UI par rôle insuffisantes — un agent peut accéder aux Paramètres LYTA

---

## 🎯 Roadmap restante (priorités Habib)

1. ~~Import portefeuilles~~ ✅ (version simple faite)
2. **LYTA Tools** — reporté, à cadrer (modèle hybride user/tenant, niveau d'ambition)
3. **Clean & stabilisation** — en cours (auth/notifs déjà fixés)
4. **Refonte UI/UX** complète — prochaine grosse phase
5. ~~Recommande tes proches~~ ✅ (en attente de déploiement)
6. **Scan cross-device intelligent** — partiellement existant, à étendre

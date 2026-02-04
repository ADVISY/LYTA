# 🔐 Document de Sécurité LYTA

> **Version:** 2.1  
> **Dernière mise à jour:** 4 février 2026  
> **Conformité:** RGPD (UE), nLPD (Suisse)  
> **Audit de sécurité:** ✅ Complété

---

## 📋 Résumé Exécutif

LYTA est une plateforme SaaS multi-tenant conçue pour les cabinets d'assurance suisses. La sécurité et la protection des données sont au cœur de notre architecture.

**Points clés :**
- ✅ Hébergement en **Suisse/UE (Frankfurt)** via Supabase/AWS
- ✅ **Chiffrement AES-256** au repos + **TLS 1.3** en transit
- ✅ **Isolation stricte des données** par tenant
- ✅ **Authentification multi-facteurs** (SMS 2FA obligatoire)
- ✅ **Audit complet** de toutes les actions sensibles
- ✅ **Row Level Security (RLS)** sur toutes les tables

---

## 🏗️ Architecture de Sécurité

### 1. Authentification

| Fonctionnalité | Implémentation |
|----------------|----------------|
| **Mots de passe** | bcrypt (cost factor 10) |
| **Vérification compromission** | HaveIBeenPwned API (k-anonymity) |
| **2FA obligatoire** | SMS pour tous les rôles |
| **Session SMS** | Valide 120 minutes |
| **Reset password** | Token unique par email, expire 1h |
| **Verrouillage compte** | Après 5 tentatives échouées |

### 2. Modèle RBAC (Role-Based Access Control)

```
┌─────────────────────────────────────────────────────────────┐
│                        KING (Super Admin)                    │
│                    Accès total plateforme                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                    TENANT (Cabinet d'assurance)               │
├───────────────────────────────────────────────────────────────┤
│  Admin Cabinet │ Manager │ Agent │ Backoffice │ Compta │ Client │
│  (tout accès)  │ (équipe)│ (ses  │ (contrats) │ (commi-│ (son   │
│                │         │clients)│            │ ssions)│ espace)│
└───────────────────────────────────────────────────────────────┘
```

**Permissions granulaires par module :**
- `clients` : view, create, update, delete, export
- `contracts` : view, create, update, cancel, deposit
- `commissions` : view, create, validate, modify_rules
- `collaborators` : view, create, update, delete
- `settings` : view, update

### 3. Isolation Multi-Tenant

```sql
-- Chaque requête est filtrée par tenant_id via RLS
CREATE POLICY "Tenant isolation" ON public.clients
  FOR ALL USING (tenant_id = get_user_tenant_id());
```

**Protections :**
- ✅ Isolation via `tenant_id` sur toutes les tables métier
- ✅ Validation croisée domaine/session (`lyta_login_space`)
- ✅ Fonction `can_access_client()` vérifie tenant + rôle
- ✅ Déconnexion forcée si manipulation de session détectée

### 4. Accès Documents

| Type d'accès | Règle |
|--------------|-------|
| Documents client | Propriétaire ou agent assigné |
| Polices | Agent assigné + managers + admin tenant |
| Documents sensibles | Chiffrement supplémentaire AES-256 |
| Téléchargement | URL signée avec expiration (15 min) |

---

## 🛡️ Protection des Données

### Données Personnelles (PII)

| Donnée | Protection |
|--------|------------|
| Email, téléphone | Chiffrement en transit + accès RLS |
| IBAN, coordonnées bancaires | Accès restreint (compta + admin) |
| N° AVS | Chiffré au repos, masqué à l'affichage |
| Mots de passe | Hashés bcrypt, jamais stockés en clair |
| Documents scannés | Chiffrement AES-256, isolation par tenant |

### Vue Sécurisée `clients_safe`

```sql
-- Vue sans données sensibles financières
CREATE VIEW clients_safe AS
  SELECT id, first_name, last_name, email, phone, ...
  -- EXCLUS: iban, bank_name, commission rates, salary
  FROM clients WHERE can_access_client(id);
```

### Traitement IA

| Aspect | Mesure |
|--------|--------|
| Modèle utilisé | Google Gemini 2.5 Flash via Lovable AI |
| Conservation données | Aucune - traitement stateless |
| Entraînement | Données NON utilisées pour entraînement |
| Extraction | Snapshot temporaire pour audit uniquement |

---

## 📊 Logs & Traçabilité

### Table `audit_logs`

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  tenant_id UUID,
  action TEXT NOT NULL,        -- 'login', 'create', 'update', 'delete', etc.
  entity TEXT,                 -- 'client', 'policy', 'document', etc.
  entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Actions tracées :**
- ✅ Connexions/déconnexions
- ✅ Création/modification/suppression de données
- ✅ Accès aux documents sensibles
- ✅ Modifications de permissions
- ✅ Actions IA (scan, extraction)
- ✅ Échecs d'authentification

### Table `document_scan_audit`

Traçabilité spécifique pour le module IA SCAN :
- Snapshot complet de la réponse IA
- Modifications manuelles par l'utilisateur
- Validation/rejet des données extraites

---

## 🔒 Sécurité API & Edge Functions

### Rate Limiting

```sql
CREATE TABLE api_rate_limits (
  identifier TEXT,      -- IP ou user_id
  endpoint TEXT,
  window_hour TIMESTAMPTZ,
  request_count INTEGER
);
```

| Endpoint | Limite |
|----------|--------|
| Authentification | 5 req/min par IP |
| API générale | 100 req/min par user |
| IA Scan | 10 docs/min par tenant |
| SMS | Limité par quota tenant |

### Protection des Edge Functions

- ✅ Vérification JWT sur toutes les fonctions sensibles
- ✅ Validation des paramètres d'entrée (Zod)
- ✅ Service Role Key uniquement côté serveur
- ✅ CORS configuré pour domaines autorisés uniquement

---

## 🌐 Infrastructure

### Hébergement

| Composant | Localisation | Fournisseur |
|-----------|--------------|-------------|
| Base de données | Frankfurt (eu-central-1) | Supabase/AWS |
| Edge Functions | Frankfurt | Deno Deploy |
| Storage | Frankfurt | Supabase Storage (S3) |
| CDN | Global | Cloudflare |

### Chiffrement

| Niveau | Méthode |
|--------|---------|
| En transit | TLS 1.3 |
| Au repos (DB) | AES-256 (PostgreSQL) |
| Au repos (Storage) | AES-256 (S3 SSE) |
| Backups | Chiffrés automatiquement |

---

## 📜 Conformité RGPD / nLPD

### Droits des Personnes

| Droit | Implémentation |
|-------|----------------|
| Accès | Export complet via espace client |
| Rectification | Modification en ligne ou via conseiller |
| Effacement | Suppression compte + anonymisation données |
| Portabilité | Export JSON/CSV |
| Opposition | Désinscription marketing |

### Mesures Techniques

- ✅ **Minimisation** : Seules les données nécessaires sont collectées
- ✅ **Pseudonymisation** : IDs internes, pas de données en clair dans les logs
- ✅ **Durée de conservation** : Configurable par tenant (défaut 10 ans assurance)
- ✅ **Notification breach** : Procédure en place (72h CNIL, LPD suisse)

---

## 🚨 Gestion des Incidents

### Procédure

1. **Détection** : Monitoring continu + alertes automatiques
2. **Containment** : Isolation immédiate du tenant/compte affecté
3. **Investigation** : Analyse des audit logs
4. **Notification** : 
   - Interne : < 1h
   - Autorités (si applicable) : < 72h
   - Utilisateurs affectés : < 72h
5. **Remediation** : Patch + post-mortem

### Contacts

| Rôle | Contact |
|------|---------|
| DPO | dpo@lyta.ch |
| Sécurité | security@lyta.ch |
| Support | support@lyta.ch |

---

## ✅ Checklist Sécurité

### Authentification
- [x] Mots de passe hashés (bcrypt)
- [x] Vérification HaveIBeenPwned
- [x] 2FA SMS obligatoire
- [x] Session timeout (2h)
- [x] Reset password sécurisé

### Autorisation
- [x] RBAC multi-niveau
- [x] RLS sur toutes les tables
- [x] Isolation multi-tenant
- [x] Permissions granulaires

### Données
- [x] Chiffrement AES-256 au repos
- [x] TLS 1.3 en transit
- [x] Vue sécurisée sans PII financiers
- [x] Masquage IBAN/AVS

### API
- [x] Rate limiting
- [x] Validation des entrées
- [x] CORS restrictif
- [x] JWT verification

### Audit
- [x] Logs complets des actions
- [x] Traçabilité IA Scan
- [x] Rétention configurable
- [x] Alertes anomalies

---

## 📢 Discours Commercial

> **"Vos données sont protégées comme celles d'une banque suisse"**
> 
> LYTA utilise une infrastructure hébergée en Suisse/UE avec chiffrement de niveau bancaire (AES-256), authentification multi-facteurs, et une isolation stricte entre cabinets. Chaque action est tracée et auditable. Nous sommes conformes RGPD et nLPD.

---

*Document généré automatiquement. Pour toute question : security@lyta.ch*

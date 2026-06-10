<!--
  NOTE INTERNE — non publiée
  Date de cette version : 9 juin 2026
  Éditeur en cours : Optimislink Sàrl (Sàrl jeune, 03.06.2024).
  À republier dès qu'Habib séparera la structure (cf. plan à 30 clients
  payants : nouvelle entité dédiée LYTA distincte d'Optimislink).
-->

# Conditions Générales d'Utilisation (CGU) — LYTA

**Dernière mise à jour : 9 juin 2026**
**Version : 1.1**

---

## Préambule

Les présentes Conditions Générales d'Utilisation (« **CGU** ») régissent l'accès et l'utilisation de la plateforme logicielle SaaS **LYTA** (« le **Service** »), éditée par **Optimislink Sàrl** (« **LYTA** », « l'**Éditeur** » ou « **nous** »), Société à responsabilité limitée de droit suisse dont le siège social est situé Place de la Fontaine 9, 1868 Collombey, Suisse, inscrite au Registre du commerce du canton du Valais sous le numéro CH-621.4.012.418-8 et identifiée par le numéro IDE CHE-229.220.256.

LYTA est une solution CRM SaaS destinée aux **courtiers en assurance suisses** et à leurs collaborateurs, accessible via le domaine **lyta.ch** et ses sous-domaines tenants (`*.lyta.ch`).

Toute utilisation du Service implique l'**acceptation pleine et entière** des présentes CGU.
Si vous n'acceptez pas ces conditions, n'utilisez pas le Service.

---

## 1. Définitions

| Terme | Définition |
|-------|------------|
| **Service** | La plateforme SaaS LYTA, accessible en ligne via lyta.ch |
| **Utilisateur** | Toute personne physique accédant au Service (broker, collaborateur, partenaire, client final) |
| **Tenant** / **Cabinet** | Entité (cabinet de courtage) ayant souscrit un abonnement LYTA pour son propre espace isolé |
| **Administrateur Cabinet** | Personne désignée par le Tenant pour administrer son espace |
| **Client Final** | Particulier ou entreprise dont les données sont gérées par un Tenant dans LYTA |
| **Contenu Utilisateur** | Toute donnée, document, contrat, information saisie ou téléversée par un Utilisateur |
| **Abonnement** | Contrat à durée déterminée souscrit par un Tenant donnant accès au Service |

---

## 2. Objet du Service

LYTA fournit aux courtiers en assurance suisses une plateforme de gestion comprenant :

- Gestion de la base clients (prospects, clients, partenaires)
- Gestion des contrats d'assurance (LCA, LAMal, LPP, vie, IJ, dommages, etc.)
- Gestion des commissions et de la rémunération
- Espace client sécurisé pour partage de documents
- Fonctionnalités d'intelligence artificielle (scan de documents, assistant SmartFlow)
- Intégrations avec services tiers (Google, Microsoft, Bexio, WhatsApp Business, 3CX, Zoom)
- Signature électronique de mandats et contrats
- Rapports analytiques et conformité FINMA (lorsque applicable)
- Communications multi-canaux (email, SMS, WhatsApp)

La liste des fonctionnalités peut évoluer ; les fonctionnalités effectivement accessibles dépendent du **plan d'abonnement** souscrit par le Tenant.

---

## 3. Création de compte et accès

### 3.1 Inscription

L'accès au Service nécessite la création d'un compte. L'Utilisateur s'engage à fournir des informations **exactes, complètes et à jour**.

Pour les Tenants (cabinets), l'inscription se fait via l'Administrateur Cabinet, après vérification de l'éligibilité (statut professionnel de courtier en assurance suisse).

### 3.2 Identifiants et confidentialité

Chaque Utilisateur est responsable de la confidentialité de ses identifiants. Toute action effectuée avec son compte est présumée avoir été réalisée par lui. En cas de compromission, l'Utilisateur doit en informer LYTA immédiatement à **security@lyta.ch**.

LYTA recommande fortement l'activation de l'**authentification à deux facteurs (2FA)** pour les comptes administrateurs.

### 3.3 Vérification du tenant

LYTA se réserve le droit de vérifier l'éligibilité d'un nouveau Tenant avant activation complète (vérification IDE, registre du commerce, autorisation FINMA si applicable).

---

## 4. Abonnements et tarifs

### 4.1 Plans d'abonnement

Les plans, leurs fonctionnalités et leurs tarifs sont décrits sur la page tarifs du site lyta.ch ou contractualisés dans une offre spécifique. Les tarifs sont indiqués **en CHF, hors TVA suisse**.

### 4.2 Facturation et paiement

- La facturation est mensuelle ou annuelle selon le plan choisi
- Les paiements sont gérés via **Stripe** (PCI-DSS Level 1) ou par facturation directe (QR-bill suisse)
- Les factures sont émises au début de chaque période et payables à 30 jours
- En cas de retard, LYTA peut suspendre l'accès après mise en demeure restée sans effet pendant 15 jours
- Tout dépassement d'usage (« overage ») est facturé selon le tarif en vigueur, après notification

### 4.3 Modification des tarifs

LYTA peut modifier ses tarifs avec un préavis de **60 jours** pour les abonnements annuels et de **30 jours** pour les abonnements mensuels. Le Tenant peut résilier sans frais en cas de désaccord.

### 4.4 Période d'essai

Lorsque proposée, la période d'essai est gratuite et sans engagement. Aucun moyen de paiement n'est requis pour la démarrer. Au terme de la période d'essai, l'Utilisateur peut souscrire un abonnement payant ; à défaut, l'accès est suspendu.

---

## 5. Engagements de l'Utilisateur

L'Utilisateur s'engage à :

1. Utiliser le Service uniquement à des **fins professionnelles licites**
2. Respecter les lois suisses (et internationales applicables), notamment en matière de :
   - Protection des données (nLPD, RGPD)
   - Activité de courtage en assurance (LSFin, LSA, FINMA)
   - Lutte contre le blanchiment (LBA)
   - Propriété intellectuelle
3. **Obtenir le consentement préalable** des clients finaux pour le traitement de leurs données
4. Ne pas saisir de données fausses, diffamatoires, illégales ou contraires aux bonnes mœurs
5. Ne pas tenter de **contourner les mécanismes de sécurité** (RLS, authentification, isolation tenant)
6. Ne pas pratiquer de **rétro-ingénierie**, ne pas copier ou scraper le Service
7. Ne pas utiliser d'outils automatisés (bots, scrapers) pour interagir avec le Service sans autorisation écrite
8. Ne pas surcharger l'infrastructure (usage abusif, attaques DoS)
9. Maintenir ses informations de compte à jour
10. Signaler immédiatement toute vulnérabilité de sécurité détectée à **security@lyta.ch** (politique de divulgation responsable)

---

## 6. Engagements de LYTA

LYTA s'engage à :

1. Fournir le Service avec **diligence professionnelle**
2. Assurer une **disponibilité moyenne mensuelle de 99,5 %** (hors maintenance planifiée et cas de force majeure)
3. Prévenir des **interruptions de service prévues** au moins 48h à l'avance par email
4. Sécuriser les données via chiffrement TLS 1.3 (transit) et AES-256 (repos)
5. Héberger les données principales **en Suisse** (Supabase Zurich — AWS eu-central-2)
6. Effectuer des **sauvegardes quotidiennes** chiffrées
7. Notifier toute violation de sécurité dans les **72 heures** conformément à l'art. 24 nLPD
8. Mettre à disposition une fonction d'**export complet** des données (JSON + ZIP)
9. Respecter les durées de conservation indiquées dans la [Politique de confidentialité](./POLITIQUE_CONFIDENTIALITE.md)

LYTA ne garantit **pas** :
- L'absence totale d'interruption ou d'erreur
- L'adéquation à des besoins spécifiques non contractuellement définis
- La compatibilité parfaite avec tous les navigateurs / OS / configurations matérielles

---

## 7. Propriété intellectuelle

### 7.1 Service LYTA
L'ensemble des composants du Service (code source, design, interface, marque, base de données structurelle, contenus éditoriaux) reste la **propriété exclusive de l'Éditeur**. Aucune cession n'est accordée à l'Utilisateur.

L'Utilisateur bénéficie d'un **droit d'usage personnel, non exclusif, non cessible** pendant la durée de son abonnement.

### 7.2 Contenu Utilisateur
Les données saisies par l'Utilisateur (clients, contrats, documents, etc.) restent sa **propriété exclusive** (ou celle de son cabinet). LYTA agit en tant que **simple sous-traitant technique** au sens de l'art. 9 nLPD.

L'Utilisateur accorde à LYTA une **licence limitée** pour héberger, dupliquer (backup), traiter et afficher ces données dans le seul but de fournir le Service.

### 7.3 Suggestions et retours
Toute suggestion d'amélioration, retour d'expérience ou idée de fonctionnalité communiquée à LYTA peut être librement utilisée par l'Éditeur sans contrepartie financière.

---

## 8. Protection des données personnelles

Le traitement des données personnelles fait l'objet d'une **Politique de confidentialité** dédiée que vous pouvez consulter ici : [POLITIQUE_CONFIDENTIALITE.md](./POLITIQUE_CONFIDENTIALITE.md).

Cette Politique fait partie intégrante des CGU. En acceptant les CGU, vous acceptez également la Politique de confidentialité.

**Sous-traitance** : LYTA agit comme **sous-traitant** du Tenant pour les données de ses clients finaux. Un Accord de Sous-traitance (DPA) est disponible sur demande à **legal@lyta.ch** pour les Tenants soumis au RGPD ou nLPD.

---

## 9. Intégrations tierces (LYTA Tools)

L'Utilisateur peut **librement choisir** de connecter LYTA à des services tiers (Google, Microsoft, Bexio, WhatsApp Business, 3CX, Zoom).

- Ces connexions sont **explicitement activées** par l'Utilisateur via OAuth ou clé API
- Les données échangées sont soumises aux conditions du service tiers
- LYTA décline toute responsabilité quant au fonctionnement, à la sécurité et à la disponibilité des services tiers
- L'Utilisateur peut **révoquer** ces connexions à tout moment depuis l'interface LYTA Tools

---

## 10. Intelligence artificielle (SmartFlow, Scan IA, Assistant)

LYTA intègre des fonctionnalités d'IA fournies par **OpenAI L.L.C.** (GPT-5 et modèles compatibles).

### 10.1 Usage et limites
- Les résultats produits par l'IA sont **indicatifs** et nécessitent toujours une validation humaine par le broker
- LYTA ne garantit pas l'exactitude à 100 % des extractions IA (scan de contrats, analyse de documents)
- Le broker reste **seul responsable** des décisions prises sur la base de ces suggestions

### 10.2 Confidentialité
- Les données envoyées à OpenAI sont chiffrées en transit (TLS)
- OpenAI s'engage par contrat à **ne pas utiliser ces données pour entraîner ses modèles** (opt-out par défaut sur l'API)
- Les données sont conservées au maximum **30 jours** chez OpenAI pour la détection d'abus

### 10.3 Désactivation
L'Administrateur Cabinet peut désactiver les fonctionnalités IA dans les paramètres du tenant. Aucune donnée n'est alors transmise à OpenAI.

---

## 11. Limitations de responsabilité

### 11.1 Limite générale
La responsabilité totale de LYTA envers un Utilisateur ou Tenant, toutes causes confondues, est **plafonnée au montant total versé par le Tenant à LYTA au cours des 12 derniers mois** précédant l'événement générateur de responsabilité.

### 11.2 Exclusions
LYTA n'est **pas responsable** :
- Des **dommages indirects** (perte de chiffre d'affaires, de clientèle, d'image, perte de chance)
- Des dommages causés par un **mauvais usage du Service** par l'Utilisateur
- Des **erreurs ou omissions** dans les données saisies par l'Utilisateur
- Des conséquences de la **non-conformité** réglementaire propre à l'activité du Tenant (FINMA, LSFin, etc.)
- Des **interruptions** dues à des cas de force majeure (panne réseau majeure, attaque, cataclysme)
- Du fonctionnement des **services tiers connectés** par l'Utilisateur

### 11.3 Garanties applicables
Les présentes limitations s'appliquent dans toute la mesure permise par le droit suisse impératif. Elles ne s'appliquent pas en cas de **faute intentionnelle ou de négligence grave** de LYTA.

---

## 12. Suspension et résiliation

### 12.1 Résiliation par l'Utilisateur / Tenant
Le Tenant peut résilier son abonnement :
- **Mensuel** : à tout moment, avec effet à la fin du mois en cours
- **Annuel** : avec préavis de 30 jours avant échéance, à défaut renouvellement tacite

La résiliation s'effectue depuis l'interface (Paramètres → Abonnement) ou par email à billing@lyta.ch.

### 12.2 Résiliation par LYTA
LYTA peut résilier l'abonnement, après mise en demeure restée sans effet pendant 15 jours, en cas de :
- Non-paiement
- Violation grave des CGU (usage frauduleux, atteinte à la sécurité, illégalité)
- Inactivité prolongée du compte (>12 mois)

### 12.3 Conséquences de la résiliation
À la résiliation :
- L'accès au Service est suspendu à la date d'effet
- Les données du Tenant restent **récupérables pendant 30 jours** via demande à privacy@lyta.ch
- Au-delà de 30 jours, les données sont **supprimées définitivement** (sauf obligations légales de conservation, ex : factures = 10 ans)
- Aucun remboursement n'est dû pour la période en cours, sauf cas de manquement grave imputable à LYTA

### 12.4 Suspension immédiate
En cas de menace imminente sur la sécurité ou en cas d'usage manifestement illégal, LYTA peut suspendre l'accès **sans préavis**, avec notification immédiate par email.

---

## 13. Modifications des CGU

Les CGU peuvent évoluer. Toute modification substantielle est notifiée :
- Par email à tous les Administrateurs Cabinet **30 jours avant** l'entrée en vigueur
- Via une bannière dans l'interface LYTA

L'usage continu du Service après cette période vaut acceptation. À défaut, le Tenant peut résilier sans frais.

---

## 14. Confidentialité réciproque

LYTA et le Tenant s'engagent à respecter la confidentialité des informations échangées (commerciale, technique, financière) dans le cadre de l'exécution du contrat, pendant toute sa durée et pendant **3 ans** après son terme.

---

## 15. Force majeure

Aucune partie ne pourra être tenue responsable d'un manquement résultant d'un **cas de force majeure** au sens de la jurisprudence suisse : catastrophe naturelle, guerre, attaque cybernétique majeure, défaillance grave d'un fournisseur critique, décision gouvernementale.

---

## 16. Indépendance des clauses

Si une clause des présentes CGU est jugée nulle ou inapplicable par un tribunal, les autres clauses conservent leur pleine validité.

---

## 17. Cession

LYTA peut céder tout ou partie de ses droits et obligations à un tiers (ex : opération de fusion-acquisition) en informant les Tenants par email au moins 30 jours à l'avance. En cas de désaccord, le Tenant peut résilier sans frais dans ce délai.

L'Utilisateur ne peut céder ses droits et obligations sans accord écrit préalable de LYTA.

---

## 18. Communications

Toute communication officielle entre les parties se fait par email :
- **De LYTA vers le Tenant** : à l'adresse email de l'Administrateur Cabinet enregistrée
- **Du Tenant vers LYTA** : à **contact@lyta.ch** (général), **billing@lyta.ch** (facturation), **legal@lyta.ch** (juridique), **privacy@lyta.ch** (données personnelles), **security@lyta.ch** (sécurité)

---

## 19. Droit applicable et juridiction

Les présentes CGU sont régies par le **droit suisse**, à l'exclusion des règles de conflits de lois et de la Convention de Vienne sur la vente internationale de marchandises.

Tout litige relatif à l'interprétation ou à l'exécution des présentes CGU sera, à défaut de résolution amiable préalable, soumis à la **compétence exclusive des tribunaux du canton du Valais, Suisse**, sous réserve des dispositions impératives applicables au consommateur.

Une **procédure de médiation préalable** peut être proposée par les parties avant tout recours judiciaire.

---

## 20. Acceptation

En cochant la case « J'accepte les Conditions Générales d'Utilisation » lors de l'inscription, ou en utilisant le Service, l'Utilisateur reconnaît :

1. Avoir lu intégralement les présentes CGU
2. Avoir compris leur portée
3. Les accepter sans réserve
4. Disposer du pouvoir juridique de les accepter pour son compte ou pour celui de l'entité qu'il représente (Tenant)

---

## Annexes

- [Politique de confidentialité](./POLITIQUE_CONFIDENTIALITE.md)
- [Mentions légales](./MENTIONS_LEGALES.md)
- [Accord de sous-traitance (DPA)](./DPA.md) — *sur demande à legal@lyta.ch*
- [Politique de sécurité](./SECURITY.md) — *à venir*

---

**Contact pour toute question** :
- Email : **legal@lyta.ch**
- Adresse postale : Optimislink Sàrl, Place de la Fontaine 9, 1868 Collombey, Suisse
- Téléphone : +41 78 212 23 60

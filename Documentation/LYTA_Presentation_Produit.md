# LYTA — Présentation produit & catalogue des fonctionnalités

> **Version** 1.0 — 8 juin 2026
> **Audience** Toute personne qui découvre LYTA : nouveau collaborateur, prospect cabinet, partenaire, investisseur, équipe commerciale
> **Lecture** ~25-30 min en parcours complet, ou directement le module qui vous intéresse via la table des matières

---

## ⚡ LYTA en 60 secondes

LYTA est un **logiciel SaaS suisse** conçu **par et pour les cabinets de courtage en assurance**. Il regroupe dans une seule plateforme web tout ce qu'un courtier indépendant ou un cabinet utilise au quotidien :

- Un **CRM** pour gérer ses clients (personnes physiques + entreprises)
- Un **portefeuille de contrats** d'assurance par client
- Un **module mandats de gestion** avec signature électronique à distance
- Un **moteur de scan IA** (Smartflow) qui lit les PDF reçus et pré-remplit tout (polices, décomptes, pièces d'identité…)
- Un **calcul automatisé des commissions** reçues des compagnies + rétrocessions aux agents
- Un **module comptable** avec factures QR suisses
- Un **espace client** où le client final voit son dossier, ses contrats, ses sinistres
- Un **historique unifié des emails** envoyés (clients + compagnies + collaborateurs)
- Des **automatisations** : anniversaires, échéances, relances prospects, dispatch mandats aux compagnies, etc.

Le tout en **multi-tenant** : chaque cabinet a son propre sous-domaine (ex: `advisy.lyta.ch`), ses propres couleurs, son propre logo, ses propres données strictement isolées des autres cabinets.

**URL principale** : `app.lyta.ch` — **Activation** : 5 minutes en self-service après paiement Stripe.

---

## 🎯 À qui c'est destiné

| Profil | Usage |
|---|---|
| **Courtier indépendant** suisse | Gérer son portefeuille seul, signature mandats à distance, recherche LPP automatisée |
| **Cabinet de courtage** (2-50 collaborateurs) | Coordonner agents + managers + back-office, calcul commissions automatique, vue cabinet |
| **Cabinet multi-agences** | Gestion par branche, attribution clients par agence, commissions différenciées |
| **Apporteur d'affaires** | Programme affiliés intégré (suivi commissions sur leads convertis) |
| **Compagnie partenaire** | Réception automatique des mandats signés par email |
| **Client final** | Espace personnel sécurisé pour consulter ses contrats, signer ses docs, déclarer un sinistre |

---

## 🧰 Avec quoi LYTA fonctionne — Stack & intégrations

### Plateforme

- **Web** : `app.lyta.ch` et les sous-domaines tenants (`advisy.lyta.ch`, etc.)
- **Mobile** : application web responsive optimisée smartphone, et **app native iOS/Android** packagée via Capacitor (en cours de distribution)
- **Hébergement** : Vercel (frontend) + Supabase (base de données + edge functions) en Europe

### Intégrations externes

| Service | Usage |
|---|---|
| **Stripe** | Facturation des abonnements + paiement seats supplémentaires |
| **Resend** | Envoi des emails (transactionnels + campagnes + mandats vers compagnies) |
| **Twilio Verify** | Codes SMS pour la double authentification (2FA) |
| **OpenAI / Anthropic** | Moteur IA Smartflow (lecture PDF, extraction de champs) |
| **OpenPLZ + Zippopotam + swisstopo** | Autocomplete codes postaux + adresses suisses (3 sources avec fallback) |
| **Cloudflare** | DNS automatique des sous-domaines tenants |
| **HaveIBeenPwned** | Vérification que les mots de passe n'apparaissent pas dans des fuites connues |

### Conformité

- Conforme **nLPD suisse** (Loi fédérale sur la protection des données, 1er sept. 2023)
- Conforme **RGPD européen**
- Respect du **secret professionnel** des courtiers en assurance (art. 47 LB / OS-FINMA)
- Données hébergées chez Supabase (région UE)

---

## 📚 Table des matières des modules

1. [Inscription & onboarding](#1-inscription--onboarding)
2. [Adresses / Clients](#2-adresses--clients)
3. [Contrats / Polices d'assurance](#3-contrats--polices-dassurance)
4. [Compagnies & catalogue produits](#4-compagnies--catalogue-produits)
5. [Mandats de gestion & signatures à distance](#5-mandats-de-gestion--signatures-à-distance)
6. [Smartflow — Scan IA des documents](#6-smartflow--scan-ia-des-documents)
7. [Commissions & rétrocessions](#7-commissions--rétrocessions)
8. [Comptabilité & QR-factures](#8-comptabilité--qr-factures)
9. [Communications & emailing](#9-communications--emailing)
10. [Suivis & tâches](#10-suivis--tâches)
11. [Rapports & dashboards](#11-rapports--dashboards)
12. [LPP — 2ᵉ pilier](#12-lpp--2ᵉ-pilier)
13. [Espace client](#13-espace-client)
14. [Collaborateurs, rôles & permissions](#14-collaborateurs-rôles--permissions)
15. [Abonnement & facturation tenant](#15-abonnement--facturation-tenant)
16. [LytaTools — Apps tierces connectées](#16-lytatools--apps-tierces-connectées)
17. [Programme affiliés](#17-programme-affiliés)
18. [KING — Administration plateforme](#18-king--administration-plateforme)
19. [Automatisations & crons](#19-automatisations--crons)
20. [Sécurité & conformité](#20-sécurité--conformité)
21. [Roadmap — À venir](#21-roadmap--à-venir)

---

## 1. Inscription & onboarding

**En quoi ça consiste** : tout le parcours qui transforme un visiteur du site marketing en cabinet actif sur LYTA, en moins de 5 minutes.

### 1.1 Self-signup en 5 minutes

- **Page marketing** `lyta.ch/access` : choix du plan, paiement Stripe sécurisé
- **Essai gratuit 7 jours** sur tous les plans
- **Cartes bancaires** + Apple Pay + Google Pay (via Stripe Payment Links)
- **Redirection automatique** vers `app.lyta.ch/finalize` après paiement

### 1.2 Formulaire de finalisation en 4 sections

1. **Entreprise** : nom du cabinet, slug (sous-domaine `slug.lyta.ch`) avec **vérification en temps réel** de disponibilité, upload du logo (PNG/JPEG/WebP/SVG, max 2 MB)
2. **Couleurs** : choix primary + secondary (color pickers) → tout le CRM est rebrandé aux couleurs du cabinet
3. **Contact** : prénom/nom/email de l'admin + email back-office (pour reply-to)
4. **Options** : nombre de collaborateurs CRM supplémentaires (avec rappel **"clients finaux illimités gratuits"**)

### 1.3 Provisioning automatique

Tout se fait en parallèle en arrière-plan, sans intervention manuelle :

- Création du **tenant** dans la base
- Création du **compte admin** avec magic link envoyé
- **DNS Cloudflare** créé pour le sous-domaine `slug.lyta.ch`
- **Domaine custom** ajouté au projet Vercel
- **Audience Resend** créée pour les emails du cabinet
- **Notifications King** en cascade pour Habib : "Nouveau paiement" → "Tenant créé" → "DNS configuré"

### 1.4 Filet de sécurité

- **Email "Active ton cabinet"** envoyé même si le redirect Stripe rate → l'utilisateur a toujours un lien actionnable
- **Cron horaire de retry** : si une étape rate (DNS, Vercel, Resend), retry automatique pendant 24h
- **Cron horaire d'activation auto** : tenant en trial qui expire passe automatiquement à `active` même si le webhook Stripe a raté
- **Bouton "Re-run onboarding"** pour Habib dans la fiche tenant côté KING

### 1.5 Connexion 2FA SMS dès l'inscription

- **2FA SMS activée par défaut** au self-signup (les cabinets manipulent des données sensibles, l'option n'est pas négociable au début)
- Code à 6 chiffres envoyé via Twilio Verify
- Téléphone validé en amont via Twilio

### 1.6 Email de bienvenue tenant

- Envoi automatique après création
- Branding tenant complet (logo, couleurs)
- Magic link pour définir le mot de passe
- Liens directs vers le CRM + l'aide en ligne

---

## 2. Adresses / Clients

**En quoi ça consiste** : le **carnet d'adresses** central du cabinet. Tout part d'ici : un contrat est lié à un client, un mandat est signé par un client, une commission est calculée sur un client, etc.

### 2.1 Création & édition d'un client

- **Type** : personne physique (prospect / actif / archivé) ou entreprise (prochainement)
- **Identité** : prénom, nom, civilité, date de naissance, nationalité, **n° AVS** (format `756.XXXX.XXXX.XX` validé)
- **Coordonnées multiples** : email, téléphone(s) fixe/mobile, plusieurs adresses (pro + privée)
- **Filtre Pro / Privé** sur les adresses (depuis avril 2026)
- **Photo de profil** (facultatif)
- **Notes libres** par client

### 2.2 Autocomplete intelligent

- **NPA / Code postal suisse** : taper "1003" → propositions "Lausanne, Renens, …" avec canton automatique
- **3 sources avec fallback** : OpenPLZ → Zippopotam → swisstopo
- **Adresse de rue** : autocomplete via swisstopo (toutes les rues + numéros suisses)
- **IBAN suisse** : validation en direct + détection IBAN QR vs IBAN classique

### 2.3 Membres de famille

- Rattacher au foyer : conjoint, enfants, autres
- Possibilité de **lier un membre comme client existant** (une mère peut avoir son propre dossier)
- Permet de gérer les **assurances familiales** (LAMal famille, etc.)

### 2.4 Attribution & responsabilité

- **Agent assigné** par client (`assigned_agent_id`)
- **Réassignation en masse** : sélectionner N clients → assigner à un autre agent en 1 clic
- **Multi-assignation** (depuis mai 2026) : un client peut être suivi par plusieurs agents
- **Scopes** :
  - Admin : voit tout le cabinet
  - Manager : voit son équipe
  - Agent : voit uniquement ses clients

### 2.5 Recherche & filtres

- **Recherche fulltext** : par nom, prénom, email, téléphone, NPA
- **Recherche côté serveur** (pas de slowdown sur 1000+ clients)
- **Filtres** : statut (prospect/actif/archivé), agent assigné, branche, date de création
- **Tri** par colonne

### 2.6 Documents attachés

- Upload depuis l'app (PDF, images, jusqu'à 25 MB par fichier, formats HEIC/HEIF acceptés)
- **Catégorisation** : pièce d'identité, police, mandat, attestation, autre
- **Rappels d'échéance** automatiques (ex: carte d'identité qui expire dans 60 jours)
- **Téléchargement** ou prévisualisation directe

### 2.7 Import & export

- **Import prospects CSV/XLSX** : assistant d'upload + mapping colonnes + déduplication
- **Export tableur** de la liste filtrée

### 2.8 Quick contact

- Bouton **📞 Appeler / ✉️ Email / 📱 SMS** disponible partout (liste + fiche)
- Ouvre direct l'app email/téléphone de l'OS

---

## 3. Contrats / Polices d'assurance

**En quoi ça consiste** : le **portefeuille** d'un client — toutes les polices souscrites, leurs primes, échéances, sinistres associés. C'est ce qui alimente les commissions et les dashboards.

### 3.1 Création d'une police

- **Compagnie** : depuis le catalogue (AXA, Helsana, Swiss Life, …) — 22 compagnies préchargées
- **Produit** : depuis le catalogue de la compagnie (LAMal Basis, LCA dentaire, 3a, LPP, RC, …)
- **Multi-produits dans une même police** : une LAMal + une LCA + une LCA dentaire dans le même contrat
- **Numéro de police**, dates de début / fin
- **Prime** mensuelle ou annuelle, devise, franchise (LAMal)
- **Notes libres**

### 3.2 Branches & taxonomie

- **Branches normalisées** : Maladie, Vie, Choses, Responsabilité, Véhicules, Indemnités journalières, Prévoyance (LPP)
- **Branche combinée LAMal + LCA** : reconnue comme un domaine unique pour les calculs et les agences
- **Override par police** : une police peut être affectée à une branche différente de celle du produit standard (cas multi-agence)

### 3.3 Suivi du cycle de vie

- **Statuts** : brouillon, active, expirée, annulée
- **Dates clés** : début, fin, prochaine échéance
- **Rappels automatiques** d'échéance (cron) — emails envoyés au client + au broker N jours avant

### 3.4 Sinistres rattachés

- Déclaration depuis le CRM ou depuis l'espace client final
- **Documents joints** au sinistre
- Statut + suivi + notes

### 3.5 Dépôt de contrat public (`/deposer-contrat`)

Page **publique** (sans connexion) que le cabinet partage à des prospects ou des partenaires apporteurs. 5 onglets :

| Onglet | Branche |
|---|---|
| **SANA** | Maladie de base + complémentaire |
| **VITA** | Vie / 3ᵉ pilier (3a + 3b) |
| **MEDIO** | Indemnités journalières maladie |
| **BUSINESS** | Risques pro / entreprise |
| **LPP** 🐷 | 2ᵉ pilier — recherche, libre passage, rapatriement |

### 3.6 Anti-doublons intelligents

- Détection automatique : si on essaie de créer une police "AXA LAMal" pour un client qui en a déjà une → alerte
- **Exception 3ᵉ pilier** : split autorisé (un client peut avoir plusieurs 3a et plusieurs 3b)

---

## 4. Compagnies & catalogue produits

**En quoi ça consiste** : le **catalogue centralisé** des compagnies d'assurance suisses et de leurs produits. Maintenu par l'administrateur de la plateforme (KING) et enrichissable par chaque cabinet.

### 4.1 Catalogue partagé (KING)

- **22 compagnies** préchargées (AXA, Helsana, Swiss Life, Generali, CSS, Visana, Sanitas, …)
- **155 produits Advisy** seedés (utilisables par les autres cabinets)
- **Logos** servis localement (chargement rapide, accessible mobile)
- **Logos tolérants aux suffixes** : "AXA", "AXA SA", "AXA Assurances", "AXA Group" → même logo

### 4.2 Catalogue tenant (par cabinet)

- Possibilité d'**ajouter des produits propres** non présents dans le catalogue global
- **Override des taux de commission** par produit (chaque cabinet a ses propres conditions négociées)
- **Statut actif / inactif** par produit (cacher les legacy)

### 4.3 Contacts par compagnie

- **Email général**, **email mandat** (utilisé pour le dispatch automatique), **email sinistre**
- **Téléphone**, adresse postale
- Maintenus par cabinet (chaque cabinet a ses propres contacts négociés)

### 4.4 Branches par produit

- Permet de classifier le produit pour les calculs de production par branche
- Vue **"Produits par branche"** dans le dashboard KING

### 4.5 Suggestions de produits

- Quand Smartflow détecte un produit qui n'est pas dans le catalogue → envoi automatique en **file d'attente KING** pour validation par l'admin plateforme

---

## 5. Mandats de gestion & signatures à distance

**En quoi ça consiste** : le **module phare** de LYTA. Permet à un courtier de faire signer électroniquement un mandat de gestion (ou n'importe quel document PDF) par un client, à distance, en quelques minutes. Avec dispatch automatique du mandat signé aux compagnies.

### 5.1 Mandat de gestion généré

- **Template officiel** pré-rempli avec :
  - Nom du cabinet, branding (logo, couleurs)
  - Identité du mandant (client) : nom, adresse, date de naissance
  - Sélection des compagnies que le mandat couvre
  - Texte juridique conforme au droit suisse
- **Aperçu en temps réel** avant envoi
- **Personnalisation** du texte d'introduction selon le cabinet

### 5.2 Document libre (procuration, résiliation, etc.)

- Possibilité d'**uploader n'importe quel PDF** (jusqu'à 8 MB) à faire signer
- Le client signera comme pour un mandat
- Usage typique : procuration assurance maladie, lettre de résiliation, attestation, etc.

### 5.3 Envoi du lien de signature

- **Email au client** avec lien sécurisé `slug.lyta.ch/signer/<token>`
- Email **branded** au nom du cabinet
- Lien **valable 24h** (renouvelable)
- Sujet et corps du message personnalisables

### 5.4 Côté client : signature en 1 minute

- Le client clique le lien, **aucune installation** ni création de compte
- **Affichage du PDF** dans son navigateur (multi-page, scroll fluide)
- **Drag pour choisir la zone de signature** sur le document
- **Pad de signature** au doigt (mobile) ou souris (desktop)
- **Aperçu de la signature** avant envoi final
- **Bouton "Demander un nouveau lien"** si le lien est expiré

### 5.5 PDF final professionnel

- Le **PDF original** est conservé intact
- La **signature** est incrustée à la zone choisie par le client
- Une **page d'attestation** est ajoutée avec :
  - Date et heure de signature (fuseau Europe/Zurich)
  - Adresse IP du signataire
  - Token unique de la signature (preuve)
  - Logo + identité du cabinet
- **Fichier PDF unique** stocké et accessible à tout moment

### 5.6 Suivi des demandes

- **Tableau de bord** : signatures en cours / signées / refusées / expirées
- **Statut par demande** : envoyée, vue, signée, refusée
- **Historique complet** : qui a envoyé, quand, à qui, statut actuel

### 5.7 Dispatch automatique aux compagnies (après signature)

Une fois le mandat signé par le client, le broker clique sur **un seul bouton** pour envoyer le mandat à toutes les compagnies concernées :

- **Détection automatique** des compagnies depuis les contrats actuels du client
- **Email branded** envoyé à chaque compagnie avec :
  - PDF du mandat signé en pièce jointe
  - Lettre de reprise pré-rédigée
- **Statut par compagnie** : envoyé / pas d'email configuré / erreur Resend
- **Pas de spam** : 1 seul envoi par compagnie, log conservé

### 5.8 Suivi du dispatch dans l'historique emails

- Onglet **CRM → Publicité → Historique** filtré par "Envoi compagnies"
- Voir précisément quel email est parti à quelle compagnie, quand, et le statut Resend
- En cas de bounce ou d'erreur : visible immédiatement

### 5.9 Mandats signés en personne

- Possibilité d'**uploader un mandat déjà signé** (cabinet en présentiel)
- Le mandat rentre dans le même flow de dispatch aux compagnies
- Pas besoin de relancer une signature électronique

### 5.10 Refus & relance

- Si le client refuse → statut "refusé" + notification au broker
- Si le lien expire → bouton "Demander un nouveau lien" disponible
- Possibilité de **refaire un mandat** sans supprimer l'ancien (historique conservé)

---

## 6. Smartflow — Scan IA des documents

**En quoi ça consiste** : un **moteur d'intelligence artificielle** qui lit les PDF que le courtier reçoit, les classifie, et pré-remplit automatiquement les bons écrans du CRM. Le courtier valide en 30 secondes au lieu de saisir 10 minutes.

### 6.1 Upload simple

- **Drag & drop** un ou plusieurs PDF (ou photos) sur le module Smartflow
- Formats : PDF, images (PNG, JPEG, HEIC, HEIF, WebP)
- Taille max : 25 MB par fichier
- Upload en parallèle de plusieurs fichiers (mode batch)

### 6.2 14 types de documents reconnus

L'IA détecte automatiquement la nature de chaque document :

| Type | Détecté pour |
|---|---|
| Pièce d'identité | Carte ID, passeport, permis |
| Police active | Document de police en cours |
| Ancienne police | Police à résilier/remplacer |
| Mandat de gestion | Mandat existant |
| Fiche de salaire | Pour les analyses LPP |
| Attestation d'avoirs | LPP / 3ᵉ pilier |
| Décompte de commission | Pour Smartflow Décomptes |
| Facture QR | Suisse (LPP, primes) |
| Procuration | Pour LPP / résiliations |
| Et 5 autres | À découvrir dans le module |

### 6.3 Pré-remplissage intelligent

Pour chaque type, l'IA extrait les champs pertinents :

- **Police** : compagnie, n° de police, dates de début/fin, prime, franchise, type de produit
- **Pièce d'identité** : prénom, nom, date de naissance, nationalité, n° de pièce
- **Décompte** : période, lignes de commission, montants, références clients

### 6.4 Matching catalogue

- L'IA propose le **produit le plus probable** depuis le catalogue (matching fuzzy + trigram)
- Si le produit n'existe pas → suggestion automatique → file d'attente KING

### 6.5 Family flow

- Détection automatique des **personnes assurées** dans un même document
- Création de **N clients + N contrats** routés par personne
- Exemple : un contrat famille SWICA avec 4 assurés → 4 fiches clients + 4 contrats créés
- **Anti-doublons** : LAMal + LCA pour la même personne et la même compagnie = 1 seul contrat canonique

### 6.6 Lazy creation

- **Rien n'est écrit en base** tant que le courtier n'a pas validé
- Affichage en preview de tout ce qui va être créé
- Modification possible avant validation
- Annulation = aucune trace

### 6.7 Smartflow Décomptes (cas spécial)

Pour les **décomptes de commission** reçus des compagnies (PDF mensuels) :

- Upload du décompte
- L'IA extrait toutes les lignes (50-200 par décompte)
- Pour chaque ligne : tentative de **match automatique** avec un client + une police existants
- Si match → ligne pré-validée
- Si pas de match → le courtier l'associe manuellement
- **Bannière "X commissions à valider"** dans CRM → Commissions
- Validation ligne par ligne dans un formulaire pré-rempli

### 6.8 Quotas

- **Quota mensuel** par cabinet, configurable par plan
- Plan Start : 0 scans / Plan Pro : 0 scans / Plans Prime+Founder : 400 scans
- **Override possible** par tenant (Advisy a 500/mois)
- Au-delà : **overage facturé automatiquement** sur la facture Stripe du mois

### 6.9 Anti-erreur

- Plusieurs **moteurs IA** (OpenAI GPT-5 + alternatives)
- **Retry automatique** en cas d'échec ou de timeout
- **Vérifications cohérence** : date de naissance plausible, IBAN valide, NPA suisse, etc.

---

## 7. Commissions & rétrocessions

**En quoi ça consiste** : LYTA calcule **automatiquement** les commissions que le cabinet gagne sur chaque police, applique les règles tarifaires propres à chaque compagnie/produit, et reverse aux agents leur part.

### 7.1 Saisie manuelle ou auto

- **Saisie manuelle** : formulaire client + police + montant
- **Import auto** via Smartflow Décomptes (cf. §6.7)

### 7.2 Règles de commission par compagnie/produit

- **Taux** : % du montant de la prime
- **Montant fixe** : commission flat
- **Plafonds** : montant max par contrat
- **Première année / récurrente** : taux différents
- **Configurables par cabinet** (override des règles du catalogue)

### 7.3 Tiering (paliers progressifs)

- Possibilité de définir des paliers selon le volume
- Exemple : 0-50 polices → 10% / 51-100 → 12% / 101+ → 15%
- Calculé automatiquement pour chaque agent

### 7.4 Rétrocessions aux agents

- Chaque agent a sa **règle de rétrocession** (% des commissions qu'il génère)
- Calcul automatique pour chaque commission reçue
- **Décompte par collaborateur** mensuel ou trimestriel

### 7.5 Comptes de réserve

- Possibilité de **retenir un %** de chaque commission sur un compte de réserve
- Sert à **provisionner les retours** (la compagnie peut reprendre la commission si le client résilie)
- Vue dédiée dans CRM → Compta

### 7.6 Statuts & cycle

- **Brouillon** → en attente de validation
- **À valider** → en attente du broker
- **Validée** → comptabilisée dans les KPIs
- **Payée** → reversée au collaborateur
- **Annulée** → reprise par la compagnie

### 7.7 Vue par collaborateur

- Tableau de bord par agent : total mois, total année, rétrocession due, en attente
- Comparaison N / N-1

### 7.8 Scope-aware

- Un agent ne voit que **ses propres** commissions
- Un manager voit celles de son équipe
- Un admin voit tout le cabinet

---

## 8. Comptabilité & QR-factures

**En quoi ça consiste** : la vue **financière** du cabinet — décomptes payés, factures QR suisses émises, comptes de réserve, exports comptables.

### 8.1 Décomptes par collaborateur

- Vue **par période** (mois, trimestre)
- Total brut / réserve / TVA / net
- **Export PDF** branded au cabinet
- Possibilité d'envoyer le décompte par email au collaborateur

### 8.2 Comptes de réserve

- Vue par collaborateur du solde de réserve actuel
- Historique des transactions (provision + reprise)
- **Libération** manuelle ou automatique après N mois (configurable)

### 8.3 QR-factures suisses

- **Génération conforme** à la norme ISO 20022 (QR-IBAN, IID, montant CHF)
- **Code QR scannable** par toutes les apps bancaires suisses (Twint, e-banking)
- Émission depuis le cabinet vers un client (consultation, dossier complémentaire)
- Émission depuis le cabinet vers un collaborateur (paie commissions)
- **PDF imprimable** standard avec section paiement

### 8.4 Transactions & exports

- Vue de toutes les **transactions** (entrées + sorties)
- **Export Excel / CSV** pour la comptabilité externe
- **Filtres** : période, type, contrepartie

### 8.5 Paiements externes

- Suivi des paiements à des **apporteurs** (partenaires)
- Suivi des paiements aux **affiliés**

---

## 9. Communications & emailing

**En quoi ça consiste** : le **centre de communication** sortant — emails transactionnels (signature, mandat, notifs), campagnes, historique unifié, automatisations.

### 9.1 Historique unifié

**Tous** les emails envoyés depuis le cabinet sont logués dans un seul écran (CRM → Publicité → Historique).

Pour chaque email : kind, destinataire, sujet, date, statut Resend (envoyé / rebondi / échec), lien vers l'aperçu.

### 9.2 Types d'emails tracés (10 kinds)

| Kind | Quand |
|---|---|
| **Lien signature** | Envoi d'une demande de signature à un client |
| **Mandat signé** | Confirmation au client après signature |
| **Envoi compagnies** | Dispatch du mandat signé aux compagnies |
| **Création compte** | Création d'un compte client espace client |
| **Email rapide** | Email custom envoyé depuis la fiche client |
| **Email CRM** | Email via l'éditeur du CRM |
| **Recherche LPP** | Email envoyé aux institutions LPP |
| **Campagne** | Campagne marketing programmée |
| **Transactionnel** | Autres notifications système |
| **Anniversaire / Renouvellement / Follow-up** | Crons automatiques |

### 9.3 Filtres puissants

- Par **kind** : pour ne voir que les dispatchs mandat, ou que les signatures, etc.
- Par **statut** : voir uniquement les bounces ou les échecs
- Par **destinataire**, par **période**

### 9.4 5 toggles d'automatisations

Le cabinet active/désactive chaque automatisation depuis CRM → Paramètres → Emails :

1. **Bienvenue espace client** (`enable_welcome_email`)
2. **Confirmation dépôt contrat** (`enable_contract_deposit_email`)
3. **Contrat signé** (`enable_contract_signed_email`)
4. **Mandat signé** (`enable_mandat_signed_email`)
5. **Compte client créé** (`enable_account_created_email`)

### 9.5 Emails custom

- Bouton **"Envoyer un email"** depuis n'importe quelle fiche client
- Éditeur WYSIWYG + variables (nom, prénom, date du jour)
- Templates personnalisables par cabinet
- Aperçu avant envoi
- **Identité expéditeur du cabinet** (nom + reply-to admin)

### 9.6 Domaine email custom

- Possibilité d'envoyer depuis `<custom>@advisy.ch` (au lieu de `lyta.ch`)
- **Configuration DNS guidée** : LYTA génère les enregistrements à ajouter chez ton fournisseur DNS
- Vérification automatique de la propagation

### 9.7 Identité expéditeur correcte

- **From** : "Nom du cabinet <support@lyta.ch>" tant que le domaine custom n'est pas validé
- **Reply-To** : email back-office du cabinet (les réponses arrivent au bon endroit)

---

## 10. Suivis & tâches

**En quoi ça consiste** : un **système de tâches métier** typées et reliées à un client. Plus structuré qu'un simple TODO.

### 10.1 6 types de suivi

| Type | Usage |
|---|---|
| **Activation** | Suivi d'activation d'un nouveau contrat |
| **Annulation** | Demande d'annulation d'une police |
| **Retour** | Retour d'un dossier en attente |
| **Résiliation** | Procédure de résiliation en cours |
| **Sinistre** | Suivi d'un sinistre déclaré |
| **Autre** | Tout autre suivi générique |

### 10.2 3 statuts

- **Ouvert** : à traiter
- **En cours** : en traitement
- **Fermé** : terminé

### 10.3 Assignation & responsabilité

- Chaque suivi est assigné à un collaborateur
- Scope-aware : un agent voit ses propres suivis
- Délai cible configurable

### 10.4 Audit complet

- Chaque modification est loguée (qui, quand, quel champ a changé)
- Historique consultable depuis la fiche du suivi

### 10.5 Lien avec les autres modules

- Un suivi peut être lié à un client + une police + un sinistre
- Notifications email + in-app à chaque changement de statut (configurable)

---

## 11. Rapports & dashboards

**En quoi ça consiste** : la vue **analytique** du cabinet — KPIs, production, commissions, top clients, top agents, comparaisons.

### 11.1 Dashboard d'accueil CRM

- **KPIs en haut** : total clients, total polices, commissions du mois, taux conversion prospects
- **Tendances** : production de la semaine / mois / année
- **Top 5 agents** par production
- **Top 5 compagnies** par volume
- **Échéances proches** : polices qui arrivent à terme dans les 30 jours

### 11.2 Rapports détaillés (page Rapports)

- **Rapport production** : par agent, par compagnie, par branche, par période
- **Rapport portefeuille** : structure des contrats actifs
- **Rapport commissions** : brut, net, à recevoir, retours
- **Rapport prospects** : taux de conversion par source

### 11.3 Graphiques interactifs

- **Bar charts** : production mensuelle
- **Line charts** : évolution N / N-1
- **Pie charts** : répartition par branche / compagnie / agent

### 11.4 Exports

- **Excel (.xlsx)** : tableau complet avec toutes les colonnes
- **PDF** : version imprimable du rapport
- **Format français** : montants CHF, dates dd.mm.yyyy

### 11.5 Scope-aware

- Un agent voit ses propres chiffres
- Un manager voit ceux de son équipe
- Un admin voit le cabinet entier

---

## 12. LPP — 2ᵉ pilier

**En quoi ça consiste** : module **spécialisé LPP** (prévoyance professionnelle suisse) — recherche d'avoirs, libre passage, rapatriement. Avec automatisation des demandes officielles.

### 12.1 Onglet LPP du dépôt de contrat public

- **Page publique** sur `/deposer-contrat` (5ᵉ tab marqué 🐷)
- **Smartflow scan intégré** : drag PDFs en haut → IA pré-remplit
- **7 sections** dynamiques selon la demande :
  1. Type de demande (recherche / libre passage / rapatriement)
  2. Client : identité + AVS
  3. Anciens employeurs (dynamique, ajout/suppression à la volée)
  4. Libre passage
  5. Caisse pension actuelle
  6. Documents requis (pièce ID, facture QR, contrat + procuration)
  7. Confirmation

### 12.2 Automation recherche LPP (le 🐷)

- Sur **chaque contrat LPP** dans la fiche client : bouton 🐷 **"Envoyer recherche"**
- En 1 clic :
  - Email envoyé à la **Centrale du 2ᵉ pilier** (Sicherheitsfonds BVG)
  - Email envoyé à la **Fondation Institution Supplétive LPP** (Stiftung Auffangeinrichtung BVG)
- **Pièces jointes** : pièce d'identité + procuration
- **Identité expéditeur du cabinet** (nom + reply-to admin du cabinet)
- **Toast confirmation** "2/2 emails envoyés"

### 12.3 Suivi

- Table `lpp_search_requests` avec statut par institution
- Historique dans CRM → Publicité → filtre "Recherches LPP"
- Suivi des réponses (à venir : OCR auto des courriers retour)

### 12.4 Conformité

- Emails conformes au format attendu par les institutions
- Données client + AVS toujours inclus
- Mandant explicite dans la procuration jointe

---

## 13. Espace client

**En quoi ça consiste** : un **portail web sécurisé** où le client final du cabinet consulte son dossier, signe ses documents, déclare ses sinistres, parle à son conseiller.

### 13.1 Connexion sécurisée

- **Magic link** par email (pas de mot de passe à retenir)
- Validation email + téléphone à la première connexion
- Session sécurisée
- **Sans coût supplémentaire** pour le cabinet — autant de clients que voulu

### 13.2 Dashboard d'accueil

- Vue synthétique du client : nombre de polices, prochains événements (échéance, anniversaire)
- Raccourcis vers : Contrats, Sinistres, Documents, Messages, Notifications
- **Branding du cabinet** (logo, couleurs)

### 13.3 Mes contrats

- Liste complète des polices en cours
- Détail par police : compagnie, produit, dates, prime
- **Téléchargement** des polices et avenants
- Lien direct vers son conseiller pour question

### 13.4 Mes sinistres

- Liste des sinistres déclarés
- **Déclaration d'un nouveau sinistre** depuis l'app : formulaire structuré + upload photos
- Statut en temps réel
- Notes échangées avec le cabinet

### 13.5 Mes documents

- Tous les documents partagés par le cabinet
- Possibilité de **téléverser** ses propres documents (à transmettre au broker)
- **Notification automatique** au broker quand le client upload un doc
- Téléchargement à tout moment

### 13.6 Messages avec le conseiller

- Fil de discussion broker ↔ client
- **Notification email + push** à chaque nouveau message
- Conservation des échanges

### 13.7 Notifications

- Cloche **en haut à droite** sur toutes les pages
- **Bell visible mobile** dans la nav du bas
- Historique complet

### 13.8 Programme de parrainage (Referrals)

- Code de parrainage personnel
- Suivi des filleuls
- Récompense quand le filleul devient client (configurable par cabinet)

### 13.9 Profil

- Modification de ses coordonnées
- Préférences de communication
- Suppression de compte (conformité nLPD/RGPD)

### 13.10 Mobile-first

- Navigation **mobile bottom-nav** dédiée smartphone
- Toutes les actions accessibles au pouce
- Capacitor : app native iOS/Android en option

---

## 14. Collaborateurs, rôles & permissions

**En quoi ça consiste** : la **gestion de l'équipe** du cabinet — qui peut faire quoi, qui voit quoi.

### 14.1 4 rôles de base

| Rôle | Pouvoirs |
|---|---|
| **Admin** | Accès total : CRM + Paramètres + Facturation + Collaborateurs |
| **Manager** | Voit son équipe + ses propres clients, gère commissions et suivis |
| **Agent** | Voit uniquement ses clients assignés, crée/modifie ses propres dossiers |
| **Back-office** | Tâches support (à venir / configurable) |

### 14.2 Scopes (champ de vision)

| Scope | Effet |
|---|---|
| **Global** | Voit toutes les données du cabinet (typique admin) |
| **Team** | Voit son équipe + ses subordonnés |
| **Personnel** | Voit uniquement ses propres données |

### 14.3 Permissions granulaires

Sur **chaque rôle**, possibilité d'**override** finement :

- `clients.create`, `clients.delete`, `clients.export`
- `policies.write`, `policies.delete`
- `commissions.see_amounts` (voir/cacher les montants)
- `commissions.validate`
- `documents.upload`, `documents.delete`
- … et beaucoup d'autres

### 14.4 Branches d'affectation

- Un collaborateur peut être **assigné à une ou plusieurs branches**
- Détermine quels produits il peut souscrire
- Détermine ses règles de commission

### 14.5 Multi-tenant

- Un même utilisateur peut appartenir à **plusieurs cabinets** (cas d'un agent freelance)
- Switch tenant via UI

### 14.6 Profil collaborateur

- Photo de profil
- Coordonnées pro
- Adresse + horaires (pour affichage côté client)
- Bio courte

### 14.7 Invitation

- Création d'un collab → invitation envoyée par email
- Magic link 24h pour définir son mot de passe
- SMS 2FA proposé dès la 1ʳᵉ connexion

---

## 15. Abonnement & facturation tenant

**En quoi ça consiste** : le **paiement** de LYTA par le cabinet — plans, seats, overage, factures.

### 15.1 4 plans

| Plan | Smartflow / mois | SMS / mois | Email auto / mois |
|---|---|---|---|
| **Start** | 0 | 0 | 0 |
| **Pro** | 0 | 200 | 2000 |
| **Prime** | 400 | 400 | 10000 |
| **Founder** | 400 | 400 | 10000 |

### 15.2 Seats (collaborateurs CRM)

- Inclus selon le plan
- **Ajout de seats** à la volée : facturation prorata sur la prochaine facture
- **Suppression** : le seat est libéré à la fin de la période en cours
- **Règle critique** : seuls les **collaborateurs CRM** comptent comme seats. **Les clients de l'espace client sont illimités gratuits**.

### 15.3 Overage automatique

- Si un tenant dépasse son quota → l'overage est facturé automatiquement
- **Toggle `auto_overage_enabled`** : activable / désactivable
- **Cron mensuel** qui crée les invoice items Stripe

### 15.4 Alertes consommation

- **Widget de quotas** en bas de l'app : 3 jauges Smartflow / SMS / Email
- **Alertes email** : 80%, 100%, 150% du quota

### 15.5 Factures Stripe

- Vue **complète** de toutes les factures (date, montant, statut)
- **Téléchargement PDF** pour chaque facture
- **Lien direct** vers la facture hostée Stripe (pour paiement si retard)

### 15.6 Self-service annulation

- Bouton **"Annuler mon abonnement"** dans CRM → Abonnement
- Confirmation + champ raison (pour feedback)
- **`cancel_at_period_end`** Stripe → le tenant garde son accès jusqu'à fin de période payée
- Email automatique à `support@lyta.ch` avec récap (MRR perdu, raison)
- Notification KING priorité haute

### 15.7 Upgrade / downgrade

- Changement de plan depuis CRM → Abonnement
- Calcul automatique du prorata

---

## 16. LytaTools — Apps tierces connectées

**En quoi ça consiste** : module **pilote** (actuellement réservé à Advisy) permettant de connecter des **outils externes** au CRM (calculateurs de prime, API tierces, intégrations type Zapier).

### 16.1 Apps connectées

- Liste des apps actives par cabinet
- Statut de connexion (vert / rouge)
- Date dernière utilisation

### 16.2 Use cases typiques

- Calculateur de prime LAMal externe
- API d'un comparateur d'assurance
- Webhook vers un outil de marketing automation
- Connexion à un système de téléphonie

### 16.3 Sécurité

- Token API stocké chiffré
- Connexion révocable à tout moment

### 16.4 Statut : pilote

- Pour l'instant restreint au tenant Advisy pour validation
- Sera ouvert plus largement après stabilisation

---

## 17. Programme affiliés

**En quoi ça consiste** : permet à des **apporteurs externes** (consultants, autres courtiers, partenaires) de référer des cabinets à LYTA et de toucher une **commission récurrente** sur les abonnements générés.

### 17.1 Tracking automatique

- L'affilié a un code (ex: `?ref=JEAN42`)
- Tout cabinet qui s'inscrit via ce lien est tagué dans la base
- **Liaison auto** tenant ↔ affilié

### 17.2 Calcul des commissions

- **Taux** configurable par affilié
- **Durée d'éligibilité** (ex: 24 mois)
- Commission appliquée sur chaque facture Stripe payée par le cabinet référé

### 17.3 Factures mensuelles

- **Génération auto** PDF mensuel pour l'affilié
- Total dû + détail par cabinet
- Envoi automatique par email

### 17.4 Vue KING

- Tableau de bord des affiliés actifs
- Top performers
- Total commissions à payer

---

## 18. KING — Administration plateforme

**En quoi ça consiste** : l'**espace d'administration** de toute la plateforme LYTA. Réservé à Habib / Optimislink. C'est le poste de pilotage qui voit tous les cabinets, leurs métriques, leurs factures, leur consommation.

### 18.1 Dashboard KING

- **MRR Total** (revenus mensuels récurrents)
- **ARR** (revenus annuels = MRR × 12)
- **Chart 12 mois** de l'évolution du chiffre d'affaires
- **Plan distribution** (pie chart des tenants par plan)
- **Live feed** des dernières actions sur la plateforme
- **Produits par branche** (vue catalogue)

### 18.2 Gestion des tenants

- **Liste** complète avec recherche, tri, filtres
- **Export CSV**
- **Fiche détail** d'un tenant : KPIs, factures Stripe, consommation, collaborateurs
- **Sync Stripe** manuelle (récup automatique du customer/sub)
- **Re-run onboarding** (re-lance DNS + Vercel + Resend si échec initial)
- **Impersonate** : Habib peut se connecter "comme" un user du cabinet pour débug (loggué dans `king_audit_log`)
- **Suspension / activation**
- **Suppression** RGPD (avec confirmation forte)

### 18.3 Gestion des plans & modules

- Configuration des plans SaaS (Start / Pro / Prime / Founder)
- Modules activables par plan
- Quotas par plan
- **Catalogue** de compagnies + produits + branches

### 18.4 Gestion des affiliés

- Création / suspension d'affiliés
- Configuration taux + durée
- Génération factures mensuelles
- Voir §17

### 18.5 Onboarding wizard

- **KingWizard** : flow guidé pour créer un tenant manuellement (cas import depuis un autre CRM)
- Import bulk de tenants existants

### 18.6 Onglet Factures

- Toutes les factures Stripe de tous les tenants
- Bouton "Renvoyer email de bienvenue"
- Statut paiement, retards

### 18.7 Coûts plateforme

- **Tracking OpenAI** auto (coût IA par tenant)
- **Sync Resend** (volume + coût emails)
- **Sync Twilio** (volume SMS + coût)
- Vue **marge par tenant** (MRR - coûts variables)

### 18.8 Monitoring

- Santé de chaque tenant
- **Quotas alertes** 80% / 100% / 150%
- Vue cross-tenant pour détecter anomalies

### 18.9 Support tickets

- Inbox des tickets envoyés par les tenants
- Réponse depuis KING
- Statut & historique

### 18.10 Governance & audit

- **Audit log enrichi** : qui a fait quoi, quand, sur quel tenant
- **Sync automatique** tenants ↔ Stripe (linkage)
- **`billing_mode`** : trial / paying / suspended

### 18.11 Notifications KING (Bell)

- **Cloche visible partout** (sidebar + mobile)
- Nouvelles inscriptions
- Alertes sécurité
- Quotas dépassés
- Erreurs onboarding
- Tickets support entrants

### 18.12 Bouton "Tester emails"

- En 1 clic : envoie les **8 templates branded** à une boîte cible pour validation visuelle :
  - welcome, account_created, contract_signed, mandat_signed, relation_client, offre_speciale, password_reset, finalize_signup

### 18.13 Sécurité plateforme

- Config 2FA forcée
- IP allowlist
- Audit des sessions actives

### 18.14 Rapport de conformité

- Rapport **nLPD / RGPD** auto-généré
- Export pour les autorités

---

## 19. Automatisations & crons

**En quoi ça consiste** : **6 jobs automatiques** qui tournent en arrière-plan pour soulager le courtier.

### 19.1 🎂 Email anniversaire client

- **Quand** : tous les jours à 07:00 (Europe/Zurich)
- **Pour qui** : clients status `actif` dont c'est l'anniversaire aujourd'hui
- **Activation** : toggle `enable_birthday_email` par cabinet
- **Email** branded au cabinet, template personnalisable

### 19.2 📋 Email renouvellement échéance

- **Quand** : tous les jours à 07:30
- **Pour qui** : polices arrivant à échéance dans N jours (configurable)
- **Activation** : toggle `enable_renewal_reminder` + `renewal_reminder_days_before`
- **Idempotence** : pas de re-envoi pour la même échéance

### 19.3 🔔 Email follow-up prospects dormants

- **Quand** : tous les jours à 08:00
- **Pour qui** : prospects créés il y a +N jours sans conversion
- **Activation** : toggle `enable_follow_up_reminder` + `follow_up_reminder_days`
- **Limite** : 1 seul follow-up par prospect (pas de spam)

### 19.4 🔄 Retry onboarding

- **Quand** : horaire
- **Pour quoi** : tenants en `pending_setup` qui ont raté une étape DNS/Vercel/Resend
- **Limite** : 24h de retry, puis notification KING

### 19.5 ⏱ Activation auto fin de trial

- **Quand** : horaire
- **Pour quoi** : tenants en `trialing` arrivés à échéance, qui passent automatiquement à `active`
- **Filet** : si le webhook Stripe a raté, le cron corrige

### 19.6 💸 Apply monthly overage

- **Quand** : mensuel (début du mois suivant)
- **Pour quoi** : tenants avec `auto_overage_enabled=true` qui ont dépassé leur quota
- **Action** : crée les invoice items Stripe → apparaît sur la prochaine facture

---

## 20. Sécurité & conformité

**En quoi ça consiste** : LYTA est conçu pour traiter des **données très sensibles** (santé, AVS, IBAN) avec les exigences du droit suisse.

### 20.1 Authentification

- **Mot de passe** : minimum 8 caractères + vérification HaveIBeenPwned (refus si dans une fuite connue)
- **2FA SMS** : activée par défaut au self-signup (Twilio Verify)
- **Magic link** : 24h de validité
- **Reset password** : sécurisé via Supabase Auth
- **Sessions timeout** : configurable par cabinet (inactivité)
- **Logout forcé** après changement de rôle / mot de passe / 2FA enrôlée

### 20.2 Isolation multi-tenant

- Chaque cabinet est **strictement isolé** des autres
- Aucune fuite cross-tenant possible par design
- **RLS Postgres** systématique sur toutes les tables
- Audit en interne par Habib + audit externe planifié

### 20.3 Données sensibles

- AVS, IBAN, dossiers santé : stockés en base avec accès contrôlé
- **Chiffrement at-rest** : géré par Supabase (Postgres + Storage)
- **Chiffrement en transit** : TLS 1.3 partout

### 20.4 Conformité nLPD / RGPD

- **Politique de confidentialité** dédiée
- **Mentions légales** (en cours de finalisation)
- **CGU** (en cours de finalisation)
- **Suppression complète** d'un compte sur demande (RGPD art. 17)
- **Export des données** d'un tenant (RGPD portabilité)
- **Notification de violation** : procédure documentée (72h nLPD)

### 20.5 Audit

- Toutes les actions critiques loguées dans `audit_logs`
- KING actions loguées dans `king_audit_logs`
- **Conservation** : 3 ans (configurable)

### 20.6 Sauvegardes

- Backup quotidien Supabase
- Rétention 30 jours
- **PITR** (Point-In-Time Recovery) jusqu'à 7 jours

### 20.7 Headers de sécurité

- Content Security Policy (CSP) strict
- `frame-ancestors` (anti-clickjacking)
- HSTS
- X-Content-Type-Options

---

## 21. Roadmap — À venir

### Court terme (Q3 2026)

- ✅ **Signature à distance avec zone draguée** (livré juin 2026)
- 🔄 Refonte complète UI/UX (priorité #4 roadmap)
- 🔄 Suivi visuel du mandat sur chaque ligne compagnie (côté CRM Compagnies)
- 🔄 Stripe Customer Portal complet (gestion CB + factures self-service)
- 🔄 LPP Phase 2 — Pingen postal automatique (envoi courrier physique)

### Moyen terme

- 📋 **Comparateur d'assurances** intégré (alimenté par le projet Optimis séparé)
- 📋 **API publique** pour partenaires (lecture leads, lecture portefeuille)
- 📋 **App mobile native** publiée sur App Store + Google Play
- 📋 **OCR automatique** des courriers retour des compagnies
- 📋 **Workflow builder visuel** (créer ses propres automatisations)

### Long terme

- 📋 **Multi-pays** : extension Allemagne, France, Belgique
- 📋 **SOC 2 Type II** (audit sécurité externe)
- 📋 **Marketplace** d'apps tierces (intégrations natives)

> Voir aussi le document interne `Documentation/Roadmap_LYTA_Officielle.md` (priorisation Habib) pour le détail.

---

## 🤝 Pour en savoir plus

- **Site marketing** : https://lyta.ch
- **App** : https://app.lyta.ch
- **Support** : support@lyta.ch
- **Éditeur** : Optimislink Sàrl

---

*Document généré le 8 juin 2026. Document vivant — mis à jour à chaque évolution majeure. — Optimislink Sàrl.*

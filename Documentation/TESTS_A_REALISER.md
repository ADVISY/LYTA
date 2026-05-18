# Tests à réaliser — Checklist Habib

Centralisé ici les tests manuels à faire après chaque batch de features.
Statuts : 🟢 OK / 🔴 KO / 🟡 partiel / 📋 pas encore testé

---

## Self-signup tenant (paiement → tenant actif)

- 📋 Paiement Stripe sur lyta.ch (Payment Link)
- 📋 Redirect vers `app.lyta.ch/finalize?session_id=...`
- 📋 Email 1 (filet sécu) "Active ton cabinet LYTA" arrive
- 📋 Form `/finalize` complet (4 sections : entreprise / couleurs / contact / options)
- 📋 Logo upload max 2MB (PNG/JPEG/WebP/SVG)
- 📋 Submit → "Cabinet créé 🎉"
- 📋 Email 2 (welcome) "Bienvenue Lyta — {tenant}" arrive avec magic link
- 📋 Clic magic link → page reset password → définir mot de passe
- 📋 Redirection vers `{slug}.lyta.ch/connexion` → login OK
- 📋 SMS OTP 2FA arrive sur tél (si enable_2fa_login activé par défaut)
- 📋 Notifications King : "🆕 Nouveau paiement self-signup" → "🎉 Tenant créé" → "✅ DNS configuré"
- 📋 Bell King clignote (visible partout dans King)
- 📋 KingTenantDetail → bouton "Re-run onboarding" fonctionne (filet)
- 📋 Bouton "Tester emails" envoie 8 templates branded sur boîte cible

## Trial → Active automatique (7 jours)

- 📋 Tenant en trial 7 jours → Stripe transition `trialing` → `active` → tenant.status passe à `active` automatiquement
- 📋 Notification King "🎉 Cabinet actif (fin trial)"
- 📋 Cron horaire `auto_activate_expired_trials` corrige les cas où le webhook a raté

## Annulation abonnement tenant (self-service)

- 📋 CRM → Abonnement → bouton "Annuler mon abonnement" (rouge)
- 📋 Dialog confirmation + champ raison
- 📋 Stripe `cancel_at_period_end=true` appliqué
- 📋 Email à `support@lyta.ch` avec récap (MRR perdu, raison, période fin)
- 📋 Notif King "🚪 Demande d'annulation" priority high
- 📋 Tenant garde l'accès jusqu'à la fin de la période payée

## Emails auto + toggles

- 📋 CRM → Paramètres → Emails → décocher "Email de bienvenue"
- 📋 Créer nouveau client → email welcome NE part PAS
- 📋 Recocher → créer client → email part bien
- 📋 Idem pour `contract_deposit`, `contract_signed`, `mandat_signed`, `account_created`
- 📋 **Email anniversaire** : créer client status='actif' avec birthdate=aujourd'hui, activer `enable_birthday_email`, run `SELECT public.trigger_birthday_emails()` → email arrive (filtre actif uniquement, pas prospect)
- 📋 **Email renouvellement** : créer police avec `end_date = today + 30 jours`, activer `enable_renewal_reminder`, run `SELECT public.trigger_renewal_reminders()` → email arrive (filtre actif)
- 📋 **Email follow-up** : créer prospect créé il y a +7 jours, activer `enable_follow_up_reminder`, run `SELECT public.trigger_follow_up_reminders()` → email arrive (filtre prospect uniquement)

## Dépôt de contrat (`/deposer-contrat`)

- 📋 Vérification email partenaire
- 📋 Tab SANA — fonctionne end-to-end
- 📋 Tab VITA — fonctionne end-to-end
- 📋 Tab MEDIO — fonctionne end-to-end
- 📋 Tab BUSINESS — fonctionne end-to-end
- 📋 **Tab LPP** :
  - 📋 RadioGroup affiche les 5 tabs (PiggyBank ambre visible)
  - 📋 Smartflow scan en haut (drop documents → IA prefill)
  - 📋 Section "Type de demande" : 3 checkboxes (recherche / libre passage / rapatriement) — au moins 1 requis
  - 📋 Section Client : nom, prénom, email, tel, naissance, **n° AVS** (format 756.XXXX.XXXX.XX), nationalité, adresse
  - 📋 Section "Anciens employeurs" apparaît si rechercheAvoirs coché : liste dynamique avec ajout/suppression
  - 📋 Section "Libre passage" apparaît si creationLibrePassage coché
  - 📋 Section "Caisse pension actuelle" apparaît si rapatriementLPP coché
  - 📋 Upload documents : pièce d'identité, facture QR, contrat+procuration
  - 📋 Submit → policy créée avec `product_type='lpp'` + email cabinet reçu avec récap formaté

## Automation recherche LPP

- 📋 CRM → Client → Contrats → contrat LPP visible
- 📋 Bouton 🐷 "Envoyer recherche" affiché uniquement sur contrat LPP
- 📋 Clic → dialog confirmation → 2 emails partent
- 📋 Vérifier dans Gmail : **From** = "{Nom Cabinet} <support@lyta.ch>", **Reply-To** = email tenant (admin_email/email), pièces jointes (ID + procuration)
- 📋 Toast "✅ 2/2 emails envoyés"
- 📋 CRM → Publicité → Historique → filter "Recherches LPP" → 2 lignes par envoi (Centrale + Suppletive) avec statut + sujet + destinataire
- 📋 DB : nouvelle ligne dans `lpp_search_requests` avec statut par institution
- ⚠️ **AVANT TEST RÉEL** : override env vars `LPP_CENTRALE_EMAIL` et `LPP_SUPPLETIVE_EMAIL` sur Supabase Dashboard pour les pointer vers ta boîte (évite de spammer les vraies institutions)

## King Dashboard MRR

- 📋 Créer un tenant payant (via Stripe ou KingWizard)
- 📋 MRR Total card affiche le bon montant (Stripe direct OU fallback DB)
- 📋 ARR = MRR × 12
- 📋 Revenue chart 12 mois affiche les factures payées
- 📋 Plan distribution pie chart affiche la répartition
- 📋 Sync Stripe bouton sur KingTenantDetail récupère customer même sans email match (priorité `stripe_customer_id`)

## Champ "Collaborateurs supplémentaires"

- 📋 `/finalize` label = "Collaborateurs CRM supplémentaires" (pas "Utilisateurs")
- 📋 KingWizard idem
- 📋 Texte d'aide précise "clients finaux illimités gratuits"
- 📋 Backend : créer un client (espace-client) NE compte PAS comme seat payant
- 📋 Créer un collaborateur (agent/manager/backoffice) compte bien comme seat

## Logo Safari

- 📋 Ouvrir Safari → `/connexion` → vrai logo LYTA affiché (plus le fallback HTML)
- 📋 Idem `/reset-password`, `/finalize`

## Pricing utilisateurs (règle business critique)

- 📋 Tenant Start (seats inclus = 1) → admin créé OK
- 📋 Ajouter 5 clients espace-client → seat count reste 1 (pas bloqué)
- 📋 Ajouter 1 collaborateur agent → seat count passe à 2 → si plan = Start (1 seat) → blocage "Aucun siège disponible"
- 📋 King augmente `extra_users` à 5 → collaborateur peut être créé

---

## Notes

- Pour les emails : vérifier dans **boîte + spam** Gmail
- Pour les crons : `SELECT public.trigger_xxx()` dans Supabase SQL Editor pour test immédiat (au lieu d'attendre l'heure)
- Pour Stripe : utiliser **test mode** pour tous les tests (clé `sk_test_...`)
- Vault pour pg_cron : nécessite `SERVICE_ROLE_KEY` + `PROJECT_URL` ajoutés via `SELECT vault.create_secret(...)`

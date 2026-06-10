# LYTA — Guide d'envoi cold email via Resend Broadcasts

> **Pour qui** : Habib Agharbi, pour la campagne lancement LYTA juin 2026
> **Volume** : 88 contacts courtiers B2B suisses (emails seuls, pas de prénom/nom)
> **Sender** : `support@lyta.ch` (display name : "Habib Agharbi — LYTA")
> **Subject** : `Et si ton CRM datait des années 2000 ?`
> **Effort estimé** : 45 min de setup + 5 min d'envoi
> **Coût** : 0 € (gratuit jusqu'à 3 000 emails/mois sur Resend Free)
> **Version template** : v9 (palette jaune LYTA + marine, validée 10 juin 2026)

---

## 🗂️ Inventaire de ce que tu as déjà entre les mains

| Asset | Fichier | Statut |
|---|---|---|
| Template HTML brandé | `Documentation/marketing/cold_email_template.html` | ✅ Prêt |
| Subject lines (3 variantes A/B) | `Documentation/marketing/cold_email_copy.md` | ✅ Prêt |
| Body texte alternatif | `Documentation/marketing/cold_email_copy.md` | ✅ Prêt |
| LP de lancement + vidéo | `https://lyta.ch/lancement` | ✅ Déjà en ligne (selon ton message) |
| Logo LYTA SVG | `public/marketing/lyta-logo-*.svg` | ⚠️ À convertir en PNG pour email |
| CSV des 88 contacts | (chez toi) | ⏳ À préparer dans le bon format |

---

## 🚀 Procédure d'envoi — 8 étapes

### Étape 1 — Convertir le logo SVG en PNG (5 min)

Les clients email ne supportent pas tous le SVG (Outlook desktop le bloque). Convertir :

```bash
# Option 1 — via macOS preview / Aperçu
# Ouvrir public/marketing/lyta-logo-official.svg → Export en PNG, 512x512 px

# Option 2 — via ligne de commande (si tu as ImageMagick ou Inkscape)
inkscape public/marketing/lyta-logo-official.svg \
  --export-type=png --export-filename=public/marketing/lyta-logo-512.png \
  --export-width=512

# Option 3 — site en ligne
# https://cloudconvert.com/svg-to-png — drop le SVG, télécharge le PNG
```

**Important** : le PNG doit être accessible publiquement à
`https://app.lyta.ch/marketing/lyta-logo-512.png` après déploiement Vercel.

**Backup** : si tu n'as pas le temps d'héberger le PNG, ouvre le template HTML
et active le bloc "Logo texte" en commentaire (rechercher "Logo texte"). Le
mail s'affichera avec un logo texte stylé au lieu d'une image. Moins joli
mais marche partout.

---

### Étape 2 — Vérifier le domaine Resend (10 min — à faire UNE FOIS)

Connexion à Resend dashboard : https://resend.com/login

1. Aller dans **Domains**
2. Si `lyta.ch` n'apparaît pas → **Add Domain** → `lyta.ch`
3. Resend te donne 3-4 enregistrements DNS à ajouter chez ton registrar :
   - `_dmarc.lyta.ch` TXT (politique DMARC)
   - `resend._domainkey.lyta.ch` TXT (signature DKIM)
   - `lyta.ch` TXT (SPF — `v=spf1 include:_spf.resend.com ~all`)
4. Ajoute-les dans **Cloudflare** (ton DNS) — copier-coller exact
5. Retour Resend → **Verify Domain** → attendre 5-15 min → vert OK

Si tous tes DNS sont déjà configurés et qu'il y a un SPF existant pour Resend,
**arrête** et vérifie qu'on n'écrase pas une config qui marche pour les
emails transactionnels LYTA (signature invite, mandat dispatch, etc.).

---

### Étape 3 — Créer l'Audience dans Resend (10 min)

1. Resend dashboard → **Audiences** → **New Audience**
2. Nom : `Cold outreach - Lancement LYTA juin 2026`
3. **Upload CSV** au format minimaliste suivant (1 seule colonne) :

```csv
email
contact@cabinet-1.ch
info@cabinet-2.ch
direction@cabinet-3.ch
... (88 lignes au total)
```

**Règles CSV importantes** :
- Encodage **UTF-8** (pas Windows-1252)
- 1 email par ligne, pas de doublon (Resend détecte mais nettoie d'abord
  ton fichier pour éviter d'envoyer 2× au même)
- Pas de prénom/nom à fournir : le template n'utilise pas de personnalisation
  (« Bonjour, » tout court, pas « Bonjour Jean, »)

**Audit avant import** :
```bash
# Vérifier qu'il n'y a pas de Gmail/Hotmail dans la liste B2B
grep -iE "@gmail|@hotmail|@yahoo|@outlook|@bluewin|@infomaniak" ton-csv.csv

# Si match → sortir ces lignes (cold sur perso = risque LCD opt-in)
```

---

### Étape 4 — Créer le Broadcast (5 min)

1. Resend dashboard → **Broadcasts** → **New Broadcast**
2. **From** :
   - Address : `support@lyta.ch`
   - Name : `Habib Agharbi — LYTA`
3. **Reply-To** : `support@lyta.ch` (les réponses arrivent dans cette boîte)
4. **Subject** : `Et si ton CRM datait des années 2000 ?`
   (alternatives dans `cold_email_copy.md` si A/B test)
5. **Audience** : sélectionner l'audience créée à l'étape 3
6. **Content** :
   - Cliquer "Code editor" / "HTML editor"
   - Copier-coller le contenu de `cold_email_template.html`
   - Vérifier que le lien CTA pointe vers la bonne URL LP (`https://lyta.ch/lancement` ou ton URL de page de lancement)
   - Vérifier que le `src` du logo pointe vers ton PNG hébergé sur Vercel
     (`https://app.lyta.ch/marketing/lyta-logo-512.png`) — **important** :
     sur fond marine, prévoir une version **blanche ou jaune** du logo
     (pas la version coloré sur fond clair)

---

### Étape 5 — Envoyer 2 tests à toi-même (5 min)

**AVANT** l'envoi de masse :

1. Resend → **Test send** (bouton dans le broadcast)
2. Envoyer à 2-3 adresses test :
   - Ton email Gmail perso (test client populaire)
   - Ton email Outlook si tu en as un (test client corporate)
   - habib@lyta.ch (test client custom domain)
3. Vérifier :
   - ✅ Logo s'affiche sur le bandeau marine (sinon → revoir étape 1)
   - ✅ Le bandeau marine + le carton jaune avec le hook accrochent visuellement
   - ✅ Le bouton **JAUNE "Découvrir LYTA →"** est cliquable et ouvre la bonne LP
   - ✅ Le lien `support@lyta.ch` ouvre bien un nouveau mail
   - ✅ Le lien désabonnement marche (cliquer puis revenir)
   - ✅ Le rendu mobile est OK (vérifier sur ton smartphone)

**Si quelque chose ne va pas → corriger AVANT l'envoi de masse.** Tu as 88 contacts, tu ne pourras pas réenvoyer une 2e version sans griller la première.

---

### Étape 6 — Envoyer la campagne (1 min)

Heure recommandée : **mardi ou jeudi entre 9h30 et 11h30** Europe/Zurich.

Pourquoi : les courtiers traitent leurs emails du matin en début de journée.
Avant 9h30 = tu te fais doubler par les emails de la nuit. Après 11h30 = tu
tombes dans la liste "à voir après le déjeuner" qui ne reviendra jamais.

1. Resend → broadcast → **Send Now**
2. Confirmer
3. Tu vois en temps réel les envois partir

**Pas de "Send to all" si tu A/B test les subjects** : envoie d'abord à 30
contacts (split aléatoire avec subject A), 30 avec B, 30 avec C. Garde le
gagnant pour le scale futur.

---

### Étape 7 — Suivi quotidien (3-5 min/jour pendant 7 jours)

Resend → **Broadcasts** → ton broadcast → onglet **Insights**.

Tu vois en temps réel :

| Métrique | Comment l'interpréter |
|---|---|
| **Delivered** | Nombre d'emails arrivés. Cible : ≥ 95% |
| **Opened** | Cible 25-40% sur 88. Si < 15% → soit subject mauvais, soit ton IP/domaine spam |
| **Clicked** | Combien ont cliqué la démo. Cible 5-15% des ouvreurs |
| **Bounced** | Si > 5% → ta liste est mauvaise, nettoyer pour la prochaine fois |
| **Complained** | Si > 1 sur 88 → tu vas trop vite, ralentis. > 0.1% sur le total = Resend te ban |
| **Unsubscribed** | Si > 3 → ton ciblage est mauvais (les gens ne sont pas la bonne cible) |

**Important** : Resend ne suit pas automatiquement les réponses. Tu dois
checker ta boîte `support@lyta.ch` plusieurs fois par jour.

---

### Étape 8 — Relance ciblée J+5 (optionnel)

Si moins de 12 RDV pris à J+5, tu peux relancer **uniquement les non-ouvreurs**
avec un subject différent.

1. Resend → broadcast original → **Resend to non-openers**
2. Nouveau subject (exemple) : `J'ai oublié de te montrer ce détail`
3. Body raccourci : 3-4 phrases max, lien direct vers la vidéo

**Maximum 3 emails au total** par contact sur 2 semaines. Au-delà :
- LCD art. 3 al. 1 lit. o : harcèlement reconnu juridiquement
- Spam reports qui flinguent ta réputation Resend
- Ton produit perçu comme « insistant » → marque flinguée

---

## ⚠️ Risques à surveiller en temps réel

### 🔴 Si Resend te bloque
- Cause : trop de bounce / complaints sur 88
- Action : arrêter immédiatement, ouvrir ticket Resend, refaire la liste

### 🟡 Si taux d'ouverture < 10%
- Cause probable : subject mauvais ou ton domaine en spam
- Action : ne pas relancer, attendre, vérifier `mail-tester.com` puis re-stratégiser

### 🟡 Si > 5 désabonnements sur 88
- Cause : mauvais ciblage (ces gens ne sont pas la cible LYTA)
- Action : nettoyer la base, mieux qualifier la prochaine fois

### 🔴 Si plainte PFPDT
- Cause : un destinataire considère le mail spam selon LCD
- Action : répondre dans les 30 jours, démontrer intérêt légitime B2B,
  supprimer immédiatement de toute liste

---

## 📞 Et les 88 numéros de téléphone alors ?

Tu m'avais mentionné aussi **88 numéros**. Quelques options pour les utiliser
**après** la campagne email :

| Option | Quand | Légalité Suisse |
|---|---|---|
| **Cold call** des non-ouvreurs J+10 | Relais email → tel après non-ouverture | ✅ B2B OK si numéro pro (LCD art. 3 lit. u — opt-out registre tél possible mais B2B exempté pour entreprise) |
| **SMS personnalisé** depuis Twilio | "Habib de LYTA, je t'ai envoyé un mail, dispo 5 min ?" | ⚠️ SMS = traité comme email opt-in nécessaire — éviter sauf si contact a déjà répondu/cliqué |
| **WhatsApp Business** | Pareil que SMS mais via WhatsApp | ⚠️ Même règle |

**Mon conseil** : commence par l'email (88 contacts, ~5-8 RDV espérés). Pour
les ~80 non-réponses, appelle physiquement les 15-20 contacts les plus
intéressants (cabinets avec ≥ 3 collaborateurs, déjà sur LinkedIn LYTA, etc.).

---

## 📋 Checklist finale avant envoi

- [ ] Logo PNG hébergé OU bloc texte activé dans le HTML
- [ ] Domaine Resend lyta.ch vérifié (3-4 DNS verts)
- [ ] CSV 88 contacts uploadé en UTF-8 sans Gmail/perso
- [ ] Broadcast créé avec template HTML + subject choisi
- [ ] Tests envoyés à 2-3 adresses → tout OK
- [ ] LP `lyta.ch/lancement` testée (vidéo joue, formulaire marche)
- [ ] Heure d'envoi : mardi/jeudi 9h30-11h30
- [ ] Boîte `support@lyta.ch` accessible pour traiter les réponses dans les 24h

---

*Document généré le 10 juin 2026. À garder comme référence pour les prochaines campagnes.*

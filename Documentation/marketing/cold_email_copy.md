# LYTA — Cold email copy (campagne lancement juin 2026)

> **Version** 1.0 — 10 juin 2026
> **Audience** 88 courtiers / cabinets pros suisses avec emails nominatifs
> **Sender** `hello@lyta.ch` (display name : "Habib Agharbi — LYTA")
> **Objet** Lancement LYTA — démonstration produit + LP avec vidéo
> **Outil d'envoi** Resend Broadcasts (https://resend.com/broadcasts)

---

## 🎯 Subject lines — 3 variantes pour A/B test

Pour 88 contacts, je recommande de **tester 2-3 subjects sur 30 contacts chacun**, garder le meilleur pour le reste.

### Variante A — Humaine, signée

```
Habib d'Optimislink — un outil pensé pour ton cabinet
```

**Pourquoi ça marche** : prénom expéditeur + "ton cabinet" = personnel. Pas de clickbait. Donne envie d'ouvrir par curiosité.

**Inconvénient** : si Habib n'est pas connu de la cible, "Habib d'Optimislink" peut être ignoré.

---

### Variante B — Value proposition directe

```
LYTA — 2h/jour gagnées sur les mandats et le dispatch
```

**Pourquoi ça marche** : promesse chiffrée concrète. Le courtier sait en 2 secondes ce qu'il gagne à ouvrir.

**Inconvénient** : "2h/jour" peut sembler exagéré ou trop marketing.

---

### Variante C — Curiosité + social proof

```
{{first_name}}, comment des cabinets suisses gagnent 2h/jour
```

**Pourquoi ça marche** : personnalisation prénom + social proof ("d'autres l'utilisent") + bénéfice chiffré. Triple combo.

**Inconvénient** : si la perso `{{first_name}}` ne se résout pas (CSV incomplet), apparaît littéralement "{{first_name}}, …" — désastreux. À tester avant envoi.

---

### Ma recommandation pour 88 contacts

- **Test A/B/C sur 30 contacts chacun (90 total ≈ tes 88)** : split aléatoire
- Ou si tu préfères pas tester, **va sur la Variante A** (la plus safe et humaine pour un cold)

---

## 📝 Body — texte plein (fallback si HTML bloqué)

**Resend Broadcasts** envoie automatiquement une version texte alternative à partir du HTML. Mais pour les clients qui forcent le mode texte (très rare aujourd'hui), voici la version plain :

```
Bonjour {{first_name}},

Je suis Habib, fondateur de LYTA — la nouvelle plateforme CRM pensée pour
les cabinets de courtage suisses.

On a construit LYTA en partant d'un constat simple : entre la rédaction du
mandat de gestion, le scan des polices, le dispatch aux compagnies, les
commissions à calculer et l'espace client à animer, un courtier passe 2 à 3
heures par jour sur de l'administratif.

LYTA automatise tout ça : mandat signé à distance en 5 minutes, dispatch
automatique aux compagnies, IA qui lit les polices et décomptes, espace
client branding cabinet, calcul des commissions et rétrocessions,
conformité nLPD.

{{first_name}}, j'ai préparé une vidéo de présentation de 4 minutes où je
te montre concrètement comment ça marche chez les cabinets qui l'utilisent.

→ Voir la démo : https://lyta.ch/lancement

Si ça ne t'intéresse pas du tout, réponds-moi juste « non merci » et je ne
reviens pas vers toi.

Si tu veux qu'on en parle 15 minutes au téléphone, mon numéro est
+41 78 212 23 60.

Au plaisir d'échanger,

Habib Agharbi
Fondateur, Optimislink Sàrl — Éditeur LYTA
hello@lyta.ch · lyta.ch

---

Vous recevez ce message car votre cabinet de courtage est référencé
publiquement comme acteur suisse de l'assurance. Vos coordonnées sont
utilisées uniquement pour ce message et ne seront pas partagées avec un
tiers.

Se désabonner : {{RESEND_UNSUBSCRIBE_URL}}

Optimislink Sàrl · Place de la Fontaine 9, 1868 Collombey, Suisse
IDE CHE-229.220.256 · RC Valais CH-621.4.012.418-8
```

---

## 🔧 Variables Resend Broadcasts à mapper depuis le CSV

Quand tu uploades le CSV des 88 contacts dans Resend Audiences, les colonnes
doivent être exactement nommées :

| Colonne CSV | Variable Resend | Utilisation |
|---|---|---|
| `email` | `{{email}}` | Destinataire (obligatoire) |
| `first_name` | `{{first_name}}` | Personnalisation prénom |
| `last_name` | `{{last_name}}` | (optionnel) |
| `company` | `{{company}}` | Nom du cabinet (optionnel, pas utilisé dans la v1 du template) |

`{{RESEND_UNSUBSCRIBE_URL}}` est généré automatiquement par Resend, ne pas le
mettre dans le CSV.

---

## ⚠️ Avant d'envoyer — checklist

- [ ] Domaine `lyta.ch` configuré dans Resend (SPF + DKIM + DMARC vérifiés en vert)
- [ ] Logo PNG accessible sur `https://app.lyta.ch/marketing/lyta-logo-512.png`
       (ou alternative texte activée dans le template HTML — voir commentaire dedans)
- [ ] LP `https://lyta.ch/lancement` en ligne avec vidéo + formulaire
- [ ] CSV des 88 contacts nettoyé (1 email par ligne, prénom rempli partout)
- [ ] Test envoyé à toi-même + 1-2 collègues avant le mass send
- [ ] Subject testé sur 30 contacts d'abord si A/B
- [ ] Heure d'envoi : **mardi ou jeudi entre 9h30 et 11h30** (Suisse, taux d'ouverture max)
- [ ] **Pas de vendredi après-midi ni weekend** (Suisse + courtiers en RDV)

---

## 📊 Métriques cibles pour cette campagne

Pour une **première campagne cold B2B suisse** avec template de qualité et liste qualifiée :

| Métrique | Cible réaliste | Bench cold B2B |
|---|---|---|
| Délivrabilité (delivered/sent) | ≥ 95% | 95-98% |
| Taux d'ouverture (opened/delivered) | 25-40% | 20-30% |
| Taux de clic (clicked/opened) | 5-15% | 3-10% |
| Taux de réponse (replied) | 5-12% | 2-5% |
| Désabonnement | < 2% | 1-3% |
| Bounce | < 5% | 2-5% |
| Complaint (spam reports) | **< 0.1%** | < 0.1% (Resend ban si dépassé) |

Sur 88 contacts, ça veut dire :
- **22-35 ouvertures**
- **3-13 clics sur la démo**
- **4-10 réponses** (positives ou négatives)

Si tu obtiens **5-8 RDV qualifiés** sur cette première vague, c'est un succès.

---

## 🎬 Et après ?

- **Relance J+5** : aux non-ouvreurs uniquement (Resend Broadcasts permet ce ciblage). Subject différent ("J'ai oublié de te montrer ce détail…"), copy raccourci.
- **Relance J+10** : aux ouvreurs sans clic. Question directe : "Tu as eu le temps de voir la vidéo ?"
- **Pas plus de 3 emails au total** par contact. Au-delà = grilling LCD.

Si la campagne marche bien, on industrialise (module Cold Outreach dans le CRM,
audience persistante, scoring, etc.).

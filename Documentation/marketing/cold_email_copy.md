# LYTA — Cold email copy (campagne lancement juin 2026)

> **Version** finale (v9) — 10 juin 2026
> **Audience** 88 courtiers / cabinets pros suisses (emails seuls, pas de prénom/nom)
> **Sender** `support@lyta.ch` (display name : "Habib Agharbi — LYTA")
> **Outil d'envoi** Resend Broadcasts (https://resend.com/broadcasts)
> **Positionnement** Problème → solution (pas vente directe, pas démo, pas café)

---

## 🎯 Subject final

```
Et si ton CRM datait des années 2000 ?
```

Question directe qui parle à la majorité des cabinets suisses (encore sur Outlook + Excel ou logiciels legacy). Ouvre par curiosité défensive ("Mais non… enfin si peut-être").

### Alternatives validées pour A/B test si tu veux tester

| # | Subject | Vibe |
|---|---|---|
| **A** | Et si ton CRM datait des années 2000 ? | Direct, recommandé (utilisé en preview) |
| **B** | Ton CRM te fait perdre 2h par jour ? | Promesse chiffrée |
| **C** | Il est temps de changer de CRM | Affirmatif, urgence |
| **D** | LYTA — le CRM courtage qui ne rame pas | Met le produit + bénéfice |

---

## 📝 Body — texte plain (fallback si HTML bloqué)

Resend envoie automatiquement une version texte du HTML. Pour les rares clients qui forcent le mode plain :

```
Bonjour,

LYTA, c'est un CRM suisse pensé pour le courtage en assurance. Pas une
usine à gaz. Pas un outil qui te demande 3 clics pour ouvrir une fiche
client.

Mandats signés à distance, dispatch automatique aux compagnies, scan IA
des polices et décomptes, espace client à ton image, calcul des
commissions et rétrocessions, espace conformité nLPD. Tout dans la même
interface, conçue en 2026, pour 2026.

15 minutes suffisent pour que je te montre tout. Visio ou un vrai café
si tu es près de Collombey, Lausanne ou Genève. Tu regardes, tu me dis
ce qui marche, ce qui cloche, ce qui manque. Ça m'aide à construire le
bon outil.

Découvrir LYTA : https://lyta.ch/lancement
(90 secondes sur le site, formulaire en bas, je te rappelle.)

Tu réponds direct : support@lyta.ch

Pas intéressé ? Un mot suffit. Je n'insiste pas.

Habib Agharbi
Fondateur · Optimislink Sàrl · Édite LYTA
support@lyta.ch · lyta.ch

---

Vous recevez ce message car votre cabinet est référencé publiquement
comme acteur suisse de l'assurance.

Se désabonner : {{RESEND_UNSUBSCRIBE_URL}}

Optimislink Sàrl · Place de la Fontaine 9, 1868 Collombey, Suisse
IDE CHE-229.220.256 · RC Valais CH-621.4.012.418-8
```

---

## 🎨 Design final (palette validée v9)

```
JAUNE LYTA      #FEB000        Hook bandeau, bouton CTA, badges, accents
Jaune éclat     #FFD54F        Top du dégradé hook + CTA
Jaune cuivré    #F59E0B        Bottom du dégradé hook
Marine foncé    #0F172A        Header bandeau, contrastes, liens, hook texte
Marine clair    #1E293B        Dégradés marine
Blanc / gris    #FFFFFF / #f8fafc    Body
```

**Structure visuelle** (de haut en bas) :
1. Bandeau **MARINE** (header avec logo + badge jaune "Édition lancement")
2. Bandeau **JAUNE** (hook accroche problème → solution + badge marine "Il est temps de passer à LYTA")
3. Body blanc (4 paragraphes secs)
4. **Bouton JAUNE** géant (texte marine, ombre lumineuse)
5. Séparateur "OU"
6. CTA secondaire (mailto support@lyta.ch)
7. Signature avec filet marine + liens marine

---

## 📊 Variables Resend Broadcasts

```
{{RESEND_UNSUBSCRIBE_URL}}    auto-généré par Resend
```

C'est tout. **Aucune autre variable** (pas de prénom, pas de nom de cabinet — le CSV des 88 contacts est limité aux emails).

---

## 📁 CSV à uploader dans Resend Audiences

Format minimaliste :

```csv
email
contact@cabinet-1.ch
info@cabinet-2.ch
direction@cabinet-3.ch
...
(88 lignes total)
```

**Une seule colonne**, encodage UTF-8, pas de ligne vide en fin de fichier.

---

## ⚠️ Avant d'envoyer — checklist

- [ ] Domaine `lyta.ch` configuré dans Resend (SPF + DKIM + DMARC vérifiés en vert)
- [ ] Logo PNG accessible sur `https://app.lyta.ch/marketing/lyta-logo-512.png` — sur fond marine, prévoir une version **blanche ou jaune** du logo
- [ ] LP `https://lyta.ch/lancement` en ligne avec vidéo + formulaire
- [ ] CSV des 88 contacts nettoyé (1 email par ligne, UTF-8, pas de Gmail/Hotmail perso)
- [ ] Test envoyé à toi-même + 1-2 collègues avant le mass send
- [ ] Heure d'envoi : **mardi ou jeudi entre 9h30 et 11h30** (Suisse, taux d'ouverture max)
- [ ] **Pas de vendredi après-midi ni weekend**

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
- **3-13 clics sur la LP**
- **4-10 réponses** (positives ou négatives)
- **5-8 RDV qualifiés** si succès

---

## 🎬 Et après ?

- **Relance J+5** : aux non-ouvreurs uniquement (Resend Broadcasts permet ce ciblage). Subject différent ("J'ai oublié de te montrer quelque chose…"), copy raccourci.
- **Relance J+10** : aux ouvreurs sans clic. Question directe : "Tu as eu le temps de jeter un œil ?"
- **Maximum 3 emails au total** par contact. Au-delà = LCD art. 3 al. 1 lit. o (harcèlement).

Si la campagne marche bien, on industrialise (module Cold Outreach dans le CRM,
audience persistante, scoring, A/B test, etc.).

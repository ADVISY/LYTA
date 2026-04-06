# LYTA CRM

Application SaaS multi-tenant pour cabinets de courtage en assurances, construite avec Vite, React, TypeScript, Tailwind et Supabase.

## Demarrage local

Pre-requis:

- Node.js 20+
- npm 10+

Commandes:

```sh
npm install
npm run dev
```

Build de verification:

```sh
npm run build
```

## Variables d'environnement frontend

Le build Vite attend au minimum:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Compatibilite legacy:

- `VITE_SUPABASE_ANON_KEY` reste accepte comme alias si l'environnement utilise encore cet ancien nom.

Les secrets Stripe, Twilio, Resend et les variables des Edge Functions sont geres dans Supabase, pas dans Vercel.

## Deploiement Vercel

Le projet deployable est le dossier `app/`.

Configuration recommandee:

- Framework: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Le fichier `vercel.json` du depot contient deja cette configuration.

## Sous-domaines tenant

Le wizard KING peut maintenant provisionner automatiquement chaque sous-domaine tenant sur Vercel et Cloudflare.

Secrets requis dans les Edge Functions Supabase:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID` (ou `VERCEL_TEAM_SLUG`)
- `ALLOWED_ORIGINS` avec au moins le domaine principal et le wildcard tenant

Variables optionnelles:

- `TENANT_DOMAIN_SUFFIX=lyta.ch`
- `TENANT_CNAME_TARGET=cname.vercel-dns.com` (fallback seulement)
- `TENANT_CNAME_PROXIED=false`

Exemple recommande pour `ALLOWED_ORIGINS`:

- `https://lyta.ch,https://app.lyta.ch,https://*.lyta.ch,http://localhost:5173`

Flux automatique:

- l'edge function ajoute `tenant.lyta.ch` au projet Vercel
- elle recupere la cible CNAME recommandee par Vercel
- elle cree ou met a jour le record Cloudflare
- elle cree les TXT de verification Vercel si necessaire
- elle relance la verification jusqu'a validation ou timeout

Le mode wildcard `*.lyta.ch` n'est pas utilise ici. Chaque sous-domaine tenant est enregistre individuellement sur Vercel, ce qui reste compatible avec Cloudflare comme DNS autoritaire.

## Notes d'exploitation

- Les Edge Functions Supabase utilisent un gateway IA compatible OpenAI configurable via `AI_GATEWAY_API_KEY`, `AI_GATEWAY_URL` et `AI_MODEL`.
- `LOVABLE_API_KEY` reste accepte en fallback pour compatibilite si la migration des secrets n'est pas encore terminee.

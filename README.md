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
- `VITE_SUPABASE_ANON_KEY`

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

Pour les tenants `*.lyta.ch`, le flux d'onboarding DNS suppose un CNAME vers Vercel:

- `TENANT_CNAME_TARGET=cname.vercel-dns.com`
- `TENANT_CNAME_PROXIED=false`

Le domaine doit aussi etre ajoute dans le projet Vercel principal avant validation DNS.

## Notes d'exploitation

- Les Edge Functions Supabase utilisent un gateway IA compatible OpenAI configurable via `AI_GATEWAY_API_KEY`, `AI_GATEWAY_URL` et `AI_MODEL`.
- `LOVABLE_API_KEY` reste accepte en fallback pour compatibilite si la migration des secrets n'est pas encore terminee.

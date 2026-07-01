# Tests pgTAP — RLS cross-tenant

Ces tests garantissent qu'un utilisateur du tenant A ne peut PAS voir /
insérer / modifier les données du tenant B, quelle que soit son rôle.

## Pourquoi

Sans tests automatisés, chaque migration RLS est un pari : on croit que
la policy est bonne, mais 3 mois plus tard un fix perf ou un helper
modifié peut casser silencieusement la séparation multi-tenant et laisser
fuiter des données entre cabinets. En SaaS assurance CH (LPD/RGPD/FINMA),
un leak cross-tenant = mort commerciale.

Ces tests bloquent le merge d'une PR qui introduirait un tel risque.

## Structure

```
supabase/tests/
├── README.md                              ← ce fichier
├── _fixtures.sql                          ← seeds partagés (2 tenants + users)
├── rls_clients_cross_tenant.test.sql      ← isolation clients
└── rls_documents_visible_to_client.test.sql ← visible_to_client (juin 2026)
```

Chaque `*.test.sql` :
1. Inclut `_fixtures.sql` pour setup 2 tenants + 4 users
2. `SELECT plan(N)` déclare N assertions
3. `SET LOCAL role`, `SET LOCAL request.jwt.claims` pour simuler chaque user
4. `SELECT ok(...) / is(...) / throws_ok(...)` pour asserter
5. `SELECT * FROM finish()` puis `ROLLBACK` — aucune data ne persiste

## Lancer les tests

### Local (via Docker)

```bash
# Démarrer la stack Supabase locale
supabase start

# Lancer tous les tests pgTAP
supabase test db

# Un fichier précis
supabase test db supabase/tests/rls_clients_cross_tenant.test.sql
```

Le CLI installe automatiquement l'extension pgTAP au premier run.

### CI (GitHub Actions — à venir)

Un workflow `.github/workflows/pgtap.yml` à créer dans une prochaine session
lancera les tests à chaque PR contre `supabase/migrations/` ou `supabase/tests/`.

## Ajouter un test

1. Copier un fichier existant comme squelette
2. `SELECT plan(X)` avec X = nombre d'assertions
3. Setup les users simulés via `_fixtures.sql`
4. `SET LOCAL "request.jwt.claims"` pour changer d'identité
5. Assert avec `is()`, `ok()`, `throws_ok()`

## Convention JWT claims

Pour simuler un utilisateur authentifié Supabase :

```sql
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = jsonb_build_object(
  'sub', '<user_uuid>',
  'role', 'authenticated',
  'aal', 'aal1'
)::text;
```

Après ce SET, `auth.uid()` retourne `<user_uuid>` et toutes les policies
RLS s'évaluent comme si cet utilisateur avait fait la requête.

Pour tester en tant que `service_role` (bypass RLS totale) :

```sql
SET LOCAL role = service_role;
```

Pour repasser en `anon` :

```sql
SET LOCAL role = anon;
RESET "request.jwt.claims";
```

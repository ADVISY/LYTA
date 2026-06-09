-- ============================================================================
-- clients_business_fields
-- ============================================================================
-- Ajoute à public.clients les champs spécifiques aux clients PRO (entreprises),
-- pour rendre possible la génération d'un mandat de gestion adapté.
--
-- Contexte (demande Sammuel / cabinet Advisy juin 2026) :
-- Aujourd'hui la table clients a déjà `is_company BOOLEAN` + `company_name TEXT`
-- mais aucun champ juridique pour une entité morale (IDE, registre du commerce,
-- représentant légal). Le mandat de gestion actuel est calibré particulier
-- (date de naissance, nationalité, permis…) ET propose des branches privées
-- (RC ménage, auto, 3e pilier).
--
-- Cette migration :
--   1. Ajoute les champs entreprise sur `clients`
--   2. N'impacte AUCUN client existant (toutes les colonnes nullable,
--      defaults vides)
--   3. Permet à MandatTemplate de basculer en mode "pro" quand
--      is_company=true et que les champs sont renseignés
--
-- Aucun trigger, aucune RLS à modifier — ces colonnes héritent des policies
-- existantes sur `clients`.
-- ============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ide                    TEXT,
  ADD COLUMN IF NOT EXISTS rc_canton              TEXT,
  ADD COLUMN IF NOT EXISTS rc_number              TEXT,
  ADD COLUMN IF NOT EXISTS legal_rep_first_name   TEXT,
  ADD COLUMN IF NOT EXISTS legal_rep_last_name    TEXT,
  ADD COLUMN IF NOT EXISTS legal_rep_function     TEXT,
  ADD COLUMN IF NOT EXISTS signature_power        TEXT
    CHECK (signature_power IN ('individual', 'collective_2'))
    DEFAULT 'individual';

COMMENT ON COLUMN public.clients.ide IS
  'Numéro IDE suisse de l''entreprise (format CHE-XXX.XXX.XXX). Renseigné uniquement si is_company=true.';

COMMENT ON COLUMN public.clients.rc_canton IS
  'Canton du Registre du commerce où l''entreprise est inscrite (ex: VD, GE, ZH).';

COMMENT ON COLUMN public.clients.rc_number IS
  'Numéro d''inscription au Registre du commerce du canton.';

COMMENT ON COLUMN public.clients.legal_rep_first_name IS
  'Prénom du représentant légal autorisé à signer pour l''entreprise.';

COMMENT ON COLUMN public.clients.legal_rep_last_name IS
  'Nom du représentant légal autorisé à signer pour l''entreprise.';

COMMENT ON COLUMN public.clients.legal_rep_function IS
  'Fonction du représentant légal (ex: Administrateur unique, Directeur, Gérant, Président).';

COMMENT ON COLUMN public.clients.signature_power IS
  'Pouvoir de signature inscrit au RC : individuel (1 signataire suffit) ou collectif à 2 (2 signataires requis). Détermine si le flow mandat doit collecter 1 ou 2 signatures.';

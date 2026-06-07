-- ============================================================================
-- signature_requests : ajout colonne signature_zone (coords normalisées)
-- ============================================================================
-- Permet au broker de définir EXACTEMENT où la signature doit s'incruster
-- sur le PDF, plutôt que d'utiliser un picker 3×3 (top/middle/bottom ×
-- left/center/right) côté signataire.
--
-- Format jsonb :
--   { "page": 1, "x": 0.65, "y": 0.85, "width": 0.25, "height": 0.08 }
-- Coordonnées normalisées 0-1 par rapport à la page entière. La conversion
-- en coordonnées PDF natives (pdf-lib origine bottom-left) se fait côté
-- generateSignedPdfBase64 dans Signer.tsx au moment de l'incrustation.
-- ============================================================================

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS signature_zone jsonb;

COMMENT ON COLUMN public.signature_requests.signature_zone IS
'Zone de signature definie par le broker : {page, x, y, width, height} normalises 0-1. NULL = pas de zone (fallback picker 3x3 cote signataire).';

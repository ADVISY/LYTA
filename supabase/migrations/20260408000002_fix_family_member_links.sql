ALTER TABLE public.family_members
ADD COLUMN IF NOT EXISTS linked_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.family_members
DROP CONSTRAINT IF EXISTS family_members_relation_type_check;

ALTER TABLE public.family_members
ADD CONSTRAINT family_members_relation_type_check
CHECK (relation_type IN ('conjoint', 'enfant', 'parent', 'autre'));

CREATE INDEX IF NOT EXISTS idx_family_members_linked_client_id
ON public.family_members(linked_client_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'family_members'
      AND policyname = 'Users can view family members of linked accessible clients'
  ) THEN
    CREATE POLICY "Users can view family members of linked accessible clients"
    ON public.family_members
    FOR SELECT
    TO authenticated
    USING (
      linked_client_id IS NOT NULL
      AND public.can_access_client(linked_client_id)
    );
  END IF;
END $$;

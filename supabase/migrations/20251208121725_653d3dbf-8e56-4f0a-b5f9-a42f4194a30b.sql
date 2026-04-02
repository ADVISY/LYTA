-- 1. Fix storage policies to restrict access by ownership
-- First, drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;

-- Create secure policies based on folder structure (user_id/filename)
-- Users can only access their own documents folder
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND (
    -- Admins can view all documents
    public.has_role(auth.uid(), 'admin') OR
    -- Users can view documents in their folder
    auth.uid()::text = (storage.foldername(name))[1] OR
    -- Users can view documents they created (via documents table)
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_key = name AND d.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND (
    -- Admins can upload anywhere
    public.has_role(auth.uid(), 'admin') OR
    -- Users upload to their own folder
    auth.uid()::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND (
    -- Admins can update any document
    public.has_role(auth.uid(), 'admin') OR
    -- Users can update documents in their folder
    auth.uid()::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND (
    -- Admins can delete any document
    public.has_role(auth.uid(), 'admin') OR
    -- Users can delete documents in their folder
    auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- 2. Create a secure view for clients that excludes IBAN for non-admin/compta roles
CREATE OR REPLACE VIEW public.clients_safe AS
SELECT 
  id,
  user_id,
  external_ref,
  first_name,
  last_name,
  email,
  phone,
  mobile,
  address,
  city,
  postal_code,
  zip_code,
  canton,
  country,
  birthdate,
  civil_status,
  nationality,
  permit_type,
  profession,
  employer,
  company_name,
  is_company,
  status,
  tags,
  type_adresse,
  assigned_agent_id,
  manager_id,
  commission_rate,
  commission_rate_lca,
  commission_rate_vie,
  manager_commission_rate_lca,
  manager_commission_rate_vie,
  fixed_salary,
  bonus_rate,
  reserve_rate,
  work_percentage,
  hire_date,
  contract_type,
  created_at,
  updated_at,
  -- Only show IBAN and bank_name to admin and compta roles
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compta')
    THEN iban
    ELSE NULL
  END as iban,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compta')
    THEN bank_name
    ELSE NULL
  END as bank_name
FROM public.clients;

-- Grant access to the view
GRANT SELECT ON public.clients_safe TO authenticated;

-- 3. Add rate limiting tracking table for AI chat
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  ip_address text,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_session ON public.ai_rate_limits(session_id, window_start);
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_ip ON public.ai_rate_limits(ip_address, window_start);

-- Enable RLS
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow public insert/update for rate limiting (needed by edge function)
CREATE POLICY "Allow rate limit tracking"
ON public.ai_rate_limits FOR ALL
USING (true)
WITH CHECK (true);

-- Function to clean old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_rate_limits 
  WHERE window_start < now() - interval '1 hour';
END;
$$;
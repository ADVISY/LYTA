-- Allow public uploads to the ia-scans folder in the documents bucket
-- This is needed for the public DeposerContrat page where users upload documents without authentication

-- First, check if the documents bucket exists, if not create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public uploads to ia-scans folder (for the public deposit contract form)
CREATE POLICY "Allow public uploads to ia-scans folder"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'ia-scans'
);

-- Policy: Allow the service role and authenticated users to read ia-scans files
CREATE POLICY "Allow reading ia-scans files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'ia-scans'
);
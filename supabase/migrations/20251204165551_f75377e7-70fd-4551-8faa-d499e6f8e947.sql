-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- RLS policies for documents bucket
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);
-- Allow public uploads to documents bucket for contract deposits
-- Files will be uploaded to a 'public-deposits/' folder

CREATE POLICY "Allow public uploads for contract deposits"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'public-deposits'
);

-- Allow public to read files they just uploaded (needed for verification)
CREATE POLICY "Allow public read on public-deposits"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'public-deposits'
);
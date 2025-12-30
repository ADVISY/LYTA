-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view tenant logos (public bucket)
CREATE POLICY "Anyone can view tenant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- Allow authenticated users with king role to upload logos
CREATE POLICY "Kings can upload tenant logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'king'
  )
);

-- Allow kings to update logos
CREATE POLICY "Kings can update tenant logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'king'
  )
);

-- Allow kings to delete logos
CREATE POLICY "Kings can delete tenant logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'king'
  )
);
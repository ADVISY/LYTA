-- Add contract notification emails field to tenants table
ALTER TABLE public.tenants 
ADD COLUMN contract_notification_emails text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.contract_notification_emails IS 'Liste des emails qui reçoivent les notifications lors du dépôt d''un contrat';
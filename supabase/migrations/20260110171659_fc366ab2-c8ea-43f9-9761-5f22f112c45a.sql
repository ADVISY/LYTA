
-- Fix overly permissive RLS policies for king_notifications and king_audit_logs
-- These tables should only be writable by service role (edge functions) or KING users

-- Drop the too-permissive policies
DROP POLICY IF EXISTS "Service role can insert king_notifications" ON public.king_notifications;
DROP POLICY IF EXISTS "Service role can insert king_audit_logs" ON public.king_audit_logs;
DROP POLICY IF EXISTS "King can insert notifications" ON public.king_notifications;
DROP POLICY IF EXISTS "King can insert audit logs" ON public.king_audit_logs;

-- Create proper policies that check for KING role or use SECURITY DEFINER functions
-- The create_king_notification and log_king_action functions are SECURITY DEFINER so they bypass RLS
-- We don't need INSERT policies for client-side - all inserts go through the SECURITY DEFINER functions

-- For edge functions using service role, they bypass RLS entirely
-- So we only need policies for KING users doing direct inserts (which should not happen - use functions instead)

-- Fix: email_templates has RLS enabled but zero policies.
-- Add SELECT/INSERT/UPDATE/DELETE policies matching the pattern used for
-- plans, payments, members, etc.

CREATE POLICY "Users can view email templates in their org"
  ON email_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert email templates in their org"
  ON email_templates FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update email templates in their org"
  ON email_templates FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete email templates in their org"
  ON email_templates FOR DELETE
  USING (organization_id = get_user_organization_id());

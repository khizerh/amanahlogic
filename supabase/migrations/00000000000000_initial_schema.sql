-- =============================================================================
-- Initial Schema
-- Complete database schema for burial benefits membership system
-- =============================================================================

-- =============================================================================
-- Shared trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Organizations
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  address jsonb NOT NULL DEFAULT '{}',
  phone text,
  email text,
  timezone text DEFAULT 'America/Los_Angeles',
  stripe_connect_id text,
  stripe_onboarded boolean DEFAULT false,
  platform_fee numeric(10,2) DEFAULT 0,
  pass_fees_to_member boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organizations IS 'Multi-tenant organizations for burial benefits programs';
COMMENT ON COLUMN organizations.address IS 'JSON object: {street, city, state, zip}';
COMMENT ON COLUMN organizations.platform_fee IS 'Flat dollar amount added to each transaction';
COMMENT ON COLUMN organizations.pass_fees_to_member IS 'If true, gross-up charges so members pay processing fees and org receives the base amount.';

-- =============================================================================
-- Plans
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('single', 'married', 'widow')),
  name text NOT NULL,
  description text,
  pricing jsonb NOT NULL DEFAULT '{"monthly": 0, "biannual": 0, "annual": 0}',
  enrollment_fee numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_organization_id ON plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_plans_type ON plans(type);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active) WHERE is_active = true;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE plans IS 'Membership plan types with pricing for each billing frequency';
COMMENT ON COLUMN plans.pricing IS 'JSON object: {monthly: number, biannual: number, annual: number}';
COMMENT ON COLUMN plans.type IS 'Plan category: single, married, or widow';

-- =============================================================================
-- Members
-- =============================================================================

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address jsonb NOT NULL DEFAULT '{}',
  spouse_name text,
  children jsonb DEFAULT '[]',
  emergency_contact jsonb NOT NULL DEFAULT '{"name": "", "phone": ""}',
  preferred_language text DEFAULT 'en' CHECK (preferred_language IN ('en', 'fa')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_members_organization_id ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_members_search ON members
  USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email));

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE members IS 'Member contact information and household details';
COMMENT ON COLUMN members.address IS 'JSON object: {street, city, state, zip}';
COMMENT ON COLUMN members.children IS 'JSON array: [{id, name, dateOfBirth}]';
COMMENT ON COLUMN members.emergency_contact IS 'JSON object: {name, phone}';
COMMENT ON COLUMN members.preferred_language IS 'en = English, fa = Farsi';

-- =============================================================================
-- Memberships
-- =============================================================================

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'current',
    'lapsed',
    'cancelled'
  )),
  billing_frequency text NOT NULL DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly', 'biannual', 'annual')),
  billing_anniversary_day int CHECK (billing_anniversary_day BETWEEN 1 AND 28),
  paid_months int DEFAULT 0,
  enrollment_fee_paid boolean DEFAULT false,
  join_date date,
  last_payment_date date,
  next_payment_due date,
  eligible_date date,
  cancelled_date date,
  agreement_signed_at timestamptz,
  agreement_id uuid,
  auto_pay_enabled boolean DEFAULT false,
  stripe_subscription_id text,
  stripe_customer_id text,
  subscription_status text CHECK (subscription_status IN ('active', 'paused', 'canceled', 'past_due')),
  payment_method jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_organization_id ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_next_payment_due ON memberships(next_payment_due)
  WHERE next_payment_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_paid_months ON memberships(paid_months);
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_subscription_id ON memberships(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_customer_id ON memberships(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE memberships IS 'Member subscription to a plan with payment tracking';
COMMENT ON COLUMN memberships.status IS 'pending = onboarding, current = good standing, lapsed = missed payments, cancelled = void';
COMMENT ON COLUMN memberships.paid_months IS 'Total months paid towards eligibility (60 months required)';
COMMENT ON COLUMN memberships.billing_anniversary_day IS 'Day of month (1-28) when billing occurs';
COMMENT ON COLUMN memberships.payment_method IS 'JSON: {type, last4, brand?, bankName?, expiryMonth?, expiryYear?}';

-- =============================================================================
-- Payments
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('enrollment_fee', 'dues', 'back_dues')),
  method text CHECK (method IN ('card', 'ach', 'cash', 'check', 'zelle')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  amount numeric(10,2) NOT NULL,
  stripe_fee numeric(10,2) DEFAULT 0,
  platform_fee numeric(10,2) DEFAULT 0,
  total_charged numeric(10,2) NOT NULL,
  net_amount numeric(10,2) NOT NULL,
  months_credited int DEFAULT 0,
  invoice_number text,
  due_date date,
  period_start date,
  period_end date,
  period_label text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_invoice_id text,
  check_number text,
  zelle_transaction_id text,
  notes text,
  recorded_by text,
  reminder_count int DEFAULT 0,
  reminder_sent_at timestamptz,
  reminders_paused boolean DEFAULT false,
  requires_review boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_membership_id ON payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON payments(invoice_number)
  WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_pending_reminders ON payments(due_date, reminder_count)
  WHERE status = 'pending' AND reminders_paused = false;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payments IS 'Payment records for enrollment fees and membership dues';
COMMENT ON COLUMN payments.type IS 'enrollment_fee, dues, or back_dues';
COMMENT ON COLUMN payments.months_credited IS 'Number of membership months this payment credits';
COMMENT ON COLUMN payments.net_amount IS 'Amount org receives after fees: amount - platform_fee';

-- =============================================================================
-- Agreements
-- =============================================================================

CREATE TABLE IF NOT EXISTS agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  template_version text NOT NULL,
  pdf_url text,
  signature_image_url text,
  signed_name text,
  ip_address text,
  user_agent text,
  consent_checked boolean DEFAULT false,
  sent_at timestamptz NOT NULL,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreements_organization_id ON agreements(organization_id);
CREATE INDEX IF NOT EXISTS idx_agreements_membership_id ON agreements(membership_id);
CREATE INDEX IF NOT EXISTS idx_agreements_member_id ON agreements(member_id);
CREATE INDEX IF NOT EXISTS idx_agreements_signed_at ON agreements(signed_at) WHERE signed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agreements_template_version ON agreements(template_version);

COMMENT ON TABLE agreements IS 'E-signature records for membership agreements';

-- =============================================================================
-- Agreement Signing Links
-- =============================================================================

CREATE TABLE IF NOT EXISTS agreement_signing_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreement_signing_links_token ON agreement_signing_links(token);
CREATE INDEX idx_agreement_signing_links_agreement_id ON agreement_signing_links(agreement_id);

-- Storage bucket for signed PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-agreements', 'signed-agreements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY signed_agreements_service_upload ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'signed-agreements');

CREATE POLICY signed_agreements_org_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signed-agreements'
    AND (storage.foldername(name))[1] = current_setting('app.organization_id', true)
  );

-- =============================================================================
-- Email Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  member_name text NOT NULL,
  member_email text NOT NULL,
  template_type text NOT NULL,
  "to" text NOT NULL,
  subject text NOT NULL,
  body_preview text,
  language text DEFAULT 'en',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text,
  resend_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_organization_id ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_member_id ON email_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON email_logs(template_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_id) WHERE resend_id IS NOT NULL;

COMMENT ON TABLE email_logs IS 'Email delivery history for all member communications';

-- =============================================================================
-- Email Templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  description text,
  subject jsonb NOT NULL,
  body jsonb NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);

-- =============================================================================
-- Onboarding Invites (replaces auto_pay_invites)
-- =============================================================================

CREATE TABLE IF NOT EXISTS onboarding_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stripe_checkout_session_id text,
  planned_amount numeric(10,2) NOT NULL,
  first_charge_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'canceled')),
  sent_at timestamptz NOT NULL,
  completed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  payment_method text DEFAULT 'stripe',
  enrollment_fee_amount numeric(10,2) DEFAULT 0,
  includes_enrollment_fee boolean DEFAULT false,
  enrollment_fee_paid_at timestamptz,
  dues_amount numeric(10,2) DEFAULT 0,
  billing_frequency text,
  dues_paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_organization_id ON onboarding_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_membership_id ON onboarding_invites(membership_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_member_id ON onboarding_invites(member_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_status ON onboarding_invites(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_stripe_checkout_session_id ON onboarding_invites(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TRIGGER onboarding_invites_updated_at
  BEFORE UPDATE ON onboarding_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE onboarding_invites IS 'Tracks onboarding payment flows (Stripe Checkout and manual)';

-- =============================================================================
-- Member Invites (portal access invitations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  sent_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_invites_token ON member_invites(token);
CREATE INDEX IF NOT EXISTS idx_member_invites_member_id ON member_invites(member_id);
CREATE INDEX IF NOT EXISTS idx_member_invites_status ON member_invites(status);

COMMENT ON TABLE member_invites IS 'Portal access invitations sent to members';

-- =============================================================================
-- Agreement Templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  version text NOT NULL,
  storage_path text NOT NULL,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, language, version)
);

CREATE INDEX IF NOT EXISTS idx_agreement_templates_org ON agreement_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_agreement_templates_active ON agreement_templates(organization_id, language) WHERE is_active = true;

-- Storage bucket for agreement templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('agreement-templates', 'agreement-templates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for agreement templates storage
CREATE POLICY agreement_templates_service_upload ON storage.objects
  FOR ALL
  TO service_role
  WITH CHECK (bucket_id = 'agreement-templates');

CREATE POLICY agreement_templates_org_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agreement-templates'
    AND (storage.foldername(name))[1] = current_setting('app.organization_id', true)
  );

COMMENT ON TABLE agreement_templates IS 'PDF agreement templates per organization and language';

-- =============================================================================
-- Organization Settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_config jsonb DEFAULT '{
    "lapseDays": 7,
    "cancelMonths": 24,
    "reminderSchedule": [3, 7, 14],
    "maxReminders": 3,
    "sendInvoiceReminders": true,
    "eligibilityMonths": 60
  }',
  send_welcome_email boolean DEFAULT true,
  send_receipt_email boolean DEFAULT true,
  send_eligibility_email boolean DEFAULT true,
  require_agreement_signature boolean DEFAULT true,
  agreement_template_version text DEFAULT '1.0',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_settings_organization_id ON organization_settings(organization_id);

CREATE TRIGGER organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organization_settings IS 'Configurable settings for each organization';

-- =============================================================================
-- Invoice Sequences
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  last_sequence int DEFAULT 0,
  UNIQUE(organization_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_invoice_sequences_organization_id ON invoice_sequences(organization_id);

CREATE OR REPLACE FUNCTION next_invoice_sequence(p_organization_id uuid, p_year_month text)
RETURNS int AS $$
DECLARE
  v_sequence int;
BEGIN
  INSERT INTO invoice_sequences (organization_id, year_month, last_sequence)
  VALUES (p_organization_id, p_year_month, 1)
  ON CONFLICT (organization_id, year_month)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_sequence;
  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number(p_organization_id uuid)
RETURNS text AS $$
DECLARE
  v_year_month text;
  v_sequence int;
BEGIN
  v_year_month := to_char(now(), 'YYYYMM');
  v_sequence := next_invoice_sequence(p_organization_id, v_year_month);
  RETURN 'INV-' || substring(v_year_month from 1 for 4) || '-' || lpad(v_sequence::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Stripe Webhook Events
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'held')),
  payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_organization ON stripe_webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created_at DESC);

COMMENT ON TABLE stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_signing_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's organization_id from JWT
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid AS $$
BEGIN
  RETURN (auth.jwt() ->> 'organization_id')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations
CREATE POLICY "Users can view their organization" ON organizations FOR SELECT USING (id = get_user_organization_id());
CREATE POLICY "Users can update their organization" ON organizations FOR UPDATE USING (id = get_user_organization_id());

-- Organization Settings
CREATE POLICY "Users can view their org settings" ON organization_settings FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert their org settings" ON organization_settings FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update their org settings" ON organization_settings FOR UPDATE USING (organization_id = get_user_organization_id());

-- Plans
CREATE POLICY "Users can view plans in their org" ON plans FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert plans in their org" ON plans FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update plans in their org" ON plans FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete plans in their org" ON plans FOR DELETE USING (organization_id = get_user_organization_id());

-- Members
CREATE POLICY "Users can view members in their org" ON members FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert members in their org" ON members FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update members in their org" ON members FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete members in their org" ON members FOR DELETE USING (organization_id = get_user_organization_id());

-- Memberships
CREATE POLICY "Users can view memberships in their org" ON memberships FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert memberships in their org" ON memberships FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update memberships in their org" ON memberships FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete memberships in their org" ON memberships FOR DELETE USING (organization_id = get_user_organization_id());

-- Payments
CREATE POLICY "Users can view payments in their org" ON payments FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert payments in their org" ON payments FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update payments in their org" ON payments FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete payments in their org" ON payments FOR DELETE USING (organization_id = get_user_organization_id());

-- Agreements
CREATE POLICY "Users can view agreements in their org" ON agreements FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert agreements in their org" ON agreements FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update agreements in their org" ON agreements FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete agreements in their org" ON agreements FOR DELETE USING (organization_id = get_user_organization_id());

-- Agreement Signing Links
CREATE POLICY "agreement_signing_links_org_access" ON agreement_signing_links FOR ALL USING (
  agreement_id IN (
    SELECT id FROM agreements WHERE organization_id = current_setting('app.organization_id', true)::uuid
  )
);

-- Email Logs
CREATE POLICY "Users can view email logs in their org" ON email_logs FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert email logs in their org" ON email_logs FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update email logs in their org" ON email_logs FOR UPDATE USING (organization_id = get_user_organization_id());

-- Onboarding Invites
CREATE POLICY "Users can view onboarding invites in their org" ON onboarding_invites FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert onboarding invites in their org" ON onboarding_invites FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update onboarding invites in their org" ON onboarding_invites FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete onboarding invites in their org" ON onboarding_invites FOR DELETE USING (organization_id = get_user_organization_id());

-- Member Invites
CREATE POLICY "Users can view member invites in their org" ON member_invites FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert member invites in their org" ON member_invites FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update member invites in their org" ON member_invites FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Service role full access to member_invites" ON member_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Agreement Templates
CREATE POLICY "Users can view agreement templates in their org" ON agreement_templates FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert agreement templates in their org" ON agreement_templates FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update agreement templates in their org" ON agreement_templates FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can delete agreement templates in their org" ON agreement_templates FOR DELETE USING (organization_id = get_user_organization_id());

-- Invoice Sequences
CREATE POLICY "Users can view invoice sequences in their org" ON invoice_sequences FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert invoice sequences in their org" ON invoice_sequences FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update invoice sequences in their org" ON invoice_sequences FOR UPDATE USING (organization_id = get_user_organization_id());

-- Stripe Webhook Events
CREATE POLICY "Service role full access to stripe_webhook_events" ON stripe_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Org admins can view their stripe_webhook_events" ON stripe_webhook_events FOR SELECT TO authenticated USING (organization_id = get_user_organization_id());

-- Members can view their org's plans (for portal)
CREATE POLICY "Members can view org plans" ON plans FOR SELECT TO authenticated USING (true);

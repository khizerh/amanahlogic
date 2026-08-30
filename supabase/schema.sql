-- AUTO-GENERATED SNAPSHOT of the production database schema.
-- Do not edit by hand — apply changes directly to the database,
-- then refresh this file with:  npm run dump-schema
-- Project: vlbwgjenstbfrkncsrte

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agreement_signing_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agreement_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT agreement_signing_links_pkey PRIMARY KEY (id),
  CONSTRAINT agreement_signing_links_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.agreement_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  language text NOT NULL,
  version text NOT NULL,
  storage_path text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT agreement_templates_language_check CHECK ((language = ANY (ARRAY['en'::text, 'fa'::text]))),
  CONSTRAINT agreement_templates_organization_id_language_version_key UNIQUE (organization_id, language, version),
  CONSTRAINT agreement_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  member_id uuid NOT NULL,
  template_version text NOT NULL,
  pdf_url text,
  signature_image_url text,
  signed_name text,
  ip_address text,
  user_agent text,
  consent_checked boolean DEFAULT false,
  sent_at timestamp with time zone NOT NULL,
  signed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  reminder_count integer DEFAULT 0 NOT NULL,
  last_reminder_at timestamp with time zone,
  CONSTRAINT agreements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_id uuid,
  member_name text NOT NULL,
  member_email text NOT NULL,
  template_type text NOT NULL,
  "to" text NOT NULL,
  subject text NOT NULL,
  body_preview text,
  language text DEFAULT 'en'::text,
  status text DEFAULT 'queued'::text NOT NULL,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  failure_reason text,
  resend_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_logs_pkey PRIMARY KEY (id),
  CONSTRAINT email_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'bounced'::text])))
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  description text,
  subject jsonb NOT NULL,
  body jsonb NOT NULL,
  variables text[] DEFAULT '{}'::text[] NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT email_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  year_month text NOT NULL,
  last_sequence integer DEFAULT 0,
  CONSTRAINT invoice_sequences_organization_id_year_month_key UNIQUE (organization_id, year_month),
  CONSTRAINT invoice_sequences_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.member_invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_id uuid NOT NULL,
  email text NOT NULL,
  token uuid DEFAULT gen_random_uuid() NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT member_invites_pkey PRIMARY KEY (id),
  CONSTRAINT member_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text])))
);

CREATE TABLE IF NOT EXISTS public.members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  address jsonb DEFAULT '{}'::jsonb NOT NULL,
  spouse_name text,
  children jsonb DEFAULT '[]'::jsonb,
  emergency_contact jsonb DEFAULT '{"name": "", "phone": ""}'::jsonb NOT NULL,
  preferred_language text DEFAULT 'en'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  middle_name text,
  sms_opted_in_at timestamp with time zone,
  sms_opted_out_at timestamp with time zone,
  sms_opt_out_reason text,
  CONSTRAINT members_organization_id_email_key UNIQUE (organization_id, email),
  CONSTRAINT members_pkey PRIMARY KEY (id),
  CONSTRAINT members_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['en'::text, 'fa'::text])))
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_id uuid NOT NULL,
  plan_id uuid,
  status text DEFAULT 'pending'::text NOT NULL,
  billing_frequency text DEFAULT 'monthly'::text NOT NULL,
  billing_anniversary_day integer,
  paid_months integer DEFAULT 0,
  join_date date,
  last_payment_date date,
  next_payment_due date,
  eligible_date date,
  cancelled_date date,
  agreement_signed_at timestamp with time zone,
  agreement_id uuid,
  auto_pay_enabled boolean DEFAULT false,
  stripe_subscription_id text,
  stripe_customer_id text,
  subscription_status text,
  payment_method jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  enrollment_fee_status text DEFAULT 'unpaid'::text NOT NULL,
  payer_member_id uuid,
  CONSTRAINT memberships_billing_anniversary_day_check CHECK (((billing_anniversary_day >= 1) AND (billing_anniversary_day <= 28))),
  CONSTRAINT memberships_billing_frequency_check CHECK ((billing_frequency = ANY (ARRAY['monthly'::text, 'biannual'::text, 'annual'::text]))),
  CONSTRAINT memberships_enrollment_fee_status_check CHECK ((enrollment_fee_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'waived'::text]))),
  CONSTRAINT memberships_member_id_key UNIQUE (member_id),
  CONSTRAINT memberships_pkey PRIMARY KEY (id),
  CONSTRAINT memberships_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'current'::text, 'lapsed'::text, 'cancelled'::text]))),
  CONSTRAINT memberships_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'incomplete'::text, 'incomplete_expired'::text, 'paused'::text])))
);

CREATE TABLE IF NOT EXISTS public.onboarding_invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  member_id uuid NOT NULL,
  stripe_checkout_session_id text,
  planned_amount numeric(10,2) NOT NULL,
  first_charge_date date,
  status text DEFAULT 'pending'::text NOT NULL,
  sent_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  expired_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  payment_method text DEFAULT 'stripe'::text NOT NULL,
  enrollment_fee_amount numeric(10,2) DEFAULT 0 NOT NULL,
  includes_enrollment_fee boolean DEFAULT false NOT NULL,
  enrollment_fee_paid_at timestamp with time zone,
  dues_amount numeric(10,2) DEFAULT 0 NOT NULL,
  billing_frequency text,
  dues_paid_at timestamp with time zone,
  stripe_setup_intent_id text,
  CONSTRAINT auto_pay_invites_pkey PRIMARY KEY (id),
  CONSTRAINT auto_pay_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'expired'::text, 'canceled'::text]))),
  CONSTRAINT check_billing_frequency CHECK (((billing_frequency = ANY (ARRAY['monthly'::text, 'biannual'::text, 'annual'::text])) OR (billing_frequency IS NULL))),
  CONSTRAINT check_payment_method CHECK ((payment_method = ANY (ARRAY['stripe'::text, 'manual'::text])))
);

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  billing_config jsonb DEFAULT '{"lapseDays": 7, "cancelMonths": 24, "maxReminders": 3, "reminderSchedule": [3, 7, 14], "eligibilityMonths": 60, "sendInvoiceReminders": true}'::jsonb,
  send_welcome_email boolean DEFAULT true,
  send_receipt_email boolean DEFAULT true,
  send_eligibility_email boolean DEFAULT true,
  require_agreement_signature boolean DEFAULT true,
  agreement_template_version text DEFAULT '1.0'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_settings_organization_id_key UNIQUE (organization_id),
  CONSTRAINT organization_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  address jsonb DEFAULT '{}'::jsonb NOT NULL,
  phone text,
  email text,
  timezone text DEFAULT 'America/Los_Angeles'::text,
  stripe_connect_id text,
  stripe_onboarded boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pass_fees_to_member boolean DEFAULT false,
  platform_fees jsonb DEFAULT '{"annual": 0, "monthly": 0, "biannual": 0}'::jsonb,
  terminal_location_id text,
  twilio_phone_number text,
  twilio_brand_sid text,
  twilio_campaign_sid text,
  twilio_messaging_service_sid text,
  legal_business_name text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  member_id uuid NOT NULL,
  type text NOT NULL,
  method text,
  status text DEFAULT 'pending'::text NOT NULL,
  amount numeric(10,2) NOT NULL,
  stripe_fee numeric(10,2) DEFAULT 0,
  platform_fee numeric(10,2) DEFAULT 0,
  total_charged numeric(10,2) NOT NULL,
  net_amount numeric(10,2) NOT NULL,
  months_credited integer DEFAULT 0,
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
  reminder_count integer DEFAULT 0,
  reminder_sent_at timestamp with time zone,
  reminders_paused boolean DEFAULT false,
  requires_review boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  refunded_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  stripe_payment_method_type text,
  CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['stripe'::text, 'cash'::text, 'check'::text, 'zelle'::text]))),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text]))),
  CONSTRAINT payments_type_check CHECK ((type = ANY (ARRAY['enrollment_fee'::text, 'dues'::text, 'back_dues'::text])))
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  description text,
  pricing jsonb DEFAULT '{"annual": 0, "monthly": 0, "biannual": 0}'::jsonb NOT NULL,
  enrollment_fee numeric(10,2) DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.returning_applications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address jsonb DEFAULT '{}'::jsonb NOT NULL,
  spouse_name text,
  children jsonb DEFAULT '[]'::jsonb NOT NULL,
  emergency_contact jsonb DEFAULT '{}'::jsonb NOT NULL,
  preferred_language text DEFAULT 'en'::text NOT NULL,
  plan_id uuid NOT NULL,
  billing_frequency text DEFAULT 'monthly'::text NOT NULL,
  paid_months integer DEFAULT 0 NOT NULL,
  enrollment_fee_status text DEFAULT 'unpaid'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  admin_notes text,
  member_id uuid,
  membership_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  kind text DEFAULT 'returning'::text NOT NULL,
  sms_opted_in_at timestamp with time zone,
  CONSTRAINT returning_applications_billing_frequency_check CHECK ((billing_frequency = ANY (ARRAY['monthly'::text, 'biannual'::text, 'annual'::text]))),
  CONSTRAINT returning_applications_enrollment_fee_status_check CHECK ((enrollment_fee_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'waived'::text]))),
  CONSTRAINT returning_applications_kind_check CHECK ((kind = ANY (ARRAY['new'::text, 'returning'::text]))),
  CONSTRAINT returning_applications_pkey PRIMARY KEY (id),
  CONSTRAINT returning_applications_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['en'::text, 'fa'::text]))),
  CONSTRAINT returning_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_id uuid,
  direction text NOT NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  provider text DEFAULT 'stub'::text NOT NULL,
  provider_message_id text,
  segments integer DEFAULT 1,
  error_code text,
  error_message text,
  read_at timestamp with time zone,
  override_reason text,
  sent_by_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
  CONSTRAINT sms_messages_pkey PRIMARY KEY (id),
  CONSTRAINT sms_messages_provider_check CHECK ((provider = ANY (ARRAY['stub'::text, 'twilio'::text]))),
  CONSTRAINT sms_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'undelivered'::text, 'received'::text])))
);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  organization_id uuid,
  membership_id uuid,
  status text DEFAULT 'processed'::text NOT NULL,
  payload jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stripe_webhook_events_event_id_key UNIQUE (event_id),
  CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_webhook_events_status_check CHECK ((status = ANY (ARRAY['processed'::text, 'failed'::text, 'held'::text])))
);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE public.agreement_signing_links ADD CONSTRAINT agreement_signing_links_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE CASCADE;

ALTER TABLE public.agreement_templates ADD CONSTRAINT agreement_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public.agreements ADD CONSTRAINT agreements_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE public.agreements ADD CONSTRAINT agreements_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE;

ALTER TABLE public.agreements ADD CONSTRAINT agreements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.invoice_sequences ADD CONSTRAINT invoice_sequences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.member_invites ADD CONSTRAINT member_invites_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE public.member_invites ADD CONSTRAINT member_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.members ADD CONSTRAINT members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.members ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.memberships ADD CONSTRAINT memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE public.memberships ADD CONSTRAINT memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.memberships ADD CONSTRAINT memberships_payer_member_id_fkey FOREIGN KEY (payer_member_id) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE public.memberships ADD CONSTRAINT memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);

ALTER TABLE public.onboarding_invites ADD CONSTRAINT auto_pay_invites_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE public.onboarding_invites ADD CONSTRAINT auto_pay_invites_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE;

ALTER TABLE public.onboarding_invites ADD CONSTRAINT auto_pay_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_settings ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD CONSTRAINT payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD CONSTRAINT payments_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD CONSTRAINT payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.plans ADD CONSTRAINT plans_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.returning_applications ADD CONSTRAINT returning_applications_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id);

ALTER TABLE public.returning_applications ADD CONSTRAINT returning_applications_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id);

ALTER TABLE public.returning_applications ADD CONSTRAINT returning_applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.returning_applications ADD CONSTRAINT returning_applications_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);

ALTER TABLE public.returning_applications ADD CONSTRAINT returning_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES auth.users(id);

ALTER TABLE public.stripe_webhook_events ADD CONSTRAINT stripe_webhook_events_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL;

ALTER TABLE public.stripe_webhook_events ADD CONSTRAINT stripe_webhook_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_agreement_signing_links_agreement_id ON public.agreement_signing_links USING btree (agreement_id);

CREATE INDEX IF NOT EXISTS idx_agreement_signing_links_token ON public.agreement_signing_links USING btree (token);

CREATE INDEX IF NOT EXISTS idx_agreements_member_id ON public.agreements USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_agreements_membership_id ON public.agreements USING btree (membership_id);

CREATE INDEX IF NOT EXISTS idx_agreements_organization_id ON public.agreements USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_agreements_signed_at ON public.agreements USING btree (signed_at) WHERE (signed_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_agreements_template_version ON public.agreements USING btree (template_version);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_member_id ON public.email_logs USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_organization_id ON public.email_logs USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON public.email_logs USING btree (resend_id) WHERE (resend_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs USING btree (status);

CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON public.email_logs USING btree (template_type);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON public.email_templates USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON public.email_templates USING btree (type);

CREATE INDEX IF NOT EXISTS idx_invoice_sequences_organization_id ON public.invoice_sequences USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_member_invites_member ON public.member_invites USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_member_invites_organization_id ON public.member_invites USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_member_invites_token ON public.member_invites USING btree (token);

CREATE INDEX IF NOT EXISTS idx_members_email ON public.members USING btree (email);

CREATE INDEX IF NOT EXISTS idx_members_name ON public.members USING btree (last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_members_organization_id ON public.members USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_members_search ON public.members USING gin (to_tsvector('english'::regconfig, ((((((first_name || ' '::text) || COALESCE(middle_name, ''::text)) || ' '::text) || last_name) || ' '::text) || COALESCE(email, ''::text))));

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON public.memberships USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_memberships_next_payment_due ON public.memberships USING btree (next_payment_due) WHERE (next_payment_due IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_memberships_organization_id ON public.memberships USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_memberships_paid_months ON public.memberships USING btree (paid_months);

CREATE INDEX IF NOT EXISTS idx_memberships_payer_member_id ON public.memberships USING btree (payer_member_id) WHERE (payer_member_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON public.memberships USING btree (plan_id);

CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships USING btree (status);

CREATE INDEX IF NOT EXISTS idx_memberships_stripe_customer_id ON public.memberships USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_memberships_stripe_subscription_id ON public.memberships USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_auto_pay_invites_member_id ON public.onboarding_invites USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_auto_pay_invites_membership_id ON public.onboarding_invites USING btree (membership_id);

CREATE INDEX IF NOT EXISTS idx_auto_pay_invites_organization_id ON public.onboarding_invites USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_auto_pay_invites_status ON public.onboarding_invites USING btree (status);

CREATE INDEX IF NOT EXISTS idx_auto_pay_invites_stripe_checkout_session_id ON public.onboarding_invites USING btree (stripe_checkout_session_id) WHERE (stripe_checkout_session_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_method_status ON public.onboarding_invites USING btree (organization_id, payment_method, status);

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_org_status ON public.onboarding_invites USING btree (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_settings_organization_id ON public.organization_settings USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments USING btree (due_date) WHERE (due_date IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON public.payments USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_payments_membership_id ON public.payments USING btree (membership_id);

CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments USING btree (method);

CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON public.payments USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments USING btree (paid_at DESC) WHERE (paid_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_pending_reminders ON public.payments USING btree (due_date, reminder_count) WHERE ((status = 'pending'::text) AND (reminders_paused = false));

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments USING btree (status);

CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_type ON public.payments USING btree (type);

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON public.plans USING btree (is_active) WHERE (is_active = true);

CREATE INDEX IF NOT EXISTS idx_plans_organization_id ON public.plans USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_plans_type ON public.plans USING btree (type);

CREATE INDEX IF NOT EXISTS idx_returning_applications_email ON public.returning_applications USING btree (organization_id, email);

CREATE INDEX IF NOT EXISTS idx_returning_applications_member_id ON public.returning_applications USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_returning_applications_membership_id ON public.returning_applications USING btree (membership_id);

CREATE INDEX IF NOT EXISTS idx_returning_applications_org_status ON public.returning_applications USING btree (organization_id, status);

CREATE UNIQUE INDEX idx_returning_applications_pending_email ON public.returning_applications USING btree (organization_id, lower(email)) WHERE (status = 'pending'::text);

CREATE INDEX IF NOT EXISTS idx_returning_applications_plan_id ON public.returning_applications USING btree (plan_id);

CREATE INDEX IF NOT EXISTS idx_returning_applications_reviewed_by ON public.returning_applications USING btree (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_sms_messages_member_id ON public.sms_messages USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_sms_messages_org_member_created ON public.sms_messages USING btree (organization_id, member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_message_id ON public.sms_messages USING btree (provider_message_id) WHERE (provider_message_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sms_messages_sent_by_user_id ON public.sms_messages USING btree (sent_by_user_id);

CREATE INDEX IF NOT EXISTS idx_sms_messages_unknown_sender ON public.sms_messages USING btree (organization_id, from_number, created_at DESC) WHERE ((direction = 'inbound'::text) AND (member_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_sms_messages_unread_inbound ON public.sms_messages USING btree (organization_id, created_at DESC) WHERE ((direction = 'inbound'::text) AND (read_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON public.stripe_webhook_events USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON public.stripe_webhook_events USING btree (event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_membership_id ON public.stripe_webhook_events USING btree (membership_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_organization ON public.stripe_webhook_events USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON public.stripe_webhook_events USING btree (event_type);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_organization_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$                                                                                                                                                              
  DECLARE                                                                                                                                                                         
    v_year_month text;                                                                                                                                                            
    v_sequence int;                                                                                                                                                               
  BEGIN                                                                                                                                                                           
    v_year_month := to_char(now(), 'YYYYMM');                                                                                                                                     
    v_sequence := next_invoice_sequence(p_organization_id, v_year_month);                                                                                                         
    RETURN 'INV-' || substring(v_year_month from 1 for 4) || '-' || lpad(v_sequence::text, 4, '0');                                                                               
  END;                                                                                                                                                                            
  $function$
;

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$                                                                                                                                                              
  BEGIN                                                                                                                                                                           
    RETURN (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid;                                                                                                            
  EXCEPTION                                                                                                                                                                       
    WHEN OTHERS THEN                                                                                                                                                              
      RETURN NULL;                                                                                                                                                                
  END;                                                                                                                                                                            
  $function$
;

CREATE OR REPLACE FUNCTION public.next_invoice_sequence(p_organization_id uuid, p_year_month text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$                                                                                                                                                               
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
  $function$
;

CREATE OR REPLACE FUNCTION public.sms_messages_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$                                                                                                                                                           
  BEGIN                                                                                                                                                                           
    NEW.updated_at = NOW();                                                                                                                                                       
    RETURN NEW;                                                                                                                                                                   
  END;                                                                                                                                                                            
  $function$
;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auto_pay_invites_updated_at BEFORE UPDATE ON onboarding_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER organization_settings_updated_at BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_returning_applications_updated_at BEFORE UPDATE ON returning_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sms_messages_updated_at BEFORE UPDATE ON sms_messages FOR EACH ROW EXECUTE FUNCTION sms_messages_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.agreement_signing_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.member_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.onboarding_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.returning_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

CREATE POLICY "Users can delete signing links in their org" ON public.agreement_signing_links FOR DELETE TO public USING ((agreement_id IN ( SELECT agreements.id
   FROM agreements
  WHERE (agreements.organization_id = get_user_organization_id()))));

CREATE POLICY "Users can insert signing links in their org" ON public.agreement_signing_links FOR INSERT TO public WITH CHECK ((agreement_id IN ( SELECT agreements.id
   FROM agreements
  WHERE (agreements.organization_id = get_user_organization_id()))));

CREATE POLICY "Users can update signing links in their org" ON public.agreement_signing_links FOR UPDATE TO public USING ((agreement_id IN ( SELECT agreements.id
   FROM agreements
  WHERE (agreements.organization_id = get_user_organization_id()))));

CREATE POLICY "Users can view signing links in their org" ON public.agreement_signing_links FOR SELECT TO public USING ((agreement_id IN ( SELECT agreements.id
   FROM agreements
  WHERE (agreements.organization_id = get_user_organization_id()))));

CREATE POLICY "Users can delete templates in their org" ON public.agreement_templates FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert templates in their org" ON public.agreement_templates FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update templates in their org" ON public.agreement_templates FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view templates in their org" ON public.agreement_templates FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can delete agreements in their org" ON public.agreements FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert agreements in their org" ON public.agreements FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update agreements in their org" ON public.agreements FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view agreements in their org" ON public.agreements FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert email logs in their org" ON public.email_logs FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update email logs in their org" ON public.email_logs FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view email logs in their org" ON public.email_logs FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert email templates in their org" ON public.email_templates FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update email templates in their org" ON public.email_templates FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view email templates in their org" ON public.email_templates FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert invoice sequences in their org" ON public.invoice_sequences FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update invoice sequences in their org" ON public.invoice_sequences FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view invoice sequences in their org" ON public.invoice_sequences FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Public can verify invites" ON public.member_invites FOR SELECT TO public USING (true);

CREATE POLICY "Members can view own record" ON public.members FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can delete members in their org" ON public.members FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert members in their org" ON public.members FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update members in their org" ON public.members FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view members in their org" ON public.members FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Members can view own membership" ON public.memberships FOR SELECT TO public USING ((member_id IN ( SELECT members.id
   FROM members
  WHERE (members.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Users can delete memberships in their org" ON public.memberships FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert memberships in their org" ON public.memberships FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update memberships in their org" ON public.memberships FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view memberships in their org" ON public.memberships FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can delete auto pay invites in their org" ON public.onboarding_invites FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert auto pay invites in their org" ON public.onboarding_invites FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update auto pay invites in their org" ON public.onboarding_invites FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view auto pay invites in their org" ON public.onboarding_invites FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert their org settings" ON public.organization_settings FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update their org settings" ON public.organization_settings FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view their org settings" ON public.organization_settings FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Members can view own org" ON public.organizations FOR SELECT TO public USING ((id IN ( SELECT members.organization_id
   FROM members
  WHERE (members.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Users can update their organization" ON public.organizations FOR UPDATE TO public USING ((id = get_user_organization_id()));

CREATE POLICY "Users can view their organization" ON public.organizations FOR SELECT TO public USING ((id = get_user_organization_id()));

CREATE POLICY "Members can view own payments" ON public.payments FOR SELECT TO public USING ((member_id IN ( SELECT members.id
   FROM members
  WHERE (members.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Users can delete payments in their org" ON public.payments FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert payments in their org" ON public.payments FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update payments in their org" ON public.payments FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view payments in their org" ON public.payments FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Members can view org plans" ON public.plans FOR SELECT TO public USING ((organization_id IN ( SELECT members.organization_id
   FROM members
  WHERE (members.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Users can delete plans in their org" ON public.plans FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert plans in their org" ON public.plans FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update plans in their org" ON public.plans FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view plans in their org" ON public.plans FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can delete returning applications in their org" ON public.returning_applications FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert returning applications in their org" ON public.returning_applications FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update returning applications in their org" ON public.returning_applications FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view returning applications in their org" ON public.returning_applications FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can delete sms in their org" ON public.sms_messages FOR DELETE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can insert sms in their org" ON public.sms_messages FOR INSERT TO public WITH CHECK ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can update sms in their org" ON public.sms_messages FOR UPDATE TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Users can view sms in their org" ON public.sms_messages FOR SELECT TO public USING ((organization_id = get_user_organization_id()));

CREATE POLICY "Service role full access to stripe_webhook_events" ON public.stripe_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('agreement-templates', 'agreement-templates', false) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('signed-agreements', 'signed-agreements', false) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

CREATE POLICY "Users can delete their org agreement templates" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'agreement-templates'::text) AND ((storage.foldername(name))[1] = ( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'organization_id'::text)))));

CREATE POLICY "Users can read their org agreement templates" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'agreement-templates'::text) AND ((storage.foldername(name))[1] = ( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'organization_id'::text)))));

CREATE POLICY "Users can upload agreement templates to their org" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'agreement-templates'::text) AND ((storage.foldername(name))[1] = ( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'organization_id'::text)))));

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON COLUMN public.agreements.consent_checked IS 'Whether member checked the consent checkbox';

COMMENT ON COLUMN public.agreements.ip_address IS 'IP address at time of signature for audit';

COMMENT ON COLUMN public.agreements.last_reminder_at IS 'When the last sign-reminder nudge was sent (throttle window).';

COMMENT ON COLUMN public.agreements.reminder_count IS 'Number of sign-reminder nudges sent for this unsigned agreement (throttle/cap).';

COMMENT ON COLUMN public.agreements.template_version IS 'Version of the agreement template used';

COMMENT ON COLUMN public.agreements.user_agent IS 'Browser user agent at time of signature for audit';

COMMENT ON COLUMN public.email_logs.body_preview IS 'First ~150 characters of email body for preview';

COMMENT ON COLUMN public.email_logs.resend_id IS 'Message ID from Resend.com for tracking';

COMMENT ON COLUMN public.email_logs.template_type IS 'Email template: welcome, payment_receipt, payment_reminder, overdue_notice, etc.';

COMMENT ON COLUMN public.members.address IS 'JSON object: {street, city, state, zip}';

COMMENT ON COLUMN public.members.children IS 'JSON array: [{id, name, dateOfBirth}]';

COMMENT ON COLUMN public.members.emergency_contact IS 'JSON object: {name, phone}';

COMMENT ON COLUMN public.members.preferred_language IS 'en = English, fa = Farsi';

COMMENT ON COLUMN public.memberships.billing_anniversary_day IS 'Day of month (1-28) when billing occurs';

COMMENT ON COLUMN public.memberships.paid_months IS 'Total months paid towards eligibility (60 months required)';

COMMENT ON COLUMN public.memberships.payment_method IS 'JSON: {type, last4, brand?, bankName?, expiryMonth?, expiryYear?}';

COMMENT ON COLUMN public.memberships.status IS 'Membership lifecycle: pending → awaiting_signature → waiting_period → active | lapsed | cancelled';

COMMENT ON COLUMN public.onboarding_invites.first_charge_date IS 'Expected date of first recurring charge';

COMMENT ON COLUMN public.onboarding_invites.planned_amount IS 'Monthly amount at time invite was sent';

COMMENT ON COLUMN public.onboarding_invites.status IS 'pending = link sent, completed = member enrolled, expired = link expired, canceled = manually canceled';

COMMENT ON COLUMN public.organization_settings.billing_config IS 'JSON: {lapseDays, cancelMonths, reminderSchedule[], maxReminders, sendInvoiceReminders, eligibilityMonths}';

COMMENT ON COLUMN public.organizations.address IS 'JSON object: {street, city, state, zip}';

COMMENT ON COLUMN public.organizations.legal_business_name IS 'Registered legal entity name (for A2P 10DLC brand match); shown on public opt-in pages when set. May differ from display name.';

COMMENT ON COLUMN public.payments.months_credited IS 'Number of membership months this payment credits';

COMMENT ON COLUMN public.payments.net_amount IS 'Amount org receives after fees: amount - platform_fee';

COMMENT ON COLUMN public.payments.requires_review IS 'True when max reminders sent and payment still pending';

COMMENT ON COLUMN public.payments.type IS 'enrollment_fee, dues, or back_dues';

COMMENT ON COLUMN public.plans.pricing IS 'JSON object: {monthly: number, biannual: number, annual: number}';

COMMENT ON COLUMN public.plans.type IS 'Plan category: single, married, or widow';

COMMENT ON COLUMN public.returning_applications.kind IS 'Application type: ''new'' for first-time members, ''returning'' for members rejoining with prior paid months.';

COMMENT ON COLUMN public.returning_applications.sms_opted_in_at IS 'Timestamp the applicant checked the optional SMS consent box on the join form. Null = did not opt in. Copied to members.sms_opted_in_at on approval.';

COMMENT ON COLUMN public.stripe_webhook_events.event_id IS 'Stripe event ID (evt_xxx) - unique constraint prevents double processing';

COMMENT ON TABLE public.agreements IS 'E-signature records for membership agreements';

COMMENT ON TABLE public.email_logs IS 'Email delivery history for all member communications';

COMMENT ON TABLE public.invoice_sequences IS 'Tracks invoice number sequences per organization per month';

COMMENT ON TABLE public.members IS 'Member contact information and household details';

COMMENT ON TABLE public.memberships IS 'Member subscription to a plan with payment tracking';

COMMENT ON TABLE public.onboarding_invites IS 'Tracks Stripe Checkout sessions for auto-pay enrollment';

COMMENT ON TABLE public.organization_settings IS 'Configurable settings for each organization';

COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations for burial benefits programs';

COMMENT ON TABLE public.payments IS 'Payment records for enrollment fees and membership dues';

COMMENT ON TABLE public.plans IS 'Membership plan types with pricing for each billing frequency';

COMMENT ON TABLE public.stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';


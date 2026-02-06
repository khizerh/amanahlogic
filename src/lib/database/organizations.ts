import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Organization,
  OrganizationSettings,
  BillingConfig,
  Address,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  address: Address;
  phone?: string;
  email?: string;
  timezone?: string;
  stripeConnectId?: string;
  stripeOnboarded?: boolean;
  platformFee?: number;
  passFeesToMember?: boolean;
}

export interface UpdateOrganizationInput
  extends Partial<CreateOrganizationInput> {
  id: string;
}

export interface UpdateOrganizationSettingsInput {
  organizationId: string;
  billingConfig?: Partial<BillingConfig>;
  sendWelcomeEmail?: boolean;
  sendReceiptEmail?: boolean;
  sendEligibilityEmail?: boolean;
  requireAgreementSignature?: boolean;
  agreementTemplateVersion?: string;
}

// =============================================================================
// OrganizationsService
// =============================================================================

export class OrganizationsService {
  /**
   * Get organization by ID
   */
  static async getById(organizationId: string): Promise<Organization | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformOrganization(data);
  }

  /**
   * Get organization by slug
   */
  static async getBySlug(slug: string): Promise<Organization | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformOrganization(data);
  }

  /**
   * Get organization by Stripe Connect ID
   */
  static async getByStripeConnectId(
    stripeConnectId: string,
    supabase?: SupabaseClient
  ): Promise<Organization | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("organizations")
      .select("*")
      .eq("stripe_connect_id", stripeConnectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformOrganization(data);
  }

  /**
   * Create a new organization
   */
  static async create(
    input: CreateOrganizationInput,
    supabase?: SupabaseClient
  ): Promise<Organization> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("organizations")
      .insert({
        name: input.name,
        slug: input.slug,
        address: input.address,
        phone: input.phone || null,
        email: input.email || null,
        timezone: input.timezone || "America/Los_Angeles",
        stripe_connect_id: input.stripeConnectId || null,
        stripe_onboarded: input.stripeOnboarded || false,
        platform_fee: input.platformFee || 0,
        pass_fees_to_member: input.passFeesToMember ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    return transformOrganization(data);
  }

  /**
   * Update an organization
   */
  static async update(
    input: UpdateOrganizationInput,
    supabase?: SupabaseClient
  ): Promise<Organization> {
    const client = supabase ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
    if (updates.stripeConnectId !== undefined)
      dbUpdates.stripe_connect_id = updates.stripeConnectId;
    if (updates.stripeOnboarded !== undefined)
      dbUpdates.stripe_onboarded = updates.stripeOnboarded;
    if (updates.platformFee !== undefined)
      dbUpdates.platform_fee = updates.platformFee;
    if (updates.passFeesToMember !== undefined)
      dbUpdates.pass_fees_to_member = updates.passFeesToMember;

    const { data, error } = await client
      .from("organizations")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformOrganization(data);
  }

  /**
   * Mark organization as Stripe onboarded
   */
  static async markStripeOnboarded(
    organizationId: string,
    stripeConnectId: string,
    supabase?: SupabaseClient
  ): Promise<Organization> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("organizations")
      .update({
        stripe_connect_id: stripeConnectId,
        stripe_onboarded: true,
      })
      .eq("id", organizationId)
      .select()
      .single();

    if (error) throw error;
    return transformOrganization(data);
  }
}

// =============================================================================
// OrganizationSettingsService
// =============================================================================

export class OrganizationSettingsService {
  /**
   * Get settings for an organization
   */
  static async get(
    organizationId: string
  ): Promise<OrganizationSettings | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformSettings(data);
  }

  /**
   * Get settings or create default if not exists
   */
  static async getOrCreate(
    organizationId: string,
    supabase?: SupabaseClient
  ): Promise<OrganizationSettings> {
    const client = supabase ?? (await createClientForContext());

    // Try to get existing settings
    const { data: existing, error: fetchError } = await client
      .from("organization_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    if (existing) {
      return transformSettings(existing);
    }

    // Create default settings if not found
    if (fetchError?.code === "PGRST116") {
      const { data: created, error: createError } = await client
        .from("organization_settings")
        .insert({
          organization_id: organizationId,
        })
        .select()
        .single();

      if (createError) throw createError;
      return transformSettings(created);
    }

    if (fetchError) throw fetchError;
    throw new Error("Unexpected error in getOrCreate");
  }

  /**
   * Update settings
   */
  static async update(
    input: UpdateOrganizationSettingsInput,
    supabase?: SupabaseClient
  ): Promise<OrganizationSettings> {
    const client = supabase ?? (await createClientForContext());

    // First get existing settings to merge billing_config
    const existing = await this.getOrCreate(input.organizationId, client);

    const dbUpdates: Record<string, unknown> = {};

    if (input.billingConfig !== undefined) {
      // Merge with existing billing config
      dbUpdates.billing_config = {
        ...existing.billing,
        ...input.billingConfig,
      };
    }
    if (input.sendWelcomeEmail !== undefined)
      dbUpdates.send_welcome_email = input.sendWelcomeEmail;
    if (input.sendReceiptEmail !== undefined)
      dbUpdates.send_receipt_email = input.sendReceiptEmail;
    if (input.sendEligibilityEmail !== undefined)
      dbUpdates.send_eligibility_email = input.sendEligibilityEmail;
    if (input.requireAgreementSignature !== undefined)
      dbUpdates.require_agreement_signature = input.requireAgreementSignature;
    if (input.agreementTemplateVersion !== undefined)
      dbUpdates.agreement_template_version = input.agreementTemplateVersion;

    const { data, error } = await client
      .from("organization_settings")
      .update(dbUpdates)
      .eq("organization_id", input.organizationId)
      .select()
      .single();

    if (error) throw error;
    return transformSettings(data);
  }

  /**
   * Get billing config with defaults
   */
  static async getBillingConfig(
    organizationId: string,
    supabase?: SupabaseClient
  ): Promise<BillingConfig> {
    const settings = await this.getOrCreate(
      organizationId,
      supabase ?? (await createClientForContext())
    );
    return settings.billing;
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

interface DbOrganizationRow {
  id: string;
  name: string;
  slug: string;
  address: Address;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  stripe_connect_id: string | null;
  stripe_onboarded: boolean;
  platform_fee: number | null;
  pass_fees_to_member: boolean | null;
  created_at: string;
  updated_at: string;
}

interface DbOrganizationSettingsRow {
  id: string;
  organization_id: string;
  billing_config: Partial<BillingConfig> | null;
  send_welcome_email: boolean;
  send_receipt_email: boolean;
  send_eligibility_email: boolean;
  require_agreement_signature: boolean;
  agreement_template_version: string;
  created_at: string;
  updated_at: string;
}

function transformOrganization(dbOrg: DbOrganizationRow): Organization {
  return {
    id: dbOrg.id,
    name: dbOrg.name,
    slug: dbOrg.slug,
    address: dbOrg.address,
    phone: dbOrg.phone || "",
    email: dbOrg.email || "",
    timezone: dbOrg.timezone || "America/Los_Angeles",
    stripeConnectId: dbOrg.stripe_connect_id,
    stripeOnboarded: dbOrg.stripe_onboarded,
    platformFee: dbOrg.platform_fee || 0,
    passFeesToMember: dbOrg.pass_fees_to_member || false,
    createdAt: dbOrg.created_at,
    updatedAt: dbOrg.updated_at,
  };
}

function transformSettings(dbSettings: DbOrganizationSettingsRow): OrganizationSettings {
  const billingConfig = dbSettings.billing_config || {};

  return {
    id: dbSettings.id,
    organizationId: dbSettings.organization_id,
    billing: {
      lapseDays: billingConfig.lapseDays ?? 7,
      cancelMonths: billingConfig.cancelMonths ?? 24,
      reminderSchedule: billingConfig.reminderSchedule ?? [3, 7, 14],
      maxReminders: billingConfig.maxReminders ?? 3,
      sendInvoiceReminders: billingConfig.sendInvoiceReminders ?? true,
      eligibilityMonths: billingConfig.eligibilityMonths ?? 60,
    },
    sendWelcomeEmail: dbSettings.send_welcome_email,
    sendReceiptEmail: dbSettings.send_receipt_email,
    sendEligibilityEmail: dbSettings.send_eligibility_email,
    requireAgreementSignature: dbSettings.require_agreement_signature,
    agreementTemplateVersion: dbSettings.agreement_template_version,
    createdAt: dbSettings.created_at,
    updatedAt: dbSettings.updated_at,
  };
}

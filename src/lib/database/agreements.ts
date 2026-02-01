import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agreement } from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateAgreementInput {
  organizationId: string;
  membershipId: string;
  memberId: string;
  templateVersion: string;
  sentAt: string;
}

export interface SignAgreementInput {
  agreementId: string;
  signedName: string;
  signatureImageUrl?: string;
  pdfUrl?: string;
  templateLanguage?: "en" | "fa";
  ipAddress?: string;
  userAgent?: string;
  consentChecked?: boolean;
}

// =============================================================================
// AgreementsService
// =============================================================================

export class AgreementsService {
  /**
   * Get all agreements for an organization
   */
  static async getAll(organizationId: string): Promise<Agreement[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("agreements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformAgreements(data || []);
  }

  /**
   * Get a single agreement by ID
   */
  static async getById(agreementId: string, client?: SupabaseClient): Promise<Agreement | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("agreements")
      .select("*")
      .eq("id", agreementId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformAgreement(data);
  }

  /**
   * Get agreement by membership ID
   */
  static async getByMembershipId(
    membershipId: string
  ): Promise<Agreement | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("agreements")
      .select("*")
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformAgreement(data);
  }

  /**
   * Get agreements by member ID
   */
  static async getByMemberId(memberId: string): Promise<Agreement[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("agreements")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformAgreements(data || []);
  }

  /**
   * Create a new agreement (when sent for signature)
   */
  static async create(
    input: CreateAgreementInput,
    supabase?: SupabaseClient
  ): Promise<Agreement> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("agreements")
      .insert({
        organization_id: input.organizationId,
        membership_id: input.membershipId,
        member_id: input.memberId,
        template_version: input.templateVersion,
        sent_at: input.sentAt,
      })
      .select()
      .single();

    if (error) throw error;
    return transformAgreement(data);
  }

  /**
   * Sign an agreement
   */
  static async sign(
    input: SignAgreementInput,
    supabase?: SupabaseClient
  ): Promise<Agreement> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("agreements")
      .update({
        signed_name: input.signedName,
        signature_image_url: input.signatureImageUrl || null,
        pdf_url: input.pdfUrl || null,
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        consent_checked: input.consentChecked ?? false,
        signed_at: new Date().toISOString(),
      })
      .eq("id", input.agreementId)
      .select()
      .single();

    if (error) throw error;
    return transformAgreement(data);
  }

  /**
   * Get unsigned agreements (awaiting signature)
   */
  static async getUnsigned(organizationId: string): Promise<Agreement[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("agreements")
      .select("*")
      .eq("organization_id", organizationId)
      .is("signed_at", null)
      .order("sent_at", { ascending: false });

    if (error) throw error;
    return transformAgreements(data || []);
  }

  /**
   * Delete an agreement
   */
  static async delete(agreementId: string): Promise<void> {
    const supabase = await createClientForContext();

    const { error } = await supabase
      .from("agreements")
      .delete()
      .eq("id", agreementId);

    if (error) throw error;
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

function transformAgreement(dbAgreement: any): Agreement {
  return {
    id: dbAgreement.id,
    organizationId: dbAgreement.organization_id,
    membershipId: dbAgreement.membership_id,
    memberId: dbAgreement.member_id,
    templateVersion: dbAgreement.template_version,
    templateLanguage: dbAgreement.template_language || undefined,
    pdfUrl: dbAgreement.pdf_url,
    signatureImageUrl: dbAgreement.signature_image_url,
    signedName: dbAgreement.signed_name,
    ipAddress: dbAgreement.ip_address,
    userAgent: dbAgreement.user_agent,
    consentChecked: dbAgreement.consent_checked,
    sentAt: dbAgreement.sent_at,
    signedAt: dbAgreement.signed_at,
    createdAt: dbAgreement.created_at,
  };
}

function transformAgreements(dbAgreements: any[]): Agreement[] {
  return dbAgreements.map(transformAgreement);
}

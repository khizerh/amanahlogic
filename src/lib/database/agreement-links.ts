import "server-only";

import { createServiceRoleClient, createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AgreementSigningLink {
  id: string;
  agreementId: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface CreateSigningLinkInput {
  agreementId: string;
  token: string;
  expiresAt: string;
}

export class AgreementSigningLinksService {
  /**
   * Create a signing link record (single-use token)
   */
  static async create(
    input: CreateSigningLinkInput,
    supabase?: SupabaseClient
  ): Promise<AgreementSigningLink> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("agreement_signing_links")
      .insert({
        agreement_id: input.agreementId,
        token: input.token,
        expires_at: input.expiresAt,
      })
      .select()
      .single();

    if (error) throw error;
    return transformLink(data);
  }

  /**
   * Get an active (unused + unexpired) link by token
   *
   * Uses service role because public signers are unauthenticated.
   */
  static async getActiveByToken(token: string): Promise<AgreementSigningLink | null> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("agreement_signing_links")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? transformLink(data) : null;
  }

  /**
   * Mark a link as used
   */
  static async markUsed(linkId: string, supabase?: SupabaseClient): Promise<void> {
    const client = supabase ?? (await createClientForContext());

    const { error } = await client
      .from("agreement_signing_links")
      .update({ used_at: new Date().toISOString() })
      .eq("id", linkId);

    if (error) throw error;
  }

  /**
   * Get the active (unused + unexpired) link for an agreement
   */
  static async getActiveByAgreementId(
    agreementId: string,
    supabase?: SupabaseClient
  ): Promise<AgreementSigningLink | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("agreement_signing_links")
      .select("*")
      .eq("agreement_id", agreementId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? transformLink(data) : null;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function transformLink(dbLink: any): AgreementSigningLink {
  return {
    id: dbLink.id,
    agreementId: dbLink.agreement_id,
    token: dbLink.token,
    expiresAt: dbLink.expires_at,
    usedAt: dbLink.used_at,
    createdAt: dbLink.created_at,
  };
}

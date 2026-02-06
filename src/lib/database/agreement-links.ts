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
   * Get a link by token regardless of used/expired status.
   * Uses service role because public signers are unauthenticated.
   */
  static async getByToken(token: string): Promise<AgreementSigningLink | null> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("agreement_signing_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? transformLink(data) : null;
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

  /**
   * Invalidate all active (unused) links for an agreement by marking them as used.
   * Called before creating a new link on resend so old links no longer work.
   */
  static async invalidateByAgreementId(
    agreementId: string,
    supabase?: SupabaseClient
  ): Promise<void> {
    const client = supabase ?? (await createClientForContext());

    const { error } = await client
      .from("agreement_signing_links")
      .update({ used_at: new Date().toISOString() })
      .eq("agreement_id", agreementId)
      .is("used_at", null);

    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface DbSigningLinkRow {
  id: string;
  agreement_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

function transformLink(dbLink: Record<string, unknown>): AgreementSigningLink {
  const row = dbLink as unknown as DbSigningLinkRow;
  return {
    id: row.id,
    agreementId: row.agreement_id,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

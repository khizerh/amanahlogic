import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgreementTemplate } from "@/lib/types";

export interface CreateAgreementTemplateInput {
  organizationId: string;
  language: "en" | "fa";
  version: string;
  storagePath: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateAgreementTemplateInput extends Partial<CreateAgreementTemplateInput> {
  id: string;
}

export class AgreementTemplatesService {
  static async getActiveByLanguage(
    organizationId: string,
    language: "en" | "fa",
    supabase?: SupabaseClient
  ): Promise<AgreementTemplate | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("agreement_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("language", language)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? transformTemplate(data) : null;
  }

  static async getByVersion(
    organizationId: string,
    version: string,
    client?: SupabaseClient
  ): Promise<AgreementTemplate | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("agreement_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("version", version)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? transformTemplate(data) : null;
  }

  static async getAllByOrg(organizationId: string): Promise<AgreementTemplate[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("agreement_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformTemplates(data || []);
  }

  static async create(
    input: CreateAgreementTemplateInput,
    supabase?: SupabaseClient
  ): Promise<AgreementTemplate> {
    const client = supabase ?? (await createClientForContext());

    if (input.isActive) {
      // Deactivate existing active template for this language
      await client
        .from("agreement_templates")
        .update({ is_active: false })
        .eq("organization_id", input.organizationId)
        .eq("language", input.language)
        .eq("is_active", true);
    }

    const { data, error } = await client
      .from("agreement_templates")
      .insert({
        organization_id: input.organizationId,
        language: input.language,
        version: input.version,
        storage_path: input.storagePath,
        is_active: input.isActive ?? true,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return transformTemplate(data);
  }

  static async setActive(
    organizationId: string,
    templateId: string,
    language: "en" | "fa",
    supabase?: SupabaseClient
  ): Promise<void> {
    const client = supabase ?? (await createClientForContext());

    await client
      .from("agreement_templates")
      .update({ is_active: false })
      .eq("organization_id", organizationId)
      .eq("language", language);

    await client
      .from("agreement_templates")
      .update({ is_active: true })
      .eq("id", templateId);
  }
}

interface DbTemplateRow {
  id: string;
  organization_id: string;
  language: "en" | "fa";
  version: string;
  storage_path: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

function transformTemplate(db: Record<string, unknown>): AgreementTemplate {
  const row = db as unknown as DbTemplateRow;
  return {
    id: row.id,
    organizationId: row.organization_id,
    language: row.language,
    version: row.version,
    storagePath: row.storage_path,
    isActive: row.is_active,
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}

function transformTemplates(dbTemplates: Record<string, unknown>[]): AgreementTemplate[] {
  return dbTemplates.map(transformTemplate);
}

/**
 * Resolve a template storage path to a URL.
 * - If storagePath is already a URL, return it.
 * - Otherwise, create a signed URL from the bucket.
 */
export async function resolveTemplateUrl(storagePath: string, client?: SupabaseClient): Promise<string> {
  if (storagePath.startsWith("http")) return storagePath;

  const supabase = client ?? (await createClientForContext());
  const bucket = process.env.AGREEMENT_TEMPLATES_BUCKET || "agreement-templates";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 30); // 30 days

  if (error || !data) {
    throw new Error(`Failed to create signed URL for template: ${error?.message}`);
  }

  return data.signedUrl;
}

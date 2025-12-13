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
    language: "en" | "fa"
  ): Promise<AgreementTemplate | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
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
    version: string
  ): Promise<AgreementTemplate | null> {
    const supabase = await createClientForContext();

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

function transformTemplate(db: any): AgreementTemplate {
  return {
    id: db.id,
    organizationId: db.organization_id,
    language: db.language,
    version: db.version,
    storagePath: db.storage_path,
    isActive: db.is_active,
    notes: db.notes || "",
    createdAt: db.created_at,
  };
}

function transformTemplates(dbTemplates: any[]): AgreementTemplate[] {
  return dbTemplates.map(transformTemplate);
}

/**
 * Resolve a template storage path to a URL.
 * - If storagePath is already a URL, return it.
 * - Otherwise, create a signed URL from the bucket.
 */
export async function resolveTemplateUrl(storagePath: string): Promise<string> {
  if (storagePath.startsWith("http")) return storagePath;

  const supabase = await createClientForContext();
  const bucket = process.env.AGREEMENT_TEMPLATES_BUCKET || "agreement-templates";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 30); // 30 days

  if (error || !data) {
    throw new Error(`Failed to create signed URL for template: ${error?.message}`);
  }

  return data.signedUrl;
}

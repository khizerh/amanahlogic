import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTemplate, EmailTemplateType } from "@/lib/types";

export interface CreateEmailTemplateInput {
  organizationId: string;
  type: EmailTemplateType | "custom";
  name: string;
  description?: string;
  subject: { en: string; fa: string };
  body: { en: string; fa: string };
  variables?: string[];
  isActive?: boolean;
}

export interface UpdateEmailTemplateInput extends Partial<CreateEmailTemplateInput> {
  id: string;
}

export class EmailTemplatesService {
  static async getAll(organizationId: string): Promise<EmailTemplate[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformTemplates(data || []);
  }

  static async create(
    input: CreateEmailTemplateInput,
    supabase?: SupabaseClient
  ): Promise<EmailTemplate> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_templates")
      .insert({
        organization_id: input.organizationId,
        type: input.type,
        name: input.name,
        description: input.description || null,
        subject: input.subject,
        body: input.body,
        variables: input.variables || [],
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return transformTemplate(data);
  }

  static async update(
    input: UpdateEmailTemplateInput,
    supabase?: SupabaseClient
  ): Promise<EmailTemplate> {
    const client = supabase ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
    if (updates.body !== undefined) dbUpdates.body = updates.body;
    if (updates.variables !== undefined) dbUpdates.variables = updates.variables;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;

    const { data, error } = await client
      .from("email_templates")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformTemplate(data);
  }
}

function transformTemplate(db: any): EmailTemplate {
  return {
    id: db.id,
    organizationId: db.organization_id,
    type: db.type,
    name: db.name,
    description: db.description || "",
    subject: db.subject,
    body: db.body,
    variables: db.variables || [],
    isActive: db.is_active,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformTemplates(dbTemplates: any[]): EmailTemplate[] {
  return dbTemplates.map(transformTemplate);
}

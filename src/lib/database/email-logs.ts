import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmailLog,
  EmailStatus,
  EmailTemplateType,
  CommunicationLanguage,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateEmailLogInput {
  organizationId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  templateType: EmailTemplateType | "custom";
  to: string;
  subject: string;
  bodyPreview?: string;
  language?: CommunicationLanguage;
  status?: EmailStatus;
  resendId?: string;
}

export interface UpdateEmailLogInput {
  id: string;
  status?: EmailStatus;
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  resendId?: string;
}

// =============================================================================
// EmailLogsService
// =============================================================================

export class EmailLogsService {
  /**
   * Get all email logs for an organization
   */
  static async getAll(organizationId: string): Promise<EmailLog[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformEmailLogs(data || []);
  }

  /**
   * Get email logs with filters
   */
  static async getFiltered(
    organizationId: string,
    filters?: {
      memberId?: string;
      templateType?: EmailTemplateType | "all";
      status?: EmailStatus | "all";
      limit?: number;
    }
  ): Promise<EmailLog[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("email_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (filters?.memberId) {
      query = query.eq("member_id", filters.memberId);
    }

    if (filters?.templateType && filters.templateType !== "all") {
      query = query.eq("template_type", filters.templateType);
    }

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return transformEmailLogs(data || []);
  }

  /**
   * Get a single email log by ID
   */
  static async getById(emailLogId: string): Promise<EmailLog | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .eq("id", emailLogId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformEmailLog(data);
  }

  /**
   * Get email logs by member ID
   * @param memberId - The member ID
   * @param organizationId - Optional org ID to enforce org scoping (recommended for security)
   */
  static async getByMemberId(
    memberId: string,
    organizationId?: string
  ): Promise<EmailLog[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("email_logs")
      .select("*")
      .eq("member_id", memberId);

    // Enforce org scoping if organizationId is provided
    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return transformEmailLogs(data || []);
  }

  /**
   * Get email log by Resend ID
   */
  static async getByResendId(
    resendId: string,
    supabase?: SupabaseClient
  ): Promise<EmailLog | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_logs")
      .select("*")
      .eq("resend_id", resendId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformEmailLog(data);
  }

  /**
   * Create a new email log entry
   */
  static async create(
    input: CreateEmailLogInput,
    supabase?: SupabaseClient
  ): Promise<EmailLog> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_logs")
      .insert({
        organization_id: input.organizationId,
        member_id: input.memberId,
        member_name: input.memberName,
        member_email: input.memberEmail,
        template_type: input.templateType,
        to: input.to,
        subject: input.subject,
        body_preview: input.bodyPreview || null,
        language: input.language || "en",
        status: input.status || "queued",
        resend_id: input.resendId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return transformEmailLog(data);
  }

  /**
   * Update an email log
   */
  static async update(
    input: UpdateEmailLogInput,
    supabase?: SupabaseClient
  ): Promise<EmailLog> {
    const client = supabase ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.sentAt !== undefined) dbUpdates.sent_at = updates.sentAt;
    if (updates.deliveredAt !== undefined)
      dbUpdates.delivered_at = updates.deliveredAt;
    if (updates.failureReason !== undefined)
      dbUpdates.failure_reason = updates.failureReason;
    if (updates.resendId !== undefined) dbUpdates.resend_id = updates.resendId;

    const { data, error } = await client
      .from("email_logs")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformEmailLog(data);
  }

  /**
   * Mark email as sent
   */
  static async markSent(
    emailLogId: string,
    resendId: string,
    supabase?: SupabaseClient
  ): Promise<EmailLog> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_logs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: resendId,
      })
      .eq("id", emailLogId)
      .select()
      .single();

    if (error) throw error;
    return transformEmailLog(data);
  }

  /**
   * Mark email as delivered
   */
  static async markDelivered(
    emailLogId: string,
    supabase?: SupabaseClient
  ): Promise<EmailLog> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_logs")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", emailLogId)
      .select()
      .single();

    if (error) throw error;
    return transformEmailLog(data);
  }

  /**
   * Mark email as failed
   */
  static async markFailed(
    emailLogId: string,
    reason: string,
    supabase?: SupabaseClient
  ): Promise<EmailLog> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_logs")
      .update({
        status: "failed",
        failure_reason: reason,
      })
      .eq("id", emailLogId)
      .select()
      .single();

    if (error) throw error;
    return transformEmailLog(data);
  }

  /**
   * Mark email as bounced
   */
  static async markBounced(
    emailLogId: string,
    reason: string,
    supabase?: SupabaseClient
  ): Promise<EmailLog> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("email_logs")
      .update({
        status: "bounced",
        failure_reason: reason,
      })
      .eq("id", emailLogId)
      .select()
      .single();

    if (error) throw error;
    return transformEmailLog(data);
  }

  /**
   * Get email statistics for an organization
   */
  static async getStats(
    organizationId: string
  ): Promise<Record<EmailStatus, number>> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("email_logs")
      .select("status")
      .eq("organization_id", organizationId);

    if (error) throw error;

    const stats: Record<EmailStatus, number> = {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      bounced: 0,
    };

    (data || []).forEach((log) => {
      stats[log.status as EmailStatus]++;
    });

    return stats;
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

function transformEmailLog(dbLog: any): EmailLog {
  return {
    id: dbLog.id,
    organizationId: dbLog.organization_id,
    memberId: dbLog.member_id,
    memberName: dbLog.member_name,
    memberEmail: dbLog.member_email,
    templateType: dbLog.template_type,
    to: dbLog.to,
    subject: dbLog.subject,
    bodyPreview: dbLog.body_preview || "",
    language: dbLog.language,
    status: dbLog.status,
    sentAt: dbLog.sent_at,
    deliveredAt: dbLog.delivered_at,
    failureReason: dbLog.failure_reason,
    resendId: dbLog.resend_id,
    createdAt: dbLog.created_at,
  };
}

function transformEmailLogs(dbLogs: any[]): EmailLog[] {
  return dbLogs.map(transformEmailLog);
}

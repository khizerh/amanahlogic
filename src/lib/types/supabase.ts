export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agreement_signing_links: {
        Row: {
          agreement_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          agreement_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          agreement_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_signing_links_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          language: string
          notes: string | null
          organization_id: string
          storage_path: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          language: string
          notes?: string | null
          organization_id: string
          storage_path: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          notes?: string | null
          organization_id?: string
          storage_path?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          consent_checked: boolean | null
          created_at: string | null
          id: string
          ip_address: string | null
          member_id: string
          membership_id: string
          organization_id: string
          pdf_url: string | null
          sent_at: string
          signature_image_url: string | null
          signed_at: string | null
          signed_name: string | null
          template_version: string
          user_agent: string | null
        }
        Insert: {
          consent_checked?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          member_id: string
          membership_id: string
          organization_id: string
          pdf_url?: string | null
          sent_at: string
          signature_image_url?: string | null
          signed_at?: string | null
          signed_name?: string | null
          template_version: string
          user_agent?: string | null
        }
        Update: {
          consent_checked?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          member_id?: string
          membership_id?: string
          organization_id?: string
          pdf_url?: string | null
          sent_at?: string
          signature_image_url?: string | null
          signed_at?: string | null
          signed_name?: string | null
          template_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body_preview: string | null
          created_at: string | null
          delivered_at: string | null
          failure_reason: string | null
          id: string
          language: string | null
          member_email: string
          member_id: string | null
          member_name: string
          organization_id: string
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_type: string
          to: string
        }
        Insert: {
          body_preview?: string | null
          created_at?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          language?: string | null
          member_email: string
          member_id?: string | null
          member_name: string
          organization_id: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_type: string
          to: string
        }
        Update: {
          body_preview?: string | null
          created_at?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          language?: string | null
          member_email?: string
          member_id?: string | null
          member_name?: string
          organization_id?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_type?: string
          to?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          subject: Json
          type: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          subject: Json
          type: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          subject?: Json
          type?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          id: string
          last_sequence: number | null
          organization_id: string
          year_month: string
        }
        Insert: {
          id?: string
          last_sequence?: number | null
          organization_id: string
          year_month: string
        }
        Update: {
          id?: string
          last_sequence?: number | null
          organization_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          member_id: string
          organization_id: string
          sent_at: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          member_id: string
          organization_id: string
          sent_at?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          member_id?: string
          organization_id?: string
          sent_at?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: Json
          children: Json | null
          created_at: string | null
          email: string | null
          emergency_contact: Json
          first_name: string
          id: string
          last_name: string
          middle_name: string | null
          organization_id: string
          phone: string | null
          preferred_language: string | null
          spouse_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: Json
          children?: Json | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: Json
          first_name: string
          id?: string
          last_name: string
          middle_name?: string | null
          organization_id: string
          phone?: string | null
          preferred_language?: string | null
          spouse_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: Json
          children?: Json | null
          created_at?: string | null
          email?: string
          emergency_contact?: Json
          first_name?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          organization_id?: string
          phone?: string | null
          preferred_language?: string | null
          spouse_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          agreement_id: string | null
          agreement_signed_at: string | null
          auto_pay_enabled: boolean | null
          billing_anniversary_day: number | null
          billing_frequency: string
          cancelled_date: string | null
          created_at: string | null
          eligible_date: string | null
          enrollment_fee_status: string | null
          id: string
          join_date: string | null
          last_payment_date: string | null
          member_id: string
          next_payment_due: string | null
          organization_id: string
          paid_months: number | null
          payer_member_id: string | null
          payment_method: Json | null
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          agreement_id?: string | null
          agreement_signed_at?: string | null
          auto_pay_enabled?: boolean | null
          billing_anniversary_day?: number | null
          billing_frequency?: string
          cancelled_date?: string | null
          created_at?: string | null
          eligible_date?: string | null
          enrollment_fee_status?: string | null
          id?: string
          join_date?: string | null
          last_payment_date?: string | null
          member_id: string
          next_payment_due?: string | null
          organization_id: string
          paid_months?: number | null
          payer_member_id?: string | null
          payment_method?: Json | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          agreement_id?: string | null
          agreement_signed_at?: string | null
          auto_pay_enabled?: boolean | null
          billing_anniversary_day?: number | null
          billing_frequency?: string
          cancelled_date?: string | null
          created_at?: string | null
          eligible_date?: string | null
          enrollment_fee_status?: string | null
          id?: string
          join_date?: string | null
          last_payment_date?: string | null
          member_id?: string
          next_payment_due?: string | null
          organization_id?: string
          paid_months?: number | null
          payer_member_id?: string | null
          payment_method?: Json | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_invites: {
        Row: {
          billing_frequency: string | null
          completed_at: string | null
          created_at: string | null
          dues_amount: number
          dues_paid_at: string | null
          enrollment_fee_amount: number
          enrollment_fee_paid_at: string | null
          expired_at: string | null
          first_charge_date: string | null
          id: string
          includes_enrollment_fee: boolean
          member_id: string
          membership_id: string
          organization_id: string
          payment_method: string
          planned_amount: number
          sent_at: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_setup_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_frequency?: string | null
          completed_at?: string | null
          created_at?: string | null
          dues_amount?: number
          dues_paid_at?: string | null
          enrollment_fee_amount?: number
          enrollment_fee_paid_at?: string | null
          expired_at?: string | null
          first_charge_date?: string | null
          id?: string
          includes_enrollment_fee?: boolean
          member_id: string
          membership_id: string
          organization_id: string
          payment_method?: string
          planned_amount: number
          sent_at: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_frequency?: string | null
          completed_at?: string | null
          created_at?: string | null
          dues_amount?: number
          dues_paid_at?: string | null
          enrollment_fee_amount?: number
          enrollment_fee_paid_at?: string | null
          expired_at?: string | null
          first_charge_date?: string | null
          id?: string
          includes_enrollment_fee?: boolean
          member_id?: string
          membership_id?: string
          organization_id?: string
          payment_method?: string
          planned_amount?: number
          sent_at?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_pay_invites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_pay_invites_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_pay_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          agreement_template_version: string | null
          billing_config: Json | null
          created_at: string | null
          id: string
          organization_id: string
          require_agreement_signature: boolean | null
          send_eligibility_email: boolean | null
          send_receipt_email: boolean | null
          send_welcome_email: boolean | null
          updated_at: string | null
        }
        Insert: {
          agreement_template_version?: string | null
          billing_config?: Json | null
          created_at?: string | null
          id?: string
          organization_id: string
          require_agreement_signature?: boolean | null
          send_eligibility_email?: boolean | null
          send_receipt_email?: boolean | null
          send_welcome_email?: boolean | null
          updated_at?: string | null
        }
        Update: {
          agreement_template_version?: string | null
          billing_config?: Json | null
          created_at?: string | null
          id?: string
          organization_id?: string
          require_agreement_signature?: boolean | null
          send_eligibility_email?: boolean | null
          send_receipt_email?: boolean | null
          send_welcome_email?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json
          created_at: string | null
          email: string | null
          id: string
          name: string
          pass_fees_to_member: boolean | null
          phone: string | null
          platform_fees: Json | null
          slug: string
          stripe_connect_id: string | null
          stripe_onboarded: boolean | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: Json
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          pass_fees_to_member?: boolean | null
          phone?: string | null
          platform_fees?: Json | null
          slug: string
          stripe_connect_id?: string | null
          stripe_onboarded?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: Json
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          pass_fees_to_member?: boolean | null
          phone?: string | null
          platform_fees?: Json | null
          slug?: string
          stripe_connect_id?: string | null
          stripe_onboarded?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          check_number: string | null
          created_at: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          member_id: string
          membership_id: string
          method: string | null
          months_credited: number | null
          net_amount: number
          notes: string | null
          organization_id: string
          paid_at: string | null
          period_end: string | null
          period_label: string | null
          period_start: string | null
          platform_fee: number | null
          recorded_by: string | null
          refunded_at: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          reminders_paused: boolean | null
          requires_review: boolean | null
          status: string
          stripe_charge_id: string | null
          stripe_fee: number | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_method_type: string | null
          total_charged: number
          type: string
          updated_at: string | null
          zelle_transaction_id: string | null
        }
        Insert: {
          amount: number
          check_number?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          member_id: string
          membership_id: string
          method?: string | null
          months_credited?: number | null
          net_amount: number
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          platform_fee?: number | null
          recorded_by?: string | null
          refunded_at?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          reminders_paused?: boolean | null
          requires_review?: boolean | null
          status?: string
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method_type?: string | null
          total_charged: number
          type: string
          updated_at?: string | null
          zelle_transaction_id?: string | null
        }
        Update: {
          amount?: number
          check_number?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          member_id?: string
          membership_id?: string
          method?: string | null
          months_credited?: number | null
          net_amount?: number
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          platform_fee?: number | null
          recorded_by?: string | null
          refunded_at?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          reminders_paused?: boolean | null
          requires_review?: boolean | null
          status?: string
          stripe_charge_id?: string | null
          stripe_fee?: number | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method_type?: string | null
          total_charged?: number
          type?: string
          updated_at?: string | null
          zelle_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          enrollment_fee: number
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          pricing: Json
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enrollment_fee?: number
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          pricing?: Json
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enrollment_fee?: number
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          pricing?: Json
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          membership_id: string | null
          organization_id: string | null
          payload: Json | null
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          membership_id?: string | null
          organization_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          membership_id?: string | null
          organization_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invoice_number: {
        Args: { p_organization_id: string }
        Returns: string
      }
      get_user_organization_id: { Args: never; Returns: string }
      next_invoice_sequence: {
        Args: { p_organization_id: string; p_year_month: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

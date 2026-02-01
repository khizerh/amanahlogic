"use server";

import { headers } from "next/headers";
import { MemberPortalService } from "@/lib/database/member-portal";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  isStripeConfigured,
  createCustomerPortalSession,
  isStripeConfigurationError,
  isStripeResourceMissingError,
} from "@/lib/stripe";
import type { MemberDashboardData, MemberPaymentHistory } from "@/lib/database/member-portal";

/**
 * Get member context from request headers (set by middleware)
 */
async function getMemberContext(): Promise<{ memberId: string; organizationId: string } | null> {
  const headersList = await headers();
  const memberId = headersList.get("x-member-id");
  const organizationId = headersList.get("x-organization-id");

  if (!memberId || !organizationId) {
    return null;
  }

  return { memberId, organizationId };
}

/**
 * Get dashboard data for current member
 */
export async function getMemberDashboard(): Promise<{
  success: boolean;
  data?: MemberDashboardData;
  error?: string;
}> {
  try {
    const context = await getMemberContext();
    if (!context) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await MemberPortalService.getDashboardData(
      context.memberId,
      context.organizationId
    );

    if (!data) {
      return { success: false, error: "Member not found" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return { success: false, error: "Failed to load dashboard" };
  }
}

/**
 * Get payment history for current member
 */
export async function getMemberPayments(): Promise<{
  success: boolean;
  data?: MemberPaymentHistory;
  error?: string;
}> {
  try {
    const context = await getMemberContext();
    if (!context) {
      return { success: false, error: "Not authenticated" };
    }

    const data = await MemberPortalService.getPaymentHistory(
      context.memberId,
      context.organizationId
    );

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching payments:", error);
    return { success: false, error: "Failed to load payments" };
  }
}

/**
 * Update member profile
 */
export async function updateMemberProfile(updates: {
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  emergencyContact?: {
    name: string;
    phone: string;
  };
  preferredLanguage?: "en" | "fa";
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const context = await getMemberContext();
    if (!context) {
      return { success: false, error: "Not authenticated" };
    }

    await MemberPortalService.updateProfile(
      context.memberId,
      context.organizationId,
      updates
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

/**
 * Get Stripe portal URL for managing payment methods
 */
export async function getStripePortalUrl(): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const context = await getMemberContext();
    if (!context) {
      return { success: false, error: "Not authenticated" };
    }

    if (!isStripeConfigured()) {
      return { success: false, error: "Payment system is not configured" };
    }

    // Look up membership's Stripe customer ID
    const supabase = createServiceRoleClient();
    const { data: membership } = await supabase
      .from("memberships")
      .select("stripe_customer_id")
      .eq("member_id", context.memberId)
      .eq("organization_id", context.organizationId)
      .single();

    if (!membership?.stripe_customer_id) {
      return { success: false, error: "No payment method on file. Contact your organization to set up payments." };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
    const returnUrl = `${baseUrl}/portal/profile`;

    try {
      const portalSession = await createCustomerPortalSession({
        customerId: membership.stripe_customer_id,
        returnUrl,
      });
      return { success: true, url: portalSession.url };
    } catch (error) {
      if (isStripeConfigurationError(error)) {
        return { success: false, error: "Payment portal is not configured. Please contact support." };
      }
      if (isStripeResourceMissingError(error)) {
        return { success: false, error: "Payment account not found. Please contact your organization." };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error getting Stripe portal:", error);
    return { success: false, error: "Failed to access payment portal" };
  }
}

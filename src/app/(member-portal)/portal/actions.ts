"use server";

import { headers } from "next/headers";
import { MemberPortalService } from "@/lib/database/member-portal";
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

    const customerId = await MemberPortalService.getStripeCustomerId(
      context.memberId,
      context.organizationId
    );

    if (!customerId) {
      return { success: false, error: "No payment method on file" };
    }

    // Call existing Stripe portal endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to create portal session" };
    }

    const data = await response.json();
    return { success: true, url: data.url };
  } catch (error) {
    console.error("Error getting Stripe portal:", error);
    return { success: false, error: "Failed to access payment portal" };
  }
}

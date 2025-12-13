import { Resend } from "resend";

// Initialize Resend client (will be undefined if key not set)
const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const FROM_EMAIL = process.env.RESEND_FROM_ADDRESS || "noreply@amanahlogic.com";

/**
 * Check if email sending is configured
 */
export function isEmailConfigured(): boolean {
  return resend !== null;
}

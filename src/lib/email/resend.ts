import { Resend } from "resend";

// Initialize Resend client (will be undefined if key not set)
const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Base domain for sending emails (verified in Resend)
const EMAIL_DOMAIN = "amanahlogic.com";

// Default from address (used when org info not available)
export const FROM_EMAIL = process.env.RESEND_FROM_ADDRESS || `support@${EMAIL_DOMAIN}`;

/**
 * Check if email sending is configured
 */
export function isEmailConfigured(): boolean {
  return resend !== null;
}

/**
 * Email sender configuration for an organization
 */
export interface OrgEmailConfig {
  from: string;      // "Org Name" <org-slug@amanahlogic.com>
  replyTo: string;   // org's contact email
}

/**
 * Get organization-specific email configuration
 *
 * @param org - Organization data with name, slug, and email
 * @returns Email config with from address and reply-to
 *
 * @example
 * const config = getOrgEmailConfig({
 *   name: "Masjid Muhajireen",
 *   slug: "masjid-muhajireen",
 *   email: "info@masjidmuhajireen.org"
 * });
 * // Returns:
 * // {
 * //   from: '"Masjid Muhajireen" <masjid-muhajireen@amanahlogic.com>',
 * //   replyTo: 'info@masjidmuhajireen.org'
 * // }
 */
export function getOrgEmailConfig(org: {
  name: string;
  slug: string;
  email?: string | null;
}): OrgEmailConfig {
  // Build from address: "Org Name" <slug@domain>
  const fromEmail = `${org.slug}@${EMAIL_DOMAIN}`;
  const from = `"${org.name}" <${fromEmail}>`;

  // Reply-to is the org's contact email, fallback to from email
  const replyTo = org.email || fromEmail;

  return { from, replyTo };
}

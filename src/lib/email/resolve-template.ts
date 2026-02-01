import { EmailTemplatesService } from "@/lib/database/email-templates";
import type { EmailTemplateType } from "@/lib/types";

/**
 * Wrap plain-text email body in a branded HTML email layout.
 *
 * - Double newlines → paragraph breaks
 * - Single newlines → <br>
 * - URLs → styled link buttons
 * - RTL + dir="rtl" for Farsi
 */
export function wrapInEmailHtml(
  bodyText: string,
  orgName: string,
  language: "en" | "fa"
): { html: string; text: string } {
  const isRtl = language === "fa";
  const dir = isRtl ? ' dir="rtl" lang="fa"' : "";
  const lineHeight = isRtl ? "1.8" : "1.6";
  const direction = isRtl ? " direction: rtl;" : "";

  // Build plain text version (returned as-is, with URLs intact)
  const text = bodyText;

  // Build HTML version
  const paragraphs = bodyText.split(/\n{2,}/);
  const htmlParagraphs = paragraphs
    .map((para) => {
      // Convert single newlines to <br>
      let html = para
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>");

      // Detect URLs and turn them into styled buttons/links
      html = html.replace(
        /(https?:\/\/[^\s<]+)/g,
        (_match, url) =>
          `</p><div style="text-align: center; margin: 20px 0;"><a href="${url}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">${isRtl ? "برای ادامه کلیک کنید" : "Click Here"}</a></div><p style="color: #666; font-size: 12px;">If the button doesn't work: <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a></p><p>`
      );

      return `<p>${html}</p>`;
    })
    .join("\n\n");

  const html = `
<!DOCTYPE html>
<html${dir}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: ${lineHeight}; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;${direction}">
  <div style="margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${escapeHtml(orgName)}</h1>
  </div>

  ${htmlParagraphs}

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${escapeHtml(orgName)}
  </p>
</body>
</html>`.trim();

  return { html, text };
}

/**
 * Try to resolve an email template from the database.
 *
 * Returns { subject, html, text } if found and active.
 * Returns null if not found, inactive, or on error — caller should fall
 * back to the hardcoded template.
 */
export async function resolveEmailTemplate(
  orgId: string,
  type: EmailTemplateType,
  variables: Record<string, string>,
  language: "en" | "fa",
  orgName: string
): Promise<{ subject: string; html: string; text: string } | null> {
  try {
    const template = await EmailTemplatesService.getByType(orgId, type);
    if (!template) return null;

    // Pick localised subject + body
    const rawSubject = template.subject[language] || template.subject.en;
    const rawBody = template.body[language] || template.body.en;

    if (!rawSubject || !rawBody) return null;

    // Substitute {{var}} placeholders
    const subject = substituteVariables(rawSubject, variables);
    const bodyText = substituteVariables(rawBody, variables);

    // Wrap plain text body in branded HTML
    const { html, text } = wrapInEmailHtml(bodyText, orgName, language);

    return { subject, html, text };
  } catch (err) {
    console.error(`[resolveEmailTemplate] Error resolving ${type}:`, err);
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function substituteVariables(
  template: string,
  variables: Record<string, string>
): string {
  // Handle {{#if var}}...{{/if}} conditional blocks
  let result = template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key, content) => {
      const value = variables[key];
      // Show content only if variable is truthy (non-empty)
      return value ? content : "";
    }
  );

  // Handle simple {{var}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return variables[key] ?? "";
  });

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

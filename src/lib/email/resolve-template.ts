import * as React from "react";
import { Text, Link } from "@react-email/components";
import { render } from "@react-email/render";
import { EmailLayout } from "@emails/components/EmailLayout";
import { EmailTemplatesService } from "@/lib/database/email-templates";
import type { EmailTemplateType } from "@/lib/types";

/**
 * Wrap plain-text email body in a branded HTML email layout
 * using the shared EmailLayout React Email component.
 *
 * - Double newlines → paragraph breaks
 * - Single newlines → <br>
 * - URLs → styled CTA buttons with fallback link
 */
export async function wrapInEmailHtml(
  bodyText: string,
  orgName: string,
  language: "en" | "fa"
): Promise<{ html: string; text: string }> {
  const isRtl = language === "fa";
  const text = bodyText;

  // Parse body into paragraphs, extracting URLs for CTA buttons
  const paragraphs = bodyText.split(/\n{2,}/);
  const childElements: React.ReactNode[] = [];
  let foundUrl: string | undefined;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    // Check for URLs in this paragraph
    const urlMatch = para.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch && !foundUrl) {
      foundUrl = urlMatch[1];
    }

    // Convert single newlines to <br> by splitting
    const lines = para.split("\n");
    const content: React.ReactNode[] = [];
    lines.forEach((line, j) => {
      if (j > 0) content.push(React.createElement("br", { key: `br-${i}-${j}` }));
      // Replace URLs in line with Link components
      const parts = line.split(/(https?:\/\/[^\s]+)/g);
      parts.forEach((part, k) => {
        if (/^https?:\/\//.test(part)) {
          content.push(
            React.createElement(Link, { key: `link-${i}-${j}-${k}`, href: part, style: { color: "#2563eb", wordBreak: "break-all" as const } }, part)
          );
        } else if (part) {
          content.push(part);
        }
      });
    });

    childElements.push(
      React.createElement(Text, { key: `p-${i}`, style: { fontSize: "16px", lineHeight: 1.6, color: "#1f2937" } }, ...content)
    );
  }

  // Build the React element tree
  const element = React.createElement(
    EmailLayout,
    {
      title: orgName,
      language,
      cta: foundUrl ? { label: isRtl ? "برای ادامه کلیک کنید" : "Click Here", url: foundUrl } : undefined,
      footer: { organization_name: orgName },
      children: React.createElement(React.Fragment, null, ...childElements),
    },
  );

  const html = await render(element);
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
    const { html, text } = await wrapInEmailHtml(bodyText, orgName, language);

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

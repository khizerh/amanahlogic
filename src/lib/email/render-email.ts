import { render } from "@react-email/render";
import type { ReactElement } from "react";

export async function renderEmail(
  element: ReactElement,
  subject: string
): Promise<{ subject: string; html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { subject, html, text };
}

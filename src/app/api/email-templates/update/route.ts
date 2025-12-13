import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { EmailTemplatesService } from "@/lib/database/email-templates";

interface UpdateTemplateBody {
  id: string;
  subject?: { en: string; fa: string };
  body?: { en: string; fa: string };
  isActive?: boolean;
}

export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const body = (await req.json()) as UpdateTemplateBody;

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updated = await EmailTemplatesService.update({
      id: body.id,
      organizationId,
      subject: body.subject,
      body: body.body,
      isActive: body.isActive,
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

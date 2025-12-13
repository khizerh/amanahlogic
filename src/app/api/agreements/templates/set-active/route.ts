import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";

interface SetActiveBody {
  templateId: string;
  language: "en" | "fa";
}

export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const { templateId, language }: SetActiveBody = await req.json();

    if (!templateId || !language) {
      return NextResponse.json({ error: "templateId and language are required" }, { status: 400 });
    }

    await AgreementTemplatesService.setActive(organizationId, templateId, language);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set active template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { placeholderTestEmailService } from "@/lib/testEmailService";
import type { TestEmailResponse } from "@/lib/types";

export const runtime = "nodejs";

function jsonResponse(body: TestEmailResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let body: {
    templateId?: unknown;
    recipientEmail?: unknown;
    mjml?: unknown;
    html?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  if (typeof body.recipientEmail !== "string" || !body.recipientEmail.includes("@")) {
    return jsonResponse({ ok: false, error: "Zadejte validni e-mail prijemce." }, 400);
  }

  if (typeof body.mjml !== "string" || !body.mjml.trim()) {
    return jsonResponse({ ok: false, error: "Chybi MJML sablony pro test." }, 400);
  }

  const result = await placeholderTestEmailService.sendTestEmail({
    templateId: typeof body.templateId === "string" ? body.templateId : undefined,
    recipientEmail: body.recipientEmail,
    mjml: body.mjml,
    html: typeof body.html === "string" ? body.html : ""
  });

  return jsonResponse(result, result.ok ? 200 : 501);
}

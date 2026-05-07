import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCampaign, updateCampaign } from "@/lib/campaignStore";
import { placeholderCampaignSendService } from "@/lib/campaignSendService";
import type { CampaignTestSend, TestEmailResponse } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonResponse(body: TestEmailResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const campaign = await getCampaign(id);

  if (!campaign) {
    return jsonResponse({ ok: false, error: "Kampan nebyla nalezena." }, 404);
  }

  let recipientEmail: unknown;

  try {
    const body = (await request.json()) as { recipientEmail?: unknown };
    recipientEmail = body.recipientEmail;
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  if (typeof recipientEmail !== "string" || !recipientEmail.trim()) {
    return jsonResponse({ ok: false, error: "Zadejte testovaci e-mail." }, 400);
  }

  const result = await placeholderCampaignSendService.sendTestCampaignEmail(
    campaign,
    recipientEmail.trim()
  );
  const testSend: CampaignTestSend = {
    id: randomUUID(),
    recipientEmail: recipientEmail.trim().toLowerCase(),
    status: result.ok ? "sent" : "not-configured",
    message: result.ok ? result.message : result.error,
    createdAt: new Date().toISOString()
  };

  await updateCampaign(id, {
    testSends: [testSend, ...campaign.testSends].slice(0, 20)
  });

  return jsonResponse(result, result.ok ? 200 : 501);
}

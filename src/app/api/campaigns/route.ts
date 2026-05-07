import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/campaignStore";
import type { Campaign, CampaignListResponse, CampaignResponse } from "@/lib/types";

export const runtime = "nodejs";

function campaignResponse(body: CampaignResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function listResponse(body: CampaignListResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function GET() {
  const campaigns = await listCampaigns();
  return listResponse({ ok: true, campaigns });
}

export async function POST(request: Request) {
  let body: Partial<Campaign>;

  try {
    body = (await request.json()) as Partial<Campaign>;
  } catch {
    return campaignResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return campaignResponse({ ok: false, error: "Nazev kampane nesmi byt prazdny." }, 400);
  }

  if (body.subject !== undefined && typeof body.subject !== "string") {
    return campaignResponse({ ok: false, error: "Predmet kampane musi byt text." }, 400);
  }

  const campaign = await createCampaign(body);
  return campaignResponse({ ok: true, campaign }, 201);
}

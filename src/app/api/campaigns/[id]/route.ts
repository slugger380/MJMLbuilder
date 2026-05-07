import { NextResponse } from "next/server";
import {
  deleteCampaign,
  getCampaign,
  updateCampaign
} from "@/lib/campaignStore";
import type { Campaign, CampaignResponse } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonResponse(body: CampaignResponse | { ok: true }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const campaign = await getCampaign(id);

  if (!campaign) {
    return jsonResponse({ ok: false, error: "Kampan nebyla nalezena." }, 404);
  }

  return jsonResponse({ ok: true, campaign });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: Partial<Campaign>;

  try {
    body = (await request.json()) as Partial<Campaign>;
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return jsonResponse({ ok: false, error: "Nazev kampane nesmi byt prazdny." }, 400);
  }

  if (body.subject !== undefined && typeof body.subject !== "string") {
    return jsonResponse({ ok: false, error: "Predmet kampane musi byt text." }, 400);
  }

  const campaign = await updateCampaign(id, body);

  if (!campaign) {
    return jsonResponse({ ok: false, error: "Kampan nebyla nalezena." }, 404);
  }

  return jsonResponse({ ok: true, campaign });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteCampaign(id);

  if (!deleted) {
    return jsonResponse({ ok: false, error: "Kampan nebyla nalezena." }, 404);
  }

  return jsonResponse({ ok: true });
}

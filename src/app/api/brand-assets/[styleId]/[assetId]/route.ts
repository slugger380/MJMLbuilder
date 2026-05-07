import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getBrandStyleAsset } from "@/lib/brandStyleStore";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ styleId: string; assetId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { styleId, assetId } = await context.params;
  const storedAsset = await getBrandStyleAsset(styleId, assetId);

  if (!storedAsset) {
    return NextResponse.json(
      { ok: false, error: "Asset nebyl nalezen." },
      { status: 404 }
    );
  }

  const buffer = await readFile(storedAsset.path);

  return new Response(buffer, {
    headers: {
      "Content-Type": storedAsset.asset.mimeType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${storedAsset.asset.originalName.replace(/"/g, "")}"`
    }
  });
}

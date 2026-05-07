import { NextResponse } from "next/server";
import {
  createBrandStyle,
  listBrandStyles
} from "@/lib/brandStyleStore";
import type { BrandStyleProfile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const styles = await listBrandStyles();
  return NextResponse.json({ ok: true, styles });
}

export async function POST(request: Request) {
  let body: {
    name?: unknown;
    description?: unknown;
    profile?: Partial<BrandStyleProfile>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request musi byt validni JSON." },
      { status: 400 }
    );
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { ok: false, error: "Chybi nazev brand stylu." },
      { status: 400 }
    );
  }

  const style = await createBrandStyle({
    name: body.name,
    description: typeof body.description === "string" ? body.description : "",
    profile: body.profile
  });

  return NextResponse.json({ ok: true, style }, { status: 201 });
}

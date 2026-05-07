import { NextResponse } from "next/server";
import {
  deleteBrandStyle,
  getBrandStyle,
  updateBrandStyle
} from "@/lib/brandStyleStore";
import type { BrandStyleProfile } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const style = await getBrandStyle(id);

  if (!style) {
    return NextResponse.json(
      { ok: false, error: "Brand styl nebyl nalezen." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, style });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
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

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json(
      { ok: false, error: "Nazev brand stylu nesmi byt prazdny." },
      { status: 400 }
    );
  }

  const style = await updateBrandStyle(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    description:
      typeof body.description === "string" ? body.description : undefined,
    profile: body.profile
  });

  if (!style) {
    return NextResponse.json(
      { ok: false, error: "Brand styl nebyl nalezen." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, style });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteBrandStyle(id);

  if (!deleted) {
    return NextResponse.json(
      { ok: false, error: "Brand styl nebyl nalezen." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

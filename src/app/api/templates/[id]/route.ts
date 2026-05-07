import { NextResponse } from "next/server";
import {
  deleteTemplate,
  getTemplate,
  updateTemplate
} from "@/lib/templateStore";
import type {
  BuilderTemplateState,
  ExcelTemplateSource,
  SavedEmailTemplate,
  TemplateResponse,
  TemplateSourceType
} from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonResponse(body: TemplateResponse | { ok: true }, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const template = await getTemplate(id);

  if (!template) {
    return jsonResponse({ ok: false, error: "Sablona nebyla nalezena." }, 404);
  }

  return jsonResponse({ ok: true, template });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: {
    name?: unknown;
    description?: unknown;
    sourceType?: TemplateSourceType;
    mode?: SavedEmailTemplate["mode"];
    brandStyleId?: unknown;
    excelSource?: ExcelTemplateSource;
    metadata?: SavedEmailTemplate["metadata"];
    state?: BuilderTemplateState;
    mjml?: unknown;
    html?: unknown;
    thumbnail?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return jsonResponse({ ok: false, error: "Nazev sablony nesmi byt prazdny." }, 400);
  }

  const template = await updateTemplate(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    sourceType: body.sourceType,
    mode: body.mode,
    brandStyleId: typeof body.brandStyleId === "string" ? body.brandStyleId : undefined,
    excelSource: body.excelSource,
    metadata: body.metadata,
    state: body.state,
    mjml: typeof body.mjml === "string" ? body.mjml : undefined,
    html: typeof body.html === "string" ? body.html : undefined,
    thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : undefined
  });

  if (!template) {
    return jsonResponse({ ok: false, error: "Sablona nebyla nalezena." }, 404);
  }

  return jsonResponse({ ok: true, template });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = await deleteTemplate(id);

  if (!deleted) {
    return jsonResponse({ ok: false, error: "Sablona nebyla nalezena." }, 404);
  }

  return jsonResponse({ ok: true });
}

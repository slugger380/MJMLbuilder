import { NextResponse } from "next/server";
import { createTemplate, listTemplates } from "@/lib/templateStore";
import type {
  BuilderTemplateState,
  ExcelTemplateSource,
  SavedEmailTemplate,
  TemplateResponse,
  TemplateSourceType
} from "@/lib/types";

export const runtime = "nodejs";

function jsonResponse(body: TemplateResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  const templates = await listTemplates();
  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: Request) {
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

  if (!body.state || typeof body.state !== "object") {
    return jsonResponse({ ok: false, error: "Chybi editovatelny stav sablony." }, 400);
  }

  if (typeof body.mjml !== "string" || !body.mjml.trim()) {
    return jsonResponse({ ok: false, error: "Chybi MJML kod sablony." }, 400);
  }

  const template = await createTemplate({
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" ? body.description : "",
    sourceType: body.sourceType,
    mode: body.mode,
    brandStyleId: typeof body.brandStyleId === "string" ? body.brandStyleId : undefined,
    excelSource: body.excelSource,
    metadata: body.metadata,
    state: body.state,
    mjml: body.mjml,
    html: typeof body.html === "string" ? body.html : "",
    thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : undefined
  });

  return jsonResponse({ ok: true, template }, 201);
}

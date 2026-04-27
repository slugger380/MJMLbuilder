import { NextResponse } from "next/server";
import type { CompileMjmlResponse, ValidationIssue } from "@/lib/types";
import { compileMjml, validateMjml } from "@/lib/validateEmail";

export const runtime = "nodejs";

function jsonResponse(body: CompileMjmlResponse, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let mjml: unknown;

  try {
    const body = (await request.json()) as { mjml?: unknown };
    mjml = body.mjml;
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  if (typeof mjml !== "string" || !mjml.trim()) {
    return jsonResponse({ ok: false, error: "Chybi MJML kod ke kompilaci." }, 400);
  }

  try {
    const mjmlIssues = validateMjml(mjml, { requireSystemVariables: false });
    const compiled = compileMjml(mjml);
    const issues: ValidationIssue[] = [...mjmlIssues, ...compiled.errors];

    return jsonResponse({
      ok: true,
      html: compiled.html,
      issues
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "MJML se nepodarilo zkompilovat."
      },
      500
    );
  }
}

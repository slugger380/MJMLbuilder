import { NextResponse } from "next/server";
import { defaultMjmlCompiler } from "@/lib/mjmlCompiler";
import type { CompileMjmlResponse } from "@/lib/types";

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
    const compiled = defaultMjmlCompiler.compile(mjml, {
      requireSystemVariables: false
    });

    return jsonResponse({
      ok: true,
      html: compiled.html,
      issues: compiled.issues
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

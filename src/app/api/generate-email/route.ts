import OpenAI from "openai";
import { NextResponse } from "next/server";
import { allowedVariables } from "@/config/allowedVariables";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import { buildCouponsTemplate } from "@/lib/preparedTemplates";
import { readCouponWorkbookFromUpload } from "@/lib/couponWorkbook";
import { reviewCouponsWithAi } from "@/lib/couponAiReview";
import type {
  GenerateEmailRequest,
  GenerateEmailResponse,
  GeneratedEmailJson,
  ValidationIssue
} from "@/lib/types";
import {
  compileMjml,
  validateEmailRequirements,
  validateMjml,
  validateVariables
} from "@/lib/validateEmail";

export const runtime = "nodejs";

const generatedEmailSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    mjml: { type: "string" },
    usedVariables: {
      type: "array",
      items: { type: "string" }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["subject", "preheader", "mjml", "usedVariables", "notes"]
} as const;

function validateRequest(body: Partial<GenerateEmailRequest>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (body.templateId === "coupons-excel") {
    return issues;
  }

  if (!body.emailType) {
    issues.push({ type: "error", message: "Chybi typ e-mailu." });
  }
  if (!body.topic?.trim()) {
    issues.push({ type: "error", message: "Chybi tema e-mailu." });
  }
  if (!body.mainMessage?.trim()) {
    issues.push({ type: "error", message: "Chybi hlavni sdeleni." });
  }

  return issues;
}

function validateGeneratedJson(value: unknown): value is GeneratedEmailJson {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as GeneratedEmailJson;
  return (
    typeof candidate.subject === "string" &&
    typeof candidate.preheader === "string" &&
    typeof candidate.mjml === "string" &&
    Array.isArray(candidate.usedVariables) &&
    candidate.usedVariables.every((item) => typeof item === "string") &&
    Array.isArray(candidate.notes) &&
    candidate.notes.every((item) => typeof item === "string")
  );
}

function removeNestedMjWrappers(mjml: string): string {
  let depth = 0;

  return mjml.replace(/<\/?mj-wrapper\b[^>]*>/gi, (tag) => {
    const isClosingTag = /^<\//.test(tag);

    if (isClosingTag) {
      if (depth > 1) {
        depth -= 1;
        return "";
      }

      depth = Math.max(depth - 1, 0);
      return tag;
    }

    if (depth > 0) {
      depth += 1;
      return "";
    }

    depth += 1;
    return tag;
  });
}

function normalizeGeneratedMjml(mjml: string): {
  mjml: string;
  notes: string[];
} {
  const withoutNestedWrappers = removeNestedMjWrappers(mjml);

  return {
    mjml: withoutNestedWrappers,
    notes:
      withoutNestedWrappers === mjml
        ? []
        : [
            "Aplikace upravila AI MJML: odstranila zanorene mj-wrapper tagy, ktere MJML kompilator nepovoluje."
          ]
  };
}

function jsonResponse(body: GenerateEmailResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function formValue(formData: FormData, key: keyof GenerateEmailRequest): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: keyof GenerateEmailRequest): boolean {
  return formValue(formData, key) === "true";
}

async function requestFromFormData(request: Request): Promise<{
  body: GenerateEmailRequest;
  couponWorkbook?: { buffer: Buffer; fileName: string };
  couponTemplate?: { buffer: Buffer; fileName: string };
}> {
  const formData = await request.formData();
  const workbook = formData.get("couponWorkbook");
  const template = formData.get("couponTemplate");

  return {
    body: {
      templateId: formValue(formData, "templateId") === "coupons-excel" ? "coupons-excel" : "ai",
      emailType: (formValue(formData, "emailType") || "promo") as GenerateEmailRequest["emailType"],
      topic: formValue(formData, "topic"),
      mainMessage: formValue(formData, "mainMessage"),
      ctaText: formValue(formData, "ctaText"),
      ctaUrl: formValue(formData, "ctaUrl"),
      notes: formValue(formData, "notes"),
      useAiMatching: formBoolean(formData, "useAiMatching"),
      useAiReview: formBoolean(formData, "useAiReview"),
      couponMonth: formValue(formData, "couponMonth")
    },
    couponWorkbook:
      workbook instanceof File && workbook.size > 0
        ? {
            buffer: Buffer.from(await workbook.arrayBuffer()),
            fileName: workbook.name
          }
        : undefined,
    couponTemplate:
      template instanceof File && template.size > 0
        ? {
            buffer: Buffer.from(await template.arrayBuffer()),
            fileName: template.name
          }
        : undefined
  };
}

async function requestFromJson(request: Request): Promise<{
  body: GenerateEmailRequest;
  couponWorkbook?: { buffer: Buffer; fileName: string };
  couponTemplate?: { buffer: Buffer; fileName: string };
}> {
  return { body: (await request.json()) as GenerateEmailRequest };
}

export async function POST(request: Request) {
  let body: GenerateEmailRequest;
  let couponWorkbook: { buffer: Buffer; fileName: string } | undefined;
  let couponTemplate: { buffer: Buffer; fileName: string } | undefined;
  try {
    const contentType = request.headers.get("content-type") || "";
    const parsed = contentType.includes("multipart/form-data")
      ? await requestFromFormData(request)
      : await requestFromJson(request);
    body = parsed.body;
    couponWorkbook = parsed.couponWorkbook;
    couponTemplate = parsed.couponTemplate;
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON nebo formular." }, 400);
  }

  const requestIssues = validateRequest(body);
  if (requestIssues.some((issue) => issue.type === "error")) {
    return jsonResponse(
      {
        ok: false,
        error: "Zadani neni kompletni.",
        issues: requestIssues
      },
      400
    );
  }

  try {
    if (body.templateId === "coupons-excel") {
      if (!couponWorkbook) {
        return jsonResponse(
          {
            ok: false,
            error: "Pro rezim Kupony z Excelu nahrajte soubor .xlsx nebo .xls."
          },
          400
        );
      }

      const {
        generated,
        html: htmlFromTemplate,
        templateSourceType,
        issues: templateIssues
      } = await buildCouponsTemplate(
        body,
        couponWorkbook,
        couponTemplate,
        {
          openaiApiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || "gpt-5.2",
          useAiMatching: Boolean(body.useAiMatching)
        }
      );
      const variableIssues =
        templateSourceType === "mjml"
          ? validateVariables(generated.mjml, [...allowedVariables])
          : [];
      const mjmlIssues =
        templateSourceType === "mjml"
          ? validateMjml(generated.mjml, { requireSystemVariables: false })
          : [];
      const requirementIssues: ValidationIssue[] = [];
      const compiled =
        templateSourceType === "mjml"
          ? compileMjml(generated.mjml)
          : { html: htmlFromTemplate || "", errors: [] };
      const aiReviewIssues: ValidationIssue[] = [];
      const aiReviewNotes: string[] = [];

      if (body.useAiReview) {
        if (!process.env.OPENAI_API_KEY) {
          aiReviewIssues.push({
            type: "warning",
            message:
              "AI kontrola byla zapnuta, ale chybi OPENAI_API_KEY. Doplnte ho do .env.local."
          });
        } else if (generated.mjml && compiled.errors.length === 0) {
          try {
            const workbook = readCouponWorkbookFromUpload(couponWorkbook, 24);
            const review = await reviewCouponsWithAi({
              apiKey: process.env.OPENAI_API_KEY,
              model: process.env.OPENAI_MODEL || "gpt-5.2",
              rows: workbook.rows,
              headers: workbook.headers,
              mjml: generated.mjml,
              month: body.couponMonth
            });

            aiReviewIssues.push(...review.issues);
            aiReviewNotes.push(...review.notes);
          } catch (error) {
            aiReviewIssues.push({
              type: "warning",
              message: "AI kontrola selhala.",
              details: error instanceof Error ? error.message : "Neznama chyba"
            });
          }
        }
      }

      const issues = [
        ...templateIssues,
        ...variableIssues,
        ...mjmlIssues,
        ...requirementIssues,
        ...compiled.errors,
        ...aiReviewIssues
      ];

      return jsonResponse({
        ok: true,
        subject: generated.subject,
        preheader: generated.preheader,
        mjml: generated.mjml,
        html: compiled.html,
        usedVariables: generated.usedVariables,
        notes: [...generated.notes, ...aiReviewNotes],
        issues
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Chybi OPENAI_API_KEY. Doplnte ho do .env.local podle .env.example."
        },
        500
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(body) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "generated_email",
          strict: true,
          schema: generatedEmailSchema
        }
      }
    });

    let generated: unknown;
    try {
      generated = JSON.parse(response.output_text);
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "OpenAI vratilo nevalidni JSON."
        },
        502
      );
    }

    if (!validateGeneratedJson(generated)) {
      return jsonResponse(
        {
          ok: false,
          error: "OpenAI vratilo JSON v neocekavanem tvaru."
        },
        502
      );
    }

    const normalized = normalizeGeneratedMjml(generated.mjml);
    const generatedEmail: GeneratedEmailJson = {
      ...generated,
      mjml: normalized.mjml,
      notes: [...generated.notes, ...normalized.notes]
    };
    const variableIssues = validateVariables(generatedEmail.mjml, [...allowedVariables]);
    const mjmlIssues = validateMjml(generatedEmail.mjml);
    const requirementIssues = validateEmailRequirements(
      generatedEmail.mjml,
      body.emailType
    );
    const compiled = compileMjml(generatedEmail.mjml);
    const allowedVariableSet = new Set<string>(allowedVariables);
    const usedVariableIssues = generatedEmail.usedVariables
      .filter((variable) => !allowedVariableSet.has(variable))
      .map((variable) => ({
        type: "error" as const,
        message: `OpenAI nahlasilo nepovolenou promenou: {{${variable}}}.`
      }));

    const issues = [
      ...variableIssues,
      ...usedVariableIssues,
      ...mjmlIssues,
      ...requirementIssues,
      ...compiled.errors
    ];

    return jsonResponse({
      ok: true,
      subject: generatedEmail.subject,
      preheader: generatedEmail.preheader,
      mjml: generatedEmail.mjml,
      html: compiled.html,
      usedVariables: generatedEmail.usedVariables,
      notes: generatedEmail.notes,
      issues
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Pri generovani e-mailu doslo k nezname chybe."
      },
      500
    );
  }
}

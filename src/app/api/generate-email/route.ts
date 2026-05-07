import OpenAI from "openai";
import { NextResponse } from "next/server";
import { allowedVariables } from "@/config/allowedVariables";
import {
  generatedEmailSchema,
  OpenAiTemplateGenerator,
  validateGeneratedEmailJson
} from "@/lib/aiTemplateGenerator";
import { getBrandStyle } from "@/lib/brandStyleStore";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import {
  DEFAULT_COUPON_WORKBOOK_LIMIT,
  readCouponWorkbookFromUpload
} from "@/lib/couponWorkbook";
import { couponExcelTemplateAssembler } from "@/lib/excelTemplateAssembler";
import { reviewCouponsWithAi } from "@/lib/couponAiReview";
import type {
  GenerateEmailRequest,
  GenerateEmailResponse,
  GeneratedEmailJson,
  TemplateGenerationRequest,
  ValidationIssue
} from "@/lib/types";
import {
  compileMjml,
  validateEmailRequirements,
  validateMjml,
  validateVariables
} from "@/lib/validateEmail";

export const runtime = "nodejs";

const MAX_EXCEL_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_TEMPLATE_UPLOAD_BYTES = 2 * 1024 * 1024;
const excelFilePattern = /\.(xlsx|xls)$/i;
const mjmlFilePattern = /\.mjml$/i;

function validateRequest(body: Partial<GenerateEmailRequest>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (body.templateId === "coupons-excel") {
    return issues;
  }

  if (body.brandStyleId || body.prompt || !body.topic) {
    if (!body.brandStyleId?.trim()) {
      issues.push({ type: "error", message: "Vyberte brand styl." });
    }
    if (!body.prompt?.trim()) {
      issues.push({
        type: "error",
        message: "Chybi volny popis e-mailove sablony."
      });
    }
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

function uploadIssue(message: string, details?: string): ValidationIssue {
  return {
    type: "error",
    message,
    details,
    source: "excel-workbook"
  };
}

function validateUploadedFile(
  file: File,
  options: {
    label: string;
    maxBytes: number;
    pattern: RegExp;
    allowedDescription: string;
  }
): ValidationIssue | undefined {
  if (file.size > options.maxBytes) {
    return uploadIssue(
      `${options.label} je prilis velky.`,
      `Maximum je ${Math.round(options.maxBytes / 1024 / 1024)} MB.`
    );
  }

  if (!options.pattern.test(file.name)) {
    return uploadIssue(
      `${options.label} ma nepodporovany typ souboru.`,
      `Povoleno: ${options.allowedDescription}.`
    );
  }

  return undefined;
}

async function requestFromFormData(request: Request): Promise<{
  body: GenerateEmailRequest;
  couponWorkbook?: { buffer: Buffer; fileName: string };
  couponTemplate?: { buffer: Buffer; fileName: string };
  uploadIssues: ValidationIssue[];
}> {
  const formData = await request.formData();
  const workbook = formData.get("couponWorkbook");
  const template = formData.get("couponTemplate");
  const uploadIssues: ValidationIssue[] = [];

  if (workbook instanceof File && workbook.size > 0) {
    const issue = validateUploadedFile(workbook, {
      label: "Excel tabulka",
      maxBytes: MAX_EXCEL_UPLOAD_BYTES,
      pattern: excelFilePattern,
      allowedDescription: ".xlsx nebo .xls"
    });
    if (issue) {
      uploadIssues.push(issue);
    }
  }

  if (template instanceof File && template.size > 0) {
    const issue = validateUploadedFile(template, {
      label: "MJML sablona",
      maxBytes: MAX_TEMPLATE_UPLOAD_BYTES,
      pattern: mjmlFilePattern,
      allowedDescription: ".mjml"
    });
    if (issue) {
      uploadIssues.push(issue);
    }
  }

  return {
    body: {
      templateId: formValue(formData, "templateId") === "coupons-excel" ? "coupons-excel" : "ai",
      brandStyleId: formValue(formData, "brandStyleId"),
      prompt: formValue(formData, "prompt"),
      emailType: (formValue(formData, "emailType") || "promo") as GenerateEmailRequest["emailType"],
      topic: formValue(formData, "topic"),
      mainMessage: formValue(formData, "mainMessage"),
      ctaText: formValue(formData, "ctaText"),
      ctaUrl: formValue(formData, "ctaUrl"),
      notes: formValue(formData, "notes"),
      useAiMatching: formBoolean(formData, "useAiMatching"),
      useAiReview: formBoolean(formData, "useAiReview"),
      includeSelfServiceAd: formBoolean(formData, "includeSelfServiceAd"),
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
        : undefined,
    uploadIssues
  };
}

async function requestFromJson(request: Request): Promise<{
  body: GenerateEmailRequest;
  couponWorkbook?: { buffer: Buffer; fileName: string };
  couponTemplate?: { buffer: Buffer; fileName: string };
  uploadIssues: ValidationIssue[];
}> {
  return { body: (await request.json()) as GenerateEmailRequest, uploadIssues: [] };
}

export async function POST(request: Request) {
  let body: GenerateEmailRequest;
  let couponWorkbook: { buffer: Buffer; fileName: string } | undefined;
  let couponTemplate: { buffer: Buffer; fileName: string } | undefined;
  let uploadIssues: ValidationIssue[] = [];
  try {
    const contentType = request.headers.get("content-type") || "";
    const parsed = contentType.includes("multipart/form-data")
      ? await requestFromFormData(request)
      : await requestFromJson(request);
    body = parsed.body;
    couponWorkbook = parsed.couponWorkbook;
    couponTemplate = parsed.couponTemplate;
    uploadIssues = parsed.uploadIssues;
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON nebo formular." }, 400);
  }

  const requestIssues = validateRequest(body);
  requestIssues.push(...uploadIssues);
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
      } = await couponExcelTemplateAssembler.assemble({
        input: body,
        workbook: couponWorkbook,
        template: couponTemplate,
        options: {
          openaiApiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || "gpt-5.2",
          useAiMatching: Boolean(body.useAiMatching)
        }
      });
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
            const workbook = readCouponWorkbookFromUpload(
              couponWorkbook,
              DEFAULT_COUPON_WORKBOOK_LIMIT
            );
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

    if (body.brandStyleId?.trim() || body.prompt?.trim()) {
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

      const brandStyleId = body.brandStyleId?.trim() || "";
      const prompt = body.prompt?.trim() || "";
      const brandStyle = await getBrandStyle(brandStyleId);

      if (!brandStyle) {
        return jsonResponse(
          {
            ok: false,
            error: "Vybrany brand styl nebyl nalezen."
          },
          404
        );
      }

      const generator = new OpenAiTemplateGenerator({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-5.2"
      });
      const generationRequest: TemplateGenerationRequest = {
        templateId: "ai",
        brandStyleId,
        prompt
      };
      const generated = await generator.generate({
        request: generationRequest,
        brandStyle
      });
      const normalized = normalizeGeneratedMjml(generated.mjml);
      const generatedEmail: GeneratedEmailJson = {
        ...generated,
        mjml: normalized.mjml,
        notes: [
          ...generated.notes,
          ...normalized.notes,
          `Pouzity brand styl: ${brandStyle.name}.`
        ]
      };
      const variableIssues = validateVariables(generatedEmail.mjml, [...allowedVariables]);
      const mjmlIssues = validateMjml(generatedEmail.mjml);
      const compiled = compileMjml(generatedEmail.mjml);
      const allowedVariableSet = new Set<string>(allowedVariables);
      const usedVariableIssues = generatedEmail.usedVariables
        .filter((variable) => !allowedVariableSet.has(variable))
        .map((variable) => ({
          type: "error" as const,
          message: `OpenAI nahlasilo nepovolenou promenou: {{${variable}}}.`
        }));

      return jsonResponse({
        ok: true,
        subject: generatedEmail.subject,
        preheader: generatedEmail.preheader,
        mjml: generatedEmail.mjml,
        html: compiled.html,
        usedVariables: generatedEmail.usedVariables,
        notes: generatedEmail.notes,
        issues: [
          ...variableIssues,
          ...usedVariableIssues,
          ...mjmlIssues,
          ...compiled.errors
        ]
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

    if (!validateGeneratedEmailJson(generated)) {
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
      body.emailType || "promo"
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

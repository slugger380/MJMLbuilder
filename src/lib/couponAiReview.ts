import OpenAI from "openai";
import type { WorkbookDataRow } from "@/lib/couponWorkbook";
import type { ValidationIssue } from "@/lib/types";

type CouponReviewInput = {
  apiKey: string;
  model: string;
  rows: WorkbookDataRow[];
  headers: string[];
  mjml: string;
  month?: string;
};

type AiReviewIssue = {
  severity: "error" | "warning";
  rowNumber: number | null;
  field: string | null;
  message: string;
  expected: string | null;
  actual: string | null;
  suggestion: string | null;
};

type CouponAiReviewResult = {
  summary: string;
  checkedRows: number;
  issues: AiReviewIssue[];
  notes: string[];
};

const couponReviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    checkedRows: { type: "number" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["error", "warning"] },
          rowNumber: { type: ["number", "null"] },
          field: { type: ["string", "null"] },
          message: { type: "string" },
          expected: { type: ["string", "null"] },
          actual: { type: ["string", "null"] },
          suggestion: { type: ["string", "null"] }
        },
        required: [
          "severity",
          "rowNumber",
          "field",
          "message",
          "expected",
          "actual",
          "suggestion"
        ]
      }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["summary", "checkedRows", "issues", "notes"]
} as const;

function validateReview(value: unknown): value is CouponAiReviewResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as CouponAiReviewResult;
  return (
    typeof candidate.summary === "string" &&
    typeof candidate.checkedRows === "number" &&
    Array.isArray(candidate.issues) &&
    candidate.issues.every(
      (issue) =>
        issue &&
        typeof issue === "object" &&
        (issue.severity === "error" || issue.severity === "warning") &&
        (typeof issue.rowNumber === "number" || issue.rowNumber === null) &&
        (typeof issue.field === "string" || issue.field === null) &&
        typeof issue.message === "string" &&
        (typeof issue.expected === "string" || issue.expected === null) &&
        (typeof issue.actual === "string" || issue.actual === null) &&
        (typeof issue.suggestion === "string" || issue.suggestion === null)
    ) &&
    Array.isArray(candidate.notes) &&
    candidate.notes.every((note) => typeof note === "string")
  );
}

function compactRows(rows: WorkbookDataRow[]) {
  return rows.map((row, index) => ({
    index: index + 1,
    rowNumber: row.rowNumber,
    values: row.values
  }));
}

function trimForModel(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n\n[ZKRACENO: ${value.length - limit} znaku]`;
}

export async function reviewCouponsWithAi(
  input: CouponReviewInput
): Promise<{
  issues: ValidationIssue[];
  notes: string[];
}> {
  const openai = new OpenAI({ apiKey: input.apiKey });
  const response = await openai.responses.create({
    model: input.model,
    input: [
      {
        role: "system",
        content:
          "Jsi peclivy QA kontrolor kuponovych e-mailovych sablon. Nikdy neupravuj MJML. Porovnej radky Excelu s vyslednym MJML a vrat pouze JSON podle schema. Kontroluj, ze kazdy radek ma jeden blok, ze texty, kuponove kody, affiliate odkazy, zamerne zobrazene platnosti a loga odpovidaji tabulce. Sloupec Platnost do muze byt v Excelu internim udajem a v e-mailove sablone se zamerne nezobrazuje; jeho absenci nikdy nehlas jako problem. Pokud je logo v tabulce prazdne, ve vysledku nema byt v danem bloku zadne logo. Nesoulad hodnot oznac jako error. Jazykove, typograficke nebo obchodni doporuceni oznac jen jako warning. U textu hledej preklepy, divne formulace, duplicity a zjevne nelogicke hodnoty. Nehlas drobnosti, ktere nejsou problem."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Zkontroluj kuponovou sablonu proti Excelu.",
            month: input.month || "",
            headers: input.headers,
            rows: compactRows(input.rows),
            generatedMjml: trimForModel(input.mjml, 60000)
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "coupon_email_review",
        strict: true,
        schema: couponReviewSchema
      }
    }
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error("AI kontrola vratila nevalidni JSON.");
  }

  if (!validateReview(parsed)) {
    throw new Error("AI kontrola vratila JSON v neocekavanem tvaru.");
  }

  return {
    issues: parsed.issues.map((issue) => ({
      type: issue.severity,
      message: `AI kontrola${issue.rowNumber ? `, radek ${issue.rowNumber}` : ""}${
        issue.field ? `, ${issue.field}` : ""
      }: ${issue.message}`,
      details: [
        issue.expected ? `Ocekavano: ${issue.expected}` : "",
        issue.actual ? `Nalezeno: ${issue.actual}` : "",
        issue.suggestion ? `Navrh: ${issue.suggestion}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    })),
    notes: [
      `AI kontrola: ${parsed.summary}`,
      `AI zkontrolovala radku: ${parsed.checkedRows}`,
      ...parsed.notes.map((note) => `AI poznamka: ${note}`)
    ]
  };
}

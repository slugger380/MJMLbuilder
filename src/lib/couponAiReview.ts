import OpenAI from "openai";
import type { WorkbookDataRow } from "@/lib/couponWorkbook";
import type { ValidationIssue, AiSuggestionChange } from "@/lib/types";

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
    values: Object.fromEntries(
      Object.entries(row.values).filter(([, value]) => value.trim())
    )
  }));
}

function trimForModel(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n\n[ZKRACENO: ${value.length - limit} znaku]`;
}

function isForbiddenTokenSuggestion(issue: AiReviewIssue) {
  const text = [
    issue.field,
    issue.message,
    issue.expected,
    issue.actual,
    issue.suggestion
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("[!month!]") ||
    text.includes("{{month}}") ||
    (text.includes("mesic") &&
      /(placeholder|token|atribut|\[!|\[\?|\{\{)/i.test(text))
  );
}

function isExcelQualityIssue(issue: AiReviewIssue) {
  const text = [
    issue.field,
    issue.message,
    issue.expected,
    issue.actual,
    issue.suggestion
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /(excel|tabulce|tabulka|sloupec|bunka|buňka)/i.test(text) &&
    /(chybi|chybí|missing|prazdn|prázdn|neni vyplnen|není vyplněn|neni uveden|není uveden)/i.test(text)
  );
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
          "Jsi QA kontrolor vysledne MJML sablony, ne auditor Excelu. Excel pouzij jen jako zdroj pravdy pro porovnani, zda se neprázdné hodnoty z radku spravne propsaly do vysledneho MJML. Nikdy nehlas chybejici, prazdne nebo nevyplnene hodnoty v Excelu, chybejici sloupce ani kvalitu vstupni tabulky. Pokud je bunka nebo sloupec v Excelu prazdny, je to v poradku a nic k tomu nehlas. Kontroluj pouze: 1) kazdy pouzitelny radek Excelu ma odpovidajici blok ve vyslednem MJML, 2) neprázdné hodnoty z Excelu, ktere se maji zobrazit v sablone, jsou v MJML spravne, 3) kuponove kody a affiliate odkazy odpovidaji, 4) viditelne texty sablony maji pravopisne, jazykove nebo typograficke chyby. Sloupec Platnost do muze byt internim udajem a v e-mailove sablone se zamerne nezobrazuje; jeho absenci nikdy nehlas. Pokud je logo nebo podminka v Excelu prazdna, nikdy to nehlas jako problem. Nehlas drobnosti, ktere nejsou problem. Nenavrhuj zmeny internich tokenu, placeholderu ani systemovych atributu, napr. [!month!], {{month}} nebo tokenu [?MESIC?]; mesic v headeru ridi aplikace pres pole Mesic do headeru a je spravne, ze je ve vyslednem MJML jako konkretni text. Kazdy skutecny problem, ktery lze opravit, musi mit konkretni actionable suggestion. Do actual dej presny nalezeny text nebo hodnotu z MJML, do expected dej presnou spravnou hodnotu a do suggestion kratky pokyn typu Nahradit X za Y nebo Zmenit atribut line-height z 1.15 na 16px. Vrat pouze JSON podle schema."
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
    issues: parsed.issues.filter((issue) => !isForbiddenTokenSuggestion(issue) && !isExcelQualityIssue(issue)).map((issue) => {
      const change: Partial<AiSuggestionChange> = {
        rowNumber: issue.rowNumber,
        field: issue.field,
        message: issue.message,
        expected: issue.expected,
        actual: issue.actual
      };

      return {
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
          .join("\n"),
        source: "ai-review",
        ...change,
        suggestion: issue.suggestion
      };
    }),
    notes: [
      `AI kontrola: ${parsed.summary}`,
      `AI zkontrolovala radku: ${parsed.checkedRows}`,
      ...parsed.notes.map((note) => `AI poznamka: ${note}`)
    ]
  };
}

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { allowedVariables } from "@/config/allowedVariables";
import type {
  AiSuggestionChange,
  ApplyAiSuggestionsRequest,
  GenerateEmailResponse,
  GeneratedEmailJson
} from "@/lib/types";
import { compileMjml, validateMjml, validateVariables } from "@/lib/validateEmail";

export const runtime = "nodejs";

const appliedSuggestionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mjml: { type: "string" },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["mjml", "notes"]
} as const;

function jsonResponse(body: GenerateEmailResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function validateGeneratedJson(value: unknown): value is Pick<GeneratedEmailJson, "mjml" | "notes"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Pick<GeneratedEmailJson, "mjml" | "notes">;
  return (
    typeof candidate.mjml === "string" &&
    Array.isArray(candidate.notes) &&
    candidate.notes.every((note) => typeof note === "string")
  );
}

function validateRequest(body: Partial<ApplyAiSuggestionsRequest>): string | undefined {
  if (!body.mjml?.trim()) {
    return "Chybi MJML k uprave.";
  }

  if (!Array.isArray(body.suggestions) || body.suggestions.length === 0) {
    return "Vyberte alespon jeden AI navrh k provedeni.";
  }

  if (
    body.suggestions.some(
      (suggestion) =>
        !suggestion.message?.trim() ||
        (!suggestion.suggestion?.trim() &&
          (!suggestion.expected?.trim() || !suggestion.actual?.trim()))
    )
  ) {
    return "Vybrane AI navrhy nemaji kompletni popis zmeny.";
  }

  return undefined;
}

function normalizeText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function countOccurrences(source: string, search: string) {
  if (!search) {
    return 0;
  }

  return source.split(search).length - 1;
}

function replaceSingleText(source: string, search: string, replacement: string) {
  if (!search || search === replacement || countOccurrences(source, search) !== 1) {
    return source;
  }

  return source.replace(search, replacement);
}

const mjmlAttributeNames = [
  "line-height",
  "font-size",
  "font-weight",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "color",
  "background-color",
  "href",
  "src",
  "alt",
  "width",
  "height",
  "border-radius"
];

function detectMjmlAttribute(change: AiSuggestionChange) {
  const haystack = [
    change.field,
    change.message,
    change.actual,
    change.expected,
    change.suggestion
  ]
    .map((value) => value || "")
    .join(" ")
    .toLowerCase();

  return mjmlAttributeNames.find((attribute) => haystack.includes(attribute));
}

function quotedAttributeValue(value: string, attribute: string) {
  return value.match(new RegExp(`${escapeRegExp(attribute)}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function cssLikeValues(value: string) {
  return Array.from(
    value.matchAll(/#[0-9a-f]{3,8}\b|-?\d+(?:\.\d+)?(?:px|em|rem|%|pt)?\b/gi)
  ).map((match) => match[0]);
}

function attributeValueCandidates(value: string | undefined | null, attribute: string) {
  const text = normalizeText(value);
  const quotedValue = quotedAttributeValue(text, attribute);
  const cssValues = cssLikeValues(text);

  return uniqueValues([quotedValue, ...cssValues, text]);
}

function replacementCandidates(change: AiSuggestionChange, attribute?: string) {
  const expected = normalizeText(change.expected);
  const suggestion = normalizeText(change.suggestion);

  if (!attribute) {
    return uniqueValues([expected, suggestion]);
  }

  const suggestedAttributeValues = uniqueValues([
    quotedAttributeValue(suggestion, attribute),
    ...cssLikeValues(suggestion)
  ]);
  return uniqueValues([
    expected,
    ...attributeValueCandidates(expected, attribute),
    suggestedAttributeValues[suggestedAttributeValues.length - 1],
    suggestion
  ]);
}

function applyAttributeChange(
  source: string,
  change: AiSuggestionChange,
  attribute: string
) {
  const replacements = replacementCandidates(change, attribute);
  const previousValues = attributeValueCandidates(change.actual, attribute);

  for (const previousValue of previousValues) {
    for (const replacement of replacements) {
      if (!replacement || previousValue === replacement) {
        continue;
      }

      const pattern = new RegExp(
        `(${escapeRegExp(attribute)}\\s*=\\s*["'])${escapeRegExp(previousValue)}(["'])`,
        "gi"
      );
      const matches = source.match(pattern);

      if (matches?.length === 1) {
        return source.replace(pattern, `$1${replacement}$2`);
      }
    }
  }

  return source;
}

function applyTextChange(source: string, change: AiSuggestionChange) {
  const actualValues = uniqueValues([
    change.actual?.trim(),
    normalizeText(change.actual)
  ]);
  const replacements = replacementCandidates(change);

  if (!actualValues.length) {
    return source;
  }

  for (const actual of actualValues) {
    for (const replacement of replacements) {
      const next = replaceSingleText(source, actual, replacement);
      if (next !== source) {
        return next;
      }
    }
  }

  return source;
}

function applyLocalSuggestion(source: string, change: AiSuggestionChange) {
  const attribute = detectMjmlAttribute(change);
  const withAttributeChange = attribute
    ? applyAttributeChange(source, change, attribute)
    : source;

  if (withAttributeChange !== source) {
    return withAttributeChange;
  }

  return applyTextChange(source, change);
}

function applyLocalSuggestions(mjml: string, suggestions: AiSuggestionChange[]) {
  const applied: AiSuggestionChange[] = [];
  const remaining: AiSuggestionChange[] = [];
  let nextMjml = mjml;

  for (const suggestion of suggestions) {
    const updated = applyLocalSuggestion(nextMjml, suggestion);

    if (updated === nextMjml) {
      remaining.push(suggestion);
    } else {
      nextMjml = updated;
      applied.push(suggestion);
    }
  }

  return { mjml: nextMjml, applied, remaining };
}

function cleanChangeText(value?: string | null) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function changeSummary(change: AiSuggestionChange) {
  const message = cleanChangeText(change.message);
  const actual = cleanChangeText(change.actual);
  const expected = cleanChangeText(change.expected);
  const suggestion = cleanChangeText(change.suggestion);
  const location = [
    change.rowNumber ? `radek ${change.rowNumber}` : "",
    change.field || ""
  ]
    .filter(Boolean)
    .join(", ");

  if (actual && expected) {
    return `${location ? `${location}: ` : ""}${actual} -> ${expected}`;
  }

  if (suggestion) {
    return `${location ? `${location}: ` : ""}${suggestion}`;
  }

  return `${location ? `${location}: ` : ""}${message || "Provedena vybrana AI uprava."}`;
}

function appliedChangeNotes(
  changes: AiSuggestionChange[],
  mode: "local" | "model"
) {
  const modeLabel = mode === "local" ? "lokalne" : "pres AI model";

  return changes.map(
    (change, index) =>
      `AI provedena zmena ${index + 1} (${modeLabel}): ${changeSummary(change)}`
  );
}

function buildSuccessResponse(
  body: ApplyAiSuggestionsRequest,
  mjml: string,
  notes: string[]
) {
  const variableIssues = validateVariables(mjml, [...allowedVariables]);
  const mjmlIssues = validateMjml(mjml, { requireSystemVariables: false });
  const compiled = compileMjml(mjml);

  return jsonResponse({
    ok: true,
    subject: body.subject || "Upravena e-mailova sablona",
    preheader: body.preheader || "",
    mjml,
    html: compiled.html,
    usedVariables: body.usedVariables || [],
    notes: [...(Array.isArray(body.notes) ? body.notes : []), ...notes],
    issues: [...variableIssues, ...mjmlIssues, ...compiled.errors]
  });
}

export async function POST(request: Request) {
  let body: ApplyAiSuggestionsRequest;
  try {
    body = (await request.json()) as ApplyAiSuggestionsRequest;
  } catch {
    return jsonResponse({ ok: false, error: "Request musi byt validni JSON." }, 400);
  }

  const requestError = validateRequest(body);
  if (requestError) {
    return jsonResponse({ ok: false, error: requestError }, 400);
  }

  const locallyApplied = applyLocalSuggestions(body.mjml, body.suggestions);
  const localNotes = locallyApplied.applied.length
    ? [
        `AI provedeno lokalne: ${locallyApplied.applied.length} vybranych navrhu.`,
        ...appliedChangeNotes(locallyApplied.applied, "local")
      ]
    : [];

  if (locallyApplied.remaining.length === 0) {
    return buildSuccessResponse(body, locallyApplied.mjml, localNotes);
  }

  if (!process.env.OPENAI_API_KEY) {
    if (locallyApplied.applied.length > 0) {
      return buildSuccessResponse(body, locallyApplied.mjml, [
        ...localNotes,
        `AI neprovedla zmeny: ${locallyApplied.remaining.length} navrhu neslo bezpecne provest lokalne. Pro slozitejsi upravy doplnte OPENAI_API_KEY.`
      ]);
    }

    return jsonResponse(
      {
        ok: false,
        error:
          "Vybrane navrhy nejdou bezpecne provest lokalne a chybi OPENAI_API_KEY pro AI upravu."
      },
      500
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: [
        {
          role: "system",
          content:
            "Jsi opatrny editor MJML e-mailu. Aplikuj pouze vybrane navrhy z QA kontroly. Zachovej layout, poradi bloku, stylovani, odkazy a texty, kterych se navrhy netykaji. Nevymyslej nove kupony ani nove sekce. Vrat pouze JSON podle schema."
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Uprav MJML podle vybranych AI navrhu.",
              selectedSuggestions: locallyApplied.remaining,
              currentMjml: locallyApplied.mjml
            },
            null,
            2
          )
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "applied_ai_suggestions",
          strict: true,
          schema: appliedSuggestionsSchema
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

    return buildSuccessResponse(body, generated.mjml, [
      ...localNotes,
      `AI provedeno pres model: ${locallyApplied.remaining.length} vybranych navrhu.`,
      ...appliedChangeNotes(locallyApplied.remaining, "model"),
      ...generated.notes.map((note) => `AI uprava: ${note}`)
    ]);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "AI navrhy se nepodarilo provest."
      },
      500
    );
  }
}

import OpenAI from "openai";
import { allowedVariables } from "@/config/allowedVariables";
import { getEmailComponentReference } from "@/lib/emailComponents";
import type {
  BrandStyle,
  BrandStyleAsset,
  GeneratedEmailJson,
  TemplateGenerationRequest
} from "@/lib/types";

export type AiTemplateGeneratorOptions = {
  apiKey: string;
  model: string;
};

export type AiTemplateGeneratorInput = {
  request: TemplateGenerationRequest;
  brandStyle: BrandStyle;
};

export interface AiTemplateGenerator {
  generate(input: AiTemplateGeneratorInput): Promise<GeneratedEmailJson>;
}

export const generatedEmailSchema = {
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

export function validateGeneratedEmailJson(
  value: unknown
): value is GeneratedEmailJson {
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

function assetContext(asset: BrandStyleAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    url: asset.url,
    extractedText: asset.extractedText?.slice(0, 3000)
  };
}

function compactBrandStyleForPrompt(brandStyle: BrandStyle) {
  return {
    id: brandStyle.id,
    name: brandStyle.name,
    description: brandStyle.description,
    profile: brandStyle.profile,
    assets: brandStyle.assets.map(assetContext)
  };
}

export function buildBrandTemplateSystemPrompt() {
  return `You are an expert generator of responsive production email templates in MJML.
Return only JSON that matches the provided schema.

Generate clean, valid MJML first. The application will compile MJML to HTML after validation.

MJML and email requirements:
- Use only well-supported MJML components: mjml, mj-head, mj-title, mj-preview, mj-attributes, mj-body, mj-section, mj-column, mj-text, mj-button, mj-image, mj-divider, mj-spacer, mj-wrapper, mj-table, mj-navbar, mj-social, mj-accordion, mj-carousel, mj-raw only when unavoidable.
- Do not use JavaScript, external CSS frameworks, CSS classes, forms, videos, unsupported interactive HTML, or unknown MJML tags.
- Do not include Markdown fences around MJML.
- Keep layout responsive with a max width around the selected brand style preference.
- Use semantic alt text on images and readable text contrast.
- Include a visible footer with company/contact context and an unsubscribe link when appropriate.
- Use table-safe, email-client-safe structure.
- Avoid nested mj-wrapper tags.
- Use real MJML attributes instead of CSS classes.
- Keep output production-ready and avoid fake URLs.

Brand and variable rules:
- Follow the selected brand style profile closely.
- If uploaded assets are provided, use them as brand context. Prefer {{company.logo_url}} for the production logo instead of local asset API URLs.
- You may use literal brand colors/fonts from the selected style profile.
- If a system variable is needed, use only the allowed variables below.
- Do not invent variables.

Allowed variables:
${allowedVariables.map((variable) => `- {{${variable}}}`).join("\n")}

Reference MJML component patterns:
${getEmailComponentReference()}`;
}

export function buildBrandTemplateUserPrompt(input: AiTemplateGeneratorInput) {
  return JSON.stringify(
    {
      task: "Generate a branded MJML email template.",
      selectedBrandStyle: compactBrandStyleForPrompt(input.brandStyle),
      userRequest: input.request.prompt,
      outputContract: {
        subject: "Short email subject line.",
        preheader: "Useful preview text.",
        mjml: "Complete valid MJML document.",
        usedVariables:
          "List variable names used in MJML without braces, and only include variables that actually appear.",
        notes:
          "Short implementation notes, including any brand assumptions or fallback choices."
      },
      bestPractices: [
        "Start with logo/header when suitable.",
        "Use a clear visual hierarchy.",
        "Keep copy concise and scannable.",
        "Use one primary CTA for promotional or onboarding emails unless the request needs multiple actions.",
        "Make button styling match the brand profile.",
        "Use responsive one-column mobile-friendly structure.",
        "Preserve accessibility: alt text, sufficient contrast, logical reading order."
      ]
    },
    null,
    2
  );
}

export class OpenAiTemplateGenerator implements AiTemplateGenerator {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: AiTemplateGeneratorOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model;
  }

  async generate(input: AiTemplateGeneratorInput) {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: buildBrandTemplateSystemPrompt() },
        { role: "user", content: buildBrandTemplateUserPrompt(input) }
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
      throw new Error("OpenAI vratilo nevalidni JSON.");
    }

    if (!validateGeneratedEmailJson(generated)) {
      throw new Error("OpenAI vratilo JSON v neocekavanem tvaru.");
    }

    return generated;
  }
}

import OpenAI from "openai";

export type CouponMatchInput = {
  coupons: Array<{
    index: number;
    advertiser?: string;
    code: string;
    specification: string;
    url: string;
  }>;
  blocks: Array<{
    index: number;
    comment: string;
    imageAlt: string;
    imageSrc: string;
    buttonCode: string;
    buttonHref: string;
    title: string;
  }>;
};

export type CouponMatch = {
  couponIndex: number;
  templateBlockIndex: number;
  confidence: number;
  reason: string;
};

const matchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          couponIndex: { type: "number" },
          templateBlockIndex: { type: "number" },
          confidence: { type: "number" },
          reason: { type: "string" }
        },
        required: ["couponIndex", "templateBlockIndex", "confidence", "reason"]
      }
    },
    unmatchedCoupons: {
      type: "array",
      items: { type: "number" }
    },
    unmatchedBlocks: {
      type: "array",
      items: { type: "number" }
    }
  },
  required: ["matches", "unmatchedCoupons", "unmatchedBlocks"]
} as const;

type MatchResponse = {
  matches: CouponMatch[];
  unmatchedCoupons: number[];
  unmatchedBlocks: number[];
};

function validateMatchResponse(value: unknown): value is MatchResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as MatchResponse;
  return (
    Array.isArray(candidate.matches) &&
    candidate.matches.every(
      (match) =>
        typeof match.couponIndex === "number" &&
        typeof match.templateBlockIndex === "number" &&
        typeof match.confidence === "number" &&
        typeof match.reason === "string"
    ) &&
    Array.isArray(candidate.unmatchedCoupons) &&
    Array.isArray(candidate.unmatchedBlocks)
  );
}

export async function matchCouponsWithAi(input: {
  apiKey: string;
  model: string;
  data: CouponMatchInput;
}): Promise<MatchResponse> {
  const openai = new OpenAI({ apiKey: input.apiKey });
  const response = await openai.responses.create({
    model: input.model,
    input: [
      {
        role: "system",
        content:
          "Jsi presny parovac kuponu z Excelu na existujici bloky e-mailove sablony. Nemenis texty ani HTML/MJML. Vrat pouze JSON podle schema. Paruj podle nazvu inzerenta, kodu kuponu, komentare bloku, alt textu loga, nazvu souboru loga, puvodniho kodu a podobnosti URL. Kazdy couponIndex i templateBlockIndex pouzij nejvyse jednou. Pokud si nejsi jisty, nastav nizsi confidence."
      },
      {
        role: "user",
        content: JSON.stringify(input.data, null, 2)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "coupon_block_matches",
        strict: true,
        schema: matchSchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text) as unknown;
  if (!validateMatchResponse(parsed)) {
    throw new Error("OpenAI vratilo mapovani kuponu v neocekavanem tvaru.");
  }

  return parsed;
}

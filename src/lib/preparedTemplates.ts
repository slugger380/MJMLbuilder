import { readFileSync } from "node:fs";
import path from "node:path";
import {
  readCouponWorkbookFromUpload,
  type CouponRow,
  type CouponWorkbookInput,
  type WorkbookDataRow,
  normalizeWorkbookKey
} from "@/lib/couponWorkbook";
import { matchCouponsWithAi, type CouponMatch } from "@/lib/couponAiMatcher";
import type { GenerateEmailRequest, GeneratedEmailJson, ValidationIssue } from "@/lib/types";

const couponTemplatePath = path.join(
  process.cwd(),
  "src",
  "templates",
  "sablona_1blok.mjml"
);

export type CouponTemplateInput = {
  buffer: Buffer;
  fileName: string;
};

export type CouponTemplateOptions = {
  useAiMatching?: boolean;
  openaiApiKey?: string;
  model?: string;
};

type CouponSectionPair = {
  coupon: CouponRow;
  couponIndex: number;
  section: string;
  sectionIndex: number;
  isNewBlock: boolean;
  aiConfidence?: number;
  aiReason?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatMultilineText(value: string, indent: string): string {
  const escaped = escapeXml(value);
  const maxLength = 74;
  const words = escaped.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.join(`\n${indent}`);
}

function textBetweenTags(section: string, tagPattern: RegExp): string {
  const match = section.match(tagPattern);
  return normalizeText(match?.[1] || "");
}

function buttonValue(section: string): string {
  return textBetweenTags(section, /<mj-button\b[\s\S]*?>([\s\S]*?)<\/mj-button\s*>/i);
}

function buttonHref(section: string): string {
  return section.match(/<mj-button\b[\s\S]*?\bhref="([^"]*)"/i)?.[1] || "";
}

function imageSrc(section: string): string {
  return section.match(/<mj-image\b[\s\S]*?\bsrc="([^"]*)"/i)?.[1] || "";
}

function imageAlt(section: string): string {
  return section.match(/<mj-image\b[\s\S]*?\balt="([^"]*)"/i)?.[1] || "";
}

function commentLabel(section: string): string {
  return section.match(/<!--\s*([\s\S]*?)\s*-->/)?.[1] || "";
}

function normalizeKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(cz|sk|com|eu|net|org)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sectionSearchKey(section: string): string {
  return [
    commentLabel(section),
    imageAlt(section),
    buttonValue(section),
    imageSrc(section)
  ]
    .map(normalizeKey)
    .join("|");
}

function couponSearchKeys(coupon: CouponRow): string[] {
  return [coupon.advertiser, coupon.code]
    .filter((value): value is string => Boolean(value))
    .map(normalizeKey)
    .filter(Boolean);
}

function validityText(section: string): string {
  const matches = Array.from(
    section.matchAll(/<mj-text\b[^>]*css-class="note"[^>]*>([\s\S]*?)<\/mj-text>/gi)
  );
  return normalizeText(matches.at(-1)?.[1] || "");
}

function firstTitle(section: string): string {
  return textBetweenTags(
    section,
    /<mj-text\b[\s\S]*?font-weight="bold"[\s\S]*?>([\s\S]*?)<\/mj-text>/i
  );
}

function replaceFirstBoldText(section: string, specification: string): string {
  return section.replace(
    /(<mj-text\b[^>]*font-weight="bold"[^>]*>)([\s\S]*?)(<\/mj-text>)/i,
    (_match, open: string, _oldText: string, close: string) =>
      `${open}\n          ${formatMultilineText(specification, "          ")}\n        ${close}`
  );
}

function replaceButton(section: string, coupon: CouponRow): string {
  return section.replace(
    /(<mj-button\b[^>]*\bhref=")([^"]*)("[^>]*>)([\s\S]*?)(<\/mj-button\s*>)/i,
    (_match, open: string, _oldHref: string, middle: string, _oldCode: string, close: string) =>
      `${open}${escapeXml(coupon.url)}${middle}\n          ${escapeXml(coupon.code)}\n        ${close}`
  );
}

function removeLogo(section: string): string {
  return section.replace(/\s*<mj-image\b[\s\S]*?(?:<\/mj-image>|\/>)\s*/i, "\n");
}

function replaceLogo(
  section: string,
  coupon: CouponRow,
  options: { removeWhenMissing?: boolean } = {}
): string {
  const logoUrl = coupon.resolvedLogoUrl || coupon.logoUrl;
  if (!logoUrl?.startsWith("http")) {
    if (options.removeWhenMissing) {
      return removeLogo(section);
    }
    return section;
  }

  const logoTag = `<mj-image
          align="center"
          css-class="logo"
          padding-bottom="15px"
          src="${escapeXml(logoUrl)}"
          width="140px"
        ></mj-image>`;

  if (!/<mj-image\b/i.test(section)) {
    const withLabel = section.replace(
      /(<mj-text\b[^>]*>\s*Slevov[ýy]\s+k[oó]d\s+uplatn[ěe]te[\s\S]*?<\/mj-text>)/i,
      `${logoTag}\n        $1`
    );

    if (withLabel !== section) {
      return withLabel;
    }

    return section.replace(
      /(<mj-button\b[^>]*\bhref="[^"]*"[^>]*>)/i,
      `${logoTag}\n        $1`
    );
  }

  return section.replace(
    /(<mj-image\b[^>]*\bsrc=")([^"]*)("[^>]*\/?>)(<\/mj-image>)?/i,
    (_match, open: string, _oldSrc: string, close: string, end: string = "") =>
      `${open}${escapeXml(logoUrl)}${close}${end}`
  );
}

function replaceValidity(section: string, coupon: CouponRow): string {
  if (!coupon.validTo) {
    return section;
  }

  const validity = `Platnost do ${escapeXml(coupon.validTo)}`;
  const notePattern =
    /(<mj-text\b[^>]*css-class="note"[^>]*>\s*)([\s\S]*?)(\s*<\/mj-text>)/gi;
  const matches = Array.from(section.matchAll(notePattern));
  const lastMatch = matches.at(-1);

  if (!lastMatch || lastMatch.index === undefined) {
    return section;
  }

  const before = section.slice(0, lastMatch.index);
  const after = section.slice(lastMatch.index + lastMatch[0].length);
  return `${before}${lastMatch[1]}\n          ${validity}\n        ${lastMatch[3]}${after}`;
}

function updateCouponSection(
  section: string,
  coupon: CouponRow,
  options: { removeLogoWhenMissing?: boolean } = {}
): string {
  return replaceValidity(
    replaceLogo(
      replaceButton(replaceFirstBoldText(section, coupon.specification), coupon),
      coupon,
      { removeWhenMissing: options.removeLogoWhenMissing }
    ),
    coupon
  );
}

function pairCouponsWithSections(coupons: CouponRow[], sections: string[]): CouponSectionPair[] {
  const remaining = new Set(sections.map((_, index) => index));
  const fallbackSection = sections[0];

  return coupons
    .map((coupon, couponIndex) => {
      const keys = couponSearchKeys(coupon);
      const matchedIndex = Array.from(remaining).find((sectionIndex) => {
        const sectionKey = sectionSearchKey(sections[sectionIndex]);
        return keys.some((key) => key && sectionKey.includes(key));
      });

      if (matchedIndex !== undefined) {
        remaining.delete(matchedIndex);
        return {
          coupon,
          couponIndex,
          section: sections[matchedIndex],
          sectionIndex: matchedIndex,
          isNewBlock: false
        };
      }

      return fallbackSection
        ? {
            coupon,
            couponIndex,
            section: fallbackSection,
            sectionIndex: -1,
            isNewBlock: true
          }
        : undefined;
    })
    .filter((pair): pair is CouponSectionPair => Boolean(pair));
}

function blockSummary(section: string, index: number) {
  return {
    index,
    comment: commentLabel(section),
    imageAlt: imageAlt(section),
    imageSrc: imageSrc(section),
    buttonCode: buttonValue(section),
    buttonHref: buttonHref(section),
    title: firstTitle(section)
  };
}

function couponSummary(coupon: CouponRow, index: number) {
  return {
    index,
    advertiser: coupon.advertiser,
    code: coupon.code,
    specification: coupon.specification,
    url: coupon.url
  };
}

function pairCouponsWithAiMatches(
  coupons: CouponRow[],
  sections: string[],
  matches: CouponMatch[]
): CouponSectionPair[] {
  const usedCoupons = new Set<number>();
  const usedSections = new Set<number>();
  const fallbackSection = sections[0];

  const pairs = matches
    .filter((match) => match.confidence >= 0.55)
    .filter((match) => {
      const valid =
        coupons[match.couponIndex] &&
        sections[match.templateBlockIndex] &&
        !usedCoupons.has(match.couponIndex) &&
        !usedSections.has(match.templateBlockIndex);

      if (valid) {
        usedCoupons.add(match.couponIndex);
        usedSections.add(match.templateBlockIndex);
      }

      return valid;
    })
    .map((match) => ({
      coupon: coupons[match.couponIndex],
      couponIndex: match.couponIndex,
      section: sections[match.templateBlockIndex],
      sectionIndex: match.templateBlockIndex,
      isNewBlock: false,
      aiConfidence: match.confidence,
      aiReason: match.reason
    }));

  const fallbackPairs = coupons
    .map((coupon, couponIndex) => ({ coupon, couponIndex }))
    .filter(({ couponIndex }) => !usedCoupons.has(couponIndex))
    .filter(() => Boolean(fallbackSection))
    .map(({ coupon, couponIndex }) => ({
      coupon,
      couponIndex,
      section: fallbackSection,
      sectionIndex: -1,
      isNewBlock: true,
      aiConfidence: 0,
      aiReason: "AI nenasla odpovidajici blok, vytvoren novy blok z fallback sablony."
    }));

  return [...pairs, ...fallbackPairs];
}

function sourceType(fileName: string, content: string): "mjml" | "html" {
  if (fileName.toLowerCase().endsWith(".html") || /<html[\s>]/i.test(content)) {
    return "html";
  }
  return "mjml";
}

function hasColumnTokens(template: string): boolean {
  return /\[\?[\s\S]+?\?\]/.test(template);
}

function tokenKey(value: string): string {
  return normalizeWorkbookKey(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function currentCzechMonth(): string {
  const monthNames = [
    "LEDNA",
    "\u00daNORA",
    "B\u0158EZNA",
    "DUBNA",
    "KV\u011aTNA",
    "\u010cERVNA",
    "\u010cERVENCE",
    "SRPNA",
    "Z\u00c1\u0158\u00cd",
    "\u0158\u00cdJNA",
    "LISTOPADU",
    "PROSINCE"
  ];

  return monthNames[new Date().getMonth()];
}

function normalizeCzechMonth(value: string | undefined): string {
  const cleaned = normalizeWorkbookKey(value || "")
    .replace(/\./g, "")
    .trim();

  if (!cleaned) {
    return currentCzechMonth();
  }

  const monthByKey: Record<string, string> = {
    "1": "LEDNA",
    "01": "LEDNA",
    leden: "LEDNA",
    ledna: "LEDNA",
    "2": "\u00daNORA",
    "02": "\u00daNORA",
    unor: "\u00daNORA",
    unora: "\u00daNORA",
    "3": "B\u0158EZNA",
    "03": "B\u0158EZNA",
    brezen: "B\u0158EZNA",
    brezna: "B\u0158EZNA",
    "4": "DUBNA",
    "04": "DUBNA",
    duben: "DUBNA",
    dubna: "DUBNA",
    "5": "KV\u011aTNA",
    "05": "KV\u011aTNA",
    kveten: "KV\u011aTNA",
    kvetna: "KV\u011aTNA",
    "6": "\u010cERVNA",
    "06": "\u010cERVNA",
    cerven: "\u010cERVNA",
    cervna: "\u010cERVNA",
    "7": "\u010cERVENCE",
    "07": "\u010cERVENCE",
    cervenec: "\u010cERVENCE",
    cervence: "\u010cERVENCE",
    "8": "SRPNA",
    "08": "SRPNA",
    srpen: "SRPNA",
    srpna: "SRPNA",
    "9": "Z\u00c1\u0158\u00cd",
    "09": "Z\u00c1\u0158\u00cd",
    zari: "Z\u00c1\u0158\u00cd",
    "10": "\u0158\u00cdJNA",
    rijen: "\u0158\u00cdJNA",
    rijna: "\u0158\u00cdJNA",
    "11": "LISTOPADU",
    listopad: "LISTOPADU",
    listopadu: "LISTOPADU",
    "12": "PROSINCE",
    prosinec: "PROSINCE",
    prosince: "PROSINCE"
  };

  return monthByKey[cleaned] || (value || "").trim().toLocaleUpperCase("cs-CZ");
}

function tokenAliases(key: string): string[] {
  const aliases: Record<string, string[]> = {
    mesic: ["mesic"],
    "slevovy kod": [
      "slevovy kod",
      "zneni kuponu",
      "zneni kuponu nebo odkaz na soubor s promokody",
      "kod",
      "promokod"
    ],
    "odkaz na logo": ["odkaz na logo", "logo", "logo url", "url loga"],
    "affiliate odkaz": ["affiliate odkaz", "url", "odkaz"],
    podminka: ["podminka"],
    "platnost od": ["platnost od"],
    "platnost do": ["platnost do"],
    "specifikace promokodu": ["specifikace promokodu"]
  };

  return aliases[key] || [key];
}

function isOptionalToken(rawToken: string): boolean {
  return ["odkaz na logo", "logo", "logo url", "url loga", "podminka"].includes(
    tokenKey(rawToken)
  );
}

function rowLookup(row: WorkbookDataRow): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const [header, value] of Object.entries(row.values)) {
    lookup.set(tokenKey(header), value);
  }

  return lookup;
}

function valueForToken(
  rawToken: string,
  row: WorkbookDataRow,
  month: string
): string | undefined {
  const key = tokenKey(rawToken);

  if (key === "mesic") {
    return month;
  }

  const lookup = rowLookup(row);
  for (const alias of tokenAliases(key)) {
    const value = lookup.get(alias);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function replaceColumnTokens(
  source: string,
  row: WorkbookDataRow,
  month: string,
  missingTokens: Set<string>
): string {
  return source.replace(/\[\?([\s\S]+?)\?\]/g, (_match, rawToken: string) => {
    const value = valueForToken(rawToken, row, month);

    if (value === undefined) {
      if (!isOptionalToken(rawToken)) {
        missingTokens.add(normalizeText(rawToken));
      }
      return "";
    }

    return escapeXml(value);
  });
}

function removeEmptyImages(source: string): string {
  return source.replace(
    /\s*<mj-image\b(?=[^>]*\bsrc="(?:\s*|\[\?[\s\S]*?\?\])")[\s\S]*?(?:<\/mj-image>|\/>)\s*/gi,
    "\n"
  );
}

function extractSingleBlockTemplate(template: string): {
  prefix: string;
  block: string;
  footer: string;
} {
  const sectionPattern = /\n?\s*(?:<!--[\s\S]*?-->\s*)?<mj-section\b[\s\S]*?<\/mj-section>/gi;
  const sections = Array.from(template.matchAll(sectionPattern));
  const blockMatch = sections.find((match) => {
    const section = match[0];
    const tokens = Array.from(section.matchAll(/\[\?([\s\S]+?)\?\]/g)).map((token) =>
      tokenKey(token[1])
    );

    return tokens.some((token) => token !== "mesic");
  });

  if (!blockMatch || blockMatch.index === undefined) {
    return { prefix: template, block: "", footer: "" };
  }

  const start = blockMatch.index;
  const end = start + blockMatch[0].length;

  return {
    prefix: template.slice(0, start),
    block: blockMatch[0],
    footer: template.slice(end)
  };
}

function buildTokenizedTemplate(
  input: GenerateEmailRequest,
  workbook: ReturnType<typeof readCouponWorkbookFromUpload>,
  template: string,
  templateName: string
): {
  generated: GeneratedEmailJson;
  templateSourceType: "mjml";
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = workbook.tableWarnings.map((message) => ({
    type: "warning",
    message
  }));
  const { prefix, block, footer } = extractSingleBlockTemplate(template);
  const month = normalizeCzechMonth(input.couponMonth);

  if (!block) {
    issues.push({
      type: "error",
      message:
        "V sablone se nepodarilo najit ukazkovy blok s tokeny [?NAZEV SLOUPCE?]."
    });
  }

  if (workbook.rows.length === 0) {
    issues.push({
      type: "error",
      message: "V Excelu se nepodarilo najit zadne datove radky."
    });
  }

  const missingTokens = new Set<string>();
  const headerRow = workbook.rows[0] || { rowNumber: 0, values: {} };
  const filledPrefix = replaceColumnTokens(prefix, headerRow, month, missingTokens);
  const filledFooter = replaceColumnTokens(footer, headerRow, month, missingTokens);
  const blocks = workbook.rows
    .map((row) =>
      removeEmptyImages(replaceColumnTokens(block, row, month, missingTokens))
    )
    .join("\n");
  const mjml = `${filledPrefix}${blocks}${filledFooter}`;

  for (const token of missingTokens) {
    if (tokenKey(token) !== "mesic") {
      issues.push({
        type: "warning",
        message: `Token [?${token}?] nema odpovidajici sloupec v Excelu, byl ponechan prazdny.`
      });
    }
  }

  return {
    generated: {
      subject: input.topic?.trim() || `Slevove kody na ${month}`,
      preheader:
        input.mainMessage?.trim() ||
        "Aktualni slevove kody sestavene podle nahrane excelove tabulky.",
      mjml,
      usedVariables: [],
      notes: [
        `Pouzita tokenova MJML sablona: ${templateName}.`,
        `Zdroj Excelu: ${workbook.fileName}`,
        `List: ${workbook.sheetName}`,
        `Mesic: ${month}`,
        `Pouzito radku/bloku: ${workbook.rows.length}`,
        "Kazdy datovy radek Excelu vytvoril jednu kopii ukazkoveho bloku.",
        "Tokeny ve tvaru [?NAZEV SLOUPCE?] se doplnily podle hlavicek Excelu.",
        "Pokud je prazdny token pro logo, mj-image se z bloku odstrani."
      ]
    },
    templateSourceType: "mjml",
    issues
  };
}

function buildCouponTemplateError(
  input: GenerateEmailRequest,
  workbook: ReturnType<typeof readCouponWorkbookFromUpload>,
  templateName: string,
  message: string
): {
  generated: GeneratedEmailJson;
  html?: string;
  templateSourceType: "mjml" | "html";
  issues: ValidationIssue[];
} {
  return {
    generated: {
      subject: input.topic?.trim() || "Slevove kody",
      preheader:
        input.mainMessage?.trim() ||
        "Sablonu se nepodarilo sestavit kvuli nevhodnemu formatu sablony.",
      mjml: "",
      usedVariables: [],
      notes: [
        `Pouzita sablona: ${templateName}.`,
        `Zdroj Excelu: ${workbook.fileName}`,
        `List: ${workbook.sheetName}`,
        "Rezim Kupony z Excelu ted pouziva pouze jednu MJML predlohu s tokeny [?NAZEV SLOUPCE?]."
      ]
    },
    html: "",
    templateSourceType: "mjml",
    issues: [{ type: "error", message }]
  };
}

function extractCouponSections(template: string): {
  prefix: string;
  sections: string[];
  footer: string;
} {
  const sectionPattern = /\n\s*(?:<!--[\s\S]*?-->\s*)?<mj-section\b[\s\S]*?<\/mj-section>/g;
  const matches = Array.from(template.matchAll(sectionPattern)).filter((match) => {
    const section = match[0];
    return (
      /<mj-button\b/i.test(section) &&
      /\bhref="/i.test(section) &&
      !section.includes("[!customer_portal_url!]") &&
      /Slevov[ýy]\s+k[oó]d|css-class="code|btn-center/i.test(section)
    );
  });

  if (matches.length === 0 || matches[0].index === undefined) {
    return { prefix: template, sections: [], footer: "" };
  }

  const firstIndex = matches[0].index;
  const lastMatch = matches[matches.length - 1];
  const lastIndex = (lastMatch.index || 0) + lastMatch[0].length;

  return {
    prefix: template.slice(0, firstIndex),
    sections: matches.map((match) => match[0]),
    footer: template.slice(lastIndex)
  };
}

function buildChangeNotes(
  pairs: CouponSectionPair[]
): string[] {
  return pairs.flatMap(({ coupon, section, sectionIndex, isNewBlock }) => {
    const label = coupon.advertiser || coupon.code || `blok ${sectionIndex + 1}`;

    const changes = [
      isNewBlock ? `${label}: vytvoren novy kuponovy blok z fallback sablony.` : "",
      firstTitle(section) !== normalizeText(coupon.specification)
        ? `${label}: aktualizovana specifikace promokodu.`
        : "",
      buttonValue(section) !== coupon.code
        ? `${label}: aktualizovano zneni kuponu.`
        : "",
      buttonHref(section) !== coupon.url
        ? `${label}: aktualizovan affiliate odkaz.`
        : "",
      coupon.logoUrl?.startsWith("http") && imageSrc(section) !== coupon.logoUrl
        ? `${label}: aktualizovano logo z Excelu.`
        : "",
      !coupon.logoUrl?.startsWith("http") && coupon.resolvedLogoUrl?.startsWith("http")
        ? `${label}: zachovano logo ze sablony.`
        : "",
      coupon.validTo && !validityText(section).includes(coupon.validTo)
        ? `${label}: aktualizovana platnost do.`
        : ""
    ];

    return changes.filter(Boolean);
  });
}

function replaceSequential(
  source: string,
  pattern: RegExp,
  values: Array<string | undefined>,
  replacer: (match: RegExpExecArray, value: string | undefined) => string
): string {
  let index = 0;
  return source.replace(pattern, (...args: unknown[]) => {
    const match = args.slice(0, -2) as string[];
    const value = values[index];
    index += 1;
    return replacer(match as unknown as RegExpExecArray, value);
  });
}

function updateHtmlTemplate(template: string, coupons: CouponRow[]): string {
  let html = template;

  html = replaceSequential(
    html,
    /(<a\b[^>]*\bhref=")([^"]*)("[^>]*>)([\s\S]*?)(<\/a>)/gi,
    coupons.map((coupon) => `${coupon.url}|||${coupon.code}`),
    (match, value) => {
      if (!value) {
        return match[0];
      }
      const [url, code] = value.split("|||");
      return `${match[1]}${escapeXml(url)}${match[3]}${escapeXml(code)}${match[5]}`;
    }
  );

  html = replaceSequential(
    html,
    /Platnost(?:\s+od\s+[^<\n]+?)?\s+do\s+[^<\n]+/gi,
    coupons.map((coupon) => coupon.validTo || ""),
    (match, value) => (value ? `Platnost do ${escapeXml(value)}` : match[0])
  );

  html = replaceSequential(
    html,
    /(<img\b[^>]*\bsrc=")([^"]*)("[^>]*>)/gi,
    coupons.map((coupon) => coupon.logoUrl || ""),
    (match, value) => (value ? `${match[1]}${escapeXml(value)}${match[3]}` : match[0])
  );

  if (!/<img\b/i.test(html)) {
    const firstLogo = coupons.find((coupon) => coupon.logoUrl)?.logoUrl;
    if (firstLogo) {
      html = html.replace(
        /(<a\b[^>]*>[\s\S]*?<\/a>)/i,
        `<img src="${escapeXml(firstLogo)}" alt="" width="140" style="display:block;margin:0 auto 15px auto;" />$1`
      );
    }
  }

  return html;
}

export async function buildCouponsTemplate(
  input: GenerateEmailRequest,
  workbookInput: CouponWorkbookInput,
  templateInput?: CouponTemplateInput,
  options: CouponTemplateOptions = {}
): Promise<{
  generated: GeneratedEmailJson;
  html?: string;
  templateSourceType: "mjml" | "html";
  issues: ValidationIssue[];
}> {
  const workbook = readCouponWorkbookFromUpload(workbookInput, 24);
  const template = templateInput
    ? templateInput.buffer.toString("utf8")
    : readFileSync(couponTemplatePath, "utf8");
  const templateKind = sourceType(templateInput?.fileName || "sablona_1blok.mjml", template);
  const templateName = templateInput?.fileName || "sablona_1blok.mjml";
  const coupons = workbook.coupons;

  if (templateKind === "html") {
    return buildCouponTemplateError(
      input,
      workbook,
      templateName,
      "Pro skladani kuponu nahrajte puvodni MJML sablonu s tokeny [?NAZEV SLOUPCE?], ne vygenerovany HTML vystup."
    );
  }

  if (hasColumnTokens(template)) {
    return buildTokenizedTemplate(input, workbook, template, templateName);
  }

  if (process.env.ENABLE_LEGACY_COUPON_TEMPLATE !== "true") {
    return buildCouponTemplateError(
      input,
      workbook,
      templateName,
      "MJML sablona neobsahuje tokeny ve tvaru [?NAZEV SLOUPCE?]. Nahrajte jednoblokovou tokenovou sablonu."
    );
  }

  const { prefix, sections, footer } = extractCouponSections(template);
  const issues: ValidationIssue[] = workbook.warnings.map((message) => ({
    type: "warning",
    message
  }));

  if (sections.length === 0) {
    issues.push({
      type: "error",
      message: "V MJML sablone se nepodarilo najit kuponove bloky."
    });
  }

  if (workbook.coupons.length > sections.length) {
    issues.push({
      type: "warning",
      message: `Excel obsahuje ${workbook.coupons.length} kuponu, sablona ma ${sections.length} bloku. Nove kupony se vytvori z fallback sablony.`
    });
  }

  let aiNotes: string[] = [];
  let pairs = pairCouponsWithSections(coupons, sections);

  if (options.useAiMatching) {
    if (!options.openaiApiKey) {
      issues.push({
        type: "warning",
        message:
          "AI parovani bylo zapnute, ale chybi OPENAI_API_KEY. Pouzito lokalni parovani."
      });
    } else {
      try {
        const aiResult = await matchCouponsWithAi({
          apiKey: options.openaiApiKey,
          model: options.model || "gpt-5.2",
          data: {
            coupons: coupons.map(couponSummary),
            blocks: sections.map(blockSummary)
          }
        });
        const aiPairs = pairCouponsWithAiMatches(
          coupons,
          sections,
          aiResult.matches
        );

        if (aiPairs.length > 0) {
          pairs = aiPairs;
          aiNotes = [
            `AI parovani pouzito: ${aiPairs.length} paru.`,
            ...aiPairs.map(
              (pair) =>
                `${pair.coupon.advertiser || pair.coupon.code}: blok ${pair.sectionIndex + 1}, jistota ${Math.round((pair.aiConfidence || 0) * 100)} %. ${pair.aiReason || ""}`
            )
          ];
        } else {
          issues.push({
            type: "warning",
            message:
              "AI parovani nevratilo zadne pouzitelne pary. Pouzito lokalni parovani."
          });
        }
      } catch (error) {
        issues.push({
          type: "warning",
          message: "AI parovani selhalo. Pouzito lokalni parovani.",
          details: error instanceof Error ? error.message : "Neznama chyba"
        });
      }
    }
  }

  const pairsWithResolvedLogos = pairs.map((pair) => ({
    ...pair,
    coupon: {
      ...pair.coupon,
      resolvedLogoUrl:
        pair.coupon.logoUrl || (!pair.isNewBlock ? imageSrc(pair.section) : undefined)
    }
  }));
  const mjml = `${prefix}${pairsWithResolvedLogos
    .sort((a, b) => a.couponIndex - b.couponIndex)
    .map(({ section, coupon, isNewBlock }) =>
      updateCouponSection(section, coupon, { removeLogoWhenMissing: isNewBlock })
    )
    .join("")}${footer}`;
  const changeNotes = buildChangeNotes(pairsWithResolvedLogos);
  const templateLogoCount = pairsWithResolvedLogos.filter(
    ({ coupon }) => !coupon.logoUrl && coupon.resolvedLogoUrl?.startsWith("http")
  ).length;

  return {
    generated: {
      subject: input.topic?.trim() || "Slevove kody pro verne zakazniky",
      preheader:
        input.mainMessage?.trim() ||
        "Aktualni slevove kody sestavene podle nahrane excelove tabulky.",
      mjml,
      usedVariables: [],
      notes: [
        `Pouzita MJML sablona: ${templateName}.`,
        `Zdroj Excelu: ${workbook.fileName}`,
        `List: ${workbook.sheetName}`,
        `Pouzito kuponu: ${pairs.length}`,
        "Kupony byly parovany se sablonou podle nazvu inzerenta, alt textu loga, komentare bloku nebo puvodniho kodu.",
        "Nove kupony bez odpovidajiciho bloku se vytvari z prvni kuponove karty v sablone.",
        `Nalezeno logo URL: ${workbook.logoCount}`,
        `Prevzato logo ze sablony: ${templateLogoCount}`,
        ...aiNotes,
        ...changeNotes
      ]
    },
    templateSourceType: "mjml",
    issues
  };
}

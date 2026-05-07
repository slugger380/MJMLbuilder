import { createRequire } from "node:module";
import type { ValidationIssue } from "@/lib/types";

type XlsxModule = {
  read: (data: Buffer, options: { type: "buffer"; cellDates: false }) => Workbook;
  utils: {
    sheet_to_json: <T>(worksheet: Worksheet, options: { header: 1; blankrows: false }) => T[];
  };
};

type Workbook = {
  SheetNames: string[];
  Sheets: Record<string, Worksheet>;
};

type Worksheet = Record<string, unknown>;

export type CouponRow = {
  advertiser?: string;
  code: string;
  specification: string;
  validTo?: string;
  url: string;
  logoUrl?: string;
  resolvedLogoUrl?: string;
};

export type CouponWorkbookResult = {
  fileName: string;
  sheetName: string;
  coupons: CouponRow[];
  rows: WorkbookDataRow[];
  headers: string[];
  issues: ValidationIssue[];
  warnings: string[];
  couponIssues: ValidationIssue[];
  couponWarnings: string[];
  tableIssues: ValidationIssue[];
  tableWarnings: string[];
  logoCount: number;
};

export type CouponWorkbookInput = {
  buffer: Buffer;
  fileName: string;
};

export type WorkbookDataRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export const DEFAULT_COUPON_WORKBOOK_LIMIT = 100;

function getXlsx(): XlsxModule {
  const requireFromProject = createRequire(`${process.cwd()}/package.json`);
  return requireFromProject("xlsx") as XlsxModule;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeWorkbookKey(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: unknown): string {
  return normalizeWorkbookKey(value);
}

function excelDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(value);
  }

  if (typeof value !== "number") {
    return text(value) || undefined;
  }

  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function looksLikeLogoUrl(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return (
    normalized.startsWith("http") &&
    (normalized.includes("logo") ||
      normalized.includes("/download/mail/") ||
      normalized.includes("_kupony") ||
      /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(normalized))
  );
}

function firstLogoUrl(row: unknown[], preferredIndexes: number[] = []): string | undefined {
  const preferred = preferredIndexes.map((index) => text(row[index])).find(looksLikeLogoUrl);
  if (preferred) {
    return preferred;
  }

  return row.map(text).find(looksLikeLogoUrl);
}

function pickSheetName(workbook: Workbook): string {
  const preferred = ["březen opravené", "březen", "brezen opravene", "brezen"];
  const normalized = new Map(
    workbook.SheetNames.map((sheetName) => [normalizeHeader(sheetName), sheetName])
  );

  return (
    preferred
      .map((sheetName) => normalized.get(normalizeHeader(sheetName)))
      .find(Boolean) ||
    workbook.SheetNames[0]
  );
}

function normalizeRows(rows: unknown[][]): {
  coupons: CouponRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const headerIndex = rows.findIndex((row) => {
    const joined = row.map(normalizeHeader).join("|");
    return (
      joined.includes("specifikace promokodu") &&
      joined.includes("platnost do") &&
      joined.includes("affiliate odkaz") &&
      joined.includes("zneni kuponu")
    );
  });

  if (headerIndex < 0) {
    return normalizeRowsWithoutHeader(rows);
  }

  const header = rows[headerIndex].map(normalizeHeader);
  const indexOf = (needle: string) => header.findIndex((name) => name.includes(needle));
  const specificationIndex = indexOf("specifikace promokodu");
  const validToIndex = indexOf("platnost do");
  const urlIndex = indexOf("affiliate odkaz");
  const codeIndex = indexOf("zneni kuponu");
  const advertiserIndex = header.findIndex(
    (name) => name.includes("inzerent") || name.includes("nazev") || name.includes("název")
  );
  const logoHeaderMatchers = [
    "odkaz na logo",
    "url loga",
    "logo url",
    "logo_url",
    "logo",
    "obrazek",
    "image"
  ];
  const logoIndex = logoHeaderMatchers
    .map((matcher) => header.findIndex((name) => name.includes(matcher)))
    .find((index) => index >= 0) ?? -1;

  const coupons = rows
    .slice(headerIndex + 1)
    .map((row) => ({
      advertiser: advertiserIndex >= 0 ? text(row[advertiserIndex]) : undefined,
      specification: text(row[specificationIndex]),
      validTo: excelDate(row[validToIndex]),
      url: text(row[urlIndex]),
      code: text(row[codeIndex]),
      logoUrl:
        logoIndex >= 0 && text(row[logoIndex]).startsWith("http")
          ? text(row[logoIndex])
          : firstLogoUrl(row)
    }))
    .filter((coupon) => coupon.specification || coupon.code || coupon.url)
    .filter((coupon) => {
      const isValid = coupon.specification && coupon.code && coupon.url.startsWith("http");
      if (!isValid) {
        warnings.push(
          `Preskocen radek: chybi specifikace, zneni kuponu nebo validni affiliate odkaz.`
        );
      }
      if (isValid && logoIndex >= 0 && text((coupon as CouponRow).logoUrl) === "") {
        warnings.push(`Radek ${coupon.code}: sloupec Odkaz na logo je prazdny nebo neobsahuje URL.`);
      }
      return isValid;
    });

  return { coupons, warnings };
}

function formatCellValue(value: unknown, header: string): string {
  const normalizedHeader = normalizeHeader(header);
  if (
    normalizedHeader.includes("platnost") ||
    normalizedHeader.includes("datum") ||
    normalizedHeader.includes("date")
  ) {
    return excelDate(value) || "";
  }

  return text(value);
}

function normalizeWorkbookRows(rows: unknown[][]): {
  rows: WorkbookDataRow[];
  headers: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const headerIndex = rows.findIndex(
    (row) => row.map(text).filter(Boolean).length >= 2
  );

  if (headerIndex < 0) {
    return {
      rows: [],
      headers: [],
      warnings: ["V Excelu nebyla nalezena hlavicka se sloupci."]
    };
  }

  const headers = rows[headerIndex].map(text);
  const dataRows = rows
    .slice(headerIndex + 1)
    .map((row, rowIndex) => {
      const values = headers.reduce<Record<string, string>>((acc, header, index) => {
        if (header) {
          acc[header] = formatCellValue(row[index], header);
        }
        return acc;
      }, {});

      return {
        rowNumber: headerIndex + rowIndex + 2,
        values
      };
    })
    .filter((row) => Object.values(row.values).some(Boolean));

  return { rows: dataRows, headers: headers.filter(Boolean), warnings };
}

function excelIssue(
  type: ValidationIssue["type"],
  message: string,
  details?: string
): ValidationIssue {
  return {
    type,
    message: `Excel: ${message}`,
    details,
    source: "excel-workbook"
  };
}

function duplicateHeaders(headers: string[]) {
  const counts = new Map<string, number>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return Array.from(counts)
    .filter(([, count]) => count > 1)
    .map(([header]) => header);
}

function tableHealthIssues(
  rawRows: unknown[][],
  table: ReturnType<typeof normalizeWorkbookRows>,
  limit: number
): ValidationIssue[] {
  const issues = table.warnings.map((message) => excelIssue("warning", message));
  const visibleRowCount = rawRows.filter((row) => row.map(text).some(Boolean)).length;
  const duplicates = duplicateHeaders(table.headers);

  if (visibleRowCount === 0) {
    issues.push(
      excelIssue(
        "error",
        "List je prazdny nebo obsahuje jen prazdne bunky.",
        "Nahrajte list s hlavickou a alespon jednim datovym radkem."
      )
    );
    return issues;
  }

  if (table.headers.length === 0) {
    issues.push(
      excelIssue(
        "error",
        "Nepodarilo se rozpoznat hlavicku tabulky.",
        "Prvni pouzitelny radek by mel obsahovat nazvy sloupcu, napr. Specifikace promokodu, Zneni kuponu a Affiliate odkaz."
      )
    );
    return issues;
  }

  if (table.headers.length < 3) {
    issues.push(
      excelIssue(
        "warning",
        `Tabulka ma jen ${table.headers.length} rozpoznane sloupce.`,
        "Zkontrolujte, jestli je vybrany spravny list a jestli hlavicka neni posunuta nebo sloucena."
      )
    );
  }

  if (duplicates.length) {
    issues.push(
      excelIssue(
        "warning",
        `Duplicitni nazvy sloupcu: ${duplicates.join(", ")}.`,
        "Duplicitni hlavicky mohou zpusobit, ze se do sablony propise jina hodnota, nez cekate."
      )
    );
  }

  if (table.rows.length === 0) {
    issues.push(
      excelIssue(
        "error",
        "Tabulka ma hlavicku, ale zadne datove radky.",
        "Doplnte alespon jeden radek s hodnotami pod hlavicku."
      )
    );
  }

  if (table.rows.length > limit) {
    issues.push(
      excelIssue(
        "warning",
        `Tabulka obsahuje vice nez ${limit} datovych radku, pouzije se jen prvnich ${limit}.`
      )
    );
  }

  const sparseRows = table.rows.filter(
    (row) => Object.values(row.values).filter(Boolean).length <= 1
  ).length;

  if (table.rows.length >= 4 && sparseRows / table.rows.length >= 0.5) {
    issues.push(
      excelIssue(
        "warning",
        "Vetsina datovych radku ma vyplnenou jen jednu bunku.",
        "Tabulka muze byt spatne rozpoznana, posunuta, sloucena nebo muze byt vybrany nespravny list."
      )
    );
  }

  return issues;
}

function couponHealthIssues(
  normalized: ReturnType<typeof normalizeRows>,
  coupons: CouponRow[]
): ValidationIssue[] {
  const issues = normalized.warnings.map((message) => excelIssue("warning", message));
  const codeCounts = new Map<string, number>();
  const urlCounts = new Map<string, number>();

  if (normalized.coupons.length === 0) {
    issues.push(
      excelIssue(
        "error",
        "Nepodarilo se najit zadne pouzitelne kupony.",
        "Kuponovy radek musi mit specifikaci, zneni kuponu a affiliate odkaz zacinajici na http."
      )
    );
  }

  for (const coupon of coupons) {
    if (coupon.code) {
      codeCounts.set(coupon.code, (codeCounts.get(coupon.code) || 0) + 1);
    }
    if (coupon.url) {
      urlCounts.set(coupon.url, (urlCounts.get(coupon.url) || 0) + 1);
    }
  }

  const duplicateCodes = Array.from(codeCounts)
    .filter(([, count]) => count > 1)
    .map(([code]) => code);
  const duplicateUrls = Array.from(urlCounts)
    .filter(([, count]) => count > 1)
    .map(([url]) => url);

  if (duplicateCodes.length) {
    issues.push(
      excelIssue(
        "warning",
        `Duplicitni kuponove kody: ${duplicateCodes.slice(0, 8).join(", ")}.`,
        duplicateCodes.length > 8 ? `Dalsich duplicit: ${duplicateCodes.length - 8}.` : undefined
      )
    );
  }

  if (duplicateUrls.length) {
    issues.push(
      excelIssue(
        "warning",
        `Duplicitni affiliate odkazy: ${duplicateUrls.length}.`,
        "Duplicitni odkazy mohou byt v poradku, ale stoji za rychlou kontrolu."
      )
    );
  }

  return issues;
}

function uniqueIssues(issues: ValidationIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.type}|${issue.message}|${issue.details || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeRowsWithoutHeader(rows: unknown[][]): {
  coupons: CouponRow[];
  warnings: string[];
} {
  const warnings: string[] = [
    "V Excelu nebyla nalezena hlavicka, pouzito cteni podle rozlozeni z kuponove tabulky."
  ];
  const groups = [
    {
      advertiser: 0,
      code: 1,
      specification: 2,
      validTo: 4,
      url: 5,
      logoCandidates: [6, 9, 10, 11, 12]
    },
    {
      advertiser: 13,
      code: 14,
      specification: 15,
      validTo: 17,
      url: 18,
      logoCandidates: [19, 20, 21, 22]
    }
  ];
  const seen = new Set<string>();
  const coupons: CouponRow[] = [];

  for (const row of rows) {
    for (const group of groups) {
      const coupon = {
        advertiser: text(row[group.advertiser]) || undefined,
        code: text(row[group.code]),
        specification: text(row[group.specification]),
        validTo: excelDate(row[group.validTo]),
        url: text(row[group.url]),
        logoUrl: firstLogoUrl(row, group.logoCandidates)
      };
      const key = `${coupon.code}|${coupon.specification}|${coupon.url}`;
      if (
        coupon.code &&
        coupon.specification &&
        coupon.url.startsWith("http") &&
        !seen.has(key)
      ) {
        seen.add(key);
        coupons.push(coupon);
      }
    }
  }

  if (coupons.length === 0) {
    warnings.push(
      "Nepodarilo se precist kupony ani podle standardnich sloupcu: Zneni kuponu, Specifikace promokodu, Platnost do, Affiliate odkaz."
    );
  }

  return { coupons, warnings };
}

export function readCouponWorkbookFromUpload(
  input: CouponWorkbookInput,
  limit = DEFAULT_COUPON_WORKBOOK_LIMIT
): CouponWorkbookResult {
  const xlsx = getXlsx();
  const workbook = xlsx.read(input.buffer, { type: "buffer", cellDates: false });

  if (!workbook.SheetNames.length) {
    const issues = [
      excelIssue(
        "error",
        "Soubor neobsahuje zadny list.",
        "Zkontrolujte, jestli nahravate spravny .xlsx nebo .xls soubor."
      )
    ];

    return {
      fileName: input.fileName,
      sheetName: "",
      coupons: [],
      rows: [],
      headers: [],
      issues,
      warnings: issues.map((issue) => issue.message.replace(/^Excel:\s*/, "")),
      couponIssues: [],
      couponWarnings: [],
      tableIssues: issues,
      tableWarnings: [],
      logoCount: 0
    };
  }

  const sheetName = pickSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    const issues = [
      excelIssue(
        "error",
        `List "${sheetName}" se nepodarilo nacist.`,
        "Zkuste soubor znovu ulozit v Excelu a nahrat aktualni verzi."
      )
    ];

    return {
      fileName: input.fileName,
      sheetName,
      coupons: [],
      rows: [],
      headers: [],
      issues,
      warnings: issues.map((issue) => issue.message.replace(/^Excel:\s*/, "")),
      couponIssues: [],
      couponWarnings: [],
      tableIssues: issues,
      tableWarnings: [],
      logoCount: 0
    };
  }

  const rows = xlsx.utils.sheet_to_json<unknown[]>(
    sheet,
    { header: 1, blankrows: false }
  );
  const normalized = normalizeRows(rows);
  const table = normalizeWorkbookRows(rows);
  const coupons = normalized.coupons.slice(0, limit);
  const tableIssues = tableHealthIssues(rows, table, limit);
  const couponIssues = couponHealthIssues(normalized, coupons);
  const issues = uniqueIssues([...tableIssues, ...couponIssues]);
  const warnings = issues.map((issue) => issue.message.replace(/^Excel:\s*/, ""));
  const logoCount = coupons.filter((coupon) => Boolean(coupon.logoUrl)).length;

  if (normalized.coupons.length > limit) {
    warnings.push(`Pouzito prvnich ${limit} kuponu z ${normalized.coupons.length}.`);
    couponIssues.push(
      excelIssue(
        "warning",
        `Pouzito prvnich ${limit} kuponu z ${normalized.coupons.length}.`
      )
    );
    issues.push(
      excelIssue(
        "warning",
        `Pouzito prvnich ${limit} kuponu z ${normalized.coupons.length}.`
      )
    );
  }

  if (coupons.length === 0) {
    warnings.push("V nahranem Excelu se nepodarilo najit zadne pouzitelne kupony.");
  }

  return {
    fileName: input.fileName,
    sheetName,
    coupons,
    rows: table.rows.slice(0, limit),
    headers: table.headers,
    issues: uniqueIssues(issues),
    warnings,
    couponIssues: uniqueIssues(couponIssues),
    couponWarnings: normalized.warnings,
    tableIssues: uniqueIssues(tableIssues),
    tableWarnings: table.warnings,
    logoCount
  };
}

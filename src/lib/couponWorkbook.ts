import { createRequire } from "node:module";

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
  warnings: string[];
  couponWarnings: string[];
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
  limit = 12
): CouponWorkbookResult {
  const xlsx = getXlsx();
  const workbook = xlsx.read(input.buffer, { type: "buffer", cellDates: false });
  const sheetName = pickSheetName(workbook);
  const rows = xlsx.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[sheetName],
    { header: 1, blankrows: false }
  );
  const normalized = normalizeRows(rows);
  const table = normalizeWorkbookRows(rows);
  const coupons = normalized.coupons.slice(0, limit);
  const warnings = [...normalized.warnings, ...table.warnings];
  const logoCount = coupons.filter((coupon) => Boolean(coupon.logoUrl)).length;

  if (normalized.coupons.length > limit) {
    warnings.push(`Pouzito prvnich ${limit} kuponu z ${normalized.coupons.length}.`);
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
    warnings,
    couponWarnings: normalized.warnings,
    tableWarnings: table.warnings,
    logoCount
  };
}

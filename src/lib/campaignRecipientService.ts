import type {
  CampaignRecipient,
  CampaignRecipientSource,
  CampaignRecipientStatus,
  CampaignRecipients,
  RecipientImportError
} from "@/lib/types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RecipientDraft = {
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customFields?: Record<string, string>;
};

export type RecipientImportResult = {
  recipients: CampaignRecipient[];
  errors: RecipientImportError[];
  duplicateCount: number;
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidRecipientEmail(email: string) {
  return emailPattern.test(normalizeRecipientEmail(email));
}

export function createCampaignRecipient(
  input: RecipientDraft,
  source: CampaignRecipientSource = "manual",
  status: CampaignRecipientStatus = "active"
): CampaignRecipient {
  return {
    id: createId("recipient"),
    email: normalizeRecipientEmail(input.email || ""),
    firstName: input.firstName?.trim() || undefined,
    lastName: input.lastName?.trim() || undefined,
    company: input.company?.trim() || undefined,
    customFields: input.customFields || {},
    status,
    source,
    createdAt: nowIso()
  };
}

export function createEmptyCampaignRecipients(): CampaignRecipients {
  return {
    source: "none",
    recipients: [],
    invalidRows: [],
    duplicateCount: 0
  };
}

function splitRow(row: string) {
  if (row.includes("\t")) {
    return row.split("\t");
  }

  if (row.includes(";") && !row.includes(",")) {
    return row.split(";");
  }

  return row.split(",");
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function looksLikeHeader(cells: string[]) {
  const normalized = cells.map(normalizeHeader);
  return normalized.some((cell) =>
    ["email", "e_mail", "mail", "first_name", "last_name", "company"].includes(cell)
  );
}

function fieldValue(cells: string[], headers: string[], aliases: string[]) {
  const index = headers.findIndex((header) => aliases.includes(header));
  return index >= 0 ? cells[index]?.trim() || "" : "";
}

function draftFromCells(cells: string[], headers: string[]): RecipientDraft {
  if (!headers.length) {
    return {
      email: cells[0]?.trim(),
      firstName: cells[1]?.trim(),
      lastName: cells[2]?.trim(),
      company: cells[3]?.trim()
    };
  }

  const known = new Set([
    "email",
    "e_mail",
    "mail",
    "first_name",
    "firstname",
    "first",
    "jmeno",
    "last_name",
    "lastname",
    "last",
    "prijmeni",
    "company",
    "firma",
    "spolecnost"
  ]);
  const customFields = headers.reduce<Record<string, string>>((acc, header, index) => {
    const value = cells[index]?.trim();
    if (value && !known.has(header)) {
      acc[header] = value;
    }
    return acc;
  }, {});

  return {
    email: fieldValue(cells, headers, ["email", "e_mail", "mail"]),
    firstName: fieldValue(cells, headers, ["first_name", "firstname", "first", "jmeno"]),
    lastName: fieldValue(cells, headers, ["last_name", "lastname", "last", "prijmeni"]),
    company: fieldValue(cells, headers, ["company", "firma", "spolecnost"]),
    customFields
  };
}

export function importRecipientsFromDelimitedText(
  source: string,
  existingRecipients: CampaignRecipient[] = [],
  importSource: CampaignRecipientSource = "csv-import"
): RecipientImportResult {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set(existingRecipients.map((recipient) => normalizeRecipientEmail(recipient.email)));
  const errors: RecipientImportError[] = [];
  const recipients: CampaignRecipient[] = [];
  let duplicateCount = 0;

  if (!lines.length) {
    return {
      recipients,
      errors: [{ rowNumber: 1, message: "Import neobsahuje zadne radky." }],
      duplicateCount
    };
  }

  const firstCells = splitRow(lines[0]).map((cell) => cell.trim());
  const hasHeader = looksLikeHeader(firstCells);
  const headers = hasHeader ? firstCells.map(normalizeHeader) : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    const cells = splitRow(line).map((cell) => cell.trim());
    const draft = draftFromCells(cells, headers);
    const email = normalizeRecipientEmail(draft.email || "");

    if (!email) {
      errors.push({ rowNumber, message: "Radek nema e-mailovou adresu." });
      return;
    }

    if (!isValidRecipientEmail(email)) {
      errors.push({ rowNumber, email, message: "E-mailova adresa nema validni format." });
      return;
    }

    if (seen.has(email)) {
      duplicateCount += 1;
      errors.push({ rowNumber, email, message: "Duplicitni prijemce byl preskocen." });
      return;
    }

    seen.add(email);
    recipients.push(createCampaignRecipient({ ...draft, email }, importSource));
  });

  return { recipients, errors, duplicateCount };
}

export function activeCampaignRecipients(recipients: CampaignRecipient[]) {
  return recipients.filter((recipient) => recipient.status === "active");
}

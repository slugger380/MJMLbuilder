import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultBuilderTheme,
  normalizeBuilderBlocks
} from "@/lib/mjmlBuilder";
import type {
  BuilderTemplateState,
  ExcelTemplateSource,
  SavedEmailTemplate,
  TemplateSourceType
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "templates.json");

type TemplateStoreFile = {
  version: 1;
  templates: SavedEmailTemplate[];
};

function nowIso() {
  return new Date().toISOString();
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeStore([]);
  }
}

async function readStore(): Promise<SavedEmailTemplate[]> {
  await ensureStore();
  const raw = await readFile(storePath, "utf8");

  try {
    const parsed = JSON.parse(raw) as TemplateStoreFile;
    return Array.isArray(parsed.templates) ? parsed.templates : [];
  } catch {
    return [];
  }
}

async function writeStore(templates: SavedEmailTemplate[]) {
  await mkdir(dataDir, { recursive: true });
  const payload: TemplateStoreFile = {
    version: 1,
    templates
  };
  await writeFile(storePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeName(name: string | undefined, fallback = "Nova sablona") {
  const normalized = String(name || "").trim();
  return normalized || fallback;
}

function normalizeState(state: BuilderTemplateState): BuilderTemplateState {
  const theme =
    state.theme && typeof state.theme === "object"
      ? { ...defaultBuilderTheme, ...state.theme }
      : { ...defaultBuilderTheme };

  return {
    version: 1,
    source: state.source || "builder",
    blocks: normalizeBuilderBlocks(state.blocks),
    theme,
    customHead: state.customHead || "",
    savedBlocks: normalizeBuilderBlocks(state.savedBlocks || []),
    mergeTagMocks: state.mergeTagMocks || {}
  };
}

function normalizeSourceType(
  sourceType: TemplateSourceType | undefined,
  state: BuilderTemplateState
): TemplateSourceType {
  if (sourceType) {
    return sourceType;
  }

  if (state.source === "ai-generated") {
    return "ai";
  }

  if (state.source === "excel-generated") {
    return "excel";
  }

  if (state.source === "raw-mjml") {
    return "code";
  }

  if (state.source === "imported-mjml") {
    return "imported";
  }

  return "builder";
}

export async function listTemplates() {
  const templates = await readStore();
  return [...templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTemplate(id: string) {
  const templates = await readStore();
  return templates.find((template) => template.id === id) || null;
}

export async function createTemplate(input: {
  name?: string;
  description?: string;
  sourceType?: TemplateSourceType;
  mode?: SavedEmailTemplate["mode"];
  brandStyleId?: string;
  excelSource?: ExcelTemplateSource;
  metadata?: SavedEmailTemplate["metadata"];
  state: BuilderTemplateState;
  mjml: string;
  html: string;
  thumbnail?: string;
}) {
  const templates = await readStore();
  const timestamp = nowIso();
  const template: SavedEmailTemplate = {
    id: randomUUID(),
    name: normalizeName(input.name),
    description: input.description?.trim() || "",
    sourceType: normalizeSourceType(input.sourceType, input.state),
    mode: input.mode || "builder",
    brandStyleId: input.brandStyleId,
    excelSource: input.excelSource,
    metadata: input.metadata,
    state: normalizeState(input.state),
    mjml: input.mjml,
    html: input.html,
    thumbnail: input.thumbnail,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await writeStore([...templates, template]);
  return template;
}

export async function updateTemplate(
  id: string,
  input: {
    name?: string;
    description?: string;
    sourceType?: TemplateSourceType;
    mode?: SavedEmailTemplate["mode"];
    brandStyleId?: string;
    excelSource?: ExcelTemplateSource;
    metadata?: SavedEmailTemplate["metadata"];
    state?: BuilderTemplateState;
    mjml?: string;
    html?: string;
    thumbnail?: string;
  }
) {
  const templates = await readStore();
  const index = templates.findIndex((template) => template.id === id);

  if (index < 0) {
    return null;
  }

  const current = templates[index];
  const next: SavedEmailTemplate = {
    ...current,
    name: input.name === undefined ? current.name : normalizeName(input.name, current.name),
    description:
      input.description === undefined ? current.description : input.description.trim(),
    state: input.state ? normalizeState(input.state) : current.state,
    sourceType:
      input.sourceType === undefined
        ? current.sourceType || normalizeSourceType(undefined, current.state)
        : input.sourceType,
    mode: input.mode === undefined ? current.mode : input.mode,
    brandStyleId:
      input.brandStyleId === undefined ? current.brandStyleId : input.brandStyleId,
    excelSource:
      input.excelSource === undefined ? current.excelSource : input.excelSource,
    metadata: input.metadata === undefined ? current.metadata : input.metadata,
    mjml: input.mjml === undefined ? current.mjml : input.mjml,
    html: input.html === undefined ? current.html : input.html,
    thumbnail: input.thumbnail === undefined ? current.thumbnail : input.thumbnail,
    updatedAt: nowIso()
  };
  const nextTemplates = [...templates];
  nextTemplates[index] = next;
  await writeStore(nextTemplates);
  return next;
}

export async function deleteTemplate(id: string) {
  const templates = await readStore();
  const next = templates.filter((template) => template.id !== id);

  if (next.length === templates.length) {
    return false;
  }

  await writeStore(next);
  return true;
}

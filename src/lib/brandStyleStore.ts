import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrandStyle, BrandStyleAsset, BrandStyleProfile } from "@/lib/types";
import {
  applyAssetLearning,
  createEmptyBrandStyleProfile,
  inferBrandAssetKind
} from "@/lib/brandStyleLearning";

const dataDir = path.join(process.cwd(), "data");
const assetDir = path.join(dataDir, "brand-assets");
const storePath = path.join(dataDir, "brand-styles.json");

type BrandStyleStoreFile = {
  version: 1;
  styles: BrandStyle[];
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path
    .basename(fileName, extension)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${baseName || "asset"}${extension}`;
}

async function ensureStore() {
  await mkdir(assetDir, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeStore([]);
  }
}

async function readStore(): Promise<BrandStyle[]> {
  await ensureStore();
  const raw = await readFile(storePath, "utf8");

  try {
    const parsed = JSON.parse(raw) as BrandStyleStoreFile;
    return Array.isArray(parsed.styles) ? parsed.styles : [];
  } catch {
    return [];
  }
}

async function writeStore(styles: BrandStyle[]) {
  await mkdir(dataDir, { recursive: true });
  const payload: BrandStyleStoreFile = {
    version: 1,
    styles
  };
  await writeFile(storePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeProfile(profile?: Partial<BrandStyleProfile>): BrandStyleProfile {
  const empty = createEmptyBrandStyleProfile();

  return {
    ...empty,
    ...profile,
    colors: { ...empty.colors, ...profile?.colors },
    typography: { ...empty.typography, ...profile?.typography },
    logo: { ...empty.logo, ...profile?.logo },
    buttonStyle: { ...empty.buttonStyle, ...profile?.buttonStyle },
    layoutPreferences: {
      ...empty.layoutPreferences,
      ...profile?.layoutPreferences
    },
    extractedFromAssets: {
      ...empty.extractedFromAssets,
      ...profile?.extractedFromAssets,
      colors: profile?.extractedFromAssets?.colors || [],
      fonts: profile?.extractedFromAssets?.fonts || [],
      notes: profile?.extractedFromAssets?.notes || []
    }
  };
}

export async function listBrandStyles() {
  return readStore();
}

export async function getBrandStyle(id: string) {
  const styles = await readStore();
  return styles.find((style) => style.id === id) || null;
}

export async function createBrandStyle(input: {
  name: string;
  description?: string;
  profile?: Partial<BrandStyleProfile>;
}) {
  const styles = await readStore();
  const timestamp = nowIso();
  const style: BrandStyle = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || "",
    profile: normalizeProfile(input.profile),
    assets: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await writeStore([...styles, style]);
  return style;
}

export async function updateBrandStyle(
  id: string,
  input: {
    name?: string;
    description?: string;
    profile?: Partial<BrandStyleProfile>;
  }
) {
  const styles = await readStore();
  const index = styles.findIndex((style) => style.id === id);

  if (index < 0) {
    return null;
  }

  const current = styles[index];
  const next: BrandStyle = {
    ...current,
    name: input.name?.trim() || current.name,
    description:
      input.description === undefined ? current.description : input.description.trim(),
    profile: input.profile ? normalizeProfile(input.profile) : current.profile,
    updatedAt: nowIso()
  };
  const nextStyles = [...styles];
  nextStyles[index] = next;
  await writeStore(nextStyles);
  return next;
}

export async function deleteBrandStyle(id: string) {
  const styles = await readStore();
  const next = styles.filter((style) => style.id !== id);

  if (next.length === styles.length) {
    return false;
  }

  await writeStore(next);
  await rm(path.join(assetDir, id), { recursive: true, force: true });
  return true;
}

export async function addBrandStyleAsset(input: {
  styleId: string;
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}) {
  const styles = await readStore();
  const index = styles.findIndex((style) => style.id === input.styleId);

  if (index < 0) {
    return null;
  }

  const assetId = randomUUID();
  const storedName = `${assetId}-${sanitizeFileName(input.originalName)}`;
  const styleAssetDir = path.join(assetDir, input.styleId);
  await mkdir(styleAssetDir, { recursive: true });
  await writeFile(path.join(styleAssetDir, storedName), input.buffer);

  const asset: BrandStyleAsset = {
    id: assetId,
    styleId: input.styleId,
    originalName: input.originalName,
    storedName,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.size,
    kind: inferBrandAssetKind(input.originalName, input.mimeType || ""),
    url: `/api/brand-assets/${input.styleId}/${assetId}`,
    createdAt: nowIso()
  };
  const updatedStyle = applyAssetLearning(styles[index], asset, input.buffer);
  const nextStyles = [...styles];
  nextStyles[index] = updatedStyle;
  await writeStore(nextStyles);

  return {
    style: updatedStyle,
    asset: updatedStyle.assets.find((item) => item.id === asset.id) || asset
  };
}

export async function getBrandStyleAsset(styleId: string, assetId: string) {
  const style = await getBrandStyle(styleId);
  const asset = style?.assets.find((item) => item.id === assetId);

  if (!asset) {
    return null;
  }

  return {
    asset,
    path: path.join(assetDir, styleId, asset.storedName)
  };
}

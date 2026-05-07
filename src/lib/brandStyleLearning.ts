import type {
  BrandStyle,
  BrandStyleAsset,
  BrandStyleAssetKind,
  BrandStyleProfile
} from "@/lib/types";

const textAssetExtensions = new Set([
  ".txt",
  ".md",
  ".json",
  ".css",
  ".html",
  ".htm",
  ".mjml"
]);

export const maxBrandAssetSize = 10 * 1024 * 1024;

export const allowedBrandAssetExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".txt",
  ".md",
  ".json",
  ".css",
  ".html",
  ".htm",
  ".mjml",
  ".pdf"
]);

export function createEmptyBrandStyleProfile(): BrandStyleProfile {
  return {
    colors: {},
    typography: {},
    logo: {
      width: "140px",
      placement: "top"
    },
    buttonStyle: {
      borderRadius: "6px",
      padding: "14px 24px",
      fontWeight: "700"
    },
    layoutPreferences: {
      maxWidth: "640px",
      sectionPadding: "24px 32px",
      contentPadding: "0",
      borderRadius: "8px",
      density: "balanced"
    },
    spacingPreferences: "",
    imageStyle: "",
    backgroundStyle: "",
    headerStyle: "",
    footerStyle: "",
    toneOfVoice: "",
    guidelines: "",
    exampleTemplateNotes: "",
    extractedFromAssets: {
      colors: [],
      fonts: [],
      notes: []
    }
  };
}

export function extensionFromName(fileName: string) {
  const normalized = fileName.toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

export function validateBrandAssetFile(fileName: string, mimeType: string, size: number) {
  const extension = extensionFromName(fileName);

  if (!allowedBrandAssetExtensions.has(extension)) {
    return `Nepodporovany typ souboru: ${extension || mimeType || fileName}.`;
  }

  if (size > maxBrandAssetSize) {
    return "Soubor je prilis velky. Maximum je 10 MB na soubor.";
  }

  return undefined;
}

export function inferBrandAssetKind(
  fileName: string,
  mimeType: string
): BrandStyleAssetKind {
  const extension = extensionFromName(fileName);
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.includes("logo") && mimeType.startsWith("image/")) {
    return "logo";
  }

  if ([".woff", ".woff2", ".ttf", ".otf"].includes(extension)) {
    return "font";
  }

  if ([".mjml", ".html", ".htm"].includes(extension)) {
    return "example-email";
  }

  if (textAssetExtensions.has(extension) || extension === ".pdf") {
    return "reference";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return "other";
}

function mergeUnique(existing: string[], next: string[]) {
  return Array.from(new Set([...existing, ...next].map((item) => item.trim()).filter(Boolean)));
}

function extractColors(text: string) {
  return Array.from(new Set(text.match(/#[0-9a-f]{3,8}\b/gi) || [])).slice(0, 24);
}

function extractFonts(text: string) {
  const fonts = new Set<string>();

  for (const match of text.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) {
    match[1]
      .split(",")
      .map((value) => value.replace(/["']/g, "").trim())
      .filter(Boolean)
      .forEach((value) => fonts.add(value));
  }

  for (const match of text.matchAll(/font-family\s*:\s*["']?([^;"'}]+)["']?/gi)) {
    const value = match[1].replace(/["']/g, "").trim();
    if (value) {
      fonts.add(value);
    }
  }

  return Array.from(fonts).slice(0, 12);
}

function isTextReadableAsset(asset: BrandStyleAsset) {
  const extension = extensionFromName(asset.originalName);
  return textAssetExtensions.has(extension) || asset.mimeType.startsWith("text/");
}

export function extractTextFromBrandAsset(asset: BrandStyleAsset, buffer: Buffer) {
  if (!isTextReadableAsset(asset)) {
    return "";
  }

  return buffer.toString("utf8").replace(/\u0000/g, "").slice(0, 40000);
}

export function applyAssetLearning(
  style: BrandStyle,
  asset: BrandStyleAsset,
  buffer: Buffer
): BrandStyle {
  const text = extractTextFromBrandAsset(asset, buffer);
  const colors = text ? extractColors(text) : [];
  const fonts = text ? extractFonts(text) : [];
  const notes: string[] = [];
  const profile: BrandStyleProfile = {
    ...style.profile,
    colors: { ...style.profile.colors },
    typography: { ...style.profile.typography },
    logo: { ...style.profile.logo },
    buttonStyle: { ...style.profile.buttonStyle },
    layoutPreferences: { ...style.profile.layoutPreferences },
    extractedFromAssets: {
      colors: mergeUnique(style.profile.extractedFromAssets.colors, colors),
      fonts: mergeUnique(style.profile.extractedFromAssets.fonts, fonts),
      notes: [...style.profile.extractedFromAssets.notes],
      updatedAt: new Date().toISOString()
    }
  };

  if (asset.kind === "logo" && !profile.logo.preferredAssetId) {
    profile.logo.preferredAssetId = asset.id;
    profile.logo.altText = profile.logo.altText || style.name;
    notes.push(`Logo asset selected from ${asset.originalName}.`);
  }

  if (colors.length) {
    profile.colors.primary = profile.colors.primary || colors[0];
    profile.colors.secondary = profile.colors.secondary || colors[1];
    profile.colors.accent = profile.colors.accent || colors[2];
    notes.push(`Detected colors from ${asset.originalName}: ${colors.slice(0, 6).join(", ")}.`);
  }

  if (fonts.length) {
    profile.typography.bodyFont = profile.typography.bodyFont || fonts[0];
    profile.typography.headingFont = profile.typography.headingFont || fonts[0];
    notes.push(`Detected fonts from ${asset.originalName}: ${fonts.slice(0, 4).join(", ")}.`);
  }

  if (asset.kind === "font" && !profile.typography.bodyFont) {
    const fontName = asset.originalName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    profile.typography.bodyFont = fontName;
    profile.typography.headingFont = profile.typography.headingFont || fontName;
    notes.push(`Font asset stored for future use: ${asset.originalName}.`);
  }

  if (text.trim()) {
    const snippet = text.trim().slice(0, 3000);
    profile.guidelines = [profile.guidelines, snippet]
      .filter((item) => item?.trim())
      .join("\n\n--- extracted reference ---\n\n")
      .slice(0, 18000);
    notes.push(`Extracted readable brand reference from ${asset.originalName}.`);
  }

  profile.extractedFromAssets.notes = mergeUnique(
    profile.extractedFromAssets.notes,
    notes
  ).slice(-50);

  return {
    ...style,
    profile,
    assets: [
      ...style.assets,
      {
        ...asset,
        extractedText: text ? text.slice(0, 12000) : undefined
      }
    ],
    updatedAt: new Date().toISOString()
  };
}

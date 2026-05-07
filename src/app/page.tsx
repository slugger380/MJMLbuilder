"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import CampaignsSection from "@/components/CampaignsSection";
import type {
  AiSuggestionChange,
  ApplyAiSuggestionsRequest,
  BrandStyle,
  BrandStyleProfile,
  BuilderTemplateState,
  CompileMjmlResponse,
  GenerateEmailResponse,
  SavedEmailTemplate,
  TemplateListResponse,
  TemplateMode,
  TemplateResponse,
  TestEmailResponse,
  ValidationIssue
} from "@/lib/types";
import {
  buildBuilderMjml,
  builderBlockDefinitions,
  canBuilderBlockAcceptChild,
  createBuilderBlock,
  defaultBuilderBlocks,
  defaultBuilderTheme,
  getBuilderBlockProps,
  getBlockDefinition,
  normalizeBuilderBlocks,
  type BuilderBlock,
  type BuilderBlockType,
  type BuilderField,
  type BuilderRenderDevice,
  type BuilderTheme
} from "@/lib/mjmlBuilder";

type TemplateId = "ai" | "coupons-excel" | "mjml-builder";

type FormState = {
  templateId: TemplateId;
  brandStyleId: string;
  prompt: string;
  emailType: "promo" | "informacni" | "upozorneni" | "onboarding" | "servisni";
  topic: string;
  mainMessage: string;
  ctaText: string;
  ctaUrl: string;
  notes: string;
  useAiMatching: boolean;
  useAiReview: boolean;
  includeSelfServiceAd: boolean;
  couponMonth: string;
};

type Tab = "preview" | "mjml" | "html" | "issues";
type SuccessfulResult = Extract<GenerateEmailResponse, { ok: true }>;
type ExportFormat = "html" | "mjml";
type ExportableTemplate = Pick<SuccessfulResult, "subject" | "html" | "mjml">;
type BuilderDropPosition = "before" | "after" | "inside";
type BuilderDropPreview = {
  blockId: string;
  position: BuilderDropPosition;
} | null;
type BuilderDropHandler = (
  event: DragEvent<HTMLElement>,
  index: number,
  parentId?: string
) => void;
type BuilderDragState =
  | { kind: "palette"; type: BuilderBlockType }
  | { kind: "block"; id: string; type: BuilderBlockType }
  | null;
type BuilderDevice = BuilderRenderDevice;
type BuilderPanelTab = "blocks" | "layout" | "saved";

type BuilderSnapshot = {
  blocks: BuilderBlock[];
  customHead: string;
  device: BuilderDevice;
  savedBlocks: BuilderBlock[];
  selectedBlockId: string;
  theme: BuilderTheme;
};

type BuilderHistory = {
  past: BuilderSnapshot[];
  future: BuilderSnapshot[];
};

type BuilderCompileState = {
  html: string;
  issues: ValidationIssue[];
  isCompiling: boolean;
  error?: string;
};

type ImportedMjmlTemplate = {
  body: string;
  blocks: BuilderBlock[];
  customHead: string;
  bodyBackground?: string;
  width?: string;
};

type BrandStylesResponse =
  | {
      ok: true;
      styles: BrandStyle[];
    }
  | {
      ok: false;
      error: string;
    };

type BrandStyleResponse =
  | {
      ok: true;
      style: BrandStyle;
    }
  | {
      ok: false;
      error: string;
    };

type BrandAssetUploadResponse =
  | {
      ok: true;
      style: BrandStyle;
    }
  | {
      ok: false;
      error: string;
    };

type BrandStyleDraft = {
  id?: string;
  name: string;
  description: string;
  profileJson: string;
};

const emptyForm: FormState = {
  templateId: "ai",
  brandStyleId: "",
  prompt: "",
  emailType: "promo",
  topic: "",
  mainMessage: "",
  ctaText: "",
  ctaUrl: "",
  notes: "",
  useAiMatching: false,
  useAiReview: false,
  includeSelfServiceAd: false,
  couponMonth: ""
};

const demoForm: FormState = {
  templateId: "ai",
  brandStyleId: "",
  prompt:
    "Create a welcome email for new customers. Include a hero section, short intro, three benefits, CTA button, and footer.",
  emailType: "promo",
  topic: "rychlejsi internet pro domacnosti",
  mainMessage: "vyhodnejsi tarif pro stavajici zakazniky",
  ctaText: "Zobrazit nabidku",
  ctaUrl: "{{cta.url}}",
  notes: "",
  useAiMatching: false,
  useAiReview: false,
  includeSelfServiceAd: false,
  couponMonth: ""
};

const couponTemplateForm: FormState = {
  templateId: "coupons-excel",
  brandStyleId: "",
  prompt: "",
  emailType: "promo",
  topic: "Aktualni slevove kupony pro zakazniky",
  mainMessage:
    "Vybrali jsme pro vas aktualni slevove kody a partnerske vyhody z interni tabulky.",
  ctaText: "",
  ctaUrl: "",
  notes: "Texty, kody a odkazy se maji brat z Excelu.",
  useAiMatching: false,
  useAiReview: false,
  includeSelfServiceAd: false,
  couponMonth: ""
};

const builderTemplateForm: FormState = {
  ...emptyForm,
  templateId: "mjml-builder",
  topic: "MJML builder"
};

const topNavigationItems: { value: TemplateMode; label: string; path: string }[] = [
  { value: "dashboard", label: "Dashboard", path: "/dashboard" },
  { value: "campaigns", label: "Campaigns", path: "/campaigns" },
  { value: "contacts", label: "Contacts", path: "/contacts" },
  { value: "reports", label: "Reports", path: "/reports" },
  { value: "automation", label: "Automation", path: "/automation" },
  { value: "templates", label: "Templates", path: "/templates" },
  { value: "brand-styles", label: "Brand Styles", path: "/brand-styles" }
];

const workspaceModes: { value: TemplateMode; label: string; description: string }[] = [
  {
    value: "mjml-builder",
    label: "Builder",
    description: "Visual MJML"
  },
  {
    value: "ai",
    label: "AI",
    description: "Brand prompt"
  },
  {
    value: "coupons-excel",
    label: "Excel",
    description: "Assembly"
  },
  {
    value: "code",
    label: "Code",
    description: "MJML source"
  },
  {
    value: "preview",
    label: "Preview",
    description: "Testing"
  },
  {
    value: "settings",
    label: "Settings",
    description: "Metadata"
  }
];

const fieldClass =
  "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const secondaryButtonClass =
  "rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface";
const primaryButtonClass =
  "rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";

const tabLabels: Record<Tab, string> = {
  preview: "Preview",
  mjml: "MJML",
  html: "HTML",
  issues: "Issues"
};

type ParsedAppRoute = {
  mode: TemplateMode;
  templateId?: string;
};

function parseAppRoute(pathname: string): ParsedAppRoute {
  const segments = pathname.split("/").filter(Boolean);
  const [section, second, third] = segments;

  if (!section || section === "dashboard") {
    return { mode: "dashboard" };
  }

  if (section === "templates") {
    if (!second) {
      return { mode: "templates" };
    }

    if (second === "new") {
      if (third === "ai") {
        return { mode: "ai" };
      }
      if (third === "excel") {
        return { mode: "coupons-excel" };
      }
      if (third === "blank") {
        return { mode: "mjml-builder" };
      }
      if (third === "code") {
        return { mode: "code" };
      }
      if (third === "preview") {
        return { mode: "preview" };
      }
      return { mode: "new-template" };
    }

    if (third === "preview") {
      return { mode: "preview", templateId: second };
    }
    if (third === "code") {
      return { mode: "code", templateId: second };
    }
    if (third === "excel") {
      return { mode: "coupons-excel", templateId: second };
    }
    if (third === "ai") {
      return { mode: "ai", templateId: second };
    }
    if (third === "settings") {
      return { mode: "settings", templateId: second };
    }

    return { mode: "mjml-builder", templateId: second };
  }

  if (section === "brand-styles") {
    return { mode: "brand-styles" };
  }

  if (section === "ai-generator") {
    return { mode: "ai" };
  }

  if (
    section === "campaigns" ||
    section === "contacts" ||
    section === "reports" ||
    section === "automation"
  ) {
    return { mode: section };
  }

  return { mode: "templates" };
}

function modePath(mode: TemplateMode, templateId?: string | null) {
  if (mode === "dashboard") {
    return "/dashboard";
  }
  if (mode === "templates") {
    return "/templates";
  }
  if (mode === "new-template") {
    return "/templates/new";
  }
  if (mode === "brand-styles") {
    return "/brand-styles";
  }
  if (mode === "campaigns" || mode === "contacts" || mode === "reports" || mode === "automation") {
    return `/${mode}`;
  }
  if (mode === "ai") {
    return templateId ? `/templates/${templateId}/ai` : "/templates/new/ai";
  }
  if (mode === "coupons-excel") {
    return templateId ? `/templates/${templateId}/excel` : "/templates/new/excel";
  }
  if (mode === "code") {
    return templateId ? `/templates/${templateId}/code` : "/templates/new/code";
  }
  if (mode === "preview") {
    return templateId ? `/templates/${templateId}/preview` : "/templates/new/preview";
  }
  if (mode === "settings") {
    return templateId ? `/templates/${templateId}/settings` : "/templates/new/blank";
  }
  return templateId ? `/templates/${templateId}/builder` : "/templates/new/blank";
}

function sourceTypeLabel(template: SavedEmailTemplate) {
  if (template.sourceType === "excel" || template.state.source === "excel-generated") {
    return "Excel";
  }
  if (template.sourceType === "ai" || template.state.source === "ai-generated") {
    return "AI";
  }
  if (template.sourceType === "code" || template.state.source === "raw-mjml") {
    return "Code";
  }
  if (template.sourceType === "imported" || template.state.source === "imported-mjml") {
    return "Imported";
  }
  return "Builder";
}

const builderPaletteMime = "application/x-mjml-builder-block-type";
const builderBlockMime = "application/x-mjml-builder-block-id";
const builderRootBlockTypes: BuilderBlockType[] = [
  "section",
  "two-column",
  "three-column",
  "one-third-two-third",
  "two-third-one-third",
  "header",
  "hero",
  "image-hero",
  "card",
  "quote",
  "coupon",
  "footer",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
  "social",
  "raw-html"
];

const builderFontOptions = [
  { label: "Montserrat", value: "Montserrat, Arial, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Times New Roman", value: "\"Times New Roman\", serif" }
];

const builderFontWeightOptions = [
  { label: "Normal 400", value: "400" },
  { label: "Medium 500", value: "500" },
  { label: "Semibold 600", value: "600" },
  { label: "Bold 700", value: "700" },
  { label: "Extra Bold 800", value: "800" }
];

function templateExportBaseName(subject?: string) {
  const normalized = (subject || "email-sablona")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return normalized || "email-sablona";
}

function downloadTemplate(source: ExportableTemplate, format: ExportFormat) {
  const content = format === "html" ? source.html : source.mjml;

  if (!content.trim()) {
    return;
  }

  const blob = new Blob([content], {
    type: format === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${templateExportBaseName(source.subject)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function cloneBuilderBlocks(blocks = defaultBuilderBlocks): BuilderBlock[] {
  return normalizeBuilderBlocks(blocks).map((block) => ({
    ...block,
    props: { ...block.props },
    mobileProps: block.mobileProps ? { ...block.mobileProps } : undefined,
    children: block.children ? cloneBuilderBlocks(block.children) : undefined
  }));
}

function cloneBuilderBlocksWithNewIds(blocks: BuilderBlock[]): BuilderBlock[] {
  return blocks.map((block) => ({
    ...createBuilderBlock(block.type),
    props: { ...block.props },
    mobileProps: block.mobileProps ? { ...block.mobileProps } : undefined,
    children: block.children ? cloneBuilderBlocksWithNewIds(block.children) : undefined
  }));
}

function isBuilderBlockType(value: string): value is BuilderBlockType {
  return builderBlockDefinitions.some((definition) => definition.type === value);
}

function canAcceptChildType(parent: BuilderBlock | null, type: BuilderBlockType) {
  return canBuilderBlockAcceptChild(parent?.type, type);
}

function findBuilderBlock(blocks: BuilderBlock[], id: string): BuilderBlock | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block;
    }
    const child = block.children ? findBuilderBlock(block.children, id) : null;
    if (child) {
      return child;
    }
  }
  return null;
}

function findBuilderBlockLocation(
  blocks: BuilderBlock[],
  id: string,
  parentId?: string
): { index: number; parentId?: string } | null {
  const index = blocks.findIndex((block) => block.id === id);
  if (index >= 0) {
    return { index, parentId };
  }

  for (const block of blocks) {
    if (!block.children) {
      continue;
    }

    const childLocation = findBuilderBlockLocation(block.children, id, block.id);
    if (childLocation) {
      return childLocation;
    }
  }

  return null;
}

function getBuilderDropEffect(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes(builderPaletteMime)
    ? "copy"
    : "move";
}

function getBlockDropPosition(
  event: DragEvent<HTMLElement>,
  canDropInside: boolean
): BuilderDropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;

  if (canDropInside) {
    if (ratio < 0.25) {
      return "before";
    }
    if (ratio > 0.75) {
      return "after";
    }
    return "inside";
  }

  return ratio < 0.5 ? "before" : "after";
}

function isLeavingDropTarget(event: DragEvent<HTMLElement>) {
  const relatedTarget = event.relatedTarget;
  if (!relatedTarget || typeof Node === "undefined" || !(relatedTarget instanceof Node)) {
    return true;
  }

  return !event.currentTarget.contains(relatedTarget);
}

function mapBuilderBlocks(
  blocks: BuilderBlock[],
  mapper: (block: BuilderBlock) => BuilderBlock
): BuilderBlock[] {
  return blocks.map((block) => {
    const mapped = mapper(block);
    return {
      ...mapped,
      children: mapped.children
        ? mapBuilderBlocks(mapped.children, mapper)
        : mapped.children
    };
  });
}

function insertBuilderBlockAt(
  blocks: BuilderBlock[],
  block: BuilderBlock,
  index: number,
  parentId?: string
): BuilderBlock[] {
  if (!parentId) {
    const insertionIndex = Math.min(Math.max(index, 0), blocks.length);
    return [
      ...blocks.slice(0, insertionIndex),
      block,
      ...blocks.slice(insertionIndex)
    ];
  }

  return blocks.map((item) => {
    if (item.id === parentId) {
      const children = item.children || [];
      const insertionIndex = Math.min(Math.max(index, 0), children.length);
      return {
        ...item,
        children: [
          ...children.slice(0, insertionIndex),
          block,
          ...children.slice(insertionIndex)
        ]
      };
    }

    return {
      ...item,
      children: item.children
        ? insertBuilderBlockAt(item.children, block, index, parentId)
        : item.children
    };
  });
}

function removeBuilderBlock(
  blocks: BuilderBlock[],
  id: string
): { blocks: BuilderBlock[]; removed: BuilderBlock | null } {
  let removed: BuilderBlock | null = null;
  const next: BuilderBlock[] = [];

  for (const block of blocks) {
    if (block.id === id) {
      removed = block;
      continue;
    }

    if (block.children) {
      const childResult = removeBuilderBlock(block.children, id);
      if (childResult.removed) {
        removed = childResult.removed;
      }
      next.push({ ...block, children: childResult.blocks });
    } else {
      next.push(block);
    }
  }

  return { blocks: next, removed };
}

function moveBuilderBlockInTree(
  blocks: BuilderBlock[],
  id: string,
  direction: -1 | 1
): { blocks: BuilderBlock[]; moved: boolean } {
  const index = blocks.findIndex((block) => block.id === id);

  if (index >= 0) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return { blocks, moved: false };
    }
    const next = [...blocks];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return { blocks: next, moved: true };
  }

  let moved = false;
  const next = blocks.map((block) => {
    if (!block.children || moved) {
      return block;
    }
    const childResult = moveBuilderBlockInTree(block.children, id, direction);
    if (childResult.moved) {
      moved = true;
      return { ...block, children: childResult.blocks };
    }
    return block;
  });

  return { blocks: next, moved };
}

function duplicateBuilderBlockInTree(
  blocks: BuilderBlock[],
  id: string,
  duplicate: BuilderBlock
): { blocks: BuilderBlock[]; duplicated: boolean } {
  const index = blocks.findIndex((block) => block.id === id);
  if (index >= 0) {
    const next = [...blocks];
    next.splice(index + 1, 0, duplicate);
    return { blocks: next, duplicated: true };
  }

  let duplicated = false;
  const next = blocks.map((block) => {
    if (!block.children || duplicated) {
      return block;
    }
    const childResult = duplicateBuilderBlockInTree(block.children, id, duplicate);
    if (childResult.duplicated) {
      duplicated = true;
      return { ...block, children: childResult.blocks };
    }
    return block;
  });

  return { blocks: next, duplicated };
}

function extractTagContent(source: string, tagName: string) {
  const match = source.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
  );
  return match?.[1]?.trim() || "";
}

function extractTagAttributes(source: string, tagName: string) {
  const match = source.match(new RegExp(`<${tagName}\\b([^>]*)>`, "i"));
  return match?.[1] || "";
}

function extractAttribute(attributes: string, name: string) {
  const match = attributes.match(
    new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i")
  );
  return match?.[1] || "";
}

const responsiveBuilderFieldKeys = new Set([
  "align",
  "backgroundColor",
  "buttonBackground",
  "buttonText",
  "borderRadius",
  "color",
  "fontFamily",
  "fontWeight",
  "height",
  "iconSize",
  "innerPadding",
  "lineHeight",
  "padding",
  "sectionBackground",
  "sectionPadding",
  "textColor",
  "textSize",
  "titleBackground",
  "titleSize",
  "verticalAlign",
  "width"
]);

function isResponsiveBuilderField(field: BuilderField) {
  const key = field.key.toLowerCase();
  return (
    field.type === "color" ||
    responsiveBuilderFieldKeys.has(field.key) ||
    key.endsWith("padding") ||
    key.endsWith("size") ||
    key.endsWith("width") ||
    key.endsWith("height") ||
    key.endsWith("color") ||
    key.endsWith("align") ||
    key.includes("radius")
  );
}

function parseImportedMjmlTemplate(source: string): ImportedMjmlTemplate {
  const trimmedSource = source.trim();
  const body = extractTagContent(trimmedSource, "mj-body") || trimmedSource;
  const customHead = extractTagContent(trimmedSource, "mj-head");
  const bodyAttributes = extractTagAttributes(trimmedSource, "mj-body");

  return {
    body,
    blocks: parseImportedMjmlBody(body),
    customHead,
    bodyBackground: extractAttribute(bodyAttributes, "background-color"),
    width: extractAttribute(bodyAttributes, "width")
  };
}

function parseImportedMjmlBody(body: string): BuilderBlock[] {
  if (typeof DOMParser === "undefined") {
    return [];
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(
    `<div id="mjml-import-root">${body}</div>`,
    "text/html"
  );
  const root = document.getElementById("mjml-import-root");

  if (!root) {
    return [];
  }

  return Array.from(root.children)
    .map(parseImportedRootElement)
    .filter((block): block is BuilderBlock => Boolean(block));
}

function getMjmlAttr(element: Element, name: string) {
  return element.getAttribute(name) || "";
}

function setPropFromAttr(
  props: Record<string, string>,
  key: string,
  element: Element,
  attrName: string
) {
  const value = getMjmlAttr(element, attrName);
  if (value) {
    props[key] = value;
  }
}

function elementText(element: Element) {
  const withBreaks = element.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = withBreaks;
  return textarea.value.replace(/\n{3,}/g, "\n\n").trim();
}

function elementMjml(element: Element) {
  return element.outerHTML.trim();
}

function elementChildren(element: Element) {
  return Array.from(element.children);
}

function createImportedBlock(type: BuilderBlockType) {
  return createBuilderBlock(type);
}

function parseImportedRootElement(element: Element): BuilderBlock | null {
  const tag = element.tagName.toLowerCase();

  if (tag === "mj-wrapper") {
    const block = createImportedBlock("wrapper");
    setPropFromAttr(block.props, "backgroundColor", element, "background-color");
    setPropFromAttr(block.props, "padding", element, "padding");
    setPropFromAttr(block.props, "borderRadius", element, "border-radius");
    block.children = elementChildren(element)
      .map(parseImportedRootElement)
      .filter((child): child is BuilderBlock => Boolean(child));
    return block;
  }

  if (tag === "mj-section") {
    const block = createImportedBlock("section");
    setPropFromAttr(block.props, "backgroundColor", element, "background-color");
    setPropFromAttr(block.props, "backgroundUrl", element, "background-url");
    setPropFromAttr(block.props, "padding", element, "padding");
    block.children = elementChildren(element).flatMap((child) => {
      if (child.tagName.toLowerCase() === "mj-column") {
        setPropFromAttr(block.props, "verticalAlign", child, "vertical-align");
        return elementChildren(child)
          .map(parseImportedContentElement)
          .filter((item): item is BuilderBlock => Boolean(item));
      }
      const parsed = parseImportedContentElement(child);
      return parsed ? [parsed] : [];
    });
    return block;
  }

  if (tag === "mj-hero") {
    const block = createImportedBlock("image-hero");
    setPropFromAttr(block.props, "backgroundUrl", element, "background-url");
    setPropFromAttr(block.props, "height", element, "height");
    setPropFromAttr(block.props, "backgroundWidth", element, "background-width");
    setPropFromAttr(block.props, "backgroundHeight", element, "background-height");
    setPropFromAttr(block.props, "backgroundColor", element, "background-color");
    setPropFromAttr(block.props, "backgroundPosition", element, "background-position");
    setPropFromAttr(block.props, "verticalAlign", element, "vertical-align");
    setPropFromAttr(block.props, "padding", element, "padding");
    block.children = elementChildren(element)
      .map(parseImportedContentElement)
      .filter((item): item is BuilderBlock => Boolean(item));
    return block;
  }

  if (tag === "mj-raw") {
    const block = createImportedBlock("raw-html");
    block.props.source = element.innerHTML.trim();
    return block;
  }

  const contentBlock = parseImportedContentElement(element);
  if (contentBlock) {
    return contentBlock;
  }

  const rawBlock = createImportedBlock("raw-mjml");
  rawBlock.props.source = elementMjml(element);
  return rawBlock;
}

function parseImportedContentElement(element: Element): BuilderBlock | null {
  const tag = element.tagName.toLowerCase();

  if (tag === "mj-text") {
    const block = createImportedBlock("text");
    block.props.text = elementText(element);
    setPropFromAttr(block.props, "align", element, "align");
    setPropFromAttr(block.props, "textColor", element, "color");
    setPropFromAttr(block.props, "fontFamily", element, "font-family");
    setPropFromAttr(block.props, "fontSize", element, "font-size");
    setPropFromAttr(block.props, "fontWeight", element, "font-weight");
    setPropFromAttr(block.props, "lineHeight", element, "line-height");
    setPropFromAttr(block.props, "padding", element, "padding");
    return block;
  }

  if (tag === "mj-button") {
    const block = createImportedBlock("button");
    block.props.label = elementText(element);
    setPropFromAttr(block.props, "href", element, "href");
    setPropFromAttr(block.props, "align", element, "align");
    setPropFromAttr(block.props, "backgroundColor", element, "background-color");
    setPropFromAttr(block.props, "textColor", element, "color");
    setPropFromAttr(block.props, "fontFamily", element, "font-family");
    setPropFromAttr(block.props, "fontWeight", element, "font-weight");
    setPropFromAttr(block.props, "borderRadius", element, "border-radius");
    setPropFromAttr(block.props, "innerPadding", element, "inner-padding");
    setPropFromAttr(block.props, "sectionPadding", element, "padding");
    return block;
  }

  if (tag === "mj-image") {
    const block = createImportedBlock("image");
    setPropFromAttr(block.props, "src", element, "src");
    setPropFromAttr(block.props, "alt", element, "alt");
    setPropFromAttr(block.props, "width", element, "width");
    setPropFromAttr(block.props, "align", element, "align");
    setPropFromAttr(block.props, "borderRadius", element, "border-radius");
    setPropFromAttr(block.props, "padding", element, "padding");
    return block;
  }

  if (tag === "mj-divider") {
    const block = createImportedBlock("divider");
    setPropFromAttr(block.props, "color", element, "border-color");
    return block;
  }

  if (tag === "mj-spacer") {
    const block = createImportedBlock("spacer");
    setPropFromAttr(block.props, "height", element, "height");
    return block;
  }

  if (tag === "mj-table") {
    const block = createImportedBlock("table");
    block.props.rows = element.innerHTML.trim();
    setPropFromAttr(block.props, "color", element, "color");
    setPropFromAttr(block.props, "fontSize", element, "font-size");
    setPropFromAttr(block.props, "lineHeight", element, "line-height");
    return block;
  }

  if (tag === "mj-navbar") {
    const block = createImportedBlock("navbar");
    setPropFromAttr(block.props, "baseUrl", element, "base-url");
    const links = elementChildren(element).filter(
      (child) => child.tagName.toLowerCase() === "mj-navbar-link"
    );
    links.slice(0, 3).forEach((link, index) => {
      const item = index + 1;
      block.props[`link${item}Label`] = elementText(link);
      block.props[`link${item}Href`] = getMjmlAttr(link, "href");
      if (index === 0) {
        setPropFromAttr(block.props, "color", link, "color");
      }
    });
    return block;
  }

  if (tag === "mj-social") {
    const block = createImportedBlock("social");
    setPropFromAttr(block.props, "align", element, "align");
    setPropFromAttr(block.props, "mode", element, "mode");
    setPropFromAttr(block.props, "iconSize", element, "icon-size");
    setPropFromAttr(block.props, "fontSize", element, "font-size");
    setPropFromAttr(block.props, "color", element, "color");
    elementChildren(element).forEach((child) => {
      if (child.tagName.toLowerCase() !== "mj-social-element") {
        return;
      }
      const name = getMjmlAttr(child, "name");
      const href = getMjmlAttr(child, "href");
      if (name === "facebook") {
        block.props.facebook = href;
      } else if (name === "instagram") {
        block.props.instagram = href;
      } else if (name === "web" || name === "website") {
        block.props.web = href;
      }
    });
    return block;
  }

  if (tag === "mj-accordion") {
    const block = createImportedBlock("accordion");
    const elements = elementChildren(element).filter(
      (child) => child.tagName.toLowerCase() === "mj-accordion-element"
    );
    elements.slice(0, 2).forEach((item, index) => {
      const title = elementChildren(item).find(
        (child) => child.tagName.toLowerCase() === "mj-accordion-title"
      );
      const text = elementChildren(item).find(
        (child) => child.tagName.toLowerCase() === "mj-accordion-text"
      );
      const suffix = index + 1;
      block.props[`title${suffix}`] = title ? elementText(title) : "";
      block.props[`text${suffix}`] = text ? elementText(text) : "";
      if (title && index === 0) {
        setPropFromAttr(block.props, "titleBackground", title, "background-color");
        setPropFromAttr(block.props, "color", title, "color");
      }
      if (text && index === 0) {
        setPropFromAttr(block.props, "textBackground", text, "background-color");
      }
    });
    return block;
  }

  if (tag === "mj-carousel") {
    const block = createImportedBlock("carousel");
    const images = elementChildren(element).filter(
      (child) => child.tagName.toLowerCase() === "mj-carousel-image"
    );
    images.slice(0, 3).forEach((image, index) => {
      block.props[`image${index + 1}`] = getMjmlAttr(image, "src");
    });
    return block;
  }

  if (tag === "mj-raw") {
    const block = createImportedBlock("raw-html");
    block.props.source = element.innerHTML.trim();
    return block;
  }

  if (tag.startsWith("mj-")) {
    const block = createImportedBlock("raw-mjml");
    block.props.source = elementMjml(element);
    return block;
  }

  return null;
}

function createClientBrandProfile(): BrandStyleProfile {
  return {
    colors: {
      primary: "#17935E",
      secondary: "#334155",
      background: "#F4F7FB",
      surface: "#FFFFFF",
      text: "#172033",
      mutedText: "#667085",
      border: "#D9E1EC"
    },
    typography: {
      bodyFont: "Arial, Helvetica, sans-serif",
      headingFont: "Arial, Helvetica, sans-serif",
      fallbackFont: "Arial, Helvetica, sans-serif",
      baseFontSize: "16px",
      headingWeight: "700",
      bodyWeight: "400"
    },
    logo: {
      width: "140px",
      placement: "top"
    },
    buttonStyle: {
      backgroundColor: "#17935E",
      textColor: "#FFFFFF",
      borderRadius: "6px",
      padding: "14px 24px",
      fontWeight: "700",
      notes: ""
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

function createBrandStyleDraft(style?: BrandStyle): BrandStyleDraft {
  const profile = style?.profile || createClientBrandProfile();

  return {
    id: style?.id,
    name: style?.name || "",
    description: style?.description || "",
    profileJson: JSON.stringify(profile, null, 2)
  };
}

export default function Home() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeMode, setActiveMode] = useState<TemplateMode>("dashboard");
  const [brandStyles, setBrandStyles] = useState<BrandStyle[]>([]);
  const [brandStyleDraft, setBrandStyleDraft] = useState<BrandStyleDraft>(() =>
    createBrandStyleDraft()
  );
  const [brandStyleStatus, setBrandStyleStatus] = useState("");
  const [brandStyleError, setBrandStyleError] = useState("");
  const [isSavingBrandStyle, setIsSavingBrandStyle] = useState(false);
  const [isUploadingBrandAssets, setIsUploadingBrandAssets] = useState(false);
  const [couponFile, setCouponFile] = useState<File | null>(null);
  const [couponTemplateFile, setCouponTemplateFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [result, setResult] = useState<GenerateEmailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingAiSuggestions, setIsApplyingAiSuggestions] = useState(false);
  const [selectedAiSuggestionIds, setSelectedAiSuggestionIds] = useState<Set<string>>(
    () => new Set()
  );
  const [builderBlocks, setBuilderBlocks] = useState<BuilderBlock[]>(() =>
    cloneBuilderBlocks()
  );
  const [builderSavedBlocks, setBuilderSavedBlocks] = useState<BuilderBlock[]>([]);
  const [builderTheme, setBuilderTheme] = useState<BuilderTheme>(() => ({
    ...defaultBuilderTheme
  }));
  const [builderCustomHead, setBuilderCustomHead] = useState("");
  const [builderCodeDraft, setBuilderCodeDraft] = useState("");
  const [builderImportStatus, setBuilderImportStatus] = useState("");
  const [builderDevice, setBuilderDevice] = useState<BuilderDevice>("desktop");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeTemplateName, setActiveTemplateName] = useState("Nova sablona");
  const [savedTemplates, setSavedTemplates] = useState<SavedEmailTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailStatus, setTestEmailStatus] = useState("");
  const [testEmailError, setTestEmailError] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [mergePreviewEnabled, setMergePreviewEnabled] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState(
    defaultBuilderBlocks[0]?.id || ""
  );
  const [builderHistory, setBuilderHistory] = useState<BuilderHistory>({
    past: [],
    future: []
  });
  const [builderCompile, setBuilderCompile] = useState<BuilderCompileState>({
    html: "",
    issues: [],
    isCompiling: false
  });
  const [codeCompile, setCodeCompile] = useState<BuilderCompileState>({
    html: "",
    issues: [],
    isCompiling: false
  });
  const appliedInitialRoute = useRef(false);
  const lastAppliedPath = useRef("");

  useEffect(() => {
    let isMounted = true;

    async function loadBrandStyles() {
      setBrandStyleStatus("Nacitam brand styly...");
      setBrandStyleError("");

      try {
        const response = await fetch("/api/brand-styles");
        const data = (await response.json()) as BrandStylesResponse;

        if (!isMounted) {
          return;
        }

        if (!data.ok) {
          setBrandStyleError(data.error);
          setBrandStyleStatus("");
          return;
        }

        setBrandStyles(data.styles);
        if (data.styles.length) {
          setForm((current) =>
            current.brandStyleId
              ? current
              : { ...current, brandStyleId: data.styles[0].id }
          );
          setBrandStyleDraft(createBrandStyleDraft(data.styles[0]));
        }
        setBrandStyleStatus(
          data.styles.length
            ? `Nacteno ${data.styles.length} brand stylu.`
            : "Zatim neni ulozeny zadny brand styl."
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBrandStyleError(
          error instanceof Error
            ? error.message
            : "Brand styly se nepodarilo nacist."
        );
        setBrandStyleStatus("");
      }
    }

    loadBrandStyles();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void loadSavedTemplates();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function applyCurrentRoute(force = false) {
      const path = window.location.pathname;
      const route = parseAppRoute(path);
      const alreadyApplied =
        !force &&
        lastAppliedPath.current === path &&
        (!route.templateId || activeTemplateId === route.templateId);

      if (alreadyApplied && appliedInitialRoute.current) {
        return;
      }

      if (route.templateId) {
        const template = savedTemplates.find((item) => item.id === route.templateId);
        if (template) {
          openSavedTemplate(template, route.mode, { pushRoute: false });
        } else {
          setActiveMode(route.mode);
        }
      } else if (route.mode === "mjml-builder" && path.includes("/templates/new/blank")) {
        startNewBuilderTemplate({ pushRoute: false });
      } else {
        switchMode(route.mode, { pushRoute: false });
      }

      if (path === "/brand-styles/new") {
        startNewBrandStyle();
      }

      lastAppliedPath.current = path;
      appliedInitialRoute.current = true;
    }

    applyCurrentRoute();

    function handlePopState() {
      applyCurrentRoute(true);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // Route application is driven by the current URL plus loaded templates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplateId, savedTemplates]);

  const builderMjml = useMemo(
    () =>
      buildBuilderMjml(builderBlocks, builderTheme, {
        customHead: builderCustomHead,
        device: builderDevice
      }),
    [builderBlocks, builderCustomHead, builderDevice, builderTheme]
  );

  useEffect(() => {
    if (form.templateId !== "mjml-builder") {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setBuilderCompile((current) => ({
        ...current,
        isCompiling: true,
        error: undefined
      }));

      try {
        const response = await fetch("/api/compile-mjml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mjml: builderMjml }),
          signal: controller.signal
        });
        const data = (await response.json()) as CompileMjmlResponse;

        if (data.ok) {
          setBuilderCompile({
            html: data.html,
            issues: data.issues,
            isCompiling: false
          });
        } else {
          setBuilderCompile({
            html: "",
            issues: data.issues || [],
            isCompiling: false,
            error: data.error
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setBuilderCompile({
          html: "",
          issues: [],
          isCompiling: false,
          error:
            error instanceof Error
              ? error.message
              : "MJML se nepodarilo zkompilovat."
        });
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [builderMjml, form.templateId]);

  useEffect(() => {
    if (activeMode !== "code") {
      return;
    }

    const codeSource = (builderCodeDraft || builderMjml).trim();
    if (!codeSource) {
      const timeout = window.setTimeout(() => {
        setCodeCompile({
          html: "",
          issues: [],
          isCompiling: false,
          error: "Chybi MJML kod ke kompilaci."
        });
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCodeCompile((current) => ({
        ...current,
        isCompiling: true,
        error: undefined
      }));

      try {
        const response = await fetch("/api/compile-mjml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mjml: codeSource }),
          signal: controller.signal
        });
        const data = (await response.json()) as CompileMjmlResponse;

        if (data.ok) {
          setCodeCompile({
            html: data.html,
            issues: data.issues,
            isCompiling: false
          });
        } else {
          setCodeCompile({
            html: "",
            issues: data.issues || [],
            isCompiling: false,
            error: data.error
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setCodeCompile({
          html: "",
          issues: [],
          isCompiling: false,
          error:
            error instanceof Error
              ? error.message
              : "MJML kod se nepodarilo zkompilovat."
        });
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeMode, builderCodeDraft, builderMjml]);

  const activeBuilderBlockId = findBuilderBlock(builderBlocks, selectedBlockId)
    ? selectedBlockId
    : builderBlocks[0]?.id || "";

  const builderResult = useMemo<SuccessfulResult>(() => {
    const issues = [
      ...builderCompile.issues,
      ...(builderCompile.error
        ? [{ type: "error" as const, message: builderCompile.error }]
        : [])
    ];

    return {
      ok: true,
      subject: activeTemplateName || "MJML builder",
      preheader: `${builderBlocks.length} bloku, serverova MJML kompilace`,
      mjml: builderMjml,
      html: builderCompile.html,
      usedVariables: [],
      notes: [
        "Builder sklada MJML lokalne z bloku a server ho prevadi pres mjml2html.",
        "Bloky lze pridavat kliknutim nebo pretazenim z palety a ve strukture menit poradi drag and drop.",
        "Blok MJML Code vlozi vlastni MJML fragment primo do tela sablony."
      ],
      issues
    };
  }, [activeTemplateName, builderBlocks.length, builderCompile, builderMjml]);

  const codeResult = useMemo<SuccessfulResult>(() => {
    const mjml = builderCodeDraft || builderMjml;
    const issues = [
      ...codeCompile.issues,
      ...(codeCompile.error ? [{ type: "error" as const, message: codeCompile.error }] : [])
    ];

    return {
      ok: true,
      subject: activeTemplateName || "MJML code template",
      preheader: "Manual MJML source compiled through the shared pipeline",
      mjml,
      html: codeCompile.html,
      usedVariables: [],
      notes: [
        "Code editor compiles MJML through the same server-side mjml2html pipeline.",
        "Manual MJML edits are saved as code-compatible templates and can be imported into the visual builder when possible."
      ],
      issues
    };
  }, [activeTemplateName, builderCodeDraft, builderMjml, codeCompile]);

  const activeBrandStyle = useMemo(
    () =>
      brandStyles.find((style) => style.id === form.brandStyleId) ||
      brandStyles[0] ||
      null,
    [brandStyles, form.brandStyleId]
  );

  const visibleTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    const templates = query
      ? savedTemplates.filter((template) =>
          template.name.toLowerCase().includes(query)
        )
      : savedTemplates;

    return [...templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [savedTemplates, templateSearch]);

  const activeSavedTemplate = useMemo(
    () =>
      activeTemplateId
        ? savedTemplates.find((template) => template.id === activeTemplateId) || null
        : null,
    [activeTemplateId, savedTemplates]
  );

  const successfulResult =
    activeMode === "code"
      ? codeResult
      : form.templateId === "mjml-builder"
        ? builderResult
        : result?.ok
          ? result
          : null;

  const issues = useMemo(() => {
    if (activeMode === "code") {
      return codeResult.issues;
    }
    if (form.templateId === "mjml-builder") {
      return builderResult.issues;
    }
    if (!result) {
      return [];
    }
    return result.ok ? result.issues : result.issues || [];
  }, [activeMode, builderResult.issues, codeResult.issues, form.templateId, result]);

  const outputError =
    activeMode === "code"
      ? codeCompile.error
      : form.templateId === "mjml-builder"
      ? builderCompile.error
      : !result?.ok && result
        ? result.error
        : undefined;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function upsertBrandStyle(style: BrandStyle) {
    setBrandStyles((current) => {
      const index = current.findIndex((item) => item.id === style.id);
      if (index < 0) {
        return [...current, style];
      }

      const next = [...current];
      next[index] = style;
      return next;
    });
  }

  function selectBrandStyle(styleId: string) {
    updateForm("brandStyleId", styleId);
    const style = brandStyles.find((item) => item.id === styleId);
    if (style) {
      setBrandStyleDraft(createBrandStyleDraft(style));
    }
  }

  function startNewBrandStyle() {
    setBrandStyleDraft(createBrandStyleDraft());
    setBrandStyleError("");
    setBrandStyleStatus("Vyplnte novy brand styl a ulozte ho.");
  }

  async function saveBrandStyle() {
    setBrandStyleError("");
    setBrandStyleStatus("");

    if (!brandStyleDraft.name.trim()) {
      setBrandStyleError("Chybi nazev brand stylu.");
      return;
    }

    let profile: BrandStyleProfile;
    try {
      profile = JSON.parse(brandStyleDraft.profileJson) as BrandStyleProfile;
    } catch {
      setBrandStyleError("Profil musi byt validni JSON.");
      return;
    }

    setIsSavingBrandStyle(true);
    try {
      const response = await fetch(
        brandStyleDraft.id
          ? `/api/brand-styles/${brandStyleDraft.id}`
          : "/api/brand-styles",
        {
          method: brandStyleDraft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: brandStyleDraft.name,
            description: brandStyleDraft.description,
            profile
          })
        }
      );
      const data = (await response.json()) as BrandStyleResponse;

      if (!data.ok) {
        setBrandStyleError(data.error);
        return;
      }

      upsertBrandStyle(data.style);
      updateForm("brandStyleId", data.style.id);
      setBrandStyleDraft(createBrandStyleDraft(data.style));
      setBrandStyleStatus(`Brand styl "${data.style.name}" byl ulozen.`);
    } catch (error) {
      setBrandStyleError(
        error instanceof Error ? error.message : "Brand styl se nepodarilo ulozit."
      );
    } finally {
      setIsSavingBrandStyle(false);
    }
  }

  async function deleteSelectedBrandStyle(styleId: string) {
    const style = brandStyles.find((item) => item.id === styleId);

    if (!style || !window.confirm(`Smazat brand styl "${style.name}"?`)) {
      return;
    }

    setBrandStyleError("");
    setBrandStyleStatus("");

    try {
      const response = await fetch(`/api/brand-styles/${styleId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setBrandStyleError(data.error || "Brand styl se nepodarilo smazat.");
        return;
      }

      const remainingStyles = brandStyles.filter((item) => item.id !== styleId);
      setBrandStyles(remainingStyles);
      const nextActiveStyle = remainingStyles[0];
      updateForm("brandStyleId", nextActiveStyle?.id || "");
      setBrandStyleDraft(createBrandStyleDraft(nextActiveStyle));
      setBrandStyleStatus(`Brand styl "${style.name}" byl smazan.`);
    } catch (error) {
      setBrandStyleError(
        error instanceof Error ? error.message : "Brand styl se nepodarilo smazat."
      );
    }
  }

  async function uploadBrandAssets(files: FileList | null) {
    if (!brandStyleDraft.id || !files?.length) {
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("assets", file));
    setIsUploadingBrandAssets(true);
    setBrandStyleError("");
    setBrandStyleStatus("Nahravam a analyzuji assety...");

    try {
      const response = await fetch(
        `/api/brand-styles/${brandStyleDraft.id}/assets`,
        {
          method: "POST",
          body: formData
        }
      );
      const data = (await response.json()) as BrandAssetUploadResponse;

      if (!data.ok) {
        setBrandStyleError(data.error);
        setBrandStyleStatus("");
        return;
      }

      upsertBrandStyle(data.style);
      updateForm("brandStyleId", data.style.id);
      setBrandStyleDraft(createBrandStyleDraft(data.style));
      setBrandStyleStatus("Assety byly ulozeny a profil byl aktualizovan.");
    } catch (error) {
      setBrandStyleError(
        error instanceof Error ? error.message : "Assety se nepodarilo nahrat."
      );
      setBrandStyleStatus("");
    } finally {
      setIsUploadingBrandAssets(false);
    }
  }

  async function loadSavedTemplates() {
    setIsLoadingTemplates(true);
    setTemplateError("");

    try {
      const response = await fetch("/api/templates");
      const data = (await response.json()) as TemplateListResponse;

      if (!data.ok) {
        setTemplateError(data.error);
        return;
      }

      setSavedTemplates(data.templates);
      setTemplateStatus(
        data.templates.length
          ? `Nacteno ${data.templates.length} sablon.`
          : "Zatim neni ulozena zadna sablona."
      );
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Sablony se nepodarilo nacist."
      );
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  async function compileMjmlForSave(mjml: string) {
    const response = await fetch("/api/compile-mjml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mjml })
    });
    const data = (await response.json()) as CompileMjmlResponse;

    if (!data.ok) {
      throw new Error(data.error);
    }

    return data;
  }

  function createBuilderTemplateState(
    source: BuilderTemplateState["source"] = "builder"
  ): BuilderTemplateState {
    return {
      version: 1,
      source,
      blocks: cloneBuilderBlocks(builderBlocks),
      theme: { ...defaultBuilderTheme, ...builderTheme },
      customHead: builderCustomHead,
      savedBlocks: cloneBuilderBlocks(builderSavedBlocks),
      mergeTagMocks: {
        first_name: "Jana",
        last_name: "Novakova",
        email: "jana.novakova@example.com"
      }
    };
  }

  function createCodeTemplateState(source: string): BuilderTemplateState {
    const imported = parseImportedMjmlTemplate(source);
    const rawBlock = createBuilderBlock("raw-mjml");
    rawBlock.props.source = imported.body || source;

    return {
      version: 1,
      source: "raw-mjml",
      blocks: imported.blocks.length ? imported.blocks : [rawBlock],
      theme: { ...defaultBuilderTheme, ...builderTheme },
      customHead: imported.customHead || builderCustomHead,
      savedBlocks: cloneBuilderBlocks(builderSavedBlocks),
      mergeTagMocks: {
        first_name: "Jana",
        last_name: "Novakova",
        email: "jana.novakova@example.com"
      }
    };
  }

  function applyBuilderTemplateState(state: BuilderTemplateState) {
    const blocks = cloneBuilderBlocks(state.blocks || []);
    setBuilderBlocks(blocks);
    setBuilderTheme({ ...defaultBuilderTheme, ...state.theme });
    setBuilderCustomHead(state.customHead || "");
    setBuilderSavedBlocks(cloneBuilderBlocks(state.savedBlocks || []));
    setSelectedBlockId(blocks[0]?.id || "");
    setBuilderDevice("desktop");
    setBuilderHistory({ past: [], future: [] });
    setBuilderImportStatus("");
    setActiveTab("preview");
  }

  function startNewBuilderTemplate(options: { pushRoute?: boolean } = {}) {
    const nextBlocks = cloneBuilderBlocks();
    setBuilderBlocks(nextBlocks);
    setBuilderSavedBlocks([]);
    setBuilderTheme({ ...defaultBuilderTheme });
    setBuilderCustomHead("");
    setBuilderCodeDraft("");
    setActiveTemplateId(null);
    setActiveTemplateName("Nova sablona");
    setSelectedBlockId(nextBlocks[0]?.id || "");
    setBuilderHistory({ past: [], future: [] });
    setBuilderImportStatus("");
    setTemplateError("");
    setTemplateStatus("Nova sablona je pripravena k editaci.");
    setForm(builderTemplateForm);
    setActiveMode("mjml-builder");
    setActiveTab("preview");
    if (options.pushRoute ?? true) {
      pushPath("/templates/new/blank");
    }
  }

  async function saveCurrentTemplate() {
    setTemplateError("");
    setTemplateStatus("");

    if (!activeTemplateName.trim()) {
      setTemplateError("Chybi nazev sablony.");
      return;
    }

    setIsSavingTemplate(true);
    try {
      const isCodeMode = activeMode === "code";
      const currentMjml = isCodeMode ? codeResult.mjml : builderMjml;
      setTemplateStatus("Kompiluji aktualni MJML pred ulozenim...");
      const compiled = await compileMjmlForSave(currentMjml);
      const currentHtml = compiled.html;

      if (isCodeMode) {
        setCodeCompile({
          html: compiled.html,
          issues: compiled.issues,
          isCompiling: false
        });
      } else {
        setBuilderCompile({
          html: compiled.html,
          issues: compiled.issues,
          isCompiling: false
        });
      }

      if (compiled.issues.some((issue) => issue.type === "error")) {
        setActiveTab("issues");
      }

      const payload = {
        name: activeTemplateName,
        sourceType: isCodeMode ? "code" : "builder",
        mode: isCodeMode ? "code" : "builder",
        state: isCodeMode
          ? createCodeTemplateState(currentMjml)
          : createBuilderTemplateState("builder"),
        mjml: currentMjml,
        html: currentHtml
      };
      const response = await fetch(
        activeTemplateId ? `/api/templates/${activeTemplateId}` : "/api/templates",
        {
          method: activeTemplateId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = (await response.json()) as TemplateResponse;

      if (!data.ok) {
        setTemplateError(data.error);
        return;
      }

      setActiveTemplateId(data.template.id);
      setActiveTemplateName(data.template.name);
      setSavedTemplates((current) => {
        const index = current.findIndex((item) => item.id === data.template.id);
        if (index < 0) {
          return [data.template, ...current];
        }
        const next = [...current];
        next[index] = data.template;
        return next;
      });
      setTemplateStatus(`Sablona "${data.template.name}" byla ulozena.`);
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Sablonu se nepodarilo ulozit."
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function saveGeneratedResultAsTemplate() {
    if (!successfulResult || form.templateId === "mjml-builder") {
      return;
    }

    const isExcel = form.templateId === "coupons-excel";
    const source = isExcel ? "excel-generated" : "ai-generated";
    const imported = parseImportedMjmlTemplate(successfulResult.mjml);
    const rawBlock = createBuilderBlock("raw-mjml");
    rawBlock.props.source = imported.body || successfulResult.mjml;
    const state: BuilderTemplateState = {
      version: 1,
      source,
      blocks: imported.blocks.length ? imported.blocks : [rawBlock],
      theme: { ...defaultBuilderTheme, ...builderTheme },
      customHead: imported.customHead || builderCustomHead,
      savedBlocks: cloneBuilderBlocks(builderSavedBlocks),
      mergeTagMocks: {
        first_name: "Jana",
        last_name: "Novakova",
        email: "jana.novakova@example.com"
      }
    };

    setTemplateError("");
    setTemplateStatus("");
    setIsSavingTemplate(true);

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: successfulResult.subject || (isExcel ? "Excel sablona" : "AI sablona"),
          sourceType: isExcel ? "excel" : "ai",
          mode: isExcel ? "excel" : "ai",
          brandStyleId: form.brandStyleId || undefined,
          excelSource: isExcel
            ? {
                fileName: couponFile?.name,
                templateFileName: couponTemplateFile?.name,
                month: form.couponMonth,
                generatedAt: new Date().toISOString(),
                options: {
                  useAiMatching: form.useAiMatching,
                  useAiReview: form.useAiReview,
                  includeSelfServiceAd: form.includeSelfServiceAd
                },
                notes: successfulResult.notes
              }
            : undefined,
          metadata: {
            generatedBy: isExcel ? "excel-assembly" : "ai-generator"
          },
          state,
          mjml: successfulResult.mjml,
          html: successfulResult.html
        })
      });
      const data = (await response.json()) as TemplateResponse;

      if (!data.ok) {
        setTemplateError(data.error);
        return;
      }

      setSavedTemplates((current) => [data.template, ...current]);
      setActiveTemplateId(data.template.id);
      setActiveTemplateName(data.template.name);
      applyBuilderTemplateState(data.template.state);
      setBuilderCodeDraft(data.template.mjml);
      setTemplateStatus(`Sablona "${data.template.name}" byla ulozena.`);
      pushPath(modePath(isExcel ? "coupons-excel" : "ai", data.template.id));
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Sablonu se nepodarilo ulozit."
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }

  function openSavedTemplate(
    template: SavedEmailTemplate,
    mode: TemplateMode = "mjml-builder",
    options: { pushRoute?: boolean } = {}
  ) {
    setActiveTemplateId(template.id);
    setActiveTemplateName(template.name);
    applyBuilderTemplateState(template.state);
    setBuilderCodeDraft(template.mjml);
    setForm(builderTemplateForm);
    setActiveMode(mode);
    if (mode === "code") {
      setBuilderCodeDraft(template.mjml);
      setActiveTab("mjml");
    } else if (mode === "preview") {
      setActiveTab("preview");
    } else if (mode === "coupons-excel") {
      setForm(couponTemplateForm);
    }
    if (options.pushRoute ?? true) {
      pushPath(modePath(mode, template.id));
    }
    setTemplateStatus(`Otevreno: ${template.name}`);
  }

  async function duplicateSavedTemplate(template: SavedEmailTemplate) {
    setTemplateError("");
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} kopie`,
          description: template.description || "",
          sourceType: template.sourceType,
          mode: template.mode,
          brandStyleId: template.brandStyleId,
          excelSource: template.excelSource,
          metadata: template.metadata,
          state: template.state,
          mjml: template.mjml,
          html: template.html,
          thumbnail: template.thumbnail
        })
      });
      const data = (await response.json()) as TemplateResponse;

      if (!data.ok) {
        setTemplateError(data.error);
        return;
      }

      setSavedTemplates((current) => [data.template, ...current]);
      setTemplateStatus(`Vytvorena kopie "${data.template.name}".`);
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Sablonu se nepodarilo duplikovat."
      );
    }
  }

  async function renameSavedTemplate(template: SavedEmailTemplate) {
    const nextName = window.prompt("Novy nazev sablony", template.name);
    if (!nextName?.trim() || nextName.trim() === template.name) {
      return;
    }

    setTemplateError("");
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName.trim() })
      });
      const data = (await response.json()) as TemplateResponse;

      if (!data.ok) {
        setTemplateError(data.error);
        return;
      }

      setSavedTemplates((current) =>
        current.map((item) => (item.id === data.template.id ? data.template : item))
      );
      if (activeTemplateId === data.template.id) {
        setActiveTemplateName(data.template.name);
      }
      setTemplateStatus(`Sablona prejmenovana na "${data.template.name}".`);
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Sablonu se nepodarilo prejmenovat."
      );
    }
  }

  async function deleteSavedTemplate(template: SavedEmailTemplate) {
    if (!window.confirm(`Smazat sablonu "${template.name}"?`)) {
      return;
    }

    setTemplateError("");
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setTemplateError(data.error || "Sablonu se nepodarilo smazat.");
        return;
      }

      setSavedTemplates((current) => current.filter((item) => item.id !== template.id));
      if (activeTemplateId === template.id) {
        setActiveTemplateId(null);
        setActiveTemplateName("Nova sablona");
      }
      setTemplateStatus(`Sablona "${template.name}" byla smazana.`);
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Sablonu se nepodarilo smazat."
      );
    }
  }

  function exportTemplateJson(template: SavedEmailTemplate) {
    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${templateExportBaseName(template.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function pushPath(path: string) {
    if (typeof window === "undefined" || window.location.pathname === path) {
      return;
    }

    window.history.pushState(null, "", path);
    lastAppliedPath.current = path;
  }

  function switchMode(
    mode: TemplateMode,
    options: { pushRoute?: boolean } = {}
  ) {
    const pushRoute = options.pushRoute ?? true;
    setResult(null);
    setSelectedAiSuggestionIds(new Set());
    setActiveTab("preview");
    setCouponFile(null);
    setCouponTemplateFile(null);
    setActiveMode(mode);

    if (pushRoute) {
      pushPath(modePath(mode, activeTemplateId));
    }

    if (mode === "templates") {
      return;
    }

    if (
      mode === "dashboard" ||
      mode === "new-template" ||
      mode === "brand-styles" ||
      mode === "campaigns" ||
      mode === "contacts" ||
      mode === "reports" ||
      mode === "automation" ||
      mode === "settings"
    ) {
      return;
    }

    if (mode === "coupons-excel") {
      setForm(couponTemplateForm);
      return;
    }

    if (mode === "mjml-builder") {
      setForm(builderTemplateForm);
      return;
    }

    if (mode === "code") {
      setForm(builderTemplateForm);
      setBuilderCodeDraft(builderMjml);
      setActiveTab("mjml");
      return;
    }

    if (mode === "preview") {
      setForm(builderTemplateForm);
      setActiveTab("preview");
      return;
    }

    setForm((current) => ({
      ...emptyForm,
      brandStyleId: current.brandStyleId || activeBrandStyle?.id || ""
    }));
  }

  function createBuilderSnapshot(): BuilderSnapshot {
    return {
      blocks: cloneBuilderBlocks(builderBlocks),
      customHead: builderCustomHead,
      device: builderDevice,
      savedBlocks: cloneBuilderBlocks(builderSavedBlocks),
      selectedBlockId,
      theme: { ...builderTheme }
    };
  }

  function rememberBuilderState() {
    const snapshot = createBuilderSnapshot();
    setBuilderHistory((current) => ({
      past: [...current.past.slice(-49), snapshot],
      future: []
    }));
  }

  function restoreBuilderSnapshot(snapshot: BuilderSnapshot) {
    setBuilderBlocks(cloneBuilderBlocks(snapshot.blocks));
    setBuilderCustomHead(snapshot.customHead);
    setBuilderDevice(snapshot.device);
    setBuilderSavedBlocks(cloneBuilderBlocks(snapshot.savedBlocks || []));
    setBuilderTheme({ ...snapshot.theme });
    setSelectedBlockId(snapshot.selectedBlockId);
    setActiveTab("preview");
  }

  function undoBuilder() {
    const previous = builderHistory.past[builderHistory.past.length - 1];
    if (!previous) {
      return;
    }

    const present = createBuilderSnapshot();
    setBuilderHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [present, ...current.future].slice(0, 50)
    }));
    restoreBuilderSnapshot(previous);
  }

  function redoBuilder() {
    const next = builderHistory.future[0];
    if (!next) {
      return;
    }

    const present = createBuilderSnapshot();
    setBuilderHistory((current) => ({
      past: [...current.past.slice(-49), present],
      future: current.future.slice(1)
    }));
    restoreBuilderSnapshot(next);
  }

  function updateBuilderTheme(theme: BuilderTheme) {
    rememberBuilderState();
    setBuilderTheme(theme);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.templateId === "mjml-builder") {
      setActiveTab("preview");
      return;
    }

    if (form.templateId === "ai" && (!form.brandStyleId || !form.prompt.trim())) {
      setResult({
        ok: false,
        error: !form.brandStyleId
          ? "Nejdrive vyberte nebo vytvorte brand styl."
          : "Popiste, jakou e-mailovou sablonu chcete vygenerovat."
      });
      setActiveTab("issues");
      return;
    }

    setIsLoading(true);
    setResult(null);
    setSelectedAiSuggestionIds(new Set());
    setActiveTab("preview");

    try {
      const requestInit: RequestInit =
        form.templateId === "coupons-excel"
          ? {
              method: "POST",
              body: buildCouponFormData(form, couponFile, couponTemplateFile)
            }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                templateId: "ai",
                brandStyleId: form.brandStyleId,
                prompt: form.prompt
              })
            };

      const response = await fetch("/api/generate-email", requestInit);
      const data = (await response.json()) as GenerateEmailResponse;
      setResult(data);
      setSelectedAiSuggestionIds(new Set());

      if (
        !data.ok ||
        (data.ok && data.issues.some((issue) => issue.type === "error"))
      ) {
        setActiveTab("issues");
      }
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nepodarilo se zavolat API. Zkuste to prosim znovu."
      });
      setActiveTab("issues");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleAiSuggestion(id: string, checked: boolean) {
    setSelectedAiSuggestionIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function selectAllAiSuggestions() {
    setSelectedAiSuggestionIds(
      new Set(
        issues
          .filter(isAiIssue)
          .filter((issue) => !isIgnoredAiIssue(issue))
          .map((issue, index) => aiSuggestionId(issue, index))
      )
    );
  }

  function clearSelectedAiSuggestions() {
    setSelectedAiSuggestionIds(new Set());
  }

  async function applyAiSuggestionIssues(aiIssuesToApply: ValidationIssue[]) {
    if (!successfulResult || form.templateId === "mjml-builder") {
      return;
    }

    const selectedSuggestions = aiIssuesToApply.map(aiSuggestionChange);

    if (selectedSuggestions.length === 0) {
      return;
    }

    setIsApplyingAiSuggestions(true);
    try {
      const payload: ApplyAiSuggestionsRequest = {
        subject: successfulResult.subject,
        preheader: successfulResult.preheader,
        mjml: successfulResult.mjml,
        usedVariables: successfulResult.usedVariables,
        notes: successfulResult.notes,
        suggestions: selectedSuggestions
      };
      const response = await fetch("/api/apply-ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as GenerateEmailResponse;
      setResult(data);
      setSelectedAiSuggestionIds(new Set());
      setActiveTab("issues");
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "AI navrhy se nepodarilo provest."
      });
      setActiveTab("issues");
    } finally {
      setIsApplyingAiSuggestions(false);
    }
  }

  async function applySelectedAiSuggestions() {
    const selectedIssues = issues
      .filter(isAiIssue)
      .filter((issue) => !isIgnoredAiIssue(issue))
      .map((issue, index) => ({ issue, id: aiSuggestionId(issue, index) }))
      .filter(({ id }) => selectedAiSuggestionIds.has(id))
      .map(({ issue }) => issue);

    await applyAiSuggestionIssues(selectedIssues);
  }

  async function applyAllAiSuggestions() {
    await applyAiSuggestionIssues(
      issues.filter(isAiIssue).filter((issue) => !isIgnoredAiIssue(issue))
    );
  }

  async function applySingleAiSuggestion(issue: ValidationIssue) {
    await applyAiSuggestionIssues([issue]);
  }

  function insertBuilderBlock(
    type: BuilderBlockType,
    index = builderBlocks.length,
    parentId?: string
  ) {
    const parent = parentId ? findBuilderBlock(builderBlocks, parentId) : null;
    if (!canAcceptChildType(parent, type)) {
      setBuilderImportStatus(
        parent
          ? `${getBlockDefinition(type).label} nelze vlozit do ${getBlockDefinition(parent.type).label}.`
          : ""
      );
      return;
    }

    const block = createBuilderBlock(type);
    rememberBuilderState();
    setBuilderBlocks((current) => insertBuilderBlockAt(current, block, index, parentId));
    setSelectedBlockId(block.id);
    setActiveTab("preview");
  }

  function addBuilderBlock(type: BuilderBlockType, parentId?: string | null) {
    if (parentId !== undefined) {
      const explicitParentId = parentId || undefined;
      const parent = explicitParentId
        ? findBuilderBlock(builderBlocks, explicitParentId)
        : null;
      const childCount = parent?.children?.length || 0;
      insertBuilderBlock(
        type,
        explicitParentId ? childCount : builderBlocks.length,
        explicitParentId
      );
      return;
    }

    const selectedBlock = findBuilderBlock(builderBlocks, activeBuilderBlockId);
    const compatibleSelectedParent =
      selectedBlock && canAcceptChildType(selectedBlock, type)
        ? selectedBlock
        : selectedBlock?.children?.find((child) => canAcceptChildType(child, type));
    const selectedParentId = compatibleSelectedParent?.id;
    const childCount = compatibleSelectedParent?.children?.length || 0;
    insertBuilderBlock(
      type,
      selectedParentId ? childCount : builderBlocks.length,
      selectedParentId
    );
  }

  function addSavedBuilderBlock(savedBlock: BuilderBlock) {
    const block = cloneBuilderBlocksWithNewIds([savedBlock])[0];
    if (!block) {
      return;
    }

    rememberBuilderState();
    setBuilderBlocks((current) => insertBuilderBlockAt(current, block, current.length));
    setSelectedBlockId(block.id);
    setActiveTab("preview");
  }

  function saveReusableBuilderBlock(id: string) {
    const source = findBuilderBlock(builderBlocks, id);
    if (!source) {
      return;
    }

    rememberBuilderState();
    const reusable = cloneBuilderBlocksWithNewIds([source])[0];
    setBuilderSavedBlocks((current) => [reusable, ...current].slice(0, 30));
    setBuilderImportStatus(
      `${getBlockDefinition(source.type).label} je ulozeny mezi Saved blocks.`
    );
  }

  function updateBuilderBlock(
    id: string,
    key: string,
    value: string,
    device: BuilderDevice = builderDevice
  ) {
    rememberBuilderState();
    setBuilderBlocks((current) =>
      mapBuilderBlocks(current, (block) => {
        if (block.id !== id) {
          return block;
        }

        if (device === "mobile") {
          const mobileProps = { ...(block.mobileProps || {}) };
          if (value.trim()) {
            mobileProps[key] = value;
          } else {
            delete mobileProps[key];
          }

          return {
            ...block,
            mobileProps: Object.keys(mobileProps).length ? mobileProps : undefined
          };
        }

        return { ...block, props: { ...block.props, [key]: value } };
      })
    );
  }

  function moveBuilderBlock(id: string, direction: -1 | 1) {
    rememberBuilderState();
    setBuilderBlocks((current) => moveBuilderBlockInTree(current, id, direction).blocks);
  }

  function reorderBuilderBlock(id: string, targetIndex: number, parentId?: string) {
    const draggedBlock = findBuilderBlock(builderBlocks, id);
    const parent = parentId ? findBuilderBlock(builderBlocks, parentId) : null;
    const sourceLocation = findBuilderBlockLocation(builderBlocks, id);
    const sourceParentId = sourceLocation?.parentId || "";
    const targetParentId = parentId || "";
    const adjustedIndex =
      sourceLocation && sourceParentId === targetParentId && targetIndex > sourceLocation.index
        ? targetIndex - 1
        : targetIndex;

    if (
      !draggedBlock ||
      !sourceLocation ||
      !canAcceptChildType(parent, draggedBlock.type) ||
      (parentId && findBuilderBlock([draggedBlock], parentId)) ||
      (sourceParentId === targetParentId && adjustedIndex === sourceLocation.index)
    ) {
      setSelectedBlockId(id);
      return;
    }

    rememberBuilderState();
    setBuilderBlocks((current) => {
      const draggedBlock = findBuilderBlock(current, id);
      const parent = parentId ? findBuilderBlock(current, parentId) : null;
      if (!draggedBlock || !canAcceptChildType(parent, draggedBlock.type)) {
        return current;
      }
      if (parentId && findBuilderBlock([draggedBlock], parentId)) {
        return current;
      }
      const sourceLocation = findBuilderBlockLocation(current, id);
      if (!sourceLocation) {
        return current;
      }
      const sourceParentId = sourceLocation.parentId || "";
      const targetParentId = parentId || "";
      const adjustedIndex =
        sourceParentId === targetParentId && targetIndex > sourceLocation.index
          ? targetIndex - 1
          : targetIndex;

      if (sourceParentId === targetParentId && adjustedIndex === sourceLocation.index) {
        return current;
      }

      const removed = removeBuilderBlock(current, id);
      if (!removed.removed) {
        return current;
      }
      return insertBuilderBlockAt(removed.blocks, removed.removed, adjustedIndex, parentId);
    });
    setSelectedBlockId(id);
  }

  function handleBuilderDrop(
    event: DragEvent<HTMLElement>,
    index: number,
    parentId?: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    const paletteType = event.dataTransfer.getData(builderPaletteMime);
    const draggedBlockId = event.dataTransfer.getData(builderBlockMime);

    if (isBuilderBlockType(paletteType)) {
      const parent = parentId ? findBuilderBlock(builderBlocks, parentId) : null;
      if (!canAcceptChildType(parent, paletteType)) {
        setBuilderImportStatus(
          parent
            ? `${getBlockDefinition(paletteType).label} nelze vlozit do ${getBlockDefinition(parent.type).label}.`
            : ""
        );
        return;
      }
      insertBuilderBlock(paletteType, index, parentId);
      return;
    }

    if (draggedBlockId) {
      const draggedBlock = findBuilderBlock(builderBlocks, draggedBlockId);
      if (draggedBlock && parentId && findBuilderBlock([draggedBlock], parentId)) {
        return;
      }
      const parent = parentId ? findBuilderBlock(builderBlocks, parentId) : null;
      if (draggedBlock && !canAcceptChildType(parent, draggedBlock.type)) {
        setBuilderImportStatus(
          parent
            ? `${getBlockDefinition(draggedBlock.type).label} nelze presunout do ${getBlockDefinition(parent.type).label}.`
            : ""
        );
        return;
      }
      reorderBuilderBlock(draggedBlockId, index, parentId);
    }
  }


  function duplicateBuilderBlock(id: string) {
    const source = findBuilderBlock(builderBlocks, id);
    if (!source) {
      return;
    }
    const duplicate = {
      ...createBuilderBlock(source.type),
      props: { ...source.props },
      mobileProps: source.mobileProps ? { ...source.mobileProps } : undefined,
      children: source.children ? cloneBuilderBlocksWithNewIds(source.children) : undefined
    };
    rememberBuilderState();
    setBuilderBlocks((current) =>
      duplicateBuilderBlockInTree(current, id, duplicate).blocks
    );
    setSelectedBlockId(duplicate.id);
  }

  function deleteBuilderBlock(id: string) {
    rememberBuilderState();
    const { blocks: nextBlocks } = removeBuilderBlock(builderBlocks, id);
    setBuilderBlocks(nextBlocks);
    if (selectedBlockId === id) {
      setSelectedBlockId(nextBlocks[0]?.id || "");
    }
  }

  function resetBuilder() {
    const nextBlocks = cloneBuilderBlocks();
    rememberBuilderState();
    setBuilderBlocks(nextBlocks);
    setBuilderTheme({ ...defaultBuilderTheme });
    setBuilderCustomHead("");
    setBuilderSavedBlocks([]);
    setBuilderCodeDraft("");
    setBuilderImportStatus("");
    setBuilderDevice("desktop");
    setSelectedBlockId(nextBlocks[0]?.id || "");
    setActiveTab("preview");
  }

  function applyImportedMjmlSource(source: string, sourceName = "MJML kod") {
    const imported = parseImportedMjmlTemplate(source);

    if (!imported.body.trim()) {
      setBuilderImportStatus("Soubor neobsahuje MJML obsah.");
      return;
    }

    const importedBlocks = imported.blocks.length ? imported.blocks : [];
    if (!importedBlocks.length) {
      const importedBlock = createBuilderBlock("raw-mjml");
      importedBlock.props.source = imported.body;
      importedBlocks.push(importedBlock);
    }

    rememberBuilderState();
    setBuilderBlocks(importedBlocks);
    setBuilderCustomHead(imported.customHead);
    setBuilderTheme((current) => ({
      ...defaultBuilderTheme,
      ...current,
      bodyBackground: imported.bodyBackground || current.bodyBackground,
      width: imported.width || current.width
    }));
    setSelectedBlockId(importedBlocks[0]?.id || "");
    setActiveTab("preview");
    setActiveMode("mjml-builder");
    setForm(builderTemplateForm);
    setBuilderImportStatus(
      `Nahrano: ${sourceName}. Prevedeno na ${importedBlocks.length} editovatelnych bloku.`
    );
  }

  function importBuilderCodeDraft() {
    try {
      applyImportedMjmlSource(builderCodeDraft, "MJML kod");
    } catch (error) {
      setBuilderImportStatus(
        error instanceof Error
          ? `MJML kod se nepodarilo nacist: ${error.message}`
          : "MJML kod se nepodarilo nacist."
      );
    }
  }

  async function importBuilderTemplate(file: File) {
    try {
      const source = await file.text();
      applyImportedMjmlSource(source, file.name);
    } catch (error) {
      setBuilderImportStatus(
        error instanceof Error
          ? `Sablonu se nepodarilo nacist: ${error.message}`
          : "Sablonu se nepodarilo nacist."
      );
    }
  }

  async function sendBuilderTestEmail() {
    setTestEmailError("");
    setTestEmailStatus("");

    if (!testEmailRecipient.trim() || !testEmailRecipient.includes("@")) {
      setTestEmailError("Zadejte validni e-mail prijemce.");
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: activeTemplateId,
          recipientEmail: testEmailRecipient.trim(),
          mjml: builderMjml,
          html: builderCompile.html
        })
      });
      const data = (await response.json()) as TestEmailResponse;

      if (!data.ok) {
        setTestEmailError(data.error);
        return;
      }

      setTestEmailStatus(data.message);
    } catch (error) {
      setTestEmailError(
        error instanceof Error ? error.message : "Testovaci e-mail se nepodarilo odeslat."
      );
    } finally {
      setIsSendingTestEmail(false);
    }
  }

  return (
    <AppShell
      activeMode={activeMode}
      templateCount={savedTemplates.length}
      onNavigate={(mode) => switchMode(mode)}
    >
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 py-5 lg:min-h-[calc(100vh-72px)] lg:overflow-hidden">
        {activeMode === "dashboard" ? (
          <DashboardPage
            templateCount={savedTemplates.length}
            brandStyleCount={brandStyles.length}
            latestTemplates={visibleTemplates.slice(0, 4)}
            onNewTemplate={() => switchMode("new-template")}
            onOpenTemplates={() => switchMode("templates")}
            onOpenExcel={() => switchMode("coupons-excel")}
            onOpenAi={() => switchMode("ai")}
          />
        ) : activeMode === "new-template" ? (
          <NewTemplateFlow
            templates={visibleTemplates.slice(0, 6)}
            onBack={() => switchMode("templates")}
            onBlank={() => startNewBuilderTemplate()}
            onBuilder={() => startNewBuilderTemplate()}
            onAi={() => switchMode("ai")}
            onExcel={() => switchMode("coupons-excel")}
            onCode={() => {
              startNewBuilderTemplate({ pushRoute: false });
              switchMode("code");
            }}
            onDuplicate={duplicateSavedTemplate}
          />
        ) : activeMode === "brand-styles" ? (
          <BrandStylesPage
            activeStyleId={form.brandStyleId}
            draft={brandStyleDraft}
            error={brandStyleError}
            isSaving={isSavingBrandStyle}
            isUploading={isUploadingBrandAssets}
            status={brandStyleStatus}
            styles={brandStyles}
            onDelete={deleteSelectedBrandStyle}
            onDraftChange={setBrandStyleDraft}
            onEdit={(style) => setBrandStyleDraft(createBrandStyleDraft(style))}
            onNew={startNewBrandStyle}
            onSave={saveBrandStyle}
            onSelect={selectBrandStyle}
            onUpload={uploadBrandAssets}
          />
        ) : activeMode === "campaigns" ? (
          <CampaignsSection
            templates={savedTemplates}
            isLoadingTemplates={isLoadingTemplates}
            onCreateTemplate={() => switchMode("new-template")}
            onCreateAiTemplate={() => switchMode("ai")}
            onCreateExcelTemplate={() => switchMode("coupons-excel")}
            onCreateBuilderTemplate={() => startNewBuilderTemplate()}
            onCreateCodeTemplate={() => {
              startNewBuilderTemplate({ pushRoute: false });
              switchMode("code");
            }}
            onNavigatePath={pushPath}
            onOpenTemplates={() => switchMode("templates")}
          />
        ) : activeMode === "contacts" ||
          activeMode === "reports" ||
          activeMode === "automation" ? (
          <PlaceholderPage
            mode={activeMode}
            onOpenTemplates={() => switchMode("templates")}
          />
        ) : activeMode === "templates" ? (
          <TemplateList
            activeTemplateId={activeTemplateId}
            isLoading={isLoadingTemplates}
            query={templateSearch}
            status={templateStatus}
            error={templateError}
            templates={visibleTemplates}
            onCreate={() => switchMode("new-template")}
            onDelete={deleteSavedTemplate}
            onDuplicate={duplicateSavedTemplate}
            onExportJson={exportTemplateJson}
            onOpenBuilder={(template) => openSavedTemplate(template, "mjml-builder")}
            onOpenCode={(template) => openSavedTemplate(template, "code")}
            onOpenExcel={(template) => openSavedTemplate(template, "coupons-excel")}
            onOpenPreview={(template) => openSavedTemplate(template, "preview")}
            onRefresh={loadSavedTemplates}
            onRename={renameSavedTemplate}
            onSearch={setTemplateSearch}
          />
        ) : activeMode === "mjml-builder" ? (
          <>
            <TemplateWorkspaceBar
              activeMode={activeMode}
              activeTemplateId={activeTemplateId}
              templateName={activeTemplateName}
              status={templateStatus}
              isSaving={isSavingTemplate}
              onModeChange={switchMode}
              onNameChange={setActiveTemplateName}
              onSave={saveCurrentTemplate}
              onOpenTemplates={() => switchMode("templates")}
            />
            <section className="min-h-0 flex-1 overflow-hidden">
              <BuilderAppShell
                activeTab={activeTab}
                activeTemplateId={activeTemplateId}
                activeTemplateName={activeTemplateName}
                blocks={builderBlocks}
                canRedo={builderHistory.future.length > 0}
                canUndo={builderHistory.past.length > 0}
                compileState={builderCompile}
                error={outputError}
                html={successfulResult?.html || ""}
                importStatus={builderImportStatus}
                isSaving={isSavingTemplate}
                issues={issues}
                mjml={successfulResult?.mjml || ""}
                notes={successfulResult?.notes || []}
                device={builderDevice}
                savedBlocks={builderSavedBlocks}
                selectedBlockId={activeBuilderBlockId}
                status={templateStatus}
                theme={builderTheme}
                usedVariables={successfulResult?.usedVariables || []}
                onAddBlock={addBuilderBlock}
                onAddSavedBlock={addSavedBuilderBlock}
                onDeleteBlock={deleteBuilderBlock}
                onDeviceChange={setBuilderDevice}
                onDropAt={handleBuilderDrop}
                onDuplicateBlock={duplicateBuilderBlock}
                onImportTemplate={importBuilderTemplate}
                onMoveBlock={moveBuilderBlock}
                onOpenPreview={() => switchMode("preview")}
                onOpenTemplates={() => switchMode("templates")}
                onRedo={redoBuilder}
                onReset={resetBuilder}
                onSave={saveCurrentTemplate}
                onSaveReusableBlock={saveReusableBuilderBlock}
                onSelectBlock={setSelectedBlockId}
                onSetActiveTab={setActiveTab}
                onClearImportStatus={() => setBuilderImportStatus("")}
                onTemplateNameChange={setActiveTemplateName}
                onThemeChange={updateBuilderTheme}
                onUndo={undoBuilder}
                onUpdateBlock={updateBuilderBlock}
              />
            </section>
          </>
        ) : activeMode === "code" ? (
          <>
            <TemplateWorkspaceBar
              activeMode={activeMode}
              activeTemplateId={activeTemplateId}
              templateName={activeTemplateName}
              status={templateStatus}
              isSaving={isSavingTemplate}
              onModeChange={switchMode}
              onNameChange={setActiveTemplateName}
              onSave={saveCurrentTemplate}
              onOpenTemplates={() => switchMode("templates")}
            />
            <BuilderCodeWorkspace
              compileState={codeCompile}
              codeDraft={builderCodeDraft || builderMjml}
              html={codeCompile.html}
              importStatus={builderImportStatus}
              templateName={activeTemplateName}
              onBack={() => switchMode("mjml-builder")}
              onCodeChange={setBuilderCodeDraft}
              onImportCode={importBuilderCodeDraft}
              onSave={saveCurrentTemplate}
            />
          </>
        ) : activeMode === "preview" ? (
          <>
            <TemplateWorkspaceBar
              activeMode={activeMode}
              activeTemplateId={activeTemplateId}
              templateName={activeTemplateName}
              status={templateStatus}
              isSaving={isSavingTemplate}
              onModeChange={switchMode}
              onNameChange={setActiveTemplateName}
              onSave={saveCurrentTemplate}
              onOpenTemplates={() => switchMode("templates")}
            />
            <PreviewTestingWorkspace
              activeTemplateId={activeTemplateId}
              device={builderDevice}
              error={outputError}
              html={builderCompile.html}
              isCompiling={builderCompile.isCompiling}
              isSaving={isSavingTemplate}
              isSending={isSendingTestEmail}
              mergePreviewEnabled={mergePreviewEnabled}
              mjml={builderMjml}
              recipient={testEmailRecipient}
              status={testEmailStatus || templateStatus}
              testError={testEmailError}
              templateName={activeTemplateName}
              onBack={() => switchMode("mjml-builder")}
              onDeviceChange={setBuilderDevice}
              onRecipientChange={setTestEmailRecipient}
              onSave={saveCurrentTemplate}
              onSendTest={sendBuilderTestEmail}
              onToggleMergePreview={setMergePreviewEnabled}
            />
          </>
        ) : activeMode === "settings" ? (
          <>
            <TemplateWorkspaceBar
              activeMode={activeMode}
              activeTemplateId={activeTemplateId}
              templateName={activeTemplateName}
              status={templateStatus}
              isSaving={isSavingTemplate}
              onModeChange={switchMode}
              onNameChange={setActiveTemplateName}
              onSave={saveCurrentTemplate}
              onOpenTemplates={() => switchMode("templates")}
            />
            <TemplateSettingsWorkspace
              activeTemplateId={activeTemplateId}
              templateName={activeTemplateName}
              templates={savedTemplates}
              currentResult={successfulResult}
              onNameChange={setActiveTemplateName}
              onSave={saveCurrentTemplate}
              onExportJson={exportTemplateJson}
            />
          </>
        ) : (
          <>
            <TemplateWorkspaceBar
              activeMode={activeMode}
              activeTemplateId={activeTemplateId}
              templateName={activeTemplateName}
              status={templateStatus}
              isSaving={isSavingTemplate}
              onModeChange={switchMode}
              onNameChange={setActiveTemplateName}
              onSave={saveCurrentTemplate}
              onOpenTemplates={() => switchMode("templates")}
            />
            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[390px_minmax(0,1fr)] lg:overflow-hidden">
            <section className="w-full shrink-0 rounded-lg border border-line bg-white p-5 shadow-sm lg:overflow-y-auto">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  Nastaveni
                </p>
                <h1 className="mt-1 text-xl font-bold tracking-normal text-ink">
                  {form.templateId === "coupons-excel"
                    ? "Kupony z Excelu"
                    : "Brand AI generovani"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {form.templateId === "coupons-excel"
                    ? "Nahraj Excel, volitelnou MJML sablonu a nastav kontrolu vysledku."
                    : "Vyber ulozeny brand styl a jednim volnym zadanim popis sablonu."}
                </p>
              </div>

              {form.templateId === "ai" ? (
                <BrandStyleManager
                  activeStyleId={form.brandStyleId}
                  draft={brandStyleDraft}
                  error={brandStyleError}
                  isSaving={isSavingBrandStyle}
                  isUploading={isUploadingBrandAssets}
                  status={brandStyleStatus}
                  styles={brandStyles}
                  onDelete={deleteSelectedBrandStyle}
                  onDraftChange={setBrandStyleDraft}
                  onEdit={(style) => setBrandStyleDraft(createBrandStyleDraft(style))}
                  onNew={startNewBrandStyle}
                  onSave={saveBrandStyle}
                  onSelect={selectBrandStyle}
                  onUpload={uploadBrandAssets}
                />
              ) : null}

              {form.templateId === "coupons-excel" && activeSavedTemplate?.excelSource ? (
                <div className="mb-5 rounded-lg border border-line bg-panel p-4">
                  <h2 className="text-sm font-bold text-ink">Saved Excel source</h2>
                  <dl className="mt-3 grid gap-2 text-xs text-muted">
                    <div>
                      <dt className="font-semibold text-ink">Workbook</dt>
                      <dd>{activeSavedTemplate.excelSource.fileName || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">MJML template</dt>
                      <dd>{activeSavedTemplate.excelSource.templateFileName || "Default token template"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Month</dt>
                      <dd>{activeSavedTemplate.excelSource.month || "Automatic"}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    Original workbook bytes are not stored; upload a new Excel file to regenerate this template.
                  </p>
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                {form.templateId === "coupons-excel" ? (
                  <CouponInputs
                    form={form}
                    onUpdate={updateForm}
                    onCouponFile={setCouponFile}
                    onCouponTemplateFile={setCouponTemplateFile}
                  />
                ) : null}

                {form.templateId === "ai" ? (
                  <BrandGenerationInputs
                    activeStyle={activeBrandStyle}
                    form={form}
                    styles={brandStyles}
                    onSelectStyle={selectBrandStyle}
                    onUpdate={updateForm}
                  />
                ) : null}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      setForm((current) =>
                        form.templateId === "coupons-excel"
                          ? couponTemplateForm
                          : {
                              ...demoForm,
                              brandStyleId: current.brandStyleId
                            }
                      );
                      if (form.templateId !== "coupons-excel") {
                        setCouponFile(null);
                        setCouponTemplateFile(null);
                      }
                    }}
                  >
                    Vyplnit ukazku
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      (form.templateId === "ai" &&
                        (!form.brandStyleId || !form.prompt.trim()))
                    }
                    className={primaryButtonClass}
                  >
                    {isLoading ? "Generuji..." : "Vygenerovat"}
                  </button>
                </div>
              </form>
            </section>

            <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-line bg-white shadow-sm lg:overflow-hidden">
              <div className="border-b border-line p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      Vystup
                    </p>
                    <h2 className="mt-1 break-words text-xl font-bold text-ink">
                      {successfulResult?.subject || "Zatim neni vygenerovana sablona"}
                    </h2>
                    {successfulResult?.preheader ? (
                      <p className="mt-2 break-words text-sm leading-6 text-muted">
                        {successfulResult.preheader}
                      </p>
                    ) : null}
                    {outputError ? (
                      <p className="mt-2 break-words text-sm font-semibold text-red-700">
                        {outputError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {successfulResult ? (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={saveGeneratedResultAsTemplate}
                        disabled={isSavingTemplate}
                      >
                        {isSavingTemplate ? "Ukladam..." : "Ulozit jako sablonu"}
                      </button>
                    ) : null}
                    {(["preview", "mjml", "html", "issues"] as Tab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                          activeTab === tab
                            ? "bg-brand text-white"
                            : "border border-line bg-white text-ink hover:bg-surface"
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tabLabels[tab]}
                      </button>
                    ))}
                    <ExportSelect result={successfulResult} />
                  </div>
                </div>
              </div>

              <div className="min-h-[520px] flex-1 overflow-hidden p-5">
                {activeTab === "preview" ? (
                  <Preview html={successfulResult?.html} />
                ) : null}
                {activeTab === "mjml" ? (
                  <CodeBlock
                    code={successfulResult?.mjml}
                    empty="MJML kod se zobrazi po vygenerovani."
                    copyLabel="Kopirovat MJML"
                  />
                ) : null}
                {activeTab === "html" ? (
                  <CodeBlock
                    code={successfulResult?.html}
                    empty="HTML kod se zobrazi po kompilaci MJML."
                    copyLabel="Kopirovat HTML"
                  />
                ) : null}
                {activeTab === "issues" ? (
                  <Issues
                    error={outputError}
                    issues={issues}
                    notes={successfulResult?.notes || []}
                    usedVariables={successfulResult?.usedVariables || []}
                    selectedAiSuggestionIds={selectedAiSuggestionIds}
                    isApplyingAiSuggestions={isApplyingAiSuggestions}
                    onToggleAiSuggestion={toggleAiSuggestion}
                    onSelectAllAiSuggestions={selectAllAiSuggestions}
                    onClearAiSuggestions={clearSelectedAiSuggestions}
                    onApplyAiSuggestions={applySelectedAiSuggestions}
                    onApplyAllAiSuggestions={applyAllAiSuggestions}
                    onApplySingleAiSuggestion={applySingleAiSuggestion}
                  />
                ) : null}
              </div>
            </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function AppShell(props: {
  activeMode: TemplateMode;
  children: React.ReactNode;
  templateCount: number;
  onNavigate: (mode: TemplateMode) => void;
}) {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-40 border-b border-[#1f2937] bg-[#111827] text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-4 px-4">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3"
            onClick={() => props.onNavigate("dashboard")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-black text-white">
              MJ
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-sm font-bold">
                Email Platform
              </span>
              <span className="block truncate text-xs text-slate-300">
                Templates, MJML, Excel, AI
              </span>
            </span>
          </button>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Global navigation">
            {topNavigationItems.map((item) => {
              const isActive =
                props.activeMode === item.value ||
                (item.value === "templates" &&
                  ["new-template", "mjml-builder", "ai", "coupons-excel", "code", "preview", "settings"].includes(
                    props.activeMode
                  ));

              return (
                <button
                  key={item.value}
                  type="button"
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-[#111827]"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => props.onNavigate(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Help
            </button>
            <div className="rounded-md border border-white/15 px-3 py-2 text-xs text-slate-200">
              {props.templateCount} templates
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-[#111827]">
              IK
            </div>
          </div>
        </div>
      </header>
      {props.children}
    </main>
  );
}

function TemplateWorkspaceBar(props: {
  activeMode: TemplateMode;
  activeTemplateId: string | null;
  templateName: string;
  status: string;
  isSaving: boolean;
  onModeChange: (mode: TemplateMode) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onOpenTemplates: () => void;
}) {
  return (
    <section className="shrink-0 rounded-lg border border-line bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <button type="button" className="hover:text-brand-dark" onClick={props.onOpenTemplates}>
              Templates
            </button>
            <span>/</span>
            <span>{props.activeTemplateId || "new"}</span>
          </div>
          <input
            className="mt-1 h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xl font-bold text-ink outline-none focus:border-line focus:bg-panel"
            value={props.templateName}
            onChange={(event) => props.onNameChange(event.target.value)}
            aria-label="Template name"
          />
          {props.status ? <p className="mt-1 text-xs text-muted">{props.status}</p> : null}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid grid-cols-3 gap-1 sm:flex" role="tablist" aria-label="Template mode">
            {workspaceModes.map((mode) => {
              const isActive = props.activeMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`rounded-md px-3 py-2 text-left text-xs font-bold transition ${
                    isActive
                      ? "bg-brand text-white"
                      : "border border-line bg-white text-ink hover:bg-brand-soft"
                  }`}
                  onClick={() => props.onModeChange(mode.value)}
                >
                  <span className="block">{mode.label}</span>
                  <span className={`block text-[10px] ${isActive ? "text-white/80" : "text-muted"}`}>
                    {mode.description}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={props.isSaving}
            onClick={props.onSave}
          >
            {props.isSaving ? "Ukladam..." : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}

function DashboardPage(props: {
  templateCount: number;
  brandStyleCount: number;
  latestTemplates: SavedEmailTemplate[];
  onNewTemplate: () => void;
  onOpenTemplates: () => void;
  onOpenExcel: () => void;
  onOpenAi: () => void;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Internal workspace for MJML email templates, Excel assembly, AI generation, previews, and exports."
        actionLabel="New template"
        onAction={props.onNewTemplate}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Templates" value={props.templateCount} detail="Saved MJML records" />
        <MetricCard label="Brand styles" value={props.brandStyleCount} detail="Reusable visual profiles" />
        <MetricCard label="Pipeline" value="MJML" detail="Every HTML preview is compiled from MJML" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">Recent templates</h2>
              <p className="mt-1 text-sm text-muted">Open a saved template or continue in the Templates area.</p>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={props.onOpenTemplates}>
              View all
            </button>
          </div>
          <div className="mt-4 divide-y divide-line">
            {props.latestTemplates.length ? (
              props.latestTemplates.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{template.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {sourceTypeLabel(template)} - updated {new Date(template.updatedAt).toLocaleString("cs-CZ")}
                    </p>
                  </div>
                  <span className="rounded-md bg-brand-soft px-2 py-1 text-xs font-bold text-brand-dark">
                    {sourceTypeLabel(template)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-muted">No templates have been saved yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Quick actions</h2>
          <div className="mt-4 grid gap-2">
            <button type="button" className={primaryButtonClass} onClick={props.onNewTemplate}>
              Create template
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onOpenExcel}>
              Assemble from Excel
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onOpenAi}>
              Generate with AI
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function PageHeader(props: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {props.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-ink">{props.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{props.description}</p>
        </div>
        {props.actionLabel && props.onAction ? (
          <button type="button" className={primaryButtonClass} onClick={props.onAction}>
            {props.actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard(props: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-muted">{props.label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{props.value}</p>
      <p className="mt-1 text-xs text-muted">{props.detail}</p>
    </div>
  );
}

function NewTemplateFlow(props: {
  templates: SavedEmailTemplate[];
  onBack: () => void;
  onBlank: () => void;
  onBuilder: () => void;
  onAi: () => void;
  onExcel: () => void;
  onCode: () => void;
  onDuplicate: (template: SavedEmailTemplate) => void;
}) {
  const choices = [
    {
      title: "Blank template",
      description: "Start with an empty MJML builder workspace.",
      action: props.onBlank
    },
    {
      title: "Visual MJML builder",
      description: "Use content blocks, structures, settings, and preview.",
      action: props.onBuilder
    },
    {
      title: "AI generation",
      description: "Generate MJML from a brand style and a free-form prompt.",
      action: props.onAi
    },
    {
      title: "Excel assembly",
      description: "Upload Excel data and assemble a tokenized MJML email.",
      action: props.onExcel
    },
    {
      title: "Raw MJML code",
      description: "Write or paste MJML and compile it to HTML.",
      action: props.onCode
    }
  ];

  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        eyebrow="Templates"
        title="New template"
        description="Choose the workflow for this template. Every path saves into the same template library and uses the shared MJML-to-HTML pipeline."
      />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {choices.map((choice) => (
          <button
            key={choice.title}
            type="button"
            className="min-h-40 rounded-lg border border-line bg-white p-5 text-left shadow-sm transition hover:border-brand hover:bg-brand-soft"
            onClick={choice.action}
          >
            <span className="block text-base font-bold text-ink">{choice.title}</span>
            <span className="mt-2 block text-sm leading-6 text-muted">{choice.description}</span>
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Duplicate existing</h2>
            <p className="mt-1 text-sm text-muted">Use a saved template as a starting point.</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={props.onBack}>
            Back to templates
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.templates.length ? (
            props.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-md border border-line bg-panel p-3 text-left hover:border-brand hover:bg-white"
                onClick={() => props.onDuplicate(template)}
              >
                <span className="block truncate text-sm font-bold text-ink">{template.name}</span>
                <span className="mt-1 block text-xs text-muted">{sourceTypeLabel(template)}</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">No saved templates available yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function BrandStylesPage(props: React.ComponentProps<typeof BrandStyleManager>) {
  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        eyebrow="Brand styles"
        title="Brand Styles"
        description="Manage reusable brand profiles for AI generation, visual builder defaults, and Excel-assembled template styling."
      />
      <div className="mt-5 max-w-4xl">
        <BrandStyleManager {...props} />
      </div>
    </section>
  );
}

function PlaceholderPage(props: {
  mode: TemplateMode;
  onOpenTemplates: () => void;
}) {
  const titles: Record<string, string> = {
    campaigns: "Campaigns",
    contacts: "Contacts",
    reports: "Reports",
    automation: "Automation"
  };

  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        eyebrow="Platform"
        title={titles[props.mode] || "Coming soon"}
        description="This section is reserved for the wider internal email marketing platform. The Templates workspace is the functional area in this rebuild."
      />
      <div className="mt-5 rounded-lg border border-line bg-white p-8 text-center shadow-sm">
        <p className="text-base font-bold text-ink">Workflow placeholder</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
          Navigation is in place so the app behaves like one platform while template management remains the primary implemented workflow.
        </p>
        <button type="button" className={`${primaryButtonClass} mt-5`} onClick={props.onOpenTemplates}>
          Open Templates
        </button>
      </div>
    </section>
  );
}

function TemplateList(props: {
  activeTemplateId: string | null;
  isLoading: boolean;
  query: string;
  status: string;
  error: string;
  templates: SavedEmailTemplate[];
  onCreate: () => void;
  onDelete: (template: SavedEmailTemplate) => void;
  onDuplicate: (template: SavedEmailTemplate) => void;
  onExportJson: (template: SavedEmailTemplate) => void;
  onOpenBuilder: (template: SavedEmailTemplate) => void;
  onOpenCode: (template: SavedEmailTemplate) => void;
  onOpenExcel: (template: SavedEmailTemplate) => void;
  onOpenPreview: (template: SavedEmailTemplate) => void;
  onRefresh: () => void;
  onRename: (template: SavedEmailTemplate) => void;
  onSearch: (value: string) => void;
}) {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updated" | "name">("updated");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const filteredTemplates = useMemo(() => {
    const filtered =
      sourceFilter === "all"
        ? props.templates
        : props.templates.filter(
            (template) => sourceTypeLabel(template).toLowerCase() === sourceFilter
          );

    return [...filtered].sort((a, b) =>
      sortBy === "name"
        ? a.name.localeCompare(b.name, "cs")
        : b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [props.templates, sortBy, sourceFilter]);

  function toggleSelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Template management
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-ink">
              Templates
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Manage MJML templates from builder, AI, Excel assembly, and raw code in one library.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={props.onRefresh}
              disabled={props.isLoading}
            >
              Refresh
            </button>
            <button type="button" className={primaryButtonClass} onClick={props.onCreate}>
              New template
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-brand/20 bg-brand-soft p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-dark">Unified MJML workflow</h2>
              <p className="mt-1 text-sm leading-6 text-ink">
                Excel, AI, builder, code, preview, saving, and export all share the same MJML source and HTML compilation flow.
              </p>
            </div>
            {selectedIds.size ? (
              <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-brand-dark">
                {selectedIds.size} selected
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-center">
          <input
            className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={props.query}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Search by template name"
          />
          <select
            className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            aria-label="Filter templates"
          >
            <option value="all">All types</option>
            <option value="builder">Builder</option>
            <option value="ai">AI</option>
            <option value="excel">Excel</option>
            <option value="code">Code</option>
            <option value="imported">Imported</option>
          </select>
          <select
            className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as "updated" | "name")}
            aria-label="Sort templates"
          >
            <option value="updated">Updated date</option>
            <option value="name">Name</option>
          </select>
          <div className="text-sm text-muted">
            {props.isLoading ? "Loading..." : `${filteredTemplates.length} templates`}
          </div>
        </div>
      </div>

      {props.error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {props.error}
        </div>
      ) : null}
      {props.status ? (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          {props.status}
        </div>
      ) : null}

      {filteredTemplates.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              active={template.id === props.activeTemplateId}
              selected={selectedIds.has(template.id)}
              template={template}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
              onExportJson={props.onExportJson}
              onOpenBuilder={props.onOpenBuilder}
              onOpenCode={props.onOpenCode}
              onOpenExcel={props.onOpenExcel}
              onOpenPreview={props.onOpenPreview}
              onRename={props.onRename}
              onSelectedChange={toggleSelected}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-line bg-white p-8 text-center shadow-sm">
          <p className="text-base font-bold text-ink">No templates</p>
          <p className="mt-2 text-sm text-muted">
            Create a new template from blank, AI, Excel, builder, or raw MJML code.
          </p>
          <button type="button" className={`${primaryButtonClass} mt-4`} onClick={props.onCreate}>
            New template
          </button>
        </div>
      )}
    </section>
  );
}

function TemplateCard(props: {
  active: boolean;
  selected: boolean;
  template: SavedEmailTemplate;
  onDelete: (template: SavedEmailTemplate) => void;
  onDuplicate: (template: SavedEmailTemplate) => void;
  onExportJson: (template: SavedEmailTemplate) => void;
  onOpenBuilder: (template: SavedEmailTemplate) => void;
  onOpenCode: (template: SavedEmailTemplate) => void;
  onOpenExcel: (template: SavedEmailTemplate) => void;
  onOpenPreview: (template: SavedEmailTemplate) => void;
  onRename: (template: SavedEmailTemplate) => void;
  onSelectedChange: (id: string, selected: boolean) => void;
}) {
  const sourceLabel = sourceTypeLabel(props.template);
  const isExcelTemplate = sourceLabel === "Excel";

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-white shadow-sm ${
        props.active ? "border-brand ring-2 ring-brand/15" : "border-line"
      }`}
    >
      <div className="h-48 overflow-hidden border-b border-line bg-panel">
        {props.template.html ? (
          <iframe
            title={`${props.template.name} preview`}
            className="h-[768px] w-[600px] origin-top-left scale-[0.32] bg-white"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={props.template.html}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Bez nahledu
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <label className="mt-1 flex shrink-0 items-center">
            <input
              type="checkbox"
              checked={props.selected}
              onChange={(event) =>
                props.onSelectedChange(props.template.id, event.target.checked)
              }
              aria-label={`Select ${props.template.name}`}
              className="h-4 w-4 accent-brand"
            />
          </label>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-ink">{props.template.name}</h2>
            <p className="mt-1 text-xs text-muted">
              Updated {new Date(props.template.updatedAt).toLocaleString("cs-CZ")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded bg-brand-soft px-2 py-1 text-xs font-bold text-brand-dark">
              {sourceLabel}
            </span>
            {props.active ? (
              <span className="rounded bg-panel px-2 py-1 text-xs font-bold text-muted">
                open
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => props.onOpenBuilder(props.template)}
          >
            Builder
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => props.onOpenPreview(props.template)}
          >
            Preview
          </button>
          <ExportSelect
            result={{
              subject: props.template.name,
              html: props.template.html,
              mjml: props.template.mjml
            }}
            className="col-span-2"
          />
        </div>
        {props.template.excelSource?.fileName ? (
          <p className="mt-3 truncate rounded-md bg-panel px-2 py-1 text-xs text-muted">
            Excel: {props.template.excelSource.fileName}
          </p>
        ) : null}
        <details className="relative mt-3">
          <summary className="cursor-pointer rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface">
            Actions
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-md border border-line bg-white p-2 text-sm shadow-xl">
            <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onRename(props.template)}>
              Rename
            </button>
            <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onDuplicate(props.template)}>
              Duplicate
            </button>
            <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onOpenCode(props.template)}>
              Open code editor
            </button>
            {isExcelTemplate ? (
              <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onOpenExcel(props.template)}>
                Open Excel source
              </button>
            ) : null}
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left hover:bg-panel"
              onClick={() =>
                downloadTemplate(
                  {
                    subject: props.template.name,
                    html: props.template.html,
                    mjml: props.template.mjml
                  },
                  "html"
                )
              }
            >
              Download HTML
            </button>
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left hover:bg-panel"
              onClick={() =>
                downloadTemplate(
                  {
                    subject: props.template.name,
                    html: props.template.html,
                    mjml: props.template.mjml
                  },
                  "mjml"
                )
              }
            >
              Download MJML
            </button>
            <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onExportJson(props.template)}>
              Export JSON
            </button>
            <button type="button" className="rounded px-2 py-1.5 text-left text-muted hover:bg-panel" disabled>
              Export PDF unavailable
            </button>
          <button
            type="button"
              className="rounded px-2 py-1.5 text-left text-red-700 hover:bg-red-50"
            onClick={() => props.onDelete(props.template)}
          >
              Delete
          </button>
          </div>
        </details>
      </div>
    </article>
  );
}

function TemplateSettingsWorkspace(props: {
  activeTemplateId: string | null;
  templateName: string;
  templates: SavedEmailTemplate[];
  currentResult: ExportableTemplate | null;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onExportJson: (template: SavedEmailTemplate) => void;
}) {
  const savedTemplate = props.activeTemplateId
    ? props.templates.find((template) => template.id === props.activeTemplateId)
    : null;
  const currentResult = props.currentResult;

  return (
    <section className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Template settings
            </p>
            <h1 className="mt-1 text-xl font-bold text-ink">{props.templateName}</h1>
          </div>
          <TextInput
            label="Template name"
            value={props.templateName}
            onChange={props.onNameChange}
          />
          <div className="rounded-md border border-line bg-panel p-4">
            <h2 className="text-sm font-bold text-ink">Persistence metadata</h2>
            <dl className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2">
              <div>
                <dt className="font-semibold text-ink">Template ID</dt>
                <dd>{props.activeTemplateId || "Not saved"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Source</dt>
                <dd>{savedTemplate ? sourceTypeLabel(savedTemplate) : "Current workspace"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Created</dt>
                <dd>{savedTemplate ? new Date(savedTemplate.createdAt).toLocaleString("cs-CZ") : "Not saved"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Updated</dt>
                <dd>{savedTemplate ? new Date(savedTemplate.updatedAt).toLocaleString("cs-CZ") : "Not saved"}</dd>
              </div>
            </dl>
          </div>
          {savedTemplate?.excelSource ? (
            <div className="rounded-md border border-line bg-panel p-4">
              <h2 className="text-sm font-bold text-ink">Excel assembly source</h2>
              <dl className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2">
                <div>
                  <dt className="font-semibold text-ink">Workbook</dt>
                  <dd>{savedTemplate.excelSource.fileName || "Unknown"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Template file</dt>
                  <dd>{savedTemplate.excelSource.templateFileName || "Default MJML token template"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Month</dt>
                  <dd>{savedTemplate.excelSource.month || "Automatic"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Generated</dt>
                  <dd>{savedTemplate.excelSource.generatedAt ? new Date(savedTemplate.excelSource.generatedAt).toLocaleString("cs-CZ") : "Unknown"}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <button type="button" className={`${primaryButtonClass} w-full`} onClick={props.onSave}>
            Save settings
          </button>
          {currentResult ? (
            <>
              <button
                type="button"
                className={`${secondaryButtonClass} w-full`}
                onClick={() => downloadTemplate(currentResult, "html")}
              >
                Download HTML
              </button>
              <button
                type="button"
                className={`${secondaryButtonClass} w-full`}
                onClick={() => downloadTemplate(currentResult, "mjml")}
              >
                Download MJML
              </button>
            </>
          ) : null}
          {savedTemplate ? (
            <button
              type="button"
              className={`${secondaryButtonClass} w-full`}
              onClick={() => props.onExportJson(savedTemplate)}
            >
              Export JSON
            </button>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function BuilderCodeWorkspace(props: {
  compileState: BuilderCompileState;
  codeDraft: string;
  html: string;
  importStatus: string;
  templateName: string;
  onBack: () => void;
  onCodeChange: (value: string) => void;
  onImportCode: () => void;
  onSave: () => void;
}) {
  return (
    <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden">
      <div className="min-h-0 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Code / MJML editor
            </p>
            <h1 className="mt-1 text-xl font-bold text-ink">{props.templateName}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={props.onBack}>
              Zpet do builderu
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onImportCode}>
              Nacist do builderu
            </button>
            <button type="button" className={primaryButtonClass} onClick={props.onSave}>
              Ulozit
            </button>
          </div>
        </div>
        {props.importStatus ? (
          <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            {props.importStatus}
          </div>
        ) : null}
        <textarea
          className="mt-4 h-[calc(100vh-260px)] min-h-[520px] w-full resize-none rounded-lg border border-line bg-code p-4 font-mono text-xs leading-5 text-[#E6EDF7] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          value={props.codeDraft}
          onChange={(event) => props.onCodeChange(event.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="min-h-0 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Compiled HTML preview</h2>
          <span className={`rounded px-2 py-1 text-xs font-bold ${props.compileState.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {props.compileState.isCompiling ? "kompiluji" : props.compileState.error ? "chyba" : "validni"}
          </span>
        </div>
        <Preview html={props.html} />
      </div>
    </section>
  );
}

function applyMergeTagMocks(html: string) {
  const mocks: Record<string, string> = {
    first_name: "Jana",
    last_name: "Novakova",
    email: "jana.novakova@example.com"
  };

  return Object.entries(mocks).reduce(
    (current, [key, value]) =>
      current.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value),
    html
  );
}

function PreviewTestingWorkspace(props: {
  activeTemplateId: string | null;
  device: BuilderDevice;
  error?: string;
  html: string;
  isCompiling: boolean;
  isSaving: boolean;
  isSending: boolean;
  mergePreviewEnabled: boolean;
  mjml: string;
  recipient: string;
  status: string;
  testError: string;
  templateName: string;
  onBack: () => void;
  onDeviceChange: (device: BuilderDevice) => void;
  onRecipientChange: (value: string) => void;
  onSave: () => void;
  onSendTest: () => void;
  onToggleMergePreview: (enabled: boolean) => void;
}) {
  const previewHtml = props.mergePreviewEnabled ? applyMergeTagMocks(props.html) : props.html;
  const imageCount = (previewHtml.match(/<img\b/gi) || []).length;
  const textLength = previewHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Preview / testing
          </p>
          <h1 className="mt-1 text-xl font-bold text-ink">{props.templateName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClass} onClick={props.onBack}>
            Zpet do editoru
          </button>
          <button type="button" className={primaryButtonClass} onClick={props.onSave} disabled={props.isSaving}>
            {props.isSaving ? "Ukladam..." : "Ulozit"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 overflow-auto bg-[#2a2d33] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex gap-2">
              {(["desktop", "mobile"] as BuilderDevice[]).map((device) => (
                <button
                  key={device}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    props.device === device
                      ? "bg-white text-ink"
                      : "border border-white/20 bg-transparent text-white hover:bg-white/10"
                  }`}
                  onClick={() => props.onDeviceChange(device)}
                >
                  {device === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
              <input
                type="checkbox"
                checked={props.mergePreviewEnabled}
                onChange={(event) => props.onToggleMergePreview(event.target.checked)}
              />
              Merge preview
            </label>
          </div>
          <div
            className={`mx-auto bg-white shadow-2xl ${props.device === "mobile" ? "max-w-[390px]" : "max-w-[600px]"}`}
          >
            {previewHtml ? (
              <iframe
                title="Template preview"
                className="h-[calc(100vh-230px)] min-h-[680px] w-full bg-white"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="flex min-h-[680px] items-center justify-center text-sm text-muted">
                Preview se zobrazi po kompilaci MJML.
              </div>
            )}
          </div>
        </div>

        <aside className="min-h-0 overflow-auto border-l border-line bg-panel p-5">
          {props.error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {props.error}
            </div>
          ) : null}
          {props.status ? (
            <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              {props.status}
            </div>
          ) : null}
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="text-sm font-bold text-ink">Test e-mail</h2>
            <input
              className="mt-3 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={props.recipient}
              onChange={(event) => props.onRecipientChange(event.target.value)}
              placeholder="prijemce@example.com"
            />
            <button
              type="button"
              className={`${primaryButtonClass} mt-3 w-full`}
              disabled={props.isSending}
              onClick={props.onSendTest}
            >
              {props.isSending ? "Odesilam..." : "Odeslat test"}
            </button>
            {props.testError ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {props.testError}
              </p>
            ) : null}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-white p-4">
            <h2 className="text-sm font-bold text-ink">Kontroly</h2>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>Stav kompilace: {props.isCompiling ? "kompiluji" : props.error ? "chyba" : "hotovo"}</p>
              <p>Obrazky: {imageCount}</p>
              <p>Textove znaky: {textLength}</p>
              <p>Template ID: {props.activeTemplateId || "neulozeno"}</p>
              <p>MJML delka: {props.mjml.length} znaku</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function BuilderAppShell(props: {
  activeTab: Tab;
  activeTemplateId: string | null;
  activeTemplateName: string;
  blocks: BuilderBlock[];
  canRedo: boolean;
  canUndo: boolean;
  compileState: BuilderCompileState;
  error?: string;
  html: string;
  importStatus: string;
  isSaving: boolean;
  issues: ValidationIssue[];
  mjml: string;
  notes: string[];
  device: BuilderDevice;
  savedBlocks: BuilderBlock[];
  selectedBlockId: string;
  status: string;
  theme: BuilderTheme;
  usedVariables: string[];
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onAddSavedBlock: (block: BuilderBlock) => void;
  onDeleteBlock: (id: string) => void;
  onDeviceChange: (device: BuilderDevice) => void;
  onDropAt: BuilderDropHandler;
  onDuplicateBlock: (id: string) => void;
  onImportTemplate: (file: File) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onOpenPreview: () => void;
  onOpenTemplates: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onSaveReusableBlock: (id: string) => void;
  onSelectBlock: (id: string) => void;
  onSetActiveTab: (tab: Tab) => void;
  onClearImportStatus: () => void;
  onTemplateNameChange: (name: string) => void;
  onThemeChange: (theme: BuilderTheme) => void;
  onUndo: () => void;
  onUpdateBlock: (
    id: string,
    key: string,
    value: string,
    device?: BuilderDevice
  ) => void;
}) {
  const [canvasMode, setCanvasMode] = useState<"edit" | "preview">("edit");
  const [leftPanelTab, setLeftPanelTab] = useState<BuilderPanelTab>("blocks");
  const [builderDragState, setBuilderDragState] = useState<BuilderDragState>(null);
  const selectedBlock = findBuilderBlock(props.blocks, props.selectedBlockId) || undefined;
  const selectedDefinition = selectedBlock
    ? getBlockDefinition(selectedBlock.type)
    : null;
  const {
    onDeleteBlock,
    onDuplicateBlock,
    onMoveBlock,
    onRedo,
    onUndo,
    selectedBlockId
  } = props;

  function canDropBuilderDragAt(parentId?: string) {
    if (!builderDragState) {
      return true;
    }

    const parent = parentId ? findBuilderBlock(props.blocks, parentId) : null;
    if (parentId && !parent) {
      return false;
    }

    if (builderDragState.kind === "palette") {
      return canAcceptChildType(parent, builderDragState.type);
    }

    const draggedBlock = findBuilderBlock(props.blocks, builderDragState.id);
    if (!draggedBlock) {
      return false;
    }
    if (parentId && findBuilderBlock([draggedBlock], parentId)) {
      return false;
    }

    return canAcceptChildType(parent, draggedBlock.type);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isEditableTarget =
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";

      if (isEditableTarget) {
        return;
      }

      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      if (hasModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      if (hasModifier && key === "y") {
        event.preventDefault();
        onRedo();
        return;
      }

      if (hasModifier && (key === "d" || key === "c")) {
        event.preventDefault();
        if (selectedBlockId) {
          onDuplicateBlock(selectedBlockId);
        }
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedBlockId) {
        event.preventDefault();
        onDeleteBlock(selectedBlockId);
        return;
      }

      if (event.altKey && event.key === "ArrowUp" && selectedBlockId) {
        event.preventDefault();
        onMoveBlock(selectedBlockId, -1);
        return;
      }

      if (event.altKey && event.key === "ArrowDown" && selectedBlockId) {
        event.preventDefault();
        onMoveBlock(selectedBlockId, 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBlockId, onRedo, onUndo, onDuplicateBlock, onDeleteBlock, onMoveBlock]);

  const hasCompileErrors =
    Boolean(props.error) || props.issues.some((issue) => issue.type === "error");
  const saveStatusLabel = props.isSaving
    ? "Saving..."
    : props.compileState.isCompiling
      ? "Compiling..."
      : hasCompileErrors
        ? "Needs review"
        : "Ready";

  return (
    <div
      className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-lg border border-line bg-white text-ink shadow-sm"
      onDragEndCapture={() => setBuilderDragState(null)}
      onDropCapture={() => setBuilderDragState(null)}
    >
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-chrome-line bg-chrome px-4">
        <button
          type="button"
          className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
          onClick={props.onOpenTemplates}
        >
          Templates
        </button>

        <div className="min-w-0 flex-1">
          <input
            className="h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-sm font-bold text-ink outline-none transition focus:border-line focus:bg-white"
            value={props.activeTemplateName}
            onChange={(event) => props.onTemplateNameChange(event.target.value)}
            aria-label="Nazev sablony"
          />
          <p className="truncate text-xs text-muted">
            {props.activeTemplateId ? "Saved template" : "New template"} - {props.blocks.length} blocks - {saveStatusLabel}
          </p>
        </div>

        <div className="hidden items-center gap-1 rounded-md bg-surface p-1 xl:flex">
          <button
            type="button"
            className="rounded px-2 py-1 text-sm font-semibold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!props.canUndo}
            title="Undo / Ctrl+Z"
            onClick={props.onUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm font-semibold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!props.canRedo}
            title="Redo / Ctrl+Y"
            onClick={props.onRedo}
          >
            Redo
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-surface p-1">
          {(["desktop", "mobile"] as BuilderDevice[]).map((device) => (
            <button
              key={device}
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-bold transition ${
                props.device === device ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
              onClick={() => props.onDeviceChange(device)}
            >
              {device === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md bg-surface p-1">
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-bold transition ${
              canvasMode === "edit" && props.activeTab === "preview"
                ? "bg-white text-ink shadow-sm"
                : "text-muted"
            }`}
            onClick={() => {
              setCanvasMode("edit");
              props.onSetActiveTab("preview");
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-bold transition ${
              canvasMode === "preview" && props.activeTab === "preview"
                ? "bg-white text-ink shadow-sm"
                : "text-muted"
            }`}
            onClick={() => {
              setCanvasMode("preview");
              props.onSetActiveTab("preview");
            }}
          >
            Preview
          </button>
          {(["mjml", "html", "issues"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-bold transition ${
                props.activeTab === tab ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
              onClick={() => props.onSetActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="hidden rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface lg:inline-flex"
          onClick={props.onOpenPreview}
        >
          Test
        </button>
        <ExportSelect
          result={{ subject: "MJML builder", html: props.html, mjml: props.mjml }}
          className="w-28 px-2 py-2"
        />
        <button
          type="button"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          disabled={props.isSaving}
          onClick={props.onSave}
        >
          {props.isSaving ? "Saving..." : "Save"}
        </button>

        <details className="relative">
          <summary className="list-none rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface [&::-webkit-details-marker]:hidden">
            More
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-line bg-white p-2 shadow-xl">
            <label className="block cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-surface">
              Import MJML
              <input
                className="hidden"
                type="file"
                accept=".mjml"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    props.onImportTemplate(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface"
              onClick={() => {
                if (window.confirm("Opravdu chcete smazat vsechny bloky a obnovit vychozi nastaveni?")) {
                  props.onReset();
                }
              }}
            >
              Reset builder
            </button>
            <div
              className={`mt-2 rounded-md px-3 py-2 text-xs font-semibold ${
                hasCompileErrors ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {hasCompileErrors ? "Output has issues" : "MJML output valid"}
            </div>
          </div>
        </details>
      </header>

      {props.importStatus || props.status ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-2">
          <span className="min-w-0 flex-1 text-xs font-semibold text-muted">
            {props.importStatus || props.status}
          </span>
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-muted hover:bg-surface"
            onClick={props.onClearImportStatus}
            title="ZavrĂ­t"
          >
            âś•
          </button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 border-r border-chrome-line bg-panel">
          <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-col">
            <div className="grid grid-cols-3 gap-1 border-b border-chrome-line p-3">
              {(
                [
                  ["blocks", "Blocks"],
                  ["layout", "Layout"],
                  ["saved", "Saved"]
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-md px-2 py-2 text-xs font-bold transition ${
                    leftPanelTab === tab
                      ? "bg-brand text-white"
                      : "border border-line bg-white text-ink hover:bg-surface"
                  }`}
                  onClick={() => setLeftPanelTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {leftPanelTab === "blocks" ? (
                <ContentBlocksPanel
                  onDragPaletteEnd={() => setBuilderDragState(null)}
                  onDragPaletteStart={(type) =>
                    setBuilderDragState({ kind: "palette", type })
                  }
                  onAddBlock={props.onAddBlock}
                />
              ) : null}
              {leftPanelTab === "layout" ? (
                <StructurePanel
                  blocks={props.blocks}
                  canDropAt={canDropBuilderDragAt}
                  dragState={builderDragState}
                  selectedBlockId={props.selectedBlockId}
                  onAddBlock={props.onAddBlock}
                  onDragBlockEnd={() => setBuilderDragState(null)}
                  onDragBlockStart={(block) =>
                    setBuilderDragState({
                      kind: "block",
                      id: block.id,
                      type: block.type
                    })
                  }
                  onDragPaletteEnd={() => setBuilderDragState(null)}
                  onDragPaletteStart={(type) =>
                    setBuilderDragState({ kind: "palette", type })
                  }
                  onDropAt={props.onDropAt}
                  onSelectBlock={props.onSelectBlock}
                />
              ) : null}
              {leftPanelTab === "saved" ? (
                <SavedBlocksPanel
                  savedBlocks={props.savedBlocks}
                  onAddBlock={props.onAddBlock}
                  onAddSavedBlock={props.onAddSavedBlock}
                  onDragPaletteEnd={() => setBuilderDragState(null)}
                  onDragPaletteStart={(type) =>
                    setBuilderDragState({ kind: "palette", type })
                  }
                />
              ) : null}
            </div>
          </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 overflow-hidden">
          {props.activeTab === "preview" ? (
            <BuilderCanvas
              blocks={props.blocks}
              device={props.device}
              canDropAt={canDropBuilderDragAt}
              dragState={builderDragState}
              html={props.html}
              mode={canvasMode}
              selectedBlockId={props.selectedBlockId}
              theme={props.theme}
              onDragBlockEnd={() => setBuilderDragState(null)}
              onDragBlockStart={(block) =>
                setBuilderDragState({
                  kind: "block",
                  id: block.id,
                  type: block.type
                })
              }
              onDropAt={props.onDropAt}
              onSelectBlock={props.onSelectBlock}
            />
          ) : null}
          {props.activeTab === "mjml" ? (
            <div className="h-full p-5">
              <CodeBlock
                code={props.mjml}
                empty="MJML kod se zobrazi po sestaveni."
                copyLabel="Kopirovat MJML"
              />
            </div>
          ) : null}
          {props.activeTab === "html" ? (
            <div className="h-full p-5">
              <CodeBlock
                code={props.html}
                empty="HTML kod se zobrazi po kompilaci MJML."
                copyLabel="Kopirovat HTML"
              />
            </div>
          ) : null}
          {props.activeTab === "issues" ? (
            <div className="h-full p-5">
              <Issues
                error={props.error}
                issues={props.issues}
                notes={props.notes}
                usedVariables={props.usedVariables}
                selectedAiSuggestionIds={new Set()}
                isApplyingAiSuggestions={false}
              />
            </div>
          ) : null}
        </section>

        <aside className="min-h-0 border-l border-chrome-line bg-panel">
          <BuilderInspector
            block={selectedBlock}
            definition={selectedDefinition}
            device={props.device}
            theme={props.theme}
            onDeleteBlock={props.onDeleteBlock}
            onDuplicateBlock={props.onDuplicateBlock}
            onMoveBlock={props.onMoveBlock}
            onSaveReusableBlock={props.onSaveReusableBlock}
            onThemeChange={props.onThemeChange}
            onUpdateBlock={props.onUpdateBlock}
          />
        </aside>
      </div>
    </div>
  );
}

const basicContentBlockTypes: BuilderBlockType[] = [
  "text",
  "image",
  "button",
  "divider",
  "spacer",
  "social",
  "raw-html"
];

const prebuiltContentCategories: { label: string; types: BuilderBlockType[] }[] = [
  { label: "Reusable sections", types: ["header", "hero", "image-hero", "card", "quote", "coupon", "footer"] }
];

const structureBlockTypes: { label: string; description: string; type: BuilderBlockType }[] = [
  { label: "1 column", description: "Single full-width row", type: "section" },
  { label: "2 columns", description: "50 / 50", type: "two-column" },
  { label: "3 columns", description: "33 / 33 / 33", type: "three-column" },
  { label: "1/3 + 2/3", description: "Narrow / wide", type: "one-third-two-third" },
  { label: "2/3 + 1/3", description: "Wide / narrow", type: "two-third-one-third" }
];

const builderColumnLayoutTypes: BuilderBlockType[] = [
  "two-column",
  "three-column",
  "four-column",
  "one-third-two-third",
  "two-third-one-third"
];

function isBuilderColumnLayoutType(type: BuilderBlockType) {
  return builderColumnLayoutTypes.includes(type);
}

function getBuilderColumnLayoutGrid(type: BuilderBlockType, device: BuilderDevice, count: number) {
  if (device === "mobile") {
    return "1fr";
  }
  if (type === "one-third-two-third" && count === 2) {
    return "minmax(0, 1fr) minmax(0, 2fr)";
  }
  if (type === "two-third-one-third" && count === 2) {
    return "minmax(0, 2fr) minmax(0, 1fr)";
  }
  return `repeat(${Math.max(count, 1)}, minmax(0, 1fr))`;
}

function ContentBlocksPanel(props: {
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDragPaletteEnd: () => void;
  onDragPaletteStart: (type: BuilderBlockType) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Blocks</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Drag a block into the email or click to add it to the end.
        </p>
      </div>
      <BuilderBlockGrid
        types={basicContentBlockTypes}
        onAddBlock={props.onAddBlock}
        onDragEnd={props.onDragPaletteEnd}
        onDragStart={props.onDragPaletteStart}
      />
    </div>
  );
}

function SavedBlocksPanel(props: {
  savedBlocks: BuilderBlock[];
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onAddSavedBlock: (block: BuilderBlock) => void;
  onDragPaletteEnd: () => void;
  onDragPaletteStart: (type: BuilderBlockType) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-ink">Saved / Prebuilt</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Use reusable blocks or larger sections that are already supported by the MJML serializer.
        </p>
      </div>

      {props.savedBlocks.length ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Saved blocks
          </p>
          <div className="grid grid-cols-1 gap-2">
            {props.savedBlocks.map((block, index) => {
              const definition = getBlockDefinition(block.type);
              return (
                <button
                  key={`${block.id}-${index}`}
                  type="button"
                  className="rounded border border-line bg-white p-3 text-left text-xs transition hover:border-brand hover:bg-brand-soft"
                  onClick={() => props.onAddSavedBlock(block)}
                >
                  <span className="block font-bold text-ink">{definition.label}</span>
                  <span className="mt-1 block leading-4 text-muted">
                    Reusable block / {definition.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-line bg-white p-4 text-sm leading-6 text-muted">
          Select a block on the canvas and save it from the right panel to reuse it here.
        </div>
      )}

      {prebuiltContentCategories.map((category) => (
        <div key={category.label}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            {category.label}
          </p>
          <BuilderBlockGrid
            types={category.types}
            onAddBlock={props.onAddBlock}
            onDragEnd={props.onDragPaletteEnd}
            onDragStart={props.onDragPaletteStart}
          />
        </div>
      ))}
    </div>
  );
}
function StructurePanel(props: {
  blocks: BuilderBlock[];
  canDropAt: (parentId?: string) => boolean;
  dragState: BuilderDragState;
  selectedBlockId: string;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDragBlockEnd: () => void;
  onDragBlockStart: (block: BuilderBlock) => void;
  onDragPaletteEnd: () => void;
  onDragPaletteStart: (type: BuilderBlockType) => void;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-ink">Structure</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Add responsive MJML rows and manage the template tree.
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Layout rows
        </p>
        <div className="grid grid-cols-2 gap-2">
          {structureBlockTypes.map((item) => (
            <button
              key={item.type}
              type="button"
              draggable
              className="rounded border border-line bg-white p-3 text-left text-xs transition hover:border-brand hover:bg-brand-soft"
              onClick={() => props.onAddBlock(item.type)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(builderPaletteMime, item.type);
                props.onDragPaletteStart(item.type);
              }}
              onDragEnd={props.onDragPaletteEnd}
            >
              <span className="block font-bold text-ink">{item.label}</span>
              <span className="mt-1 block leading-4 text-muted">{item.description}</span>
            </button>
          ))}
        </div>
      </div>
      <details className="rounded-lg border border-line bg-white" open>
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-muted [&::-webkit-details-marker]:hidden">
          Current structure
        </summary>
        <div className="border-t border-line p-2">
          <BuilderTreePanel
            blocks={props.blocks}
            canDropAt={props.canDropAt}
            dragState={props.dragState}
            selectedBlockId={props.selectedBlockId}
            onAddBlock={props.onAddBlock}
            onDragBlockEnd={props.onDragBlockEnd}
            onDragBlockStart={props.onDragBlockStart}
            onDropAt={props.onDropAt}
            onSelectBlock={props.onSelectBlock}
          />
        </div>
      </details>
    </div>
  );
}

function BuilderBlockGrid(props: {
  types: BuilderBlockType[];
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDragEnd: () => void;
  onDragStart: (type: BuilderBlockType) => void;
}) {
  const defs = props.types
    .map((type) => builderBlockDefinitions.find((definition) => definition.type === type))
    .filter(Boolean) as typeof builderBlockDefinitions;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {defs.map((definition) => (
        <button
          key={definition.type}
          type="button"
          draggable
          className="min-h-12 rounded border border-[#d9dde5] bg-white p-2 text-left text-xs font-semibold text-ink transition hover:border-[#6D5EF5] hover:bg-[#F4F2FF]"
          onClick={() => props.onAddBlock(definition.type)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData(builderPaletteMime, definition.type);
            props.onDragStart(definition.type);
          }}
          onDragEnd={props.onDragEnd}
          title={definition.description}
        >
          <span className="block">{definition.label}</span>
          <span className="mt-1 block text-[11px] font-normal leading-4 text-muted">
            {definition.description.length > 40
              ? definition.description.slice(0, 38) + "..."
              : definition.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function BuilderTreePanel(props: {
  blocks: BuilderBlock[];
  canDropAt: (parentId?: string) => boolean;
  dragState: BuilderDragState;
  selectedBlockId: string;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDragBlockEnd: () => void;
  onDragBlockStart: (block: BuilderBlock) => void;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  const [openAddTargetId, setOpenAddTargetId] = useState<string | "body" | null>(null);
  const [dropPreview, setDropPreview] = useState<BuilderDropPreview>(null);
  const visibleDropPreview = props.dragState ? dropPreview : null;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-[#d9dde5] bg-white">
        <div
          className="flex items-center gap-2 border-b border-[#e8ebf0] px-3 py-2"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = props.canDropAt()
              ? getBuilderDropEffect(event)
              : "none";
          }}
          onDrop={(event) => {
            setDropPreview(null);
            if (!props.canDropAt()) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            props.onDropAt(event, props.blocks.length);
          }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#E9F8F0] text-xs font-bold text-[#0F6F47]">
            B
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">Body</p>
            <p className="text-xs text-muted">{props.blocks.length} bloku</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-dashed border-[#17935E] px-2 py-1 text-xs font-bold text-[#0F6F47] hover:bg-[#E9F8F0]"
            onClick={() =>
              setOpenAddTargetId(openAddTargetId === "body" ? null : "body")
            }
            title="Pridat blok do body"
          >
            +
          </button>
        </div>
        {openAddTargetId === "body" ? (
          <BuilderAddMenu
            parentId={null}
            types={builderRootBlockTypes}
            onAddBlock={props.onAddBlock}
            onClose={() => setOpenAddTargetId(null)}
          />
        ) : null}
        <div className="p-2">
          <BuilderTreeList
            blocks={props.blocks}
            canDropAt={props.canDropAt}
            dropPreview={visibleDropPreview}
            depth={0}
            dragState={props.dragState}
            openAddTargetId={openAddTargetId}
            selectedBlockId={props.selectedBlockId}
            onAddBlock={props.onAddBlock}
            onDragBlockEnd={props.onDragBlockEnd}
            onDragBlockStart={props.onDragBlockStart}
            onDropAt={props.onDropAt}
            onDropPreview={setDropPreview}
            onOpenAddTarget={setOpenAddTargetId}
            onSelectBlock={props.onSelectBlock}
          />
        </div>
      </div>
    </div>
  );
}

function BuilderTreeList(props: {
  blocks: BuilderBlock[];
  canDropAt: (parentId?: string) => boolean;
  dropPreview: BuilderDropPreview;
  depth: number;
  dragState: BuilderDragState;
  openAddTargetId: string | "body" | null;
  parentId?: string;
  selectedBlockId: string;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDragBlockEnd: () => void;
  onDragBlockStart: (block: BuilderBlock) => void;
  onDropAt: BuilderDropHandler;
  onDropPreview: (preview: BuilderDropPreview) => void;
  onOpenAddTarget: (id: string | "body" | null) => void;
  onSelectBlock: (id: string) => void;
}) {
  if (props.blocks.length === 0) {
    return (
      <BuilderDropZone
        index={0}
        label={props.parentId ? "Pustit dovnitr" : "Pustit do body"}
        large
        canDrop={props.canDropAt(props.parentId)}
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
    );
  }

  return (
    <div className="space-y-1">
      {props.blocks.map((block, index) => {
        const definition = getBlockDefinition(block.type);
        const isSelected = block.id === props.selectedBlockId;
        const canHaveChildren = Boolean(definition.acceptsChildren);
        const canDropAsSibling = props.canDropAt(props.parentId);
        const canDropInsideBlock = canHaveChildren && props.canDropAt(block.id);
        const childCount = block.children?.length || 0;
        const dropPosition =
          props.dropPreview?.blockId === block.id ? props.dropPreview.position : null;

        return (
          <div key={block.id}>
            <BuilderDropZone
              index={index}
              label="Pustit nad"
              canDrop={canDropAsSibling}
              parentId={props.parentId}
              onDropAt={props.onDropAt}
            />
            <div
              draggable
              className={`group relative flex cursor-grab items-center gap-2 rounded-md border px-2 py-2 active:cursor-grabbing ${
                isSelected
                  ? "border-[#17935E] bg-[#E9F8F0] ring-2 ring-[#17935E]/15"
                  : "border-transparent bg-white hover:border-line hover:bg-[#F8FAFC]"
              } ${dropPosition === "inside" ? "ring-2 ring-[#17935E]/40" : ""}`}
              style={{ marginLeft: props.depth * 16 }}
              onClick={() => props.onSelectBlock(block.id)}
              onDragStart={(event) => {
                props.onSelectBlock(block.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(builderBlockMime, block.id);
                props.onDragBlockStart(block);
              }}
              onDragEnd={props.onDragBlockEnd}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const canDropOnBlock = canDropAsSibling || canDropInsideBlock;
                event.dataTransfer.dropEffect = canDropOnBlock
                  ? getBuilderDropEffect(event)
                  : "none";
                if (!canDropOnBlock) {
                  props.onDropPreview(null);
                  return;
                }
                props.onDropPreview({
                  blockId: block.id,
                  position: getBlockDropPosition(event, canDropInsideBlock)
                });
              }}
              onDragLeave={(event) => {
                event.stopPropagation();
                if (isLeavingDropTarget(event)) {
                  props.onDropPreview(null);
                }
              }}
              onDrop={(event) => {
                event.stopPropagation();
                const canDropOnBlock = canDropAsSibling || canDropInsideBlock;
                if (!canDropOnBlock) {
                  event.preventDefault();
                  props.onDropPreview(null);
                  return;
                }

                const position = getBlockDropPosition(event, canDropInsideBlock);
                props.onDropPreview(null);

                if (position === "inside" && canDropInsideBlock) {
                  props.onDropAt(event, childCount, block.id);
                  return;
                }

                if (!canDropAsSibling) {
                  event.preventDefault();
                  return;
                }

                props.onDropAt(
                  event,
                  position === "before" ? index : index + 1,
                  props.parentId
                );
              }}
            >
              {dropPosition ? <BuilderDropIndicator position={dropPosition} /> : null}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                  canHaveChildren
                    ? "bg-[#F4F2FF] text-[#5B4AEF]"
                    : "bg-[#F1F5F9] text-muted"
                }`}
              >
                {canHaveChildren ? "â–ľ" : "â€˘"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {definition.label}
                </p>
                <p className="truncate text-xs text-muted">
                  {definition.type}
                  {canHaveChildren ? ` / ${childCount} uvnitr` : ""}
                </p>
              </div>
              {canHaveChildren ? (
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-dashed border-[#17935E] px-2 py-1 text-xs font-bold text-[#0F6F47] opacity-100 hover:bg-[#E9F8F0] md:opacity-0 md:group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onOpenAddTarget(
                      props.openAddTargetId === block.id ? null : block.id
                    );
                  }}
                  title={`Pridat do ${definition.label}`}
                >
                  +
                </button>
              ) : null}
            </div>
            {canHaveChildren && props.openAddTargetId === block.id ? (
              <div style={{ marginLeft: props.depth * 16 + 28 }}>
                <BuilderAddMenu
                  parentId={block.id}
                  types={definition.childTypes || []}
                  onAddBlock={props.onAddBlock}
                  onClose={() => props.onOpenAddTarget(null)}
                />
              </div>
            ) : null}
            {canHaveChildren ? (
              <div
                className="border-l border-dashed border-[#cfd6df] pl-2"
                style={{ marginLeft: props.depth * 16 + 10 }}
              >
                <BuilderTreeList
                  {...props}
                  blocks={block.children || []}
                  dropPreview={props.dropPreview}
                  depth={props.depth + 1}
                  parentId={block.id}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      <BuilderDropZone
        index={props.blocks.length}
        label={props.parentId ? "Pustit dovnitr" : "Pustit na konec body"}
        canDrop={props.canDropAt(props.parentId)}
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
    </div>
  );
}

function BuilderDropIndicator({ position }: { position: BuilderDropPosition }) {
  const label =
    position === "before" ? "Nad" : position === "after" ? "Pod" : "Dovnitr";

  if (position === "inside") {
    return (
      <span className="pointer-events-none absolute inset-0 z-10 rounded-md border-2 border-dashed border-[#17935E] bg-[#E9F8F0]/45">
        <span className="absolute right-2 top-1 rounded bg-[#17935E] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          {label}
        </span>
      </span>
    );
  }

  return (
    <>
      <span
        className={`pointer-events-none absolute left-0 right-0 z-10 h-0.5 bg-[#17935E] ${
          position === "before" ? "-top-1" : "-bottom-1"
        }`}
      />
      <span
        className={`pointer-events-none absolute right-2 z-10 rounded bg-[#17935E] px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
          position === "before" ? "-top-3" : "-bottom-3"
        }`}
      >
        {label}
      </span>
    </>
  );
}

function BuilderAddMenu(props: {
  parentId: string | null;
  types: BuilderBlockType[];
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onClose: () => void;
}) {
  const types = props.types.length ? props.types : builderRootBlockTypes;

  return (
    <div className="my-2 rounded-md border border-[#d9dde5] bg-[#fbfbfc] p-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
          Pridat prvek
        </p>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-xs font-bold text-muted hover:bg-white"
          onClick={props.onClose}
        >
          x
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {types.map((type) => {
          const definition = getBlockDefinition(type);
          return (
            <button
              key={type}
              type="button"
              draggable
              className="rounded border border-line bg-white px-2 py-1.5 text-left text-xs font-semibold text-ink transition hover:border-[#17935E] hover:bg-[#E9F8F0]"
              onClick={() => {
                props.onAddBlock(type, props.parentId);
                props.onClose();
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(builderPaletteMime, type);
              }}
              title={definition.description}
            >
              {definition.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BuilderThemePanel(props: {
  theme: BuilderTheme;
  onThemeChange: (theme: BuilderTheme) => void;
}) {
  function updateTheme<K extends keyof BuilderTheme>(key: K, value: BuilderTheme[K]) {
    props.onThemeChange({ ...props.theme, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Global email</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Defaults used by new sections, blocks, preview, and export.
        </p>
      </div>

      <TextInput
        label="Email width"
        value={props.theme.width}
        onChange={(value) => updateTheme("width", value)}
        placeholder="600px"
      />
      <label className="block">
        <span className="text-sm font-semibold text-ink">Default font</span>
        <select
          className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
          value={props.theme.fontFamily}
          onChange={(event) => updateTheme("fontFamily", event.target.value)}
        >
          {builderFontOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        label="Preheader text"
        value={props.theme.previewText}
        onChange={(value) => updateTheme("previewText", value)}
        placeholder="Short inbox preview text"
      />

      <div className="grid grid-cols-2 gap-3">
        <ColorInput
          label="Page background"
          value={props.theme.bodyBackground}
          onChange={(value) => updateTheme("bodyBackground", value)}
        />
        <ColorInput
          label="Section background"
          value={props.theme.sectionBackground}
          onChange={(value) => updateTheme("sectionBackground", value)}
        />
        <ColorInput
          label="Text color"
          value={props.theme.textColor}
          onChange={(value) => updateTheme("textColor", value)}
        />
        <ColorInput
          label="Link color"
          value={props.theme.linkColor}
          onChange={(value) => updateTheme("linkColor", value)}
        />
        <ColorInput
          label="Button color"
          value={props.theme.buttonBackground}
          onChange={(value) => updateTheme("buttonBackground", value)}
        />
        <ColorInput
          label="Button text"
          value={props.theme.buttonText}
          onChange={(value) => updateTheme("buttonText", value)}
        />
      </div>

      <TextInput
        label="Default section padding"
        value={props.theme.defaultSectionPadding}
        onChange={(value) => updateTheme("defaultSectionPadding", value)}
        placeholder="24px 30px"
      />
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Text size"
          value={props.theme.defaultTextSize}
          onChange={(value) => updateTheme("defaultTextSize", value)}
          placeholder="16px"
        />
        <TextInput
          label="Line height"
          value={props.theme.defaultLineHeight}
          onChange={(value) => updateTheme("defaultLineHeight", value)}
          placeholder="24px"
        />
      </div>

      <details className="rounded-md border border-line bg-white p-3">
        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.08em] text-muted [&::-webkit-details-marker]:hidden">
          Advanced email settings
        </summary>
        <div className="mt-3 space-y-3">
          <TextInput
            label="MJML title"
            value={props.theme.headTitle}
            onChange={(value) => updateTheme("headTitle", value)}
            placeholder="Internal email"
          />
          <TextInput
            label="Mobile breakpoint"
            value={props.theme.breakpoint}
            onChange={(value) => updateTheme("breakpoint", value)}
            placeholder="480px"
          />
          <CodeArea
            label="mj-all attributes"
            value={props.theme.globalAttributes}
            onChange={(value) => updateTheme("globalAttributes", value)}
            help='Use only MJML attributes, for example font-family="Arial, sans-serif" color="#172033".'
          />
        </div>
      </details>
    </div>
  );
}
function BuilderCanvas(props: {
  blocks: BuilderBlock[];
  canDropAt: (parentId?: string) => boolean;
  device: BuilderDevice;
  dragState: BuilderDragState;
  html: string;
  mode: "edit" | "preview";
  selectedBlockId: string;
  theme: BuilderTheme;
  onDragBlockEnd: () => void;
  onDragBlockStart: (block: BuilderBlock) => void;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  const [dropPreview, setDropPreview] = useState<BuilderDropPreview>(null);
  const visibleDropPreview = props.dragState ? dropPreview : null;

  return (
    <div
        className="builder-checkerboard h-full min-h-0 overflow-auto p-6"
        onDragOver={(event) => {
          if (props.mode !== "edit") {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = props.canDropAt()
            ? getBuilderDropEffect(event)
            : "none";
        }}
        onDrop={(event) => {
          if (props.mode !== "edit") {
            return;
          }
          setDropPreview(null);
          if (!props.canDropAt()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          props.onDropAt(event, props.blocks.length);
        }}
      >
        <div
          className={`relative mx-auto bg-white shadow-xl transition-all ${
            props.device === "mobile" ? "max-w-[390px]" : "max-w-[600px]"
          }`}
          style={{
            background: props.theme.bodyBackground || "#ffffff",
            fontFamily: props.theme.fontFamily
          }}
        >
          <span className="absolute -right-12 top-3 rounded bg-[#777d89] px-2 py-1 text-xs font-bold text-white">
            {props.device === "mobile" ? "390px" : "600px"}
          </span>
          {props.mode === "preview" && props.html ? (
            <iframe
              title="Compiled email preview"
              className="h-[calc(100vh-116px)] min-h-[720px] w-full bg-white"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={props.html}
            />
          ) : props.blocks.length ? (
            <div className="min-h-[560px] overflow-hidden rounded-lg">
              <CanvasBlockList
                blocks={props.blocks}
                canDropAt={props.canDropAt}
                device={props.device}
                dragState={props.dragState}
                dropPreview={visibleDropPreview}
                selectedBlockId={props.selectedBlockId}
                theme={props.theme}
                onDragBlockEnd={props.onDragBlockEnd}
                onDragBlockStart={props.onDragBlockStart}
                onDropAt={props.onDropAt}
                onDropPreview={setDropPreview}
                onSelectBlock={props.onSelectBlock}
              />
            </div>
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E9F8F0] text-3xl text-[#17935E]">
                +
              </div>
              <div>
                <p className="text-base font-bold text-ink">Canvas is empty</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Drag a block or layout from the left panel to start the email.
                </p>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

function CanvasBlockList(props: {
  blocks: BuilderBlock[];
  canDropAt: (parentId?: string) => boolean;
  device: BuilderDevice;
  dragState: BuilderDragState;
  dropPreview: BuilderDropPreview;
  parentId?: string;
  selectedBlockId: string;
  theme: BuilderTheme;
  onDragBlockEnd: () => void;
  onDragBlockStart: (block: BuilderBlock) => void;
  onDropAt: BuilderDropHandler;
  onDropPreview: (preview: BuilderDropPreview) => void;
  onSelectBlock: (id: string) => void;
}) {
  if (props.blocks.length === 0) {
    return (
      <BuilderDropZone
        index={0}
        label={props.parentId ? "Pretahni dovnitr" : "Pretahni do body"}
        large
        canDrop={props.canDropAt(props.parentId)}
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
    );
  }

  return (
    <>
      <BuilderDropZone
        index={0}
        label="Pustit nad"
        canDrop={props.canDropAt(props.parentId)}
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
      {props.blocks.map((block, index) => (
        <div key={block.id}>
          <InteractiveCanvasBlock
            block={block}
            canDropAt={props.canDropAt}
            device={props.device}
            dragState={props.dragState}
            dropPreview={props.dropPreview}
            index={index}
            parentId={props.parentId}
            selectedBlockId={props.selectedBlockId}
            theme={props.theme}
            onDragBlockEnd={props.onDragBlockEnd}
            onDragBlockStart={props.onDragBlockStart}
            onDropAt={props.onDropAt}
            onDropPreview={props.onDropPreview}
            onSelectBlock={props.onSelectBlock}
          />
          <BuilderDropZone
            index={index + 1}
            label="Pustit pod"
            canDrop={props.canDropAt(props.parentId)}
            parentId={props.parentId}
            onDropAt={props.onDropAt}
          />
        </div>
      ))}
    </>
  );
}

function InteractiveCanvasBlock(props: {
  block: BuilderBlock;
  canDropAt: (parentId?: string) => boolean;
  device: BuilderDevice;
  dragState: BuilderDragState;
  dropPreview: BuilderDropPreview;
  index: number;
  parentId?: string;
  selectedBlockId: string;
  theme: BuilderTheme;
  onDragBlockEnd: () => void;
  onDragBlockStart: (block: BuilderBlock) => void;
  onDropAt: BuilderDropHandler;
  onDropPreview: (preview: BuilderDropPreview) => void;
  onSelectBlock: (id: string) => void;
}) {
  const definition = getBlockDefinition(props.block.type);
  const p = getBuilderBlockProps(props.block, props.device);
  const isSelected = props.block.id === props.selectedBlockId;
  const canHaveChildren = Boolean(definition.acceptsChildren);
  const canDropAsSibling = props.canDropAt(props.parentId);
  const canDropInsideBlock = canHaveChildren && props.canDropAt(props.block.id);
  const dropPosition =
    props.dropPreview?.blockId === props.block.id ? props.dropPreview.position : null;
  const dropClass =
    dropPosition === "before"
      ? "shadow-[0_-3px_0_#17935E]"
      : dropPosition === "after"
        ? "shadow-[0_3px_0_#17935E]"
        : dropPosition === "inside"
          ? "ring-2 ring-[#17935E]/45"
          : "";
  const shellClass = `group relative cursor-pointer transition ${
    isSelected
      ? "builder-selected-block z-10 outline outline-2 outline-[#17935E] ring-4 ring-[#17935E]/20"
      : "outline outline-1 outline-transparent hover:outline-[#17935E]/40"
  } ${dropClass}`;
  const selectProps = {
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      event.stopPropagation();
      props.onSelectBlock(props.block.id);
    },
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      props.onSelectBlock(props.block.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(builderBlockMime, props.block.id);
      props.onDragBlockStart(props.block);
    },
    onDragEnd: props.onDragBlockEnd,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const canDropOnBlock = canDropAsSibling || canDropInsideBlock;
      event.dataTransfer.dropEffect = canDropOnBlock
        ? getBuilderDropEffect(event)
        : "none";
      if (!canDropOnBlock) {
        props.onDropPreview(null);
        return;
      }
      props.onDropPreview({
        blockId: props.block.id,
        position: getBlockDropPosition(event, canDropInsideBlock)
      });
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      if (isLeavingDropTarget(event)) {
        props.onDropPreview(null);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      const canDropOnBlock = canDropAsSibling || canDropInsideBlock;
      if (!canDropOnBlock) {
        event.preventDefault();
        props.onDropPreview(null);
        return;
      }

      const position = getBlockDropPosition(event, canDropInsideBlock);
      props.onDropPreview(null);

      if (position === "inside" && canDropInsideBlock) {
        props.onDropAt(event, props.block.children?.length || 0, props.block.id);
        return;
      }

      if (!canDropAsSibling) {
        event.preventDefault();
        return;
      }

      props.onDropAt(
        event,
        position === "before" ? props.index : props.index + 1,
        props.parentId
      );
    }
  };

  if (isBuilderColumnLayoutType(props.block.type)) {
    const columns = (props.block.children || []).filter((child) => child.type === "column");

    if (columns.length) {
      return (
        <section
          {...selectProps}
          className={`${shellClass} grid gap-4 p-5`}
          style={{
            background: p.backgroundColor || props.theme.sectionBackground,
            gridTemplateColumns: getBuilderColumnLayoutGrid(
              props.block.type,
              props.device,
              columns.length
            ),
            padding: p.padding || props.theme.defaultSectionPadding
          }}
        >
          {dropPosition ? <BuilderDropIndicator position={dropPosition} /> : null}
          <CanvasBlockLabel label={definition.label} />
          {columns.map((columnBlock, columnIndex) => {
            const columnProps = getBuilderBlockProps(columnBlock, props.device);
            const isColumnSelected = columnBlock.id === props.selectedBlockId;

            return (
              <div
                key={columnBlock.id}
                draggable
                className={`group/column min-h-32 rounded-md border border-dashed p-2 transition ${
                  isColumnSelected
                    ? "border-[#17935E] bg-[#E9F8F0]/50 ring-2 ring-[#17935E]/20"
                    : "border-[#d9dde5] bg-white/70 hover:border-[#17935E]/50"
                }`}
                style={{
                  background: columnProps.backgroundColor || "rgba(255,255,255,0.72)",
                  padding: columnProps.padding || "8px"
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onSelectBlock(columnBlock.id);
                }}
                onDragStart={(event) => {
                  props.onSelectBlock(columnBlock.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(builderBlockMime, columnBlock.id);
                  props.onDragBlockStart(columnBlock);
                }}
                onDragEnd={props.onDragBlockEnd}
              >
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-muted opacity-70 group-hover/column:opacity-100">
                  <span>Column {columnIndex + 1}</span>
                  <span>{columnProps.width || ""}</span>
                </div>
                <CanvasBlockList
                  blocks={columnBlock.children || []}
                  canDropAt={props.canDropAt}
                  device={props.device}
                  dragState={props.dragState}
                  dropPreview={props.dropPreview}
                  parentId={columnBlock.id}
                  selectedBlockId={props.selectedBlockId}
                  theme={props.theme}
                  onDragBlockEnd={props.onDragBlockEnd}
                  onDragBlockStart={props.onDragBlockStart}
                  onDropAt={props.onDropAt}
                  onDropPreview={props.onDropPreview}
                  onSelectBlock={props.onSelectBlock}
                />
              </div>
            );
          })}
        </section>
      );
    }
  }

  if (canHaveChildren && !isBuilderColumnLayoutType(props.block.type)) {
    const isHero = props.block.type === "image-hero";
    const style: CSSProperties = isHero
      ? {
          minHeight: p.height || "320px",
          backgroundColor: p.backgroundColor || "#1F2937",
          backgroundImage: p.backgroundUrl ? `url(${p.backgroundUrl})` : undefined,
          backgroundPosition: p.backgroundPosition || "center center",
          backgroundSize: p.backgroundSize || "cover",
          color: p.textColor || "#ffffff",
          padding: p.padding || "40px 30px"
        }
      : {
          backgroundColor: p.backgroundColor || props.theme.sectionBackground,
          backgroundImage: p.backgroundUrl ? `url(${p.backgroundUrl})` : undefined,
          backgroundPosition: "center center",
          backgroundSize: "cover",
          padding: p.padding || props.theme.defaultSectionPadding
        };

    return (
      <section
        {...selectProps}
        className={`${shellClass} flex flex-col`}
        style={style}
      >
        {dropPosition ? <BuilderDropIndicator position={dropPosition} /> : null}
        <CanvasBlockLabel label={definition.label} />
        <CanvasBlockList
          blocks={props.block.children || []}
          canDropAt={props.canDropAt}
          device={props.device}
          dragState={props.dragState}
          dropPreview={props.dropPreview}
          parentId={props.block.id}
          selectedBlockId={props.selectedBlockId}
          theme={props.theme}
          onDragBlockEnd={props.onDragBlockEnd}
          onDragBlockStart={props.onDragBlockStart}
          onDropAt={props.onDropAt}
          onDropPreview={props.onDropPreview}
          onSelectBlock={props.onSelectBlock}
        />
      </section>
    );
  }

  if (props.block.type === "text") {
    return (
      <div
        {...selectProps}
        className={shellClass}
        style={{
          background: p.backgroundColor || "transparent",
          boxSizing: "border-box",
          color: p.textColor || props.theme.textColor,
          fontFamily: p.fontFamily || props.theme.fontFamily,
          fontSize: p.fontSize || props.theme.defaultTextSize,
          fontWeight: p.fontWeight || props.theme.defaultFontWeight || "400",
          lineHeight: p.lineHeight || props.theme.defaultLineHeight,
          padding: p.padding || "24px 30px",
          textAlign: (p.align as CSSProperties["textAlign"]) || "left"
        }}
      >
        <CanvasBlockLabel label={definition.label} />
        {p.text || "Text"}
      </div>
    );
  }

  if (props.block.type === "button") {
    return (
      <div
        {...selectProps}
        className={`${shellClass} py-1`}
        style={{ textAlign: (p.align as CSSProperties["textAlign"]) || "center" }}
      >
        <CanvasBlockLabel label={definition.label} />
        <span
          className="inline-block font-semibold"
          style={{
            background: p.backgroundColor || props.theme.buttonBackground,
            borderRadius: p.borderRadius || "8px",
            color: p.textColor || props.theme.buttonText,
            fontFamily: p.fontFamily || props.theme.fontFamily,
            fontWeight: p.fontWeight || "700",
            padding: p.innerPadding || "12px 24px"
          }}
        >
          {p.label || "Button"}
        </span>
      </div>
    );
  }

  if (props.block.type === "image" || props.block.type === "gif") {
    return (
      <div
        {...selectProps}
        className={`${shellClass} py-1`}
        style={{ textAlign: (p.align as CSSProperties["textAlign"]) || "center" }}
      >
        <CanvasBlockLabel label={definition.label} />
        {p.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={p.alt || ""}
            src={p.src}
            style={{
              borderRadius: p.borderRadius || undefined,
              display: "inline-block",
              maxWidth: "100%",
              width: p.width || "140px"
            }}
          />
        ) : (
          <div className="rounded-md border border-dashed border-line p-4 text-sm text-muted">
            {props.block.type === "gif" ? "Bez GIFu" : "Bez obrazku"}
          </div>
        )}
      </div>
    );
  }

  if (props.block.type === "header" || props.block.type === "hero") {
    return (
      <section
        {...selectProps}
        className={`${shellClass} p-7`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground }}
      >
        <CanvasBlockLabel label={definition.label} />
        {"eyebrow" in p && p.eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: props.theme.primaryColor }}>
            {p.eyebrow}
          </p>
        ) : null}
        <h2
          className="font-bold"
          style={{
            color: props.block.type === "header" ? props.theme.primaryColor : props.theme.textColor,
            fontSize: p.titleSize || "26px",
            lineHeight: 1.2
          }}
        >
          {p.title || "Nadpis"}
        </h2>
        <p
          className="mt-3 whitespace-pre-line"
          style={{
            color: props.theme.textColor,
            fontSize: p.textSize || props.theme.defaultTextSize,
            lineHeight: p.lineHeight || props.theme.defaultLineHeight
          }}
        >
          {p.text || "Text"}
        </p>
      </section>
    );
  }

  if (props.block.type === "coupon") {
    return (
      <section
        {...selectProps}
        className={`${shellClass} mx-auto text-center`}
        style={{
          background: p.backgroundColor || "#e9f6fc",
          borderRadius: p.borderRadius || "12px",
          boxSizing: "border-box",
          color: props.theme.textColor,
          maxWidth: p.cardWidth || "380px",
          padding: p.padding || "40px"
        }}
      >
        <CanvasBlockLabel label={definition.label} />
        <h3 className="text-base font-bold leading-tight">{p.title || "Kupon"}</h3>
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mx-auto mt-4 max-h-16 max-w-[160px]" src={p.logoUrl} />
        ) : null}
        <p className="mt-4 text-[11px]">Slevovy kod uplatnete kliknutim ZDE:</p>
        <span
          className="mt-2 inline-block rounded-md px-5 py-2 text-sm font-bold"
          style={{
            background: p.buttonBackground || props.theme.buttonBackground,
            color: p.buttonText || props.theme.buttonText
          }}
        >
          {p.code || "KOD"}
        </span>
        <p className="mt-3 text-xs leading-5 text-muted">{p.condition}</p>
        {p.validFrom ? <p className="mt-2 text-[11px] text-muted">{p.validFrom}</p> : null}
      </section>
    );
  }

  if (
    props.block.type === "two-column" ||
    props.block.type === "three-column" ||
    props.block.type === "four-column" ||
    props.block.type === "one-third-two-third" ||
    props.block.type === "two-third-one-third"
  ) {
    const columns =
      props.block.type === "two-column" ||
      props.block.type === "one-third-two-third" ||
      props.block.type === "two-third-one-third"
        ? [
            { title: p.leftTitle, text: p.leftText },
            { title: p.rightTitle, text: p.rightText }
          ]
        : props.block.type === "four-column"
          ? [
              { title: p.title1, text: p.text1 },
              { title: p.title2, text: p.text2 },
              { title: p.title3, text: p.text3 },
              { title: p.title4, text: p.text4 }
            ]
          : [
              { title: p.title1, text: p.text1 },
              { title: p.title2, text: p.text2 },
              { title: p.title3, text: p.text3 }
            ];

    return (
      <section
        {...selectProps}
        className={`${shellClass} grid gap-4 p-6`}
        style={{
          background: p.backgroundColor || props.theme.sectionBackground,
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`
        }}
      >
        <CanvasBlockLabel label={definition.label} />
        {columns.map((columnItem, index) => (
          <div key={index}>
            <h3 className="text-sm font-bold" style={{ color: props.theme.textColor }}>
              {columnItem.title}
            </h3>
            <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted">
              {columnItem.text}
            </p>
          </div>
        ))}
      </section>
    );
  }

  if (props.block.type === "card") {
    return (
      <section
        {...selectProps}
        className={`${shellClass} p-5`}
        style={{ background: p.backgroundColor || "#F8FAFC", color: p.textColor || props.theme.textColor }}
      >
        <CanvasBlockLabel label={definition.label} />
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mb-4 max-h-48 w-full rounded object-cover" src={p.imageUrl} />
        ) : null}
        <h3 className="text-lg font-bold">{p.title || "Nadpis karty"}</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6">{p.text}</p>
        {p.ctaLabel ? (
          <span
            className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-bold"
            style={{ background: props.theme.buttonBackground, color: props.theme.buttonText }}
          >
            {p.ctaLabel}
          </span>
        ) : null}
      </section>
    );
  }

  if (props.block.type === "quote") {
    return (
      <section
        {...selectProps}
        className={`${shellClass} p-6`}
        style={{
          background: p.backgroundColor || props.theme.sectionBackground,
          color: p.textColor || props.theme.textColor
        }}
      >
        <CanvasBlockLabel label={definition.label} />
        <blockquote
          className="border-l-4 pl-4 text-base font-semibold leading-7"
          style={{ borderColor: p.accentColor || props.theme.primaryColor }}
        >
          {p.quote}
        </blockquote>
        {p.author ? <p className="mt-3 text-sm text-muted">{p.author}</p> : null}
      </section>
    );
  }

  if (props.block.type === "navbar") {
    const links = [1, 2, 3]
      .map((index) => ({
        label: p[`link${index}Label`],
        href: p[`link${index}Href`]
      }))
      .filter((link) => link.label);

    return (
      <nav
        {...selectProps}
        className={`${shellClass} flex flex-wrap justify-center gap-3 p-4 text-sm font-bold`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground, color: p.color || props.theme.textColor }}
      >
        <CanvasBlockLabel label={definition.label} />
        {links.map((link, index) => (
          <span key={index} className="rounded border border-line px-3 py-1">
            {link.label}
          </span>
        ))}
      </nav>
    );
  }

  if (props.block.type === "social") {
    const links = [
      { label: "Facebook", href: p.facebook },
      { label: "Instagram", href: p.instagram },
      { label: "Web", href: p.web }
    ].filter((link) => link.href);

    return (
      <div
        {...selectProps}
        className={`${shellClass} flex flex-wrap justify-center gap-2 p-4 text-xs font-bold`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground, color: p.color || props.theme.textColor }}
      >
        <CanvasBlockLabel label={definition.label} />
        {links.map((link) => (
          <span key={link.label} className="rounded-full border border-line px-3 py-2">
            {link.label}
          </span>
        ))}
      </div>
    );
  }

  if (props.block.type === "table") {
    return (
      <div
        {...selectProps}
        className={`${shellClass} overflow-hidden p-5`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground }}
      >
        <CanvasBlockLabel label={definition.label} />
        <table
          className="w-full text-left text-sm"
          style={{ color: p.color || props.theme.textColor }}
          dangerouslySetInnerHTML={{ __html: p.rows || "" }}
        />
      </div>
    );
  }

  if (props.block.type === "accordion") {
    return (
      <div
        {...selectProps}
        className={`${shellClass} space-y-2 p-5`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground }}
      >
        <CanvasBlockLabel label={definition.label} />
        {[1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded border border-line">
            <div className="px-4 py-3 text-sm font-bold" style={{ background: p.titleBackground || "#F4F7FB" }}>
              {p[`title${index}`]}
            </div>
            <div className="px-4 py-3 text-sm leading-6" style={{ background: p.textBackground || "#ffffff" }}>
              {p[`text${index}`]}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (props.block.type === "carousel") {
    const image = p.image1 || p.image2 || p.image3;
    return (
      <div
        {...selectProps}
        className={`${shellClass} p-5 text-center`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground }}
      >
        <CanvasBlockLabel label={definition.label} />
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mx-auto max-h-64 max-w-full rounded object-contain" src={image} />
        ) : (
          <p className="text-sm text-muted">Carousel nema obrazek.</p>
        )}
      </div>
    );
  }

  if (props.block.type === "product") {
    return (
      <section
        {...selectProps}
        className={`${shellClass} p-6 text-center`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground, color: p.textColor || props.theme.textColor }}
      >
        <CanvasBlockLabel label={definition.label} />
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mx-auto mb-4 max-h-40 max-w-[240px] object-contain" src={p.imageUrl} />
        ) : (
          <div className="mx-auto mb-4 flex h-24 max-w-[240px] items-center justify-center rounded border border-dashed border-line text-xs text-muted">
            Bez obrazku
          </div>
        )}
        <h3 className="text-lg font-bold">{p.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6">{p.description}</p>
        <p className="mt-3 text-lg font-bold" style={{ color: props.theme.primaryColor }}>
          {p.price}
        </p>
        <span
          className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-bold"
          style={{ background: p.buttonBackground || props.theme.buttonBackground, color: p.buttonText || props.theme.buttonText }}
        >
          {p.ctaLabel}
        </span>
      </section>
    );
  }

  if (props.block.type === "article") {
    return (
      <article
        {...selectProps}
        className={`${shellClass} p-6`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground, color: p.textColor || props.theme.textColor }}
      >
        <CanvasBlockLabel label={definition.label} />
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mb-4 max-h-52 w-full rounded object-cover" src={p.imageUrl} />
        ) : null}
        {p.category ? (
          <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: p.accentColor || props.theme.primaryColor }}>
            {p.category}
          </p>
        ) : null}
        <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6">{p.summary}</p>
        {p.ctaLabel ? (
          <span className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-bold" style={{ background: props.theme.buttonBackground, color: props.theme.buttonText }}>
            {p.ctaLabel}
          </span>
        ) : null}
      </article>
    );
  }

  if (props.block.type === "video") {
    return (
      <section
        {...selectProps}
        className={`${shellClass} p-6 text-center`}
        style={{ background: p.backgroundColor || props.theme.sectionBackground, color: p.textColor || props.theme.textColor }}
      >
        <CanvasBlockLabel label={definition.label} />
        {p.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mx-auto mb-4 max-h-64 max-w-full rounded object-cover" src={p.thumbnailUrl} />
        ) : (
          <div className="mb-4 flex h-36 items-center justify-center rounded bg-[#111827] text-sm font-bold text-white">
            Video placeholder
          </div>
        )}
        <h3 className="text-lg font-bold">{p.title}</h3>
        <p className="mt-2 text-sm leading-6">{p.text}</p>
        <span className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-bold" style={{ background: p.buttonBackground || props.theme.buttonBackground, color: p.buttonText || props.theme.buttonText }}>
          {p.playLabel}
        </span>
      </section>
    );
  }

  if (
    props.block.type === "raw-html" ||
    props.block.type === "raw-mjml" ||
    props.block.type === "dynamic"
  ) {
    return (
      <div
        {...selectProps}
        className={`${shellClass} bg-[#111827] p-4 font-mono text-xs leading-5 text-white`}
      >
        <CanvasBlockLabel label={definition.label} />
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap">{p.source}</pre>
      </div>
    );
  }

  if (props.block.type === "footer") {
    return (
      <footer
        {...selectProps}
        className={`${shellClass} p-5 text-center text-sm`}
        style={{ background: p.backgroundColor || props.theme.primaryColor, color: p.textColor || "#ffffff" }}
      >
        <CanvasBlockLabel label={definition.label} />
        <p className="whitespace-pre-line">{p.text}</p>
      </footer>
    );
  }

  if (props.block.type === "spacer") {
    return (
      <div {...selectProps} className={`${shellClass} bg-black/5`} style={{ height: p.height || "24px" }}>
        <CanvasBlockLabel label={definition.label} />
      </div>
    );
  }

  if (props.block.type === "divider") {
    return (
      <div {...selectProps} className={`${shellClass} py-3`}>
        <CanvasBlockLabel label={definition.label} />
        <div style={{ borderTop: `1px solid ${p.color || "#d9e2ec"}` }} />
      </div>
    );
  }

  return (
    <div
      {...selectProps}
      className={`${shellClass} bg-white p-4`}
      style={{ color: props.theme.textColor }}
    >
      <CanvasBlockLabel label={definition.label} />
      <p className="text-sm font-semibold">{definition.label}</p>
      <p className="mt-1 text-xs text-muted">{definition.description}</p>
    </div>
  );
}

function CanvasBlockLabel({ label }: { label: string }) {
  return (
    <span className="canvas-block-label pointer-events-none absolute left-2 top-2 hidden rounded bg-[#17935E] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white group-hover:block">
      {label}
    </span>
  );
}

function BuilderInspector(props: {
  block?: BuilderBlock;
  definition: ReturnType<typeof getBlockDefinition> | null;
  device: BuilderDevice;
  theme: BuilderTheme;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onSaveReusableBlock: (id: string) => void;
  onThemeChange: (theme: BuilderTheme) => void;
  onUpdateBlock: (
    id: string,
    key: string,
    value: string,
    device?: BuilderDevice
  ) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[#d9dde5] px-5 py-4">
        <h2 className="text-sm font-bold text-ink">
          {props.definition ? `${props.definition.label} settings` : "Email settings"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {props.definition
            ? `${props.device === "mobile" ? "Mobile overrides" : "Default settings"}`
            : "Global styles and preview text"}
        </p>
      </div>
      {props.block ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-[#d9dde5] bg-[#fafafa] px-3 py-2">
          <button
            type="button"
            title="Presunout nahoru (Alt+â†‘)"
            className="flex h-7 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink transition hover:bg-[#F4F7FB] active:scale-95"
            onClick={() => props.onMoveBlock(props.block!.id, -1)}
          >
            â†‘
          </button>
          <button
            type="button"
            title="Presunout dolu (Alt+â†“)"
            className="flex h-7 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink transition hover:bg-[#F4F7FB] active:scale-95"
            onClick={() => props.onMoveBlock(props.block!.id, 1)}
          >
            â†“
          </button>
          <button
            type="button"
            title="Duplikovat blok (Ctrl+D)"
            className="flex h-7 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink transition hover:bg-[#F4F7FB] active:scale-95"
            onClick={() => props.onDuplicateBlock(props.block!.id)}
          >
            Kopie
          </button>
          <button
            type="button"
            title="Ulozit jako reusable block"
            className="flex h-7 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink transition hover:bg-[#F4F7FB] active:scale-95"
            onClick={() => props.onSaveReusableBlock(props.block!.id)}
          >
            Ulozit blok
          </button>
          <button
            type="button"
            title="Smazat blok (Delete)"
            className="ml-auto flex h-7 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 active:scale-95"
            onClick={() => {
              if (window.confirm(`Smazat blok "${props.definition?.label}"?`)) {
                props.onDeleteBlock(props.block!.id);
              }
            }}
          >
            Smazat
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {props.block && props.definition ? (
          <div className="space-y-6">
            <div>
              <p className="mt-2 text-sm font-bold text-ink">{props.definition.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {props.definition.description}
              </p>
              <p className="mt-3 rounded-md bg-[#F4F7FB] px-3 py-2 text-xs font-semibold leading-5 text-muted">
                {props.device === "mobile"
                  ? "Upravujes mobilni atributy. Prazdna hodnota pouzije desktop."
                  : "Upravujes desktop / vychozi hodnoty."}
              </p>
            </div>
            <InspectorGroups
              block={props.block}
              definition={props.definition}
              device={props.device}
              onUpdateBlock={props.onUpdateBlock}
            />
          </div>
        ) : (
          <div className="space-y-5">
            <BuilderThemePanel
              theme={props.theme}
              onThemeChange={props.onThemeChange}
            />
            <div className="rounded-md border border-line bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Shortcuts</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted">
                <li><kbd className="rounded bg-[#F4F7FB] px-1.5 py-0.5 font-mono font-semibold text-ink">Delete</kbd> deletes the selected block</li>
                <li><kbd className="rounded bg-[#F4F7FB] px-1.5 py-0.5 font-mono font-semibold text-ink">Ctrl+D</kbd> duplicates the selected block</li>
                <li><kbd className="rounded bg-[#F4F7FB] px-1.5 py-0.5 font-mono font-semibold text-ink">Ctrl+Z</kbd> undo</li>
                <li><kbd className="rounded bg-[#F4F7FB] px-1.5 py-0.5 font-mono font-semibold text-ink">Ctrl+Y</kbd> redo</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type InspectorGroup = {
  title: string;
  fields: BuilderField[];
};

const inspectorGroupOrder = [
  "Content",
  "Links & Media",
  "Colors",
  "Typography",
  "Layout",
  "Advanced"
];

const primaryInspectorFieldKeys: Partial<Record<BuilderBlockType, string[]>> = {
  section: ["backgroundColor", "padding", "verticalAlign", "backgroundUrl"],
  column: ["width", "backgroundColor", "padding", "verticalAlign"],
  wrapper: ["backgroundColor", "padding", "borderRadius"],
  text: ["text", "fontSize", "textColor", "align", "lineHeight", "padding", "backgroundColor"],
  button: ["label", "href", "backgroundColor", "textColor", "borderRadius", "align", "innerPadding", "sectionPadding"],
  image: ["src", "alt", "width", "align", "padding", "backgroundColor", "borderRadius"],
  gif: ["src", "alt", "link", "width", "align", "padding", "backgroundColor"],
  social: ["facebook", "instagram", "web", "align", "iconSize", "color", "backgroundColor", "padding"],
  divider: ["color", "padding", "borderWidth"],
  spacer: ["height"],
  "raw-html": ["source"],
  "raw-mjml": ["source"],
  dynamic: ["source"],
  header: ["title", "text", "backgroundColor", "titleSize", "textSize", "padding"],
  hero: ["eyebrow", "title", "text", "backgroundColor", "titleSize", "padding"],
  "image-hero": ["backgroundUrl", "title", "text", "ctaLabel", "ctaHref", "textColor", "buttonBackground", "buttonText", "height", "padding"],
  coupon: ["title", "logoUrl", "code", "href", "condition", "validFrom", "backgroundColor", "buttonBackground", "buttonText", "padding"],
  "two-column": ["leftTitle", "leftText", "rightTitle", "rightText", "backgroundColor", "padding"],
  "three-column": ["title1", "text1", "title2", "text2", "title3", "text3", "backgroundColor", "padding"],
  "four-column": ["title1", "text1", "title2", "text2", "title3", "text3", "title4", "text4", "backgroundColor", "padding"],
  "one-third-two-third": ["leftTitle", "leftText", "rightTitle", "rightText", "backgroundColor", "padding"],
  "two-third-one-third": ["leftTitle", "leftText", "rightTitle", "rightText", "backgroundColor", "padding"],
  card: ["imageUrl", "title", "text", "ctaLabel", "ctaHref", "backgroundColor", "textColor", "padding", "borderRadius"],
  quote: ["quote", "author", "backgroundColor", "accentColor", "textColor", "padding"],
  navbar: ["baseUrl", "link1Label", "link1Href", "link2Label", "link2Href", "link3Label", "link3Href", "color", "backgroundColor", "padding"],
  table: ["rows", "color", "fontSize", "lineHeight", "backgroundColor", "padding"],
  accordion: ["title1", "text1", "title2", "text2", "backgroundColor", "titleBackground", "textBackground", "color", "padding"],
  carousel: ["image1", "image2", "image3", "width", "borderRadius", "backgroundColor", "padding"],
  product: ["imageUrl", "title", "description", "price", "ctaLabel", "ctaHref", "backgroundColor", "textColor", "buttonBackground", "buttonText", "padding"],
  article: ["imageUrl", "category", "title", "summary", "ctaLabel", "ctaHref", "backgroundColor", "textColor", "accentColor", "padding"],
  video: ["thumbnailUrl", "title", "text", "href", "playLabel", "backgroundColor", "textColor", "buttonBackground", "buttonText", "width", "padding"],
  footer: ["text", "backgroundColor", "textColor", "padding"]
};

function InspectorGroups(props: {
  block: BuilderBlock;
  definition: ReturnType<typeof getBlockDefinition>;
  device: BuilderDevice;
  onUpdateBlock: (
    id: string,
    key: string,
    value: string,
    device?: BuilderDevice
  ) => void;
}) {
  const { primaryFields, advancedFields } = splitInspectorFields(
    props.block.type,
    props.definition.fields
  );
  const groups = groupInspectorFields(primaryFields);
  const advancedGroups = groupInspectorFields(advancedFields);

  function renderGroups(items: InspectorGroup[]) {
    return items.map((group) => (
      <section key={group.title} className="space-y-3">
        <h3 className="text-sm font-bold text-ink">{group.title}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {group.fields.map((field) => {
            const responsive = isResponsiveBuilderField(field);
            const isMobileValue = props.device === "mobile" && responsive;
            const value = isMobileValue
              ? props.block.mobileProps?.[field.key] || ""
              : props.block.props[field.key] || "";
            const desktopValue = props.block.props[field.key] || "";

            return (
              <InspectorField
                key={field.key}
                desktopValue={desktopValue}
                device={props.device}
                field={field}
                isResponsive={responsive}
                value={value}
                onChange={(nextValue) =>
                  props.onUpdateBlock(
                    props.block.id,
                    field.key,
                    nextValue,
                    isMobileValue ? "mobile" : "desktop"
                  )
                }
              />
            );
          })}
        </div>
      </section>
    ));
  }

  return (
    <div className="space-y-7">
      {renderGroups(groups)}
      {advancedFields.length ? (
        <details className="rounded-md border border-line bg-white p-3">
          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.08em] text-muted [&::-webkit-details-marker]:hidden">
            Advanced MJML attributes
          </summary>
          <div className="mt-4 space-y-7">{renderGroups(advancedGroups)}</div>
        </details>
      ) : null}
    </div>
  );
}

function splitInspectorFields(type: BuilderBlockType, fields: BuilderField[]) {
  const primaryKeys = primaryInspectorFieldKeys[type];

  if (primaryKeys) {
    const primaryKeySet = new Set(primaryKeys);
    const primaryFields = primaryKeys
      .map((key) => fields.find((field) => field.key === key))
      .filter(Boolean) as BuilderField[];
    const advancedFields = fields.filter((field) => !primaryKeySet.has(field.key));

    return { primaryFields, advancedFields };
  }

  const primaryFields = fields.filter((field) => !isAdvancedInspectorField(field));
  const advancedFields = fields.filter((field) => isAdvancedInspectorField(field));

  return { primaryFields, advancedFields };
}

function isAdvancedInspectorField(field: BuilderField) {
  const key = field.key.toLowerCase();
  return field.type === "code" || key.includes("attributes");
}
function groupInspectorFields(fields: BuilderField[]): InspectorGroup[] {
  const groups = new Map<string, BuilderField[]>();

  fields.forEach((field) => {
    const groupName = getInspectorGroupName(field);
    groups.set(groupName, [...(groups.get(groupName) || []), field]);
  });

  return inspectorGroupOrder
    .map((title) => ({ title, fields: groups.get(title) || [] }))
    .filter((group) => group.fields.length > 0);
}

function getInspectorGroupName(field: BuilderField) {
  const key = field.key.toLowerCase();
  const label = field.label.toLowerCase();

  if (
    field.type === "code" ||
    key.includes("attributes") ||
    key === "source" ||
    key === "rows"
  ) {
    return "Advanced";
  }

  if (
    key.includes("href") ||
    key.includes("url") ||
    key.includes("src") ||
    key.includes("image") ||
    key.includes("logo") ||
    key === "facebook" ||
    key === "instagram" ||
    key === "web"
  ) {
    return "Links & Media";
  }

  if (
    key.includes("color") ||
    key.includes("background") ||
    label.includes("barva") ||
    label.includes("pozadi")
  ) {
    return "Colors";
  }

  if (
    key.includes("padding") ||
    key.includes("width") ||
    key.includes("height") ||
    key.includes("radius") ||
    key.includes("align") ||
    key.includes("position") ||
    key === "mode"
  ) {
    return "Layout";
  }

  if (
    key.includes("font") ||
    key.includes("size") ||
    key.includes("lineheight") ||
    key.includes("textsize") ||
    key.includes("titlesize")
  ) {
    return "Typography";
  }

  return "Content";
}

function InspectorField(props: {
  desktopValue?: string;
  device: BuilderDevice;
  field: BuilderField;
  isResponsive: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const isMobileOverride = props.device === "mobile" && props.isResponsive;
  const helperText = isMobileOverride
    ? `Prazdne = desktop: ${props.desktopValue || "neni nastaveno"}`
    : "";
  const fullWidth =
    props.field.type === "textarea" ||
    props.field.type === "code" ||
    props.field.key.toLowerCase().includes("padding");
  const options = getInspectorSelectOptions(props.field.key);

  if (props.field.type === "code") {
    return (
      <div className="col-span-2">
        <InspectorLabel label={props.field.label} mobile={isMobileOverride} />
        <textarea
          className="mt-1 min-h-[180px] w-full resize-y rounded-md border border-line bg-[#101828] px-3 py-2 font-mono text-xs leading-5 text-[#E6EDF7] outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          spellCheck={false}
        />
        {helperText ? <InspectorHelp text={helperText} /> : null}
      </div>
    );
  }

  if (props.field.type === "textarea") {
    return (
      <div className="col-span-2">
        <InspectorLabel label={props.field.label} mobile={isMobileOverride} />
        <textarea
          className="mt-1 min-h-24 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={helperText}
          rows={4}
        />
      </div>
    );
  }

  if (props.field.type === "color") {
    return (
      <InspectorColorField
        helperText={helperText}
        label={props.field.label}
        mobile={isMobileOverride}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }

  if (props.field.key.toLowerCase().includes("padding")) {
    return (
      <div className="col-span-2">
        <InspectorPaddingField
          helperText={helperText}
          label={props.field.label}
          mobile={isMobileOverride}
          value={props.value}
          onChange={props.onChange}
        />
      </div>
    );
  }

  if (options.length > 0) {
    return (
      <div className={fullWidth ? "col-span-2" : ""}>
        <InspectorLabel label={props.field.label} mobile={isMobileOverride} />
        <select
          className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {helperText ? <InspectorHelp text={helperText} /> : null}
      </div>
    );
  }

  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <InspectorLabel label={props.field.label} mobile={isMobileOverride} />
      <input
        className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={helperText || (props.field.type === "url" ? "https://..." : undefined)}
      />
    </div>
  );
}

function InspectorLabel(props: { label: string; mobile?: boolean }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {props.label}
      {props.mobile ? (
        <span className="ml-1 rounded bg-[#E9F8F0] px-1.5 py-0.5 text-[10px] font-bold text-[#0F6F47]">
          mobile
        </span>
      ) : null}
    </label>
  );
}

function InspectorHelp({ text }: { text: string }) {
  return <p className="mt-1 text-[11px] leading-4 text-muted">{text}</p>;
}

function InspectorColorField(props: {
  helperText?: string;
  label: string;
  mobile?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <InspectorLabel label={props.label} mobile={props.mobile} />
      <div className="mt-1 flex gap-2">
        <input
          className="h-8 w-10 rounded-md border border-line bg-white p-1"
          type="color"
          value={isHexColor(props.value) ? props.value : "#ffffff"}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <input
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="#ffffff"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink hover:bg-[#F4F7FB]"
          onClick={() => props.onChange("transparent")}
        >
          Transparent
        </button>
        <button
          type="button"
          className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink hover:bg-[#F4F7FB]"
          onClick={() => props.onChange("")}
        >
          None
        </button>
      </div>
      {props.helperText ? <InspectorHelp text={props.helperText} /> : null}
    </div>
  );
}

function InspectorPaddingField(props: {
  helperText?: string;
  label: string;
  mobile?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const values = parseSpacingValue(props.value);

  function update(part: keyof typeof values, nextValue: string) {
    props.onChange(composeSpacingValue({ ...values, [part]: nextValue }));
  }

  return (
    <div>
      <InspectorLabel label={props.label} mobile={props.mobile} />
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {(
          [
            ["top", "Top"],
            ["right", "Right"],
            ["bottom", "Bottom"],
            ["left", "Left"]
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid grid-cols-[1fr_80px] items-center gap-2">
            <span className="text-xs text-muted">{label}</span>
            <input
              className="h-8 rounded-md border border-line bg-white px-2 text-right text-sm outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
              value={values[key]}
              onChange={(event) => update(key, event.target.value)}
              placeholder="0px"
            />
          </label>
        ))}
      </div>
      <input
        className="mt-2 h-8 w-full rounded-md border border-line bg-white px-2 text-xs text-muted outline-none focus:border-[#17935E] focus:ring-2 focus:ring-[#17935E]/20"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder="napr. 10px 25px"
      />
      {props.helperText ? <InspectorHelp text={props.helperText} /> : null}
    </div>
  );
}

function parseSpacingValue(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const top = parts[0] || "";
  const right = parts[1] || top;
  const bottom = parts[2] || top;
  const left = parts[3] || right;

  return { top, right, bottom, left };
}

function composeSpacingValue(value: {
  top: string;
  right: string;
  bottom: string;
  left: string;
}) {
  const top = value.top.trim();
  const right = value.right.trim();
  const bottom = value.bottom.trim();
  const left = value.left.trim();

  if (!top && !right && !bottom && !left) {
    return "";
  }

  if (top === right && top === bottom && top === left) {
    return top;
  }

  if (top === bottom && right === left) {
    return `${top} ${right}`.trim();
  }

  return `${top} ${right} ${bottom} ${left}`.trim();
}

function getInspectorSelectOptions(key: string) {
  const normalized = key.toLowerCase();

  if (normalized === "fontfamily") {
    return builderFontOptions;
  }

  if (normalized === "fontweight") {
    return builderFontWeightOptions;
  }

  if (normalized === "align") {
    return [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" }
    ];
  }

  if (normalized === "verticalalign") {
    return [
      { label: "Top", value: "top" },
      { label: "Middle", value: "middle" },
      { label: "Bottom", value: "bottom" }
    ];
  }

  if (normalized === "mode") {
    return [
      { label: "Fixed height", value: "fixed-height" },
      { label: "Fluid height", value: "fluid-height" }
    ];
  }

  return [];
}

function buildCouponFormData(
  form: FormState,
  couponFile: File | null,
  couponTemplateFile?: File | null
) {
  const formData = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  if (couponFile) {
    formData.append("couponWorkbook", couponFile);
  }
  if (couponTemplateFile) {
    formData.append("couponTemplate", couponTemplateFile);
  }
  return formData;
}

function BrandStyleManager(props: {
  activeStyleId: string;
  draft: BrandStyleDraft;
  error: string;
  isSaving: boolean;
  isUploading: boolean;
  status: string;
  styles: BrandStyle[];
  onDelete: (styleId: string) => void;
  onDraftChange: (draft: BrandStyleDraft) => void;
  onEdit: (style: BrandStyle) => void;
  onNew: () => void;
  onSave: () => void;
  onSelect: (styleId: string) => void;
  onUpload: (files: FileList | null) => void;
}) {
  const editingStyle = props.draft.id
    ? props.styles.find((style) => style.id === props.draft.id)
    : null;

  return (
    <section className="mb-5 space-y-4 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Brand styly</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Ulozene profily vizualni identity pro budouci generovani.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={props.onNew}
        >
          Novy styl
        </button>
      </div>

      {props.styles.length ? (
        <div className="space-y-2">
          {props.styles.map((style) => {
            const isActive = props.activeStyleId === style.id;

            return (
              <div
                key={style.id}
                className={`rounded-md border p-3 ${
                  isActive
                    ? "border-brand bg-white"
                    : "border-line bg-white/70"
                }`}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => props.onSelect(style.id)}
                >
                  <span className="block text-sm font-bold text-ink">
                    {style.name}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {style.assets.length} assetu
                    {style.description ? ` | ${style.description}` : ""}
                  </span>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
                    onClick={() => props.onEdit(style)}
                  >
                    Upravit
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => props.onDelete(style.id)}
                  >
                    Smazat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line bg-white p-3 text-sm text-muted">
          Zatim neni ulozeny zadny styl. Vytvorte prvni profil a nahrajte brand podklady.
        </p>
      )}

      <div className="space-y-3 border-t border-line pt-4">
        <TextInput
          label="Nazev stylu"
          value={props.draft.name}
          onChange={(value) =>
            props.onDraftChange({ ...props.draft, name: value })
          }
          placeholder="napr. Corporate, Product X, Partner campaign"
        />
        <TextArea
          label="Popis"
          value={props.draft.description}
          onChange={(value) =>
            props.onDraftChange({ ...props.draft, description: value })
          }
          placeholder="K cemu se styl pouziva"
          rows={2}
        />
        <CodeArea
          label="BrandStyleProfile JSON"
          value={props.draft.profileJson}
          onChange={(value) =>
            props.onDraftChange({ ...props.draft, profileJson: value })
          }
          help="Profil obsahuje barvy, typografii, buttony, layout, tone of voice a extrahovane guidelines."
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={props.isSaving}
            className={primaryButtonClass}
            onClick={props.onSave}
          >
            {props.isSaving ? "Ukladam..." : "Ulozit styl"}
          </button>
          <label
            className={`rounded-md border border-line bg-white px-3 py-2 text-center text-sm font-semibold text-ink transition ${
              props.draft.id && !props.isUploading
                ? "cursor-pointer hover:bg-surface"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            {props.isUploading ? "Nahravam..." : "Nahrat assety"}
            <input
              className="sr-only"
              type="file"
              multiple
              disabled={!props.draft.id || props.isUploading}
              accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.woff,.woff2,.ttf,.otf,.txt,.md,.json,.css,.html,.htm,.mjml,.pdf"
              onChange={(event) => {
                props.onUpload(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {editingStyle?.assets.length ? (
          <div className="rounded-md border border-line bg-white p-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
              Assety
            </h3>
            <ul className="mt-2 space-y-2">
              {editingStyle.assets.map((asset) => (
                <li key={asset.id} className="text-xs leading-5 text-ink">
                  <span className="font-semibold">{asset.kind}</span>:{" "}
                  {asset.originalName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {props.status ? (
          <p className="rounded-md border border-sky-100 bg-white p-3 text-sm text-muted">
            {props.status}
          </p>
        ) : null}
        {props.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {props.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function BrandGenerationInputs(props: {
  activeStyle: BrandStyle | null;
  form: FormState;
  styles: BrandStyle[];
  onSelectStyle: (styleId: string) => void;
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const extractedColors =
    props.activeStyle?.profile.extractedFromAssets.colors.slice(0, 6) || [];
  const profileColors = props.activeStyle
    ? Object.values(props.activeStyle.profile.colors)
        .filter(
          (value): value is string => typeof value === "string" && Boolean(value)
        )
        .slice(0, 6)
    : [];
  const colors = extractedColors.length ? extractedColors : profileColors;

  return (
    <>
      <label className="block">
        <span className="text-sm font-semibold text-ink">Aktivni brand styl</span>
        <select
          className={fieldClass}
          value={props.form.brandStyleId}
          onChange={(event) => props.onSelectStyle(event.target.value)}
          required
        >
          <option value="">Vyberte styl</option>
          {props.styles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
      </label>

      {props.activeStyle ? (
        <div className="rounded-md border border-line bg-panel p-3">
          <h3 className="text-sm font-bold text-ink">{props.activeStyle.name}</h3>
          {props.activeStyle.description ? (
            <p className="mt-1 text-xs leading-5 text-muted">
              {props.activeStyle.description}
            </p>
          ) : null}
          {colors.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {colors.map((color) => (
                <span
                  key={color}
                  className="h-6 w-6 rounded border border-line"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-muted">
            {props.activeStyle.assets.length} assetu,{" "}
            {props.activeStyle.profile.extractedFromAssets.notes.length} extrahovanych poznamek.
          </p>
        </div>
      ) : null}

      <TextArea
        label="Popis pozadovane sablony"
        value={props.form.prompt}
        onChange={(value) => props.onUpdate("prompt", value)}
        placeholder="Create a product launch email for a new SaaS feature. Include a hero, benefits, CTA, product highlights, and footer."
        required
        rows={9}
      />
    </>
  );
}

function CouponInputs(props: {
  form: FormState;
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onCouponFile: (file: File | null) => void;
  onCouponTemplateFile: (file: File | null) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-semibold text-ink">Excel tabulka</span>
        <input
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-dark"
          type="file"
          accept=".xlsx,.xls"
          required
          onChange={(event) => props.onCouponFile(event.target.files?.[0] || null)}
        />
      </label>

      <TextInput
        label="Mesic do headeru"
        value={props.form.couponMonth}
        onChange={(value) => props.onUpdate("couponMonth", value)}
        placeholder="automaticky aktualni mesic"
      />

      <label className="flex items-start gap-3 rounded-md border border-line bg-panel p-3">
        <input
          className="mt-1 h-4 w-4 accent-brand"
          type="checkbox"
          checked={props.form.includeSelfServiceAd}
          onChange={(event) =>
            props.onUpdate("includeSelfServiceAd", event.target.checked)
          }
        />
        <span>
          <span className="block text-sm font-semibold text-ink">
            Vlozit inzerci samoobsluhy
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted">
            Blok se vlozi pred prvni kupon a pouzije odkaz [!customer_portal_url!].
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-md border border-line bg-panel p-3">
        <input
          className="mt-1 h-4 w-4 accent-brand"
          type="checkbox"
          checked={props.form.useAiMatching}
          onChange={(event) => props.onUpdate("useAiMatching", event.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-ink">
            AI parovani kuponu se sablonou
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted">
            Pomuze sparovat radky Excelu se stavajicimi kuponovymi bloky, kdyz jejich poradi nesedi presne.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-md border border-line bg-panel p-3">
        <input
          className="mt-1 h-4 w-4 accent-brand"
          type="checkbox"
          checked={props.form.useAiReview}
          onChange={(event) => props.onUpdate("useAiReview", event.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-ink">
            AI kontrola textu a hodnot
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted">
            AI porovna Excel s vyslednym MJML a vrati upozorneni.
          </span>
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Sablona e-mailu</span>
        <input
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-dark"
          type="file"
          accept=".mjml"
          onChange={(event) =>
            props.onCouponTemplateFile(event.target.files?.[0] || null)
          }
        />
      </label>
    </>
  );
}

function BuilderDropZone(props: {
  index: number;
  label?: string;
  large?: boolean;
  canDrop?: boolean;
  parentId?: string;
  onDropAt: BuilderDropHandler;
}) {
  const [dragCounter, setDragCounter] = useState(0);
  const isOver = dragCounter > 0;
  const canDrop = props.canDrop ?? true;

  return (
    <div
      className={`flex items-center justify-center rounded-md border border-dashed text-xs font-semibold transition ${
        props.large ? "min-h-24 p-3" : "h-3"
      } ${
        isOver && !canDrop
          ? "border-red-300 bg-red-50 text-red-700"
          : isOver
          ? "border-[#17935E] bg-[#E9F8F0] text-[#0F6F47]"
          : props.large
            ? "border-line bg-white text-muted"
            : "border-transparent text-transparent"
      }`}
      onDragEnter={(event) => {
        event.stopPropagation();
        setDragCounter((c) => c + 1);
      }}
      onDragLeave={(event) => {
        event.stopPropagation();
        setDragCounter((c) => Math.max(0, c - 1));
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = canDrop ? getBuilderDropEffect(event) : "none";
      }}
      onDrop={(event) => {
        event.stopPropagation();
        setDragCounter(0);
        if (!canDrop) {
          event.preventDefault();
          return;
        }
        props.onDropAt(event, props.index, props.parentId);
      }}
    >
      {isOver || props.large
        ? canDrop
          ? props.label || "Pustit sem"
          : "Sem to nejde"
        : ""}
    </div>
  );
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{props.label}</span>
      <input
        className={fieldClass}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        required={props.required}
      />
    </label>
  );
}

function ColorInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isTransparent = props.value.trim().toLowerCase() === "transparent";

  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{props.label}</span>
      <div className="mt-1 flex gap-2">
        <input
          className="h-10 w-12 rounded-md border border-line bg-white p-1"
          type="color"
          value={isHexColor(props.value) ? props.value : "#ffffff"}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <input
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="transparent, #ffffff, {{brand.primary_color}}"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${
            isTransparent
              ? "border-brand bg-brand-soft text-brand-dark"
              : "border-line bg-white text-ink hover:bg-surface"
          }`}
          onClick={() => props.onChange("transparent")}
        >
          Transparent
        </button>
        <button
          type="button"
          className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
          onClick={() => props.onChange("")}
        >
          Prazdne
        </button>
      </div>
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{props.label}</span>
      <textarea
        className="mt-1 min-h-28 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        rows={props.rows || 5}
      />
    </label>
  );
}

function CodeArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{props.label}</span>
      <textarea
        className="mt-1 min-h-[280px] w-full resize-y rounded-md border border-line bg-code px-3 py-2 font-mono text-xs leading-5 text-[#E6EDF7] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        spellCheck={false}
      />
      <p className="mt-1 text-xs leading-5 text-muted">
        {props.help ||
          "Vkladej fragment pro obsah tela e-mailu, napr. mj-section, mj-wrapper nebo mj-column blok."}
      </p>
    </label>
  );
}

function Preview({ html }: { html?: string }) {
  if (!html) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-lg border border-dashed border-line bg-panel p-6 text-center text-sm text-muted">
        Preview se zobrazi po uspesnem vygenerovani a kompilaci MJML.
      </div>
    );
  }

  return (
    <iframe
      title="Email preview"
      className="h-full min-h-[520px] w-full rounded-lg border border-line bg-white"
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={html}
    />
  );
}

function ExportSelect(props: {
  result?: ExportableTemplate | null;
  className?: string;
}) {
  const canExportHtml = Boolean(props.result?.html.trim());
  const canExportMjml = Boolean(props.result?.mjml.trim());
  const isDisabled = !canExportHtml && !canExportMjml;

  return (
    <select
      aria-label="Exportovat hotovou sablonu"
      className={`rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition hover:bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}
      value=""
      disabled={isDisabled}
      onChange={(event) => {
        const format = event.target.value as ExportFormat | "";

        if (!format || !props.result) {
          return;
        }

        downloadTemplate(props.result, format);
      }}
    >
      <option value="">Exportovat</option>
      <option value="html" disabled={!canExportHtml}>
        HTML (.html)
      </option>
      <option value="mjml" disabled={!canExportMjml}>
        MJML (.mjml)
      </option>
    </select>
  );
}

function CodeBlock({
  code,
  empty,
  copyLabel
}: {
  code?: string;
  empty: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!code) {
      return;
    }
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-lg border border-line bg-code">
      <button
        type="button"
        disabled={!code}
        onClick={copyCode}
        className="absolute right-3 top-3 z-10 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copied ? "Zkopirovano" : copyLabel}
      </button>
      <pre className="h-full min-h-[520px] overflow-auto p-4 pt-16 text-xs leading-5 text-[#E6EDF7]">
        <code>{code || empty}</code>
      </pre>
    </div>
  );
}

function Issues(props: {
  error?: string;
  issues: ValidationIssue[];
  notes: string[];
  usedVariables: string[];
  selectedAiSuggestionIds: Set<string>;
  isApplyingAiSuggestions: boolean;
  onToggleAiSuggestion?: (id: string, checked: boolean) => void;
  onSelectAllAiSuggestions?: () => void;
  onClearAiSuggestions?: () => void;
  onApplyAiSuggestions?: () => void;
  onApplyAllAiSuggestions?: () => void;
  onApplySingleAiSuggestion?: (issue: ValidationIssue) => void;
}) {
  const visibleIssues = props.issues.filter((issue) => !isIgnoredAiIssue(issue));
  const excelIssues = visibleIssues.filter(isExcelIssue);
  const aiIssues = visibleIssues.filter((issue) => isAiIssue(issue) && !isExcelIssue(issue));
  const appIssues = visibleIssues.filter(
    (issue) => !isAiIssue(issue) && !isExcelIssue(issue)
  );
  const aiNotes = props.notes.filter(isAiNote);
  const appNotes = props.notes.filter((note) => !isAiNote(note));
  const selectedAiSuggestionCount = aiIssues.filter((issue, index) =>
    props.selectedAiSuggestionIds.has(aiSuggestionId(issue, index))
  ).length;

  return (
    <div className="h-full min-h-[520px] overflow-auto rounded-lg border border-line bg-panel p-4">
      {props.error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {props.error}
        </div>
      ) : null}

      {excelIssues.length ? (
        <ValidationPanel
          title="Excel tabulka"
          description="Stavy nahrane tabulky: hlavicka, datove radky, kupony, odkazy a podezrele duplicity."
          empty="Excel tabulka vypada v poradku."
          issues={excelIssues}
          notes={[]}
          tone="excel"
        />
      ) : null}

      {aiIssues.length ? (
        <div className="sticky top-0 z-20 -mx-1 mb-4 rounded-lg border border-violet-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <AiSuggestionActionBar
            issueCount={aiIssues.length}
            selectedCount={selectedAiSuggestionCount}
            isApplying={props.isApplyingAiSuggestions}
            onSelectAll={props.onSelectAllAiSuggestions}
            onClearSelection={props.onClearAiSuggestions}
            onApplySelected={props.onApplyAiSuggestions}
            onApplyAll={props.onApplyAllAiSuggestions}
          />
        </div>
      ) : null}

      <ValidationPanel
        title="AI kontrola"
        description="Navrhy z AI kontroly textu, hodnot a shody s Excelem. Zaskrtni, co chces provest."
        empty="AI kontrola nebyla spustena, nebo nenasla zadne problemy."
        issues={aiIssues}
        notes={aiNotes}
        tone="ai"
        selectedIssueIds={props.selectedAiSuggestionIds}
        selectedIssueCount={selectedAiSuggestionCount}
        issueActionCount={aiIssues.length}
        isApplying={props.isApplyingAiSuggestions}
        onToggleIssue={props.onToggleAiSuggestion}
        onSelectAll={props.onSelectAllAiSuggestions}
        onClearSelection={props.onClearAiSuggestions}
        onApplySelected={props.onApplyAiSuggestions}
        onApplyAll={props.onApplyAllAiSuggestions}
        onApplyIssue={props.onApplySingleAiSuggestion}
      />

      <ValidationPanel
        title="Validace aplikace"
        description="Technicka kontrola MJML, promennych, kompilace a skladani podle Excelu."
        empty="Aplikace nenasla zadne chyby ani upozorneni."
        issues={appIssues}
        notes={appNotes}
        tone="app"
      />

      {props.usedVariables.length ? (
        <>
          <h3 className="mt-6 text-sm font-bold text-ink">Pouzite promenne</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.usedVariables.map((variable) => (
              <span
                key={variable}
                className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
              >
                {`{{${variable}}}`}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function isAiIssue(issue: ValidationIssue) {
  const message = issue.message.toLowerCase();

  return (
    issue.source === "ai-review" ||
    message.startsWith("ai kontrola") ||
    message.startsWith("ai ") ||
    Boolean(issue.suggestion && (issue.expected || issue.actual || message.includes("jazyk")))
  );
}

function isExcelIssue(issue: ValidationIssue) {
  return issue.source === "excel-workbook" || issue.message.startsWith("Excel:");
}

function isIgnoredAiIssue(issue: ValidationIssue) {
  const text = [
    issue.field,
    issue.message,
    issue.details,
    issue.expected,
    issue.actual,
    issue.suggestion
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("[!month!]") ||
    text.includes("{{month}}") ||
    (text.includes("mesic") &&
      /(placeholder|token|atribut|\[!|\[\?|\{\{)/i.test(text))
  );
}

function aiSuggestionText(issue: ValidationIssue) {
  if (issue.suggestion?.trim()) {
    return issue.suggestion.trim();
  }

  if (issue.expected?.trim() && issue.actual?.trim()) {
    return `Nahradit "${issue.actual.trim()}" hodnotou "${issue.expected.trim()}".`;
  }

  return issue.details
    ?.split("\n")
    .find((line) => line.trim().toLowerCase().startsWith("navrh:"))
    ?.replace(/^Navrh:\s*/i, "")
    .trim();
}

function aiSuggestionId(issue: ValidationIssue, index: number) {
  return `${index}:${issue.rowNumber ?? ""}:${issue.field ?? ""}:${issue.message}:${aiSuggestionText(issue) || ""}`;
}

function aiSuggestionFallback(issue: ValidationIssue) {
  return [
    "Oprav tento AI nalez v MJML sablone.",
    stripAiPrefix(issue.message),
    issue.expected ? `Ocekavano: ${issue.expected}` : "",
    issue.actual ? `Nalezeno: ${issue.actual}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function aiSuggestionChange(issue: ValidationIssue): AiSuggestionChange {
  return {
    rowNumber: issue.rowNumber,
    field: issue.field,
    message: stripAiPrefix(issue.message),
    expected: issue.expected,
    actual: issue.actual,
    suggestion: aiSuggestionText(issue) || aiSuggestionFallback(issue)
  };
}

function isAiNote(note: string) {
  const value = note.toLowerCase();

  return (
    value.startsWith("ai ") ||
    (value.includes(" ai ") &&
      /(kontrola|uprava|navrh|navrhu|parovani|provedeno|provedena|neprovedla)/.test(value))
  );
}

function ValidationPanel(props: {
  title: string;
  description: string;
  empty: string;
  issues: ValidationIssue[];
  notes: string[];
  tone: "app" | "ai" | "excel";
  selectedIssueIds?: Set<string>;
  selectedIssueCount?: number;
  issueActionCount?: number;
  isApplying?: boolean;
  onToggleIssue?: (id: string, checked: boolean) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onApplySelected?: () => void;
  onApplyAll?: () => void;
  onApplyIssue?: (issue: ValidationIssue) => void;
}) {
  const shellClass =
    props.tone === "ai"
      ? "border-violet-200 bg-violet-50/70"
      : props.tone === "excel"
        ? "border-emerald-200 bg-emerald-50/70"
        : "border-sky-200 bg-sky-50/70";
  const badgeClass =
    props.tone === "ai"
      ? "bg-violet-100 text-violet-800"
      : props.tone === "excel"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-sky-100 text-sky-800";
  const noteClass =
    props.tone === "ai"
      ? "border-violet-100 bg-white text-violet-950"
      : props.tone === "excel"
        ? "border-emerald-100 bg-white text-emerald-950"
        : "border-sky-100 bg-white text-sky-950";
  const showAiActions =
    props.tone === "ai" &&
    Boolean(props.issueActionCount) &&
    Boolean(props.onApplySelected || props.onApplyAll);

  return (
    <section className={`mb-4 rounded-lg border p-4 ${shellClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink">{props.title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{props.description}</p>
        </div>
        <span className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${badgeClass}`}>
          {props.issues.length
            ? `${props.issues.length} nalezu`
            : props.notes.length
              ? "info"
              : "bez nalezu"}
        </span>
      </div>

      {props.issues.length === 0 ? (
        <p className="mt-3 rounded-md border border-white/70 bg-white/80 p-3 text-sm text-muted">
          {props.empty}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {props.issues.map((issue, index) => {
              const suggestion = props.tone === "ai" ? aiSuggestionText(issue) : "";

              return (
                <li
                  key={`${issue.message}-${index}`}
                  className={`rounded-md border p-3 text-sm ${
                    issue.type === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {props.tone === "ai" && props.onToggleIssue ? (
                      <input
                        type="checkbox"
                        checked={props.selectedIssueIds?.has(aiSuggestionId(issue, index)) || false}
                        onChange={(event) =>
                          props.onToggleIssue?.(aiSuggestionId(issue, index), event.target.checked)
                        }
                        className="mt-1 h-4 w-4 shrink-0 accent-violet-700"
                        aria-label="Vybrat AI navrh k provedeni"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <strong>{issue.type === "error" ? "Chyba" : "Upozorneni"}:</strong>{" "}
                      {stripAiPrefix(issue.message)}
                      {issue.details ? (
                        <IssueDetails
                          details={issue.details}
                          hideSuggestion={props.tone === "ai"}
                        />
                      ) : null}
                      {props.tone === "ai" ? (
                        <div className="mt-3 rounded-md border border-violet-100 bg-white/80 p-3 text-violet-950">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-violet-700">
                            Navrh AI zmeny
                          </p>
                          <p className="mt-1 text-sm leading-5">
                            {suggestion ||
                              "AI nalez se posle k uprave podle popisu, ocekavane a nalezene hodnoty."}
                          </p>
                        </div>
                      ) : null}
                      {props.tone === "ai" && props.onApplyIssue ? (
                        <button
                          type="button"
                          disabled={props.isApplying}
                          onClick={() => props.onApplyIssue?.(issue)}
                          className="mt-3 rounded-md border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {props.isApplying ? "Provadim..." : "Provest tento navrh"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {showAiActions ? (
            <AiSuggestionActionBar
              issueCount={props.issueActionCount || 0}
              selectedCount={props.selectedIssueCount || 0}
              isApplying={props.isApplying}
              onSelectAll={props.onSelectAll}
              onClearSelection={props.onClearSelection}
              onApplySelected={props.onApplySelected}
              onApplyAll={props.onApplyAll}
            />
          ) : null}
        </>
      )}

      {props.notes.length ? (
        <div className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            {props.tone === "ai"
              ? "AI vystup, provedene zmeny a doporuceni"
              : "Poznamky aplikace"}
          </h4>
          <ul className="mt-2 space-y-2">
            {props.notes.map((note, index) => (
              <li
                key={`${note}-${index}`}
                className={`rounded-md border p-3 text-sm leading-5 ${noteClass}`}
              >
                {stripAiPrefix(note)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function stripAiPrefix(value: string) {
  return value
    .replace(/^AI kontrola:\s*/i, "")
    .replace(/^AI poznamka:\s*/i, "")
    .replace(/^AI provedena zmena\s*\d*\s*(?:\([^)]+\))?:\s*/i, "Provedena zmena: ")
    .replace(/^AI provedeno\s*(?:lokalne|pres model)?:\s*/i, "Provedeno: ")
    .replace(/^AI neprovedla zmeny:\s*/i, "Neprovedeno: ")
    .replace(/^AI uprava:\s*/i, "Uprava: ")
    .replace(/^AI zkontrolovala radku:\s*/i, "Zkontrolovano radku: ")
    .replace(/^Excel:\s*/i, "");
}

function AiSuggestionActionBar(props: {
  issueCount: number;
  selectedCount: number;
  isApplying?: boolean;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onApplySelected?: () => void;
  onApplyAll?: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-violet-100 bg-white/85 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-5 text-violet-950">
          Zaskrtni jednotlive navrhy a potvrd jen ty, ktere chces propsat do aktualni MJML sablony.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!props.issueCount || props.isApplying}
            onClick={props.onSelectAll}
            className="rounded-md border border-violet-200 bg-white px-2 py-1 text-xs font-bold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Vybrat vse
          </button>
          <button
            type="button"
            disabled={!props.selectedCount || props.isApplying}
            onClick={props.onClearSelection}
            className="rounded-md border border-violet-200 bg-white px-2 py-1 text-xs font-bold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zrusit vyber
          </button>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          disabled={!props.selectedCount || props.isApplying}
          onClick={props.onApplySelected}
          className="rounded-md border border-violet-700 bg-violet-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:border-violet-200 disabled:bg-violet-200 disabled:text-white"
        >
          {props.isApplying
            ? "Provadim..."
            : props.selectedCount
              ? `Provest pouze vybrane zmeny (${props.selectedCount})`
              : "Vyberte zmeny"}
        </button>
        <button
          type="button"
          disabled={!props.issueCount || props.isApplying}
          onClick={props.onApplyAll}
          className="rounded-md border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.isApplying
            ? "Provadim..."
            : props.issueCount
              ? `Provest vse (${props.issueCount})`
              : "Zadne akce"}
        </button>
      </div>
    </div>
  );
}

function IssueDetails({
  details,
  hideSuggestion
}: {
  details: string;
  hideSuggestion?: boolean;
}) {
  const lines = details
    .split("\n")
    .filter(Boolean)
    .filter((line) => !hideSuggestion || !line.trim().toLowerCase().startsWith("navrh:"));

  return (
    <div className="mt-2 space-y-1 text-xs opacity-90">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

function isHexColor(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

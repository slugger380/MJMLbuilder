"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import type {
  CompileMjmlResponse,
  GenerateEmailResponse,
  ValidationIssue
} from "@/lib/types";
import {
  buildBuilderMjml,
  builderBlockDefinitions,
  createBuilderBlock,
  defaultBuilderBlocks,
  defaultBuilderTheme,
  getBuilderBlockProps,
  getBlockDefinition,
  type BuilderBlock,
  type BuilderBlockType,
  type BuilderField,
  type BuilderRenderDevice,
  type BuilderTheme
} from "@/lib/mjmlBuilder";

type TemplateId = "ai" | "coupons-excel" | "mjml-builder";

type FormState = {
  templateId: TemplateId;
  emailType: "promo" | "informacni" | "upozorneni" | "onboarding" | "servisni";
  topic: string;
  mainMessage: string;
  ctaText: string;
  ctaUrl: string;
  notes: string;
  useAiMatching: boolean;
  useAiReview: boolean;
  couponMonth: string;
};

type Tab = "preview" | "mjml" | "html" | "issues";
type SuccessfulResult = Extract<GenerateEmailResponse, { ok: true }>;
type BuilderDropHandler = (
  event: DragEvent<HTMLElement>,
  index: number,
  parentId?: string
) => void;
type BuilderDevice = BuilderRenderDevice;
type BuilderPanelTab = "structure" | "components" | "styles";

type BuilderSnapshot = {
  blocks: BuilderBlock[];
  customHead: string;
  device: BuilderDevice;
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

const emptyForm: FormState = {
  templateId: "ai",
  emailType: "promo",
  topic: "",
  mainMessage: "",
  ctaText: "",
  ctaUrl: "",
  notes: "",
  useAiMatching: false,
  useAiReview: false,
  couponMonth: ""
};

const demoForm: FormState = {
  templateId: "ai",
  emailType: "promo",
  topic: "rychlejsi internet pro domacnosti",
  mainMessage: "vyhodnejsi tarif pro stavajici zakazniky",
  ctaText: "Zobrazit nabidku",
  ctaUrl: "{{cta.url}}",
  notes: "",
  useAiMatching: false,
  useAiReview: false,
  couponMonth: ""
};

const couponTemplateForm: FormState = {
  templateId: "coupons-excel",
  emailType: "promo",
  topic: "Aktualni slevove kupony pro zakazniky",
  mainMessage:
    "Vybrali jsme pro vas aktualni slevove kody a partnerske vyhody z interni tabulky.",
  ctaText: "",
  ctaUrl: "",
  notes: "Texty, kody a odkazy se maji brat z Excelu.",
  useAiMatching: false,
  useAiReview: false,
  couponMonth: ""
};

const builderTemplateForm: FormState = {
  ...emptyForm,
  templateId: "mjml-builder",
  topic: "MJML builder"
};

const emailTypes = [
  { value: "promo", label: "Promo" },
  { value: "informacni", label: "Informacni" },
  { value: "upozorneni", label: "Upozorneni" },
  { value: "onboarding", label: "Onboarding" },
  { value: "servisni", label: "Servisni" }
] as const;

const tabLabels: Record<Tab, string> = {
  preview: "Preview",
  mjml: "MJML",
  html: "HTML",
  issues: "Issues"
};

const builderPaletteMime = "application/x-mjml-builder-block-type";
const builderBlockMime = "application/x-mjml-builder-block-id";
const builderRootBlockTypes: BuilderBlockType[] = [
  "section",
  "wrapper",
  "header",
  "hero",
  "image-hero",
  "coupon",
  "two-column",
  "three-column",
  "card",
  "quote",
  "navbar",
  "social",
  "table",
  "accordion",
  "carousel",
  "text",
  "button",
  "image",
  "divider",
  "spacer",
  "raw-html",
  "raw-mjml",
  "footer"
];

function cloneBuilderBlocks(blocks = defaultBuilderBlocks): BuilderBlock[] {
  return blocks.map((block) => ({
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

function isContainerBlock(block?: BuilderBlock | null) {
  return Boolean(block && getBlockDefinition(block.type).acceptsChildren);
}

function canAcceptChildType(parent: BuilderBlock | null, type: BuilderBlockType) {
  if (!parent) {
    return true;
  }

  const definition = getBlockDefinition(parent.type);
  if (!definition.acceptsChildren) {
    return false;
  }

  return !definition.childTypes?.length || definition.childTypes.includes(type);
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
    setPropFromAttr(block.props, "fontSize", element, "font-size");
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

export default function Home() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [couponFile, setCouponFile] = useState<File | null>(null);
  const [couponTemplateFile, setCouponTemplateFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [result, setResult] = useState<GenerateEmailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [builderBlocks, setBuilderBlocks] = useState<BuilderBlock[]>(() =>
    cloneBuilderBlocks()
  );
  const [builderTheme, setBuilderTheme] = useState<BuilderTheme>(() => ({
    ...defaultBuilderTheme
  }));
  const [builderCustomHead, setBuilderCustomHead] = useState("");
  const [builderImportStatus, setBuilderImportStatus] = useState("");
  const [builderDevice, setBuilderDevice] = useState<BuilderDevice>("desktop");
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
      subject: "MJML builder",
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
  }, [builderBlocks.length, builderCompile, builderMjml]);

  const successfulResult =
    form.templateId === "mjml-builder" ? builderResult : result?.ok ? result : null;

  const issues = useMemo(() => {
    if (form.templateId === "mjml-builder") {
      return builderResult.issues;
    }
    if (!result) {
      return [];
    }
    return result.ok ? result.issues : result.issues || [];
  }, [builderResult.issues, form.templateId, result]);

  const outputError =
    form.templateId === "mjml-builder"
      ? builderCompile.error
      : !result?.ok && result
        ? result.error
        : undefined;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function switchMode(templateId: TemplateId) {
    setResult(null);
    setActiveTab("preview");
    setCouponFile(null);
    setCouponTemplateFile(null);

    if (templateId === "coupons-excel") {
      setForm(couponTemplateForm);
      return;
    }

    if (templateId === "mjml-builder") {
      setForm(builderTemplateForm);
      return;
    }

    setForm(emptyForm);
  }

  function createBuilderSnapshot(): BuilderSnapshot {
    return {
      blocks: cloneBuilderBlocks(builderBlocks),
      customHead: builderCustomHead,
      device: builderDevice,
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.templateId === "mjml-builder") {
      setActiveTab("preview");
      return;
    }

    setIsLoading(true);
    setResult(null);
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
              body: JSON.stringify(form)
            };

      const response = await fetch("/api/generate-email", requestInit);
      const data = (await response.json()) as GenerateEmailResponse;
      setResult(data);

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
    const selectedParentId = isContainerBlock(selectedBlock) ? selectedBlock?.id : undefined;
    const childCount = selectedBlock?.children?.length || 0;
    insertBuilderBlock(
      type,
      selectedParentId ? childCount : builderBlocks.length,
      selectedParentId
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
    rememberBuilderState();
    setBuilderBlocks((current) => {
      const draggedBlock = findBuilderBlock(current, id);
      const parent = parentId ? findBuilderBlock(current, parentId) : null;
      if (!draggedBlock || !canAcceptChildType(parent, draggedBlock.type)) {
        return current;
      }
      const removed = removeBuilderBlock(current, id);
      if (!removed.removed) {
        return current;
      }
      return insertBuilderBlockAt(removed.blocks, removed.removed, targetIndex, parentId);
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
    let nextSelectedId = "";
    rememberBuilderState();
    setBuilderBlocks((current) => {
      const next = removeBuilderBlock(current, id).blocks;
      if (selectedBlockId === id) {
        nextSelectedId = next[0]?.id || "";
      }
      return next;
    });
    if (selectedBlockId === id) {
      setSelectedBlockId(nextSelectedId);
    }
  }

  function resetBuilder() {
    const nextBlocks = cloneBuilderBlocks();
    rememberBuilderState();
    setBuilderBlocks(nextBlocks);
    setBuilderTheme({ ...defaultBuilderTheme });
    setBuilderCustomHead("");
    setBuilderImportStatus("");
    setBuilderDevice("desktop");
    setSelectedBlockId(nextBlocks[0]?.id || "");
    setActiveTab("preview");
  }

  async function importBuilderTemplate(file: File) {
    try {
      const source = await file.text();
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
        ...current,
        bodyBackground: imported.bodyBackground || current.bodyBackground,
        width: imported.width || current.width
      }));
      setSelectedBlockId(importedBlocks[0]?.id || "");
      setActiveTab("preview");
      setBuilderImportStatus(
        `Nahrano: ${file.name}. Prevedeno na ${importedBlocks.length} editovatelnych bloku.`
      );
    } catch (error) {
      setBuilderImportStatus(
        error instanceof Error
          ? `Sablonu se nepodarilo nacist: ${error.message}`
          : "Sablonu se nepodarilo nacist."
      );
    }
  }

  if (form.templateId === "mjml-builder") {
    return (
      <BuilderAppShell
        activeTab={activeTab}
        blocks={builderBlocks}
        canRedo={builderHistory.future.length > 0}
        canUndo={builderHistory.past.length > 0}
        compileState={builderCompile}
        error={outputError}
        html={successfulResult?.html || ""}
        importStatus={builderImportStatus}
        issues={issues}
        mjml={successfulResult?.mjml || ""}
        notes={successfulResult?.notes || []}
        device={builderDevice}
        selectedBlockId={activeBuilderBlockId}
        theme={builderTheme}
        usedVariables={successfulResult?.usedVariables || []}
        onAddBlock={addBuilderBlock}
        onDeleteBlock={deleteBuilderBlock}
        onDeviceChange={setBuilderDevice}
        onDropAt={handleBuilderDrop}
        onDuplicateBlock={duplicateBuilderBlock}
        onImportTemplate={importBuilderTemplate}
        onMoveBlock={moveBuilderBlock}
        onRedo={redoBuilder}
        onReset={resetBuilder}
        onSelectBlock={setSelectedBlockId}
        onSetActiveTab={setActiveTab}
        onSwitchMode={switchMode}
        onThemeChange={updateBuilderTheme}
        onUndo={undoBuilder}
        onUpdateBlock={updateBuilderBlock}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FB]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 lg:h-screen lg:flex-row lg:overflow-hidden">
        <section className="w-full shrink-0 rounded-lg border border-line bg-white p-5 shadow-sm lg:w-[390px] lg:overflow-y-auto">
          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-normal text-ink">
              MJML Email Generator
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              AI generovani, Excel kupony a rucni MJML builder v jednom nastroji.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Rezim</span>
              <select
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
                value={form.templateId}
                onChange={(event) => switchMode(event.target.value as TemplateId)}
              >
                <option value="ai">AI generovani</option>
                <option value="coupons-excel">Kupony z Excelu</option>
                <option value="mjml-builder">MJML builder</option>
              </select>
            </label>

            {form.templateId === "coupons-excel" ? (
              <CouponInputs
                form={form}
                onUpdate={updateForm}
                onCouponFile={setCouponFile}
                onCouponTemplateFile={setCouponTemplateFile}
              />
            ) : null}

            {form.templateId === "ai" ? (
              <AiInputs form={form} onUpdate={updateForm} />
            ) : null}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-[#F4F7FB]"
                onClick={() => {
                  setForm(
                    form.templateId === "coupons-excel" ? couponTemplateForm : demoForm
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
                disabled={isLoading}
                className="rounded-md bg-[#1F7A8C] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#176273] disabled:cursor-not-allowed disabled:opacity-60"
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
                {(["preview", "mjml", "html", "issues"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      activeTab === tab
                        ? "bg-[#1F7A8C] text-white"
                        : "border border-line bg-white text-ink hover:bg-[#F4F7FB]"
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
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
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function BuilderAppShell(props: {
  activeTab: Tab;
  blocks: BuilderBlock[];
  canRedo: boolean;
  canUndo: boolean;
  compileState: BuilderCompileState;
  error?: string;
  html: string;
  importStatus: string;
  issues: ValidationIssue[];
  mjml: string;
  notes: string[];
  device: BuilderDevice;
  selectedBlockId: string;
  theme: BuilderTheme;
  usedVariables: string[];
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onDeviceChange: (device: BuilderDevice) => void;
  onDropAt: BuilderDropHandler;
  onDuplicateBlock: (id: string) => void;
  onImportTemplate: (file: File) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onRedo: () => void;
  onReset: () => void;
  onSelectBlock: (id: string) => void;
  onSetActiveTab: (tab: Tab) => void;
  onSwitchMode: (mode: TemplateId) => void;
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
  const [leftPanelTab, setLeftPanelTab] = useState<BuilderPanelTab>("structure");
  const selectedBlock = findBuilderBlock(props.blocks, props.selectedBlockId) || undefined;
  const selectedDefinition = selectedBlock
    ? getBlockDefinition(selectedBlock.type)
    : null;

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
          props.onRedo();
        } else {
          props.onUndo();
        }
        return;
      }

      if (hasModifier && key === "y") {
        event.preventDefault();
        props.onRedo();
        return;
      }

      if (hasModifier && (key === "d" || key === "c")) {
        event.preventDefault();
        if (props.selectedBlockId) {
          props.onDuplicateBlock(props.selectedBlockId);
        }
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && props.selectedBlockId) {
        event.preventDefault();
        props.onDeleteBlock(props.selectedBlockId);
        return;
      }

      if (event.altKey && event.key === "ArrowUp" && props.selectedBlockId) {
        event.preventDefault();
        props.onMoveBlock(props.selectedBlockId, -1);
        return;
      }

      if (event.altKey && event.key === "ArrowDown" && props.selectedBlockId) {
        event.preventDefault();
        props.onMoveBlock(props.selectedBlockId, 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-[#F5F6F8] text-ink">
      <header className="grid h-14 shrink-0 grid-cols-[312px_minmax(0,1fr)_384px] items-center border-b border-[#d9dde5] bg-[#fafafa]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-24 items-center justify-center gap-4 border-r border-[#d9dde5] text-lg text-[#7b8190]">
            <button
              type="button"
              className="rounded px-1 text-lg transition hover:bg-[#eef0f4] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!props.canUndo}
              title="Undo / Ctrl+Z"
              onClick={props.onUndo}
            >
              ↶
            </button>
            <button
              type="button"
              className="rounded px-1 text-lg transition hover:bg-[#eef0f4] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!props.canRedo}
              title="Redo / Ctrl+Y"
              onClick={props.onRedo}
            >
              ↷
            </button>
            <span title="Document">▯</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">MJML builder</p>
            <p className="text-xs text-muted">
              {props.blocks.length} bloku
              {props.compileState.isCompiling ? " - kompiluji" : " - aktualizovano"}
            </p>
          </div>
          <select
            className="w-44 rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
            value="mjml-builder"
            onChange={(event) => props.onSwitchMode(event.target.value as TemplateId)}
          >
            <option value="ai">AI generovani</option>
            <option value="coupons-excel">Kupony z Excelu</option>
            <option value="mjml-builder">MJML builder</option>
          </select>
        </div>

        <div className="flex items-center justify-center gap-3">
          <div className="flex rounded-md bg-[#eef0f4] p-1">
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm font-semibold ${
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
              className={`rounded px-3 py-1 text-sm font-semibold ${
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
          </div>
          <div className="flex gap-1">
            {(["mjml", "html", "issues"] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  props.activeTab === tab
                    ? "bg-[#6D5EF5] text-white"
                    : "border border-line bg-white text-ink hover:bg-[#F4F7FB]"
                }`}
                onClick={() => props.onSetActiveTab(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4">
          <label className="cursor-pointer rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-[#F4F7FB]">
            Nahrat MJML
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
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-[#F4F7FB]"
            onClick={props.onReset}
          >
            Reset
          </button>
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              props.issues.some((issue) => issue.type === "error")
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {props.issues.some((issue) => issue.type === "error")
              ? "chyby"
              : "validni"}
          </span>
        </div>
      </header>

      {props.importStatus ? (
        <div className="shrink-0 border-b border-line bg-[#F8FAFC] px-4 py-2 text-xs font-semibold text-muted">
          {props.importStatus}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[312px_minmax(0,1fr)_384px]">
        <aside className="min-h-0 border-r border-[#d9dde5] bg-[#fbfbfc]">
          <div className="flex h-full min-h-0 flex-col">
            <div className="grid grid-cols-3 gap-1 border-b border-[#d9dde5] p-3">
              {(
                [
                  ["structure", "Struktura"],
                  ["components", "Komponenty"],
                  ["styles", "Styly"]
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-md px-2 py-2 text-xs font-bold transition ${
                    leftPanelTab === tab
                      ? "bg-[#1F7A8C] text-white"
                      : "border border-line bg-white text-ink hover:bg-[#F4F7FB]"
                  }`}
                  onClick={() => setLeftPanelTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {leftPanelTab === "structure" ? (
                <BuilderTreePanel
                  blocks={props.blocks}
                  selectedBlockId={props.selectedBlockId}
                  onAddBlock={props.onAddBlock}
                  onDropAt={props.onDropAt}
                  onSelectBlock={props.onSelectBlock}
                />
              ) : null}
              {leftPanelTab === "components" ? (
                <BuilderPalette onAddBlock={props.onAddBlock} />
              ) : null}
              {leftPanelTab === "styles" ? (
                <BuilderThemePanel
                  theme={props.theme}
                  onThemeChange={props.onThemeChange}
                />
              ) : null}
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 overflow-hidden">
          {props.activeTab === "preview" ? (
            <BuilderCanvas
              blocks={props.blocks}
              device={props.device}
              html={props.html}
              isCompiling={props.compileState.isCompiling}
              mode={canvasMode}
              selectedBlockId={props.selectedBlockId}
              theme={props.theme}
              onDeviceChange={props.onDeviceChange}
              onDropAt={props.onDropAt}
              onSelectBlock={props.onSelectBlock}
              blockCount={props.blocks.length}
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
              />
            </div>
          ) : null}
        </section>

        <aside className="min-h-0 border-l border-[#d9dde5] bg-[#fbfbfc]">
          <BuilderInspector
            block={selectedBlock}
            definition={selectedDefinition}
            blocks={props.blocks}
            selectedBlockId={props.selectedBlockId}
            device={props.device}
            onUpdateBlock={props.onUpdateBlock}
          />
        </aside>
      </div>
    </main>
  );
}

function BuilderPalette(props: {
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-ink">Components</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Klikni pro pridani. Pokud je vybrany kontejner, prida se dovnitr.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {builderBlockDefinitions.map((definition) => (
          <button
            key={definition.type}
            type="button"
            draggable
            className="min-h-12 rounded border border-[#d9dde5] bg-white p-2 text-left text-xs font-semibold text-ink transition hover:border-[#6D5EF5] hover:bg-[#F4F2FF]"
            onClick={() => props.onAddBlock(definition.type)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData(builderPaletteMime, definition.type);
            }}
            title={definition.description}
          >
            <span className="block">{definition.label}</span>
            <span className="mt-1 block text-[11px] font-normal leading-4 text-muted">
              {definition.type}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BuilderTreePanel(props: {
  blocks: BuilderBlock[];
  selectedBlockId: string;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  const [openAddTargetId, setOpenAddTargetId] = useState<string | "body" | null>(null);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <h2 className="text-sm font-bold text-ink">Struktura e-mailu</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Tady se sklada jen telo e-mailu. Nastaveni hlavicky je v zalozce Styly.
        </p>
      </div>
      <div className="rounded-lg border border-[#d9dde5] bg-white">
        <div
          className="flex items-center gap-2 border-b border-[#e8ebf0] px-3 py-2"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => props.onDropAt(event, props.blocks.length)}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#E8F3F6] text-xs font-bold text-[#176273]">
            B
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">Body</p>
            <p className="text-xs text-muted">{props.blocks.length} bloku</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-dashed border-[#1F7A8C] px-2 py-1 text-xs font-bold text-[#176273] hover:bg-[#E8F3F6]"
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
            depth={0}
            openAddTargetId={openAddTargetId}
            selectedBlockId={props.selectedBlockId}
            onAddBlock={props.onAddBlock}
            onDropAt={props.onDropAt}
            onOpenAddTarget={setOpenAddTargetId}
            onSelectBlock={props.onSelectBlock}
          />
        </div>
      </div>
      <p className="rounded-md bg-[#F4F7FB] px-3 py-2 text-xs leading-5 text-muted">
        Blok pretahni mezi radky nebo primo na kontejner. Delete maze, Ctrl+D
        kopiruje, Ctrl+Z vraci zpet.
      </p>
    </div>
  );
}

function BuilderTreeList(props: {
  blocks: BuilderBlock[];
  depth: number;
  openAddTargetId: string | "body" | null;
  parentId?: string;
  selectedBlockId: string;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDropAt: BuilderDropHandler;
  onOpenAddTarget: (id: string | "body" | null) => void;
  onSelectBlock: (id: string) => void;
}) {
  if (props.blocks.length === 0) {
    return (
      <BuilderDropZone
        index={0}
        label={props.parentId ? "Pustit dovnitr" : "Pustit do body"}
        large
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
        const childCount = block.children?.length || 0;

        return (
          <div key={block.id}>
            <BuilderDropZone
              index={index}
              parentId={props.parentId}
              onDropAt={props.onDropAt}
            />
            <div
              draggable
              className={`group flex cursor-grab items-center gap-2 rounded-md border px-2 py-2 active:cursor-grabbing ${
                isSelected
                  ? "border-[#1F7A8C] bg-[#E8F3F6] ring-2 ring-[#1F7A8C]/15"
                  : "border-transparent bg-white hover:border-line hover:bg-[#F8FAFC]"
              }`}
              style={{ marginLeft: props.depth * 16 }}
              onClick={() => props.onSelectBlock(block.id)}
              onDragStart={(event) => {
                props.onSelectBlock(block.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(builderBlockMime, block.id);
              }}
              onDragOver={(event) => {
                if (!canHaveChildren) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!canHaveChildren) {
                  return;
                }
                props.onDropAt(event, childCount, block.id);
              }}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                  canHaveChildren
                    ? "bg-[#F4F2FF] text-[#5B4AEF]"
                    : "bg-[#F1F5F9] text-muted"
                }`}
              >
                {canHaveChildren ? "▾" : "•"}
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
                  className="shrink-0 rounded-md border border-dashed border-[#1F7A8C] px-2 py-1 text-xs font-bold text-[#176273] opacity-100 hover:bg-[#E8F3F6] md:opacity-0 md:group-hover:opacity-100"
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
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
    </div>
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
              className="rounded border border-line bg-white px-2 py-1.5 text-left text-xs font-semibold text-ink transition hover:border-[#1F7A8C] hover:bg-[#E8F3F6]"
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

function BuilderLayers(props: {
  blocks: BuilderBlock[];
  selectedBlockId: string;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-ink">Email structure</h2>
      <p className="text-xs leading-5 text-muted">
        Pretahuj bloky mezi sebou nebo je pust primo na kontejner. Klavesy:
        Delete smaze, Ctrl+D kopiruje, Alt+Sipky presouvaji.
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 rounded px-1 py-1 font-semibold text-ink">
          <span>⌄</span>
          <span>Head</span>
        </div>
        <div className="ml-5 space-y-1 text-muted">
          <div className="rounded px-1 py-1">› Default attributes</div>
          <div className="rounded px-1 py-1">◎ Subject preview</div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded px-1 py-1 font-semibold text-ink">
          <span>⌄</span>
          <span>Body</span>
          <button
            type="button"
            className="ml-auto rounded border border-dashed border-[#6D5EF5] px-1.5 text-[#6D5EF5]"
            onClick={() => props.onAddBlock("section")}
          >
            +
          </button>
        </div>
      </div>
      <BuilderLayerList {...props} blocks={props.blocks} depth={0} />
    </div>
  );
}

function BuilderLayerList(props: {
  blocks: BuilderBlock[];
  depth: number;
  selectedBlockId: string;
  parentId?: string;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  if (props.blocks.length === 0) {
    return (
      <BuilderDropZone
        index={0}
        label={props.parentId ? "Pretahni sem vnoreny blok" : "Pretahni blok sem"}
        large
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
    );
  }

  return (
    <div className="space-y-2">
      {props.blocks.map((block, index) => {
        const definition = getBlockDefinition(block.type);
        const isSelected = block.id === props.selectedBlockId;
        const canHaveChildren = Boolean(definition.acceptsChildren);

        return (
          <div key={block.id}>
            <BuilderDropZone
              index={index}
              parentId={props.parentId}
              onDropAt={props.onDropAt}
            />
            <div
              draggable
              className={`cursor-grab rounded-md border bg-white p-2 shadow-sm active:cursor-grabbing ${
                isSelected
                  ? "border-[#1F7A8C] ring-2 ring-[#1F7A8C]/15"
                  : "border-line"
              }`}
              style={{ marginLeft: props.depth * 12 }}
              onClick={() => props.onSelectBlock(block.id)}
              onDragStart={(event) => {
                props.onSelectBlock(block.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(builderBlockMime, block.id);
              }}
              onDragOver={(event) => {
                if (!canHaveChildren) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!canHaveChildren) {
                  return;
                }
                props.onDropAt(event, block.children?.length || 0, block.id);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {index + 1}. {definition.label}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {definition.type}
                    {canHaveChildren ? ` / ${block.children?.length || 0} deti` : ""}
                  </p>
                </div>
              </div>
            </div>
            {canHaveChildren ? (
              <div className="mt-2 border-l border-line pl-2">
                <BuilderLayerList
                  {...props}
                  blocks={block.children || []}
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
        label={props.parentId ? "Pustit do kontejneru" : "Pustit na konec"}
        parentId={props.parentId}
        onDropAt={props.onDropAt}
      />
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
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-ink">Globalni styly</h2>
      <TextInput
        label="Sirka e-mailu"
        value={props.theme.width}
        onChange={(value) => updateTheme("width", value)}
        placeholder="600px"
      />
      <TextInput
        label="Font"
        value={props.theme.fontFamily}
        onChange={(value) => updateTheme("fontFamily", value)}
        placeholder="Arial, sans-serif"
      />
      <ColorInput
        label="Pozadi tela"
        value={props.theme.bodyBackground}
        onChange={(value) => updateTheme("bodyBackground", value)}
      />
      <ColorInput
        label="Primarni barva"
        value={props.theme.primaryColor}
        onChange={(value) => updateTheme("primaryColor", value)}
      />
      <ColorInput
        label="Pozadi sekci"
        value={props.theme.sectionBackground}
        onChange={(value) => updateTheme("sectionBackground", value)}
      />
      <ColorInput
        label="Text"
        value={props.theme.textColor}
        onChange={(value) => updateTheme("textColor", value)}
      />
      <ColorInput
        label="Tlacitko pozadi"
        value={props.theme.buttonBackground}
        onChange={(value) => updateTheme("buttonBackground", value)}
      />
      <ColorInput
        label="Tlacitko text"
        value={props.theme.buttonText}
        onChange={(value) => updateTheme("buttonText", value)}
      />
      <TextInput
        label="Vychozi padding sekci"
        value={props.theme.defaultSectionPadding}
        onChange={(value) => updateTheme("defaultSectionPadding", value)}
        placeholder="24px 30px"
      />
      <TextInput
        label="Vychozi velikost textu"
        value={props.theme.defaultTextSize}
        onChange={(value) => updateTheme("defaultTextSize", value)}
        placeholder="16px"
      />
      <TextInput
        label="Vychozi radkovani"
        value={props.theme.defaultLineHeight}
        onChange={(value) => updateTheme("defaultLineHeight", value)}
        placeholder="24px"
      />
      <TextInput
        label="Breakpoint"
        value={props.theme.breakpoint}
        onChange={(value) => updateTheme("breakpoint", value)}
        placeholder="480px"
      />
      <TextInput
        label="MJML title"
        value={props.theme.headTitle}
        onChange={(value) => updateTheme("headTitle", value)}
        placeholder="Interni e-mail"
      />
      <TextArea
        label="Preview text"
        value={props.theme.previewText}
        onChange={(value) => updateTheme("previewText", value)}
        rows={3}
      />
      <CodeArea
        label="Pokrocile atributy mj-all"
        value={props.theme.globalAttributes}
        onChange={(value) => updateTheme("globalAttributes", value)}
        help='Vkladej jen atributy pro mj-all, napr. font-family="Arial, sans-serif" color="#172033".'
      />
    </div>
  );
}

function BuilderCanvas(props: {
  blocks: BuilderBlock[];
  blockCount: number;
  device: BuilderDevice;
  html: string;
  isCompiling: boolean;
  mode: "edit" | "preview";
  selectedBlockId: string;
  theme: BuilderTheme;
  onDeviceChange: (device: BuilderDevice) => void;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  const selectedBlock = findBuilderBlock(props.blocks, props.selectedBlockId);
  const selectedDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#d9dde5] bg-[#fafafa] px-4">
        <div className="flex items-center gap-2">
          {(["desktop", "mobile"] as BuilderDevice[]).map((device) => (
            <button
              key={device}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                props.device === device
                  ? "bg-[#1F7A8C] text-white"
                  : "border border-line bg-white text-ink hover:bg-[#F4F7FB]"
              }`}
              onClick={() => props.onDeviceChange(device)}
            >
              {device === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>
        <div className="text-right text-xs font-semibold text-muted">
          <p>
            {props.device === "desktop" ? "600px" : "390px"} -{" "}
            {props.isCompiling ? "Kompiluji..." : `${props.blockCount} bloku`}
          </p>
          <p>
            Vybrano:{" "}
            <span className="text-ink">{selectedDefinition?.label || "nic"}</span>
          </p>
        </div>
      </div>
      <div
        className="builder-checkerboard min-h-0 flex-1 overflow-auto p-6"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => props.onDropAt(event, props.blockCount)}
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
              srcDoc={props.html}
            />
          ) : props.blocks.length ? (
            <div className="min-h-[560px] overflow-hidden rounded-lg">
              {props.blocks.map((block) => (
                <InteractiveCanvasBlock
                  key={block.id}
                  block={block}
                  device={props.device}
                  selectedBlockId={props.selectedBlockId}
                  theme={props.theme}
                  onDropAt={props.onDropAt}
                  onSelectBlock={props.onSelectBlock}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-[560px] items-center justify-center p-6 text-center text-sm text-muted">
              Pretahni sem prvni blok.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InteractiveCanvasBlock(props: {
  block: BuilderBlock;
  device: BuilderDevice;
  selectedBlockId: string;
  theme: BuilderTheme;
  onDropAt: BuilderDropHandler;
  onSelectBlock: (id: string) => void;
}) {
  const definition = getBlockDefinition(props.block.type);
  const p = getBuilderBlockProps(props.block, props.device);
  const isSelected = props.block.id === props.selectedBlockId;
  const canHaveChildren = Boolean(definition.acceptsChildren);
  const shellClass = `group relative cursor-pointer transition ${
    isSelected
      ? "builder-selected-block z-10 outline outline-2 outline-[#1F7A8C] ring-4 ring-[#1F7A8C]/20"
      : "outline outline-1 outline-transparent hover:outline-[#1F7A8C]/40"
  }`;
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
    }
  };

  if (canHaveChildren) {
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
        className={`${shellClass} flex flex-col gap-3`}
        style={style}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) =>
          props.onDropAt(event, props.block.children?.length || 0, props.block.id)
        }
      >
        <CanvasBlockLabel label={definition.label} />
        {props.block.children?.length ? (
          props.block.children.map((child) => (
            <InteractiveCanvasBlock
              key={child.id}
              block={child}
              device={props.device}
              selectedBlockId={props.selectedBlockId}
              theme={props.theme}
              onDropAt={props.onDropAt}
              onSelectBlock={props.onSelectBlock}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-white/70 bg-white/20 p-4 text-center text-sm font-semibold">
            Pretahni sem text, tlacitko nebo dalsi blok.
          </div>
        )}
      </section>
    );
  }

  if (props.block.type === "text") {
    return (
      <div
        {...selectProps}
        className={`${shellClass} px-1 py-1`}
        style={{
          color: p.textColor || props.theme.textColor,
          fontSize: p.fontSize || props.theme.defaultTextSize,
          lineHeight: p.lineHeight || props.theme.defaultLineHeight,
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
            padding: p.innerPadding || "12px 24px"
          }}
        >
          {p.label || "Button"}
        </span>
      </div>
    );
  }

  if (props.block.type === "image") {
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
            Bez obrazku
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
        className={`${shellClass} mx-auto max-w-[380px] rounded-lg p-6 text-center`}
        style={{ background: p.backgroundColor || "#e9f6fc", color: props.theme.textColor }}
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

  if (props.block.type === "two-column" || props.block.type === "three-column") {
    const columns =
      props.block.type === "two-column"
        ? [
            { title: p.leftTitle, text: p.leftText },
            { title: p.rightTitle, text: p.rightText }
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

  if (props.block.type === "raw-html" || props.block.type === "raw-mjml") {
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
    <span className="canvas-block-label pointer-events-none absolute left-2 top-2 hidden rounded bg-[#1F7A8C] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white group-hover:block">
      {label}
    </span>
  );
}

function BuilderInspector(props: {
  block?: BuilderBlock;
  definition: ReturnType<typeof getBlockDefinition> | null;
  blocks: BuilderBlock[];
  device: BuilderDevice;
  selectedBlockId: string;
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
          {props.definition ? `${props.definition.label} Attributes` : "Attributes"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {props.definition
            ? `${props.definition.label} / ${props.device === "mobile" ? "Mobile" : "Desktop"}`
            : "Vyber blok"}
        </p>
      </div>
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
          <div className="rounded-md border border-dashed border-line bg-[#F8FAFC] p-4 text-sm text-muted">
            Vyber blok ve vrstvach nebo pridej novy blok z palety.
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
  "Colors",
  "Typography",
  "Layout",
  "Links & Media",
  "Advanced"
];

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
  const groups = groupInspectorFields(props.definition.fields);

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h3 className="text-sm font-bold text-ink">{group.title}:</h3>
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
      ))}
    </div>
  );
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
          className="mt-1 min-h-[180px] w-full resize-y rounded-md border border-line bg-[#101828] px-3 py-2 font-mono text-xs leading-5 text-[#E6EDF7] outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
          className="mt-1 min-h-24 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
          className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
        className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
        <span className="ml-1 rounded bg-[#E8F3F6] px-1.5 py-0.5 text-[10px] font-bold text-[#176273]">
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
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
              className="h-8 rounded-md border border-line bg-white px-2 text-right text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
              value={values[key]}
              onChange={(event) => update(key, event.target.value)}
              placeholder="0px"
            />
          </label>
        ))}
      </div>
      <input
        className="mt-2 h-8 w-full rounded-md border border-line bg-white px-2 text-xs text-muted outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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

function AiInputs(props: {
  form: FormState;
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-semibold text-ink">Typ e-mailu</span>
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
          value={props.form.emailType}
          onChange={(event) =>
            props.onUpdate("emailType", event.target.value as FormState["emailType"])
          }
        >
          {emailTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <TextInput
        label="Tema e-mailu"
        value={props.form.topic}
        onChange={(value) => props.onUpdate("topic", value)}
        placeholder="napr. zmena tarifu"
        required
      />

      <TextArea
        label="Hlavni sdeleni"
        value={props.form.mainMessage}
        onChange={(value) => props.onUpdate("mainMessage", value)}
        placeholder="Co ma prijemce pochopit nebo udelat"
        required
      />

      <TextInput
        label="CTA text"
        value={props.form.ctaText}
        onChange={(value) => props.onUpdate("ctaText", value)}
        placeholder="Zobrazit nabidku"
      />

      <TextInput
        label="CTA URL"
        value={props.form.ctaUrl}
        onChange={(value) => props.onUpdate("ctaUrl", value)}
        placeholder="{{cta.url}} nebo https://..."
      />

      <TextArea
        label="Poznamky"
        value={props.form.notes}
        onChange={(value) => props.onUpdate("notes", value)}
        placeholder="Volitelne doplnujici instrukce"
        rows={3}
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
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#E8F3F6] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#176273]"
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

      <label className="flex items-start gap-3 rounded-md border border-line bg-[#F8FAFC] p-3">
        <input
          className="mt-1 h-4 w-4"
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
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#E8F3F6] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#176273]"
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

function BuilderControls(props: {
  theme: BuilderTheme;
  onThemeChange: (theme: BuilderTheme) => void;
  onAddBlock: (type: BuilderBlockType, parentId?: string | null) => void;
  onReset: () => void;
}) {
  function updateTheme<K extends keyof BuilderTheme>(key: K, value: BuilderTheme[K]) {
    props.onThemeChange({ ...props.theme, [key]: value });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-[#F8FAFC] p-4">
        <h2 className="text-sm font-bold text-ink">Styly</h2>
        <div className="mt-3 space-y-3">
          <TextInput
            label="Sirka e-mailu"
            value={props.theme.width}
            onChange={(value) => updateTheme("width", value)}
            placeholder="600px"
          />
          <TextInput
            label="Font"
            value={props.theme.fontFamily}
            onChange={(value) => updateTheme("fontFamily", value)}
            placeholder="Arial, sans-serif"
          />
          <ColorInput
            label="Pozadi tela"
            value={props.theme.bodyBackground}
            onChange={(value) => updateTheme("bodyBackground", value)}
          />
          <ColorInput
            label="Primarni barva"
            value={props.theme.primaryColor}
            onChange={(value) => updateTheme("primaryColor", value)}
          />
          <ColorInput
            label="Pozadi sekci"
            value={props.theme.sectionBackground}
            onChange={(value) => updateTheme("sectionBackground", value)}
          />
          <ColorInput
            label="Text"
            value={props.theme.textColor}
            onChange={(value) => updateTheme("textColor", value)}
          />
          <ColorInput
            label="Tlacitko pozadi"
            value={props.theme.buttonBackground}
            onChange={(value) => updateTheme("buttonBackground", value)}
          />
          <ColorInput
            label="Tlacitko text"
            value={props.theme.buttonText}
            onChange={(value) => updateTheme("buttonText", value)}
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-[#F8FAFC] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Bloky</h2>
          <button
            type="button"
            className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink transition hover:bg-[#F4F7FB]"
            onClick={props.onReset}
          >
            Reset
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {builderBlockDefinitions.map((definition) => (
            <button
              key={definition.type}
              type="button"
              draggable
              className="rounded-md border border-line bg-white px-3 py-2 text-left text-xs font-semibold text-ink transition hover:border-[#1F7A8C] hover:bg-[#E8F3F6]"
              onClick={() => props.onAddBlock(definition.type)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(builderPaletteMime, definition.type);
              }}
              title={definition.description}
            >
              {definition.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Blok muzes pridat kliknutim, nebo ho pretahnout do struktury vpravo.
        </p>
      </section>

      <section className="rounded-lg border border-dashed border-line bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled
            className="rounded-md border border-line bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-muted"
          >
            Ulozit blok
          </button>
          <button
            type="button"
            disabled
            className="rounded-md border border-line bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-muted"
          >
            Ulozit styl
          </button>
        </div>
      </section>
    </div>
  );
}

function BuilderWorkspace(props: {
  blocks: BuilderBlock[];
  html: string;
  isCompiling: boolean;
  selectedBlockId: string;
  onSelect: (id: string) => void;
  onUpdateBlock: (id: string, key: string, value: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onDropAt: BuilderDropHandler;
  onDuplicateBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
}) {
  const selectedBlock = props.blocks.find(
    (block) => block.id === props.selectedBlockId
  );
  const selectedDefinition = selectedBlock
    ? getBlockDefinition(selectedBlock.type)
    : null;

  return (
    <div className="grid h-full min-h-[520px] gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <section className="overflow-hidden rounded-lg border border-line bg-[#F8FAFC]">
        <div className="border-b border-line bg-white px-3 py-2">
          <h3 className="text-sm font-bold text-ink">Struktura</h3>
        </div>
        <div className="max-h-[620px] space-y-2 overflow-auto p-3">
          {props.blocks.length === 0 ? (
            <BuilderDropZone
              index={0}
              label="Pretahni blok sem"
              large
              onDropAt={props.onDropAt}
            />
          ) : null}
          {props.blocks.map((block, index) => {
            const definition = getBlockDefinition(block.type);
            const isSelected = block.id === props.selectedBlockId;

            return (
              <div key={block.id}>
                <BuilderDropZone index={index} onDropAt={props.onDropAt} />
                <div
                  draggable
                  className={`rounded-md border bg-white p-2 ${
                    isSelected
                      ? "border-[#1F7A8C] ring-2 ring-[#1F7A8C]/15"
                      : "border-line"
                  } cursor-grab active:cursor-grabbing`}
                  onClick={() => props.onSelect(block.id)}
                  onDragStart={(event) => {
                    props.onSelect(block.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(builderBlockMime, block.id);
                  }}
                >
                  <button
                    type="button"
                    className="w-full text-left text-sm font-semibold text-ink"
                    onClick={() => props.onSelect(block.id)}
                  >
                    {index + 1}. {definition.label}
                  </button>
                  <p className="mt-1 text-xs leading-4 text-muted">
                    {definition.description}
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    <SmallButton
                      label="Up"
                      disabled={index === 0}
                      onClick={() => props.onMoveBlock(block.id, -1)}
                    />
                    <SmallButton
                      label="Down"
                      disabled={index === props.blocks.length - 1}
                      onClick={() => props.onMoveBlock(block.id, 1)}
                    />
                    <SmallButton
                      label="Copy"
                      onClick={() => props.onDuplicateBlock(block.id)}
                    />
                    <SmallButton
                      label="Del"
                      onClick={() => props.onDeleteBlock(block.id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {props.blocks.length ? (
            <BuilderDropZone
              index={props.blocks.length}
              label="Pustit na konec"
              onDropAt={props.onDropAt}
            />
          ) : null}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border border-line bg-[#EEF3F7]"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => props.onDropAt(event, props.blocks.length)}
      >
        <div className="flex items-center justify-between border-b border-line bg-white px-3 py-2">
          <h3 className="text-sm font-bold text-ink">Nahled</h3>
          <span className="text-xs font-semibold text-muted">
            {props.isCompiling ? "Kompiluji..." : "Aktualizovano"}
          </span>
        </div>
        {props.html ? (
          <iframe
            title="Builder preview"
            className="h-[620px] w-full bg-white"
            srcDoc={props.html}
          />
        ) : (
          <div className="flex h-[620px] items-center justify-center p-6 text-center text-sm text-muted">
            Nahled se zobrazi po kompilaci MJML.
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-[#F8FAFC]">
        <div className="border-b border-line bg-white px-3 py-2">
          <h3 className="text-sm font-bold text-ink">Inspector</h3>
        </div>
        <div className="max-h-[620px] overflow-auto p-3">
          {selectedBlock && selectedDefinition ? (
            <div className="space-y-3">
              <div className="rounded-md border border-line bg-white p-3">
                <p className="text-sm font-bold text-ink">{selectedDefinition.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {selectedDefinition.description}
                </p>
              </div>
              {selectedDefinition.fields.map((field) => (
                <BuilderFieldInput
                  key={field.key}
                  field={field}
                  value={selectedBlock.props[field.key] || ""}
                  onChange={(value) =>
                    props.onUpdateBlock(selectedBlock.id, field.key, value)
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-line bg-white p-3 text-sm text-muted">
              Vyberte blok.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function BuilderFieldInput(props: {
  desktopValue?: string;
  device?: BuilderDevice;
  field: BuilderField;
  isResponsive?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const isMobileOverride = props.device === "mobile" && props.isResponsive;
  const label = isMobileOverride ? `${props.field.label} (Mobile)` : props.field.label;
  const mobileHelp = isMobileOverride
    ? `Prazdne = pouzit desktop: ${props.desktopValue || "neni nastaveno"}.`
    : undefined;

  if (props.field.type === "code") {
    const isAttributeField = props.field.key.toLowerCase().includes("attributes");
    return (
      <CodeArea
        label={label}
        value={props.value}
        onChange={props.onChange}
        help={
          mobileHelp ||
          (isAttributeField
            ? 'Vkladej jen atributy, napr. padding-top="0" border-radius="12px" full-width="full-width".'
            : undefined)
        }
      />
    );
  }

  if (props.field.type === "textarea") {
    return (
      <TextArea
        label={label}
        value={props.value}
        onChange={props.onChange}
        placeholder={mobileHelp}
        rows={4}
      />
    );
  }

  if (props.field.type === "color") {
    return (
      <ColorInput
        label={label}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }

  return (
    <TextInput
      label={label}
      value={props.value}
      onChange={props.onChange}
      placeholder={mobileHelp || (props.field.type === "url" ? "https://..." : undefined)}
    />
  );
}

function BuilderDropZone(props: {
  index: number;
  label?: string;
  large?: boolean;
  parentId?: string;
  onDropAt: BuilderDropHandler;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={`flex items-center justify-center rounded-md border border-dashed text-xs font-semibold transition ${
        props.large ? "min-h-24 p-3" : "h-3"
      } ${
        isOver
          ? "border-[#1F7A8C] bg-[#E8F3F6] text-[#176273]"
          : props.large
            ? "border-line bg-white text-muted"
            : "border-transparent text-transparent"
      }`}
      onDragEnter={() => setIsOver(true)}
      onDragLeave={() => setIsOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        setIsOver(false);
        props.onDropAt(event, props.index, props.parentId);
      }}
    >
      {isOver || props.large ? props.label || "Pustit sem" : ""}
    </div>
  );
}

function SmallButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      className="rounded-md border border-line bg-[#F8FAFC] px-1.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-[#E8F3F6] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
    >
      {props.label}
    </button>
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
        className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
              ? "border-[#1F7A8C] bg-[#E8F3F6] text-[#176273]"
              : "border-line bg-white text-ink hover:bg-[#F4F7FB]"
          }`}
          onClick={() => props.onChange("transparent")}
        >
          Transparent
        </button>
        <button
          type="button"
          className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink hover:bg-[#F4F7FB]"
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
        className="mt-1 min-h-28 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
        className="mt-1 min-h-[280px] w-full resize-y rounded-md border border-line bg-[#101828] px-3 py-2 font-mono text-xs leading-5 text-[#E6EDF7] outline-none focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]/20"
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
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-lg border border-dashed border-line bg-[#F8FAFC] p-6 text-center text-sm text-muted">
        Preview se zobrazi po uspesnem vygenerovani a kompilaci MJML.
      </div>
    );
  }

  return (
    <iframe
      title="Email preview"
      className="h-full min-h-[520px] w-full rounded-lg border border-line bg-white"
      srcDoc={html}
    />
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
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-lg border border-line bg-[#101828]">
      <button
        type="button"
        disabled={!code}
        onClick={copyCode}
        className="absolute right-3 top-3 z-10 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-[#E8F3F6] disabled:cursor-not-allowed disabled:opacity-50"
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
}) {
  const aiIssues = props.issues.filter(isAiIssue);
  const appIssues = props.issues.filter((issue) => !isAiIssue(issue));
  const aiNotes = props.notes.filter(isAiNote);
  const appNotes = props.notes.filter((note) => !isAiNote(note));

  return (
    <div className="h-full min-h-[520px] overflow-auto rounded-lg border border-line bg-[#F8FAFC] p-4">
      {props.error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {props.error}
        </div>
      ) : null}

      <ValidationPanel
        title="Validace aplikace"
        description="Kontrola MJML, promennych, kompilace a skladani podle Excelu."
        empty="Aplikace nenasla zadne chyby ani upozorneni."
        issues={appIssues}
        notes={appNotes}
        tone="app"
      />

      <ValidationPanel
        title="AI kontrola"
        description="Kontrola shody Excelu s vyslednym MJML, textu a podezrelych hodnot."
        empty="AI kontrola nebyla spustena, nebo nenasla zadne problemy."
        issues={aiIssues}
        notes={aiNotes}
        tone="ai"
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

function isAiIssue(issue: { message: string }) {
  return issue.message.toLowerCase().startsWith("ai kontrola");
}

function isAiNote(note: string) {
  return note.toLowerCase().startsWith("ai ");
}

function ValidationPanel(props: {
  title: string;
  description: string;
  empty: string;
  issues: ValidationIssue[];
  notes: string[];
  tone: "app" | "ai";
}) {
  const shellClass =
    props.tone === "ai"
      ? "border-violet-200 bg-violet-50/70"
      : "border-sky-200 bg-sky-50/70";
  const badgeClass =
    props.tone === "ai"
      ? "bg-violet-100 text-violet-800"
      : "bg-sky-100 text-sky-800";
  const noteClass =
    props.tone === "ai"
      ? "border-violet-100 bg-white text-violet-950"
      : "border-sky-100 bg-white text-sky-950";

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
        <ul className="mt-3 space-y-2">
          {props.issues.map((issue, index) => (
            <li
              key={`${issue.message}-${index}`}
              className={`rounded-md border p-3 text-sm ${
                issue.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <strong>{issue.type === "error" ? "Chyba" : "Upozorneni"}:</strong>{" "}
              {stripAiPrefix(issue.message)}
              {issue.details ? <IssueDetails details={issue.details} /> : null}
            </li>
          ))}
        </ul>
      )}

      {props.notes.length ? (
        <div className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            {props.tone === "ai" ? "AI vystup a doporuceni" : "Poznamky aplikace"}
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
    .replace(/^AI zkontrolovala radku:\s*/i, "Zkontrolovano radku: ");
}

function IssueDetails({ details }: { details: string }) {
  const lines = details.split("\n").filter(Boolean);

  return (
    <div className="mt-2 space-y-1 text-xs opacity-90">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

import type {
  CampaignTemplateSnapshot,
  SavedEmailTemplate,
  TemplateSourceType
} from "@/lib/types";

function normalizeTemplateSourceType(template: SavedEmailTemplate): TemplateSourceType {
  if (template.sourceType) {
    return template.sourceType;
  }

  if (template.state.source === "ai-generated") {
    return "ai";
  }

  if (template.state.source === "excel-generated") {
    return "excel";
  }

  if (template.state.source === "raw-mjml") {
    return "code";
  }

  if (template.state.source === "imported-mjml") {
    return "imported";
  }

  return "builder";
}

export function createCampaignTemplateSnapshot(
  template: SavedEmailTemplate
): CampaignTemplateSnapshot {
  return {
    templateId: template.id,
    templateName: template.name,
    templateUpdatedAt: template.updatedAt,
    snapshotCreatedAt: new Date().toISOString(),
    sourceType: normalizeTemplateSourceType(template),
    brandStyleId: template.brandStyleId,
    mjml: template.mjml,
    html: template.html,
    globalSettings: template.metadata || undefined
  };
}

export function createBlankCampaignTemplateSnapshot(): CampaignTemplateSnapshot {
  return {
    templateName: "Blank campaign template",
    snapshotCreatedAt: new Date().toISOString(),
    sourceType: "blank",
    mjml: "",
    html: ""
  };
}

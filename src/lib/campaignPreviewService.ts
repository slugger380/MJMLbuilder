import type { Campaign, CampaignRecipient } from "@/lib/types";

const mergeTagPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function createSampleCampaignRecipient(): CampaignRecipient {
  return {
    id: "sample-recipient",
    email: "jana.novakova@example.com",
    firstName: "Jana",
    lastName: "Novakova",
    company: "Example s.r.o.",
    customFields: {
      segment: "VIP",
      city: "Praha"
    },
    status: "active",
    source: "manual",
    createdAt: new Date().toISOString()
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function recipientMergeValue(recipient: CampaignRecipient, tag: string) {
  const normalized = tag.trim();

  if (normalized === "first_name" || normalized === "firstName") {
    return recipient.firstName || "";
  }

  if (normalized === "last_name" || normalized === "lastName") {
    return recipient.lastName || "";
  }

  if (normalized === "email") {
    return recipient.email;
  }

  if (normalized === "company") {
    return recipient.company || "";
  }

  return recipient.customFields?.[normalized] || "";
}

export function applyCampaignMergeTags(source: string, recipient: CampaignRecipient) {
  return source.replace(mergeTagPattern, (match, tag: string) => {
    const value = recipientMergeValue(recipient, tag);
    return value ? escapeHtml(value) : match;
  });
}

export function collectCampaignMergeTags(campaign: Campaign) {
  const tags = new Set<string>();
  const source = [
    campaign.subject,
    campaign.preheader,
    campaign.templateSnapshot?.mjml || "",
    campaign.templateSnapshot?.html || ""
  ].join("\n");

  for (const match of source.matchAll(mergeTagPattern)) {
    tags.add(match[1].trim());
  }

  return Array.from(tags).sort();
}

export function createCampaignPreview(campaign: Campaign, recipient: CampaignRecipient) {
  return {
    subject: applyCampaignMergeTags(campaign.subject, recipient),
    preheader: applyCampaignMergeTags(campaign.preheader, recipient),
    html: applyCampaignMergeTags(campaign.templateSnapshot?.html || "", recipient),
    mergeTags: collectCampaignMergeTags(campaign)
  };
}

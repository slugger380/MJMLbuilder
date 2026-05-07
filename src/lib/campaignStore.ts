import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createEmptyCampaignResultSummary } from "@/lib/campaignAnalyticsService";
import {
  activeCampaignRecipients,
  createEmptyCampaignRecipients,
  isValidRecipientEmail,
  normalizeRecipientEmail
} from "@/lib/campaignRecipientService";
import type {
  Campaign,
  CampaignRecipient,
  CampaignRecipients,
  CampaignSchedule,
  CampaignSender,
  CampaignSettings,
  CampaignStatus,
  CampaignTemplateSnapshot,
  CampaignTestSend
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "campaigns.json");

type CampaignStoreFile = {
  version: 1;
  campaigns: Campaign[];
};

type CampaignInput = Partial<
  Pick<
    Campaign,
    | "name"
    | "subject"
    | "preheader"
    | "sender"
    | "status"
    | "templateReference"
    | "templateSnapshot"
    | "recipients"
    | "settings"
    | "schedule"
    | "testSends"
    | "resultSummary"
    | "events"
    | "sentAt"
    | "errorState"
  >
>;

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

async function readStore(): Promise<Campaign[]> {
  await ensureStore();
  const raw = await readFile(storePath, "utf8");

  try {
    const parsed = JSON.parse(raw) as CampaignStoreFile;
    return Array.isArray(parsed.campaigns)
      ? parsed.campaigns.map((campaign) => normalizeCampaign(campaign))
      : [];
  } catch {
    return [];
  }
}

async function writeStore(campaigns: Campaign[]) {
  await mkdir(dataDir, { recursive: true });
  const payload: CampaignStoreFile = {
    version: 1,
    campaigns
  };
  await writeFile(storePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeName(name: unknown, fallback = "Nova kampan") {
  const normalized = typeof name === "string" ? name.trim() : "";
  return normalized || fallback;
}

function normalizeSender(sender?: Partial<CampaignSender>): CampaignSender {
  return {
    name: typeof sender?.name === "string" ? sender.name.trim() : "",
    email:
      typeof sender?.email === "string" && sender.email.trim()
        ? normalizeRecipientEmail(sender.email)
        : "",
    replyToEmail:
      typeof sender?.replyToEmail === "string" && sender.replyToEmail.trim()
        ? normalizeRecipientEmail(sender.replyToEmail)
        : undefined
  };
}

function normalizeRecipient(recipient: CampaignRecipient): CampaignRecipient {
  const email = normalizeRecipientEmail(recipient.email || "");
  return {
    id: recipient.id || randomUUID(),
    email,
    firstName: recipient.firstName?.trim() || undefined,
    lastName: recipient.lastName?.trim() || undefined,
    company: recipient.company?.trim() || undefined,
    customFields: recipient.customFields || {},
    status:
      recipient.status === "unsubscribed" ||
      recipient.status === "suppressed" ||
      recipient.status === "invalid" ||
      (email && !isValidRecipientEmail(email))
        ? recipient.status === "unsubscribed" || recipient.status === "suppressed"
          ? recipient.status
          : isValidRecipientEmail(email)
            ? "active"
            : "invalid"
        : "active",
    source: recipient.source || "manual",
    createdAt: recipient.createdAt || nowIso()
  };
}

function normalizeRecipients(recipients?: Partial<CampaignRecipients>): CampaignRecipients {
  if (!recipients) {
    return createEmptyCampaignRecipients();
  }

  const seen = new Set<string>();
  const normalizedRecipients: CampaignRecipient[] = [];
  let duplicateCount = recipients.duplicateCount || 0;

  for (const recipient of recipients.recipients || []) {
    const normalized = normalizeRecipient(recipient);
    if (seen.has(normalized.email)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(normalized.email);
    normalizedRecipients.push(normalized);
  }

  return {
    source: recipients.source || (normalizedRecipients.length ? "manual" : "none"),
    recipients: normalizedRecipients,
    segments: recipients.segments || [],
    invalidRows: recipients.invalidRows || [],
    duplicateCount,
    updatedAt: recipients.updatedAt || nowIso()
  };
}

function normalizeSettings(settings?: Partial<CampaignSettings>): CampaignSettings {
  return {
    requireUnsubscribeLink: settings?.requireUnsubscribeLink ?? true,
    requireCompanyAddress: settings?.requireCompanyAddress ?? true,
    companyAddress: settings?.companyAddress?.trim() || "",
    unsubscribeUrlPlaceholder:
      settings?.unsubscribeUrlPlaceholder?.trim() || "{{unsubscribe.url}}",
    trackingEnabled: settings?.trackingEnabled ?? false,
    notes: settings?.notes?.trim() || ""
  };
}

function normalizeSchedule(schedule?: Partial<CampaignSchedule>): CampaignSchedule {
  return {
    scheduledAt: schedule?.scheduledAt || undefined,
    timezone: schedule?.timezone || "Europe/Prague",
    schedulerStatus: schedule?.schedulerStatus || "not-configured"
  };
}

function normalizeTemplateSnapshot(
  snapshot?: CampaignTemplateSnapshot
): CampaignTemplateSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  return {
    templateId: snapshot.templateId,
    templateName: normalizeName(snapshot.templateName, "Template snapshot"),
    templateUpdatedAt: snapshot.templateUpdatedAt,
    snapshotCreatedAt: snapshot.snapshotCreatedAt || nowIso(),
    sourceType: snapshot.sourceType || "unknown",
    brandStyleId: snapshot.brandStyleId,
    mjml: snapshot.mjml || "",
    html: snapshot.html || "",
    globalSettings: snapshot.globalSettings
  };
}

function normalizeTestSends(testSends?: CampaignTestSend[]) {
  return (testSends || []).map((send) => ({
    id: send.id || randomUUID(),
    recipientEmail: normalizeRecipientEmail(send.recipientEmail || ""),
    status: send.status || "not-configured",
    message: send.message || "",
    createdAt: send.createdAt || nowIso()
  }));
}

function normalizeStatus(status?: CampaignStatus): CampaignStatus {
  const statuses: CampaignStatus[] = [
    "draft",
    "ready",
    "scheduled",
    "sending",
    "sent",
    "failed",
    "archived"
  ];
  return status && statuses.includes(status) ? status : "draft";
}

function normalizeCampaign(input: CampaignInput & Partial<Campaign>): Campaign {
  const timestamp = nowIso();
  const recipients = normalizeRecipients(input.recipients);
  const templateSnapshot = normalizeTemplateSnapshot(input.templateSnapshot);

  return {
    id: input.id || randomUUID(),
    name: normalizeName(input.name),
    subject: typeof input.subject === "string" ? input.subject.trim() : "",
    preheader: typeof input.preheader === "string" ? input.preheader.trim() : "",
    sender: normalizeSender(input.sender),
    status: normalizeStatus(input.status),
    templateReference:
      input.templateReference ||
      (templateSnapshot?.templateId
        ? {
            templateId: templateSnapshot.templateId,
            templateName: templateSnapshot.templateName
          }
        : undefined),
    templateSnapshot,
    recipientSource: recipients.source,
    recipientCount: activeCampaignRecipients(recipients.recipients).length,
    recipients,
    settings: normalizeSettings(input.settings),
    schedule: normalizeSchedule(input.schedule),
    testSends: normalizeTestSends(input.testSends),
    resultSummary: input.resultSummary || createEmptyCampaignResultSummary(),
    events: input.events || [],
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
    sentAt: input.sentAt,
    errorState: input.errorState
  };
}

export async function listCampaigns() {
  const campaigns = await readStore();
  return [...campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCampaign(id: string) {
  const campaigns = await readStore();
  return campaigns.find((campaign) => campaign.id === id) || null;
}

export async function createCampaign(input: CampaignInput) {
  const campaigns = await readStore();
  const timestamp = nowIso();
  const campaign = normalizeCampaign({
    ...input,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await writeStore([...campaigns, campaign]);
  return campaign;
}

export async function updateCampaign(id: string, input: CampaignInput) {
  const campaigns = await readStore();
  const index = campaigns.findIndex((campaign) => campaign.id === id);

  if (index < 0) {
    return null;
  }

  const current = campaigns[index];
  const next = normalizeCampaign({
    ...current,
    ...input,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowIso()
  });
  const nextCampaigns = [...campaigns];
  nextCampaigns[index] = next;
  await writeStore(nextCampaigns);
  return next;
}

export async function deleteCampaign(id: string) {
  const campaigns = await readStore();
  const next = campaigns.filter((campaign) => campaign.id !== id);

  if (next.length === campaigns.length) {
    return false;
  }

  await writeStore(next);
  return true;
}

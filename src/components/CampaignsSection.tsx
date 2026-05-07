"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createSampleCampaignRecipient,
  createCampaignPreview
} from "@/lib/campaignPreviewService";
import {
  activeCampaignRecipients,
  createCampaignRecipient,
  importRecipientsFromDelimitedText,
  isValidRecipientEmail
} from "@/lib/campaignRecipientService";
import { placeholderCampaignSchedulerService, placeholderCampaignSendService } from "@/lib/campaignSendService";
import { createCampaignTemplateSnapshot } from "@/lib/campaignTemplateSnapshotService";
import type {
  Campaign,
  CampaignListResponse,
  CampaignRecipient,
  CampaignRecipientStatus,
  CampaignResponse,
  CampaignStatus,
  CampaignValidationIssue,
  SavedEmailTemplate,
  TestEmailResponse
} from "@/lib/types";

type CampaignWorkspaceMode =
  | "overview"
  | "template"
  | "recipients"
  | "preview"
  | "settings"
  | "results";

type CampaignRoute =
  | { view: "list" }
  | { view: "new" }
  | { view: "workspace"; campaignId: string; mode: CampaignWorkspaceMode };

type CampaignsSectionProps = {
  templates: SavedEmailTemplate[];
  isLoadingTemplates: boolean;
  onCreateAiTemplate: () => void;
  onCreateBuilderTemplate: () => void;
  onCreateCodeTemplate: () => void;
  onCreateExcelTemplate: () => void;
  onCreateTemplate: () => void;
  onNavigatePath: (path: string) => void;
  onOpenTemplates: () => void;
};

type NewCampaignDraft = {
  name: string;
  subject: string;
  preheader: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  templateId: string;
};

type CampaignOverviewDraft = {
  name: string;
  subject: string;
  preheader: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
};

type CampaignSettingsDraft = {
  requireUnsubscribeLink: boolean;
  requireCompanyAddress: boolean;
  companyAddress: string;
  unsubscribeUrlPlaceholder: string;
  trackingEnabled: boolean;
  scheduledAt: string;
  notes: string;
};

const fieldClass =
  "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const secondaryButtonClass =
  "rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";

const campaignModes: Array<{
  value: CampaignWorkspaceMode;
  label: string;
  path: string;
}> = [
  { value: "overview", label: "Overview", path: "" },
  { value: "template", label: "Template", path: "template" },
  { value: "recipients", label: "Recipients", path: "recipients" },
  { value: "preview", label: "Preview", path: "preview" },
  { value: "settings", label: "Settings", path: "settings" },
  { value: "results", label: "Results", path: "results" }
];

const statusLabels: Record<CampaignStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  archived: "Archived"
};

const statusClass: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  ready: "bg-emerald-100 text-emerald-800",
  scheduled: "bg-sky-100 text-sky-800",
  sending: "bg-amber-100 text-amber-800",
  sent: "bg-brand-soft text-brand-dark",
  failed: "bg-red-100 text-red-800",
  archived: "bg-zinc-100 text-zinc-600"
};

function parseCampaignRoute(pathname: string): CampaignRoute {
  const segments = pathname.split("/").filter(Boolean);
  const [, second, third] = segments;

  if (!second) {
    return { view: "list" };
  }

  if (second === "new") {
    return { view: "new" };
  }

  const mode =
    third === "template" ||
    third === "recipients" ||
    third === "preview" ||
    third === "settings" ||
    third === "results"
      ? third
      : "overview";

  return { view: "workspace", campaignId: second, mode };
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("cs-CZ") : "-";
}

function formatDateTimeInput(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function dateTimeInputToIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function templateSourceLabel(template?: SavedEmailTemplate | null) {
  if (!template) {
    return "No template";
  }

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

function campaignHtmlBaseName(campaign: Campaign) {
  return (
    campaign.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "campaign"
  );
}

function downloadCampaignHtml(campaign: Campaign) {
  const html = campaign.templateSnapshot?.html || "";

  if (!html.trim()) {
    return;
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${campaignHtmlBaseName(campaign)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function activeRecipientCount(campaign: Campaign) {
  return activeCampaignRecipients(campaign.recipients.recipients).length;
}

function campaignValidation(campaign: Campaign, requireProvider = false) {
  return placeholderCampaignSendService.validateBeforeSend(campaign, {
    requireProvider
  });
}

export default function CampaignsSection(props: CampaignsSectionProps) {
  const [route, setRoute] = useState<CampaignRoute>(() =>
    typeof window === "undefined"
      ? { view: "list" }
      : parseCampaignRoute(window.location.pathname)
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCampaigns();
  }, []);

  useEffect(() => {
    function handlePopState() {
      setRoute(parseCampaignRoute(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectedCampaign =
    route.view === "workspace"
      ? campaigns.find((campaign) => campaign.id === route.campaignId) || null
      : null;

  function navigate(path: string) {
    props.onNavigatePath(path);
    setRoute(parseCampaignRoute(path));
  }

  async function loadCampaigns() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const data = (await response.json()) as CampaignListResponse;

      if (!data.ok) {
        setError(data.error);
        return;
      }

      setCampaigns(data.campaigns);
      setStatus(
        data.campaigns.length
          ? `Nacteno ${data.campaigns.length} kampani.`
          : "Zatim neni ulozena zadna kampan."
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Kampane se nepodarilo nacist."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function createCampaign(input: Partial<Campaign>) {
    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = (await response.json()) as CampaignResponse;

      if (!data.ok) {
        setError(data.error);
        return null;
      }

      setCampaigns((current) => [data.campaign, ...current]);
      setStatus(`Kampan "${data.campaign.name}" byla vytvorena.`);
      return data.campaign;
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Kampan se nepodarilo vytvorit."
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCampaign(id: string, input: Partial<Campaign>) {
    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = (await response.json()) as CampaignResponse;

      if (!data.ok) {
        setError(data.error);
        return null;
      }

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === data.campaign.id ? data.campaign : campaign
        )
      );
      setStatus(`Kampan "${data.campaign.name}" byla ulozena.`);
      return data.campaign;
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Kampan se nepodarilo ulozit."
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`Smazat kampan "${campaign.name}"?`)) {
      return;
    }

    setError("");
    setStatus("");

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setError(data.error || "Kampan se nepodarilo smazat.");
        return;
      }

      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setStatus(`Kampan "${campaign.name}" byla smazana.`);
      navigate("/campaigns");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Kampan se nepodarilo smazat."
      );
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    const duplicated = await createCampaign({
      name: `${campaign.name} kopie`,
      subject: campaign.subject,
      preheader: campaign.preheader,
      sender: campaign.sender,
      status: "draft",
      templateReference: campaign.templateReference,
      templateSnapshot: campaign.templateSnapshot
        ? {
            ...campaign.templateSnapshot,
            snapshotCreatedAt: new Date().toISOString()
          }
        : undefined,
      recipients: campaign.recipients,
      settings: campaign.settings,
      schedule: {
        timezone: campaign.schedule.timezone,
        schedulerStatus: "not-configured"
      },
      resultSummary: undefined,
      events: []
    });

    if (duplicated) {
      navigate(`/campaigns/${duplicated.id}`);
    }
  }

  async function renameCampaign(campaign: Campaign) {
    const nextName = window.prompt("Novy nazev kampane", campaign.name);
    if (!nextName?.trim() || nextName.trim() === campaign.name) {
      return;
    }

    await saveCampaign(campaign.id, { name: nextName.trim() });
  }

  async function archiveCampaign(campaign: Campaign) {
    await saveCampaign(campaign.id, { status: "archived" });
  }

  if (route.view === "new") {
    return (
      <NewCampaignFlow
        error={error}
        isSaving={isSaving}
        status={status}
        templates={props.templates}
        isLoadingTemplates={props.isLoadingTemplates}
        onBack={() => navigate("/campaigns")}
        onCreate={async (draft) => {
          const template = props.templates.find((item) => item.id === draft.templateId);
          const snapshot = template ? createCampaignTemplateSnapshot(template) : undefined;
          const campaign = await createCampaign({
            name: draft.name,
            subject: draft.subject,
            preheader: draft.preheader,
            sender: {
              name: draft.senderName,
              email: draft.senderEmail,
              replyToEmail: draft.replyToEmail || undefined
            },
            templateReference: snapshot?.templateId
              ? {
                  templateId: snapshot.templateId,
                  templateName: snapshot.templateName
                }
              : undefined,
            templateSnapshot: snapshot
          });

          if (campaign) {
            navigate(`/campaigns/${campaign.id}`);
          }
        }}
        onCreateAiTemplate={props.onCreateAiTemplate}
        onCreateBuilderTemplate={props.onCreateBuilderTemplate}
        onCreateCodeTemplate={props.onCreateCodeTemplate}
        onCreateExcelTemplate={props.onCreateExcelTemplate}
        onCreateTemplate={props.onCreateTemplate}
      />
    );
  }

  if (route.view === "workspace") {
    if (!selectedCampaign) {
      return (
        <section className="min-h-0 flex-1 overflow-auto">
          <PageHeader
            eyebrow="Campaigns"
            title="Campaign not found"
            description="The campaign could not be loaded from local storage."
            actionLabel="Back to campaigns"
            onAction={() => navigate("/campaigns")}
          />
          {isLoading ? (
            <p className="mt-4 rounded-md border border-line bg-white p-4 text-sm text-muted">
              Loading campaigns...
            </p>
          ) : null}
        </section>
      );
    }

    return (
      <CampaignWorkspace
        campaign={selectedCampaign}
        error={error}
        isSaving={isSaving}
        mode={route.mode}
        status={status}
        templates={props.templates}
        onArchive={() => archiveCampaign(selectedCampaign)}
        onBack={() => navigate("/campaigns")}
        onDelete={() => deleteCampaign(selectedCampaign)}
        onDuplicate={() => duplicateCampaign(selectedCampaign)}
        onExportHtml={() => downloadCampaignHtml(selectedCampaign)}
        onModeChange={(mode) => {
          const suffix = campaignModes.find((item) => item.value === mode)?.path || "";
          navigate(`/campaigns/${selectedCampaign.id}${suffix ? `/${suffix}` : ""}`);
        }}
        onOpenTemplateLibrary={props.onOpenTemplates}
        onCreateAiTemplate={props.onCreateAiTemplate}
        onCreateBuilderTemplate={props.onCreateBuilderTemplate}
        onCreateCodeTemplate={props.onCreateCodeTemplate}
        onCreateExcelTemplate={props.onCreateExcelTemplate}
        onSave={(input) => saveCampaign(selectedCampaign.id, input)}
        onSetStatus={(nextStatus) => saveCampaign(selectedCampaign.id, { status: nextStatus })}
      />
    );
  }

  return (
    <CampaignOverviewPage
      campaigns={campaigns}
      error={error}
      isLoading={isLoading}
      status={status}
      onArchive={archiveCampaign}
      onCreate={() => navigate("/campaigns/new")}
      onDelete={deleteCampaign}
      onDuplicate={duplicateCampaign}
      onExportHtml={downloadCampaignHtml}
      onOpen={(campaign) => navigate(`/campaigns/${campaign.id}`)}
      onPreview={(campaign) => navigate(`/campaigns/${campaign.id}/preview`)}
      onRefresh={loadCampaigns}
      onRename={renameCampaign}
      onResults={(campaign) => navigate(`/campaigns/${campaign.id}/results`)}
    />
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
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {props.description}
          </p>
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

function CampaignOverviewPage(props: {
  campaigns: Campaign[];
  error: string;
  isLoading: boolean;
  status: string;
  onArchive: (campaign: Campaign) => void;
  onCreate: () => void;
  onDelete: (campaign: Campaign) => void;
  onDuplicate: (campaign: Campaign) => void;
  onExportHtml: (campaign: Campaign) => void;
  onOpen: (campaign: Campaign) => void;
  onPreview: (campaign: Campaign) => void;
  onRefresh: () => void;
  onRename: (campaign: Campaign) => void;
  onResults: (campaign: Campaign) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const filteredCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return props.campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        campaign.name.toLowerCase().includes(normalizedQuery) ||
        campaign.subject.toLowerCase().includes(normalizedQuery) ||
        campaign.templateSnapshot?.templateName.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [props.campaigns, query, statusFilter]);

  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        eyebrow="Campaign management"
        title="Campaigns"
        description="Create sendable campaign instances from template snapshots, manage recipients, preview personalized emails, and prepare scheduling without changing reusable templates."
        actionLabel="New campaign"
        onAction={props.onCreate}
      />

      <div className="mt-5 rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_auto_auto] lg:items-center">
          <input
            className={fieldClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns"
          />
          <select
            className={fieldClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CampaignStatus | "all")}
            aria-label="Filter campaign status"
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={props.onRefresh}
            disabled={props.isLoading}
          >
            Refresh
          </button>
          <span className="text-sm text-muted">
            {props.isLoading ? "Loading..." : `${filteredCampaigns.length} campaigns`}
          </span>
        </div>
      </div>

      <StatusMessages error={props.error} status={props.status} />

      {filteredCampaigns.length ? (
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
          <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-line bg-panel text-xs uppercase tracking-[0.06em] text-muted">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="align-top hover:bg-panel/60">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-bold text-ink hover:text-brand-dark"
                      onClick={() => props.onOpen(campaign)}
                    >
                      {campaign.name}
                    </button>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-muted">
                    <span className="line-clamp-2">{campaign.subject || "-"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {campaign.templateSnapshot?.templateName || "No template"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{campaign.recipientCount}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(campaign.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(campaign.updatedAt)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(campaign.schedule.scheduledAt)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(campaign.sentAt)}</td>
                  <td className="px-4 py-3">
                    <CampaignActionsMenu
                      campaign={campaign}
                      onArchive={props.onArchive}
                      onDelete={props.onDelete}
                      onDuplicate={props.onDuplicate}
                      onExportHtml={props.onExportHtml}
                      onOpen={props.onOpen}
                      onPreview={props.onPreview}
                      onRename={props.onRename}
                      onResults={props.onResults}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-line bg-white p-8 text-center shadow-sm">
          <p className="text-base font-bold text-ink">No campaigns</p>
          <p className="mt-2 text-sm text-muted">
            Create a campaign, choose a template snapshot, add recipients, then preview it before sending is connected.
          </p>
          <button type="button" className={`${primaryButtonClass} mt-4`} onClick={props.onCreate}>
            New campaign
          </button>
        </div>
      )}
    </section>
  );
}

function CampaignActionsMenu(props: {
  campaign: Campaign;
  onArchive: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onDuplicate: (campaign: Campaign) => void;
  onExportHtml: (campaign: Campaign) => void;
  onOpen: (campaign: Campaign) => void;
  onPreview: (campaign: Campaign) => void;
  onRename: (campaign: Campaign) => void;
  onResults: (campaign: Campaign) => void;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface">
        Actions
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-md border border-line bg-white p-2 shadow-xl">
        <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onOpen(props.campaign)}>
          Open/edit
        </button>
        <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onPreview(props.campaign)}>
          Preview
        </button>
        <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onDuplicate(props.campaign)}>
          Duplicate
        </button>
        <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onRename(props.campaign)}>
          Rename
        </button>
        <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={() => props.onArchive(props.campaign)}>
          Archive
        </button>
        <button
          type="button"
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:text-muted"
          disabled={!props.campaign.templateSnapshot?.html}
          onClick={() => props.onExportHtml(props.campaign)}
        >
          Export campaign HTML
        </button>
        <button
          type="button"
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:text-muted"
          disabled={props.campaign.status !== "sent"}
          onClick={() => props.onResults(props.campaign)}
        >
          View results
        </button>
        <button type="button" className="rounded px-2 py-1.5 text-left text-red-700 hover:bg-red-50" onClick={() => props.onDelete(props.campaign)}>
          Delete
        </button>
      </div>
    </details>
  );
}

function NewCampaignFlow(props: {
  error: string;
  isSaving: boolean;
  status: string;
  templates: SavedEmailTemplate[];
  isLoadingTemplates: boolean;
  onBack: () => void;
  onCreate: (draft: NewCampaignDraft) => void;
  onCreateAiTemplate: () => void;
  onCreateBuilderTemplate: () => void;
  onCreateCodeTemplate: () => void;
  onCreateExcelTemplate: () => void;
  onCreateTemplate: () => void;
}) {
  const [draft, setDraft] = useState<NewCampaignDraft>({
    name: "",
    subject: "",
    preheader: "",
    senderName: "",
    senderEmail: "",
    replyToEmail: "",
    templateId: props.templates[0]?.id || ""
  });
  const selectedTemplate = props.templates.find((template) => template.id === draft.templateId);
  const canCreate = draft.name.trim().length > 0;

  function update<Key extends keyof NewCampaignDraft>(key: Key, value: NewCampaignDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        eyebrow="Campaigns"
        title="New campaign"
        description="Create a draft campaign from reusable templates. The selected template is saved as a campaign snapshot so later template edits do not change this campaign unexpectedly."
      />

      <StatusMessages error={props.error} status={props.status} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Campaign basics</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField label="Campaign name" value={draft.name} onChange={(value) => update("name", value)} />
            <TextField label="Email subject" value={draft.subject} onChange={(value) => update("subject", value)} />
            <TextField label="Preheader text" value={draft.preheader} onChange={(value) => update("preheader", value)} />
            <TextField label="Sender name" value={draft.senderName} onChange={(value) => update("senderName", value)} />
            <TextField label="Sender email" value={draft.senderEmail} onChange={(value) => update("senderEmail", value)} />
            <TextField label="Reply-to email" value={draft.replyToEmail} onChange={(value) => update("replyToEmail", value)} />
          </div>
        </section>

        <aside className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Template source</h2>
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-ink">Existing template</span>
            <select
              className={fieldClass}
              value={draft.templateId}
              onChange={(event) => update("templateId", event.target.value)}
            >
              <option value="">No template yet</option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({templateSourceLabel(template)})
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-muted">
            {props.isLoadingTemplates
              ? "Loading templates..."
              : selectedTemplate
                ? `Snapshot will use ${templateSourceLabel(selectedTemplate)} MJML and compiled HTML.`
                : "You can create a campaign draft now and attach a template later."}
          </p>

          <div className="mt-5 grid gap-2">
            <button type="button" className={secondaryButtonClass} onClick={props.onCreateTemplate}>
              Create new template
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onCreateAiTemplate}>
              Use AI-generated template
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onCreateExcelTemplate}>
              Use Excel-generated template
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onCreateBuilderTemplate}>
              Use MJML Builder template
            </button>
            <button type="button" className={secondaryButtonClass} onClick={props.onCreateCodeTemplate}>
              Use raw MJML template
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={props.onBack}>
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!canCreate || props.isSaving}
              onClick={() => props.onCreate(draft)}
            >
              {props.isSaving ? "Creating..." : "Save as draft"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CampaignWorkspace(props: {
  campaign: Campaign;
  error: string;
  isSaving: boolean;
  mode: CampaignWorkspaceMode;
  status: string;
  templates: SavedEmailTemplate[];
  onArchive: () => void;
  onBack: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExportHtml: () => void;
  onModeChange: (mode: CampaignWorkspaceMode) => void;
  onOpenTemplateLibrary: () => void;
  onCreateAiTemplate: () => void;
  onCreateBuilderTemplate: () => void;
  onCreateCodeTemplate: () => void;
  onCreateExcelTemplate: () => void;
  onSave: (input: Partial<Campaign>) => Promise<Campaign | null>;
  onSetStatus: (status: CampaignStatus) => Promise<Campaign | null>;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden">
      <CampaignWorkspaceLayout
        campaign={props.campaign}
        isSaving={props.isSaving}
        mode={props.mode}
        onArchive={props.onArchive}
        onBack={props.onBack}
        onDelete={props.onDelete}
        onDuplicate={props.onDuplicate}
        onExportHtml={props.onExportHtml}
        onModeChange={props.onModeChange}
      >
        <StatusMessages error={props.error} status={props.status} />

        {props.mode === "template" ? (
          <CampaignTemplateMode
            key={`${props.campaign.id}-${props.campaign.updatedAt}-template`}
            campaign={props.campaign}
            templates={props.templates}
            onCreateAiTemplate={props.onCreateAiTemplate}
            onCreateBuilderTemplate={props.onCreateBuilderTemplate}
            onCreateCodeTemplate={props.onCreateCodeTemplate}
            onCreateExcelTemplate={props.onCreateExcelTemplate}
            onOpenTemplateLibrary={props.onOpenTemplateLibrary}
            onSave={props.onSave}
          />
        ) : props.mode === "recipients" ? (
          <CampaignRecipientsMode
            key={`${props.campaign.id}-${props.campaign.updatedAt}-recipients`}
            campaign={props.campaign}
            onSave={props.onSave}
          />
        ) : props.mode === "preview" ? (
          <CampaignPreviewMode
            key={`${props.campaign.id}-${props.campaign.updatedAt}-preview`}
            campaign={props.campaign}
          />
        ) : props.mode === "settings" ? (
          <CampaignSettingsMode
            key={`${props.campaign.id}-${props.campaign.updatedAt}-settings`}
            campaign={props.campaign}
            onSave={props.onSave}
          />
        ) : props.mode === "results" ? (
          <CampaignResultsMode campaign={props.campaign} />
        ) : (
          <CampaignOverviewMode
            key={`${props.campaign.id}-${props.campaign.updatedAt}-overview`}
            campaign={props.campaign}
            isSaving={props.isSaving}
            onSave={props.onSave}
            onSetStatus={props.onSetStatus}
          />
        )}
      </CampaignWorkspaceLayout>
    </section>
  );
}

function CampaignWorkspaceLayout(props: {
  campaign: Campaign;
  children: ReactNode;
  isSaving: boolean;
  mode: CampaignWorkspaceMode;
  onArchive: () => void;
  onBack: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExportHtml: () => void;
  onModeChange: (mode: CampaignWorkspaceMode) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="shrink-0 rounded-lg border border-line bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <button type="button" className="hover:text-brand-dark" onClick={props.onBack}>
                Campaigns
              </button>
              <span>/</span>
              <span>{props.campaign.id}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-bold text-ink">{props.campaign.name}</h1>
              <StatusBadge status={props.campaign.status} />
              {props.isSaving ? <span className="text-xs text-muted">Saving...</span> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <CampaignModeSwitcher
              activeMode={props.mode}
              onModeChange={props.onModeChange}
            />
            <details className="relative">
              <summary className={secondaryButtonClass}>Actions</summary>
              <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-md border border-line bg-white p-2 text-sm shadow-xl">
                <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={props.onDuplicate}>
                  Duplicate
                </button>
                <button type="button" className="rounded px-2 py-1.5 text-left hover:bg-panel" onClick={props.onArchive}>
                  Archive
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:text-muted"
                  disabled={!props.campaign.templateSnapshot?.html}
                  onClick={props.onExportHtml}
                >
                  Export campaign HTML
                </button>
                <button type="button" className="rounded px-2 py-1.5 text-left text-red-700 hover:bg-red-50" onClick={props.onDelete}>
                  Delete
                </button>
              </div>
            </details>
          </div>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-auto">{props.children}</div>
    </div>
  );
}

function CampaignModeSwitcher(props: {
  activeMode: CampaignWorkspaceMode;
  onModeChange: (mode: CampaignWorkspaceMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:flex" role="tablist" aria-label="Campaign mode">
      {campaignModes.map((mode) => {
        const isActive = props.activeMode === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`rounded-md px-3 py-2 text-xs font-bold transition ${
              isActive
                ? "bg-brand text-white"
                : "border border-line bg-white text-ink hover:bg-brand-soft"
            }`}
            onClick={() => props.onModeChange(mode.value)}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function CampaignOverviewMode(props: {
  campaign: Campaign;
  isSaving: boolean;
  onSave: (input: Partial<Campaign>) => Promise<Campaign | null>;
  onSetStatus: (status: CampaignStatus) => Promise<Campaign | null>;
}) {
  const [draft, setDraft] = useState<CampaignOverviewDraft>(() => ({
    name: props.campaign.name,
    subject: props.campaign.subject,
    preheader: props.campaign.preheader,
    senderName: props.campaign.sender.name,
    senderEmail: props.campaign.sender.email,
    replyToEmail: props.campaign.sender.replyToEmail || ""
  }));
  const readinessIssues = campaignValidation(props.campaign, false);
  const sendIssues = campaignValidation(props.campaign, true);

  function update<Key extends keyof CampaignOverviewDraft>(
    key: Key,
    value: CampaignOverviewDraft[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    await props.onSave({
      name: draft.name,
      subject: draft.subject,
      preheader: draft.preheader,
      sender: {
        name: draft.senderName,
        email: draft.senderEmail,
        replyToEmail: draft.replyToEmail || undefined
      }
    });
  }

  async function markReady() {
    const errors = readinessIssues.filter((issue) => issue.type === "error");
    if (errors.length) {
      window.alert(errors[0].message);
      return;
    }

    await props.onSetStatus("ready");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink">Campaign overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="Campaign name" value={draft.name} onChange={(value) => update("name", value)} />
          <TextField label="Email subject" value={draft.subject} onChange={(value) => update("subject", value)} />
          <TextField label="Preheader text" value={draft.preheader} onChange={(value) => update("preheader", value)} />
          <TextField label="Sender name" value={draft.senderName} onChange={(value) => update("senderName", value)} />
          <TextField label="Sender email" value={draft.senderEmail} onChange={(value) => update("senderEmail", value)} />
          <TextField label="Reply-to email" value={draft.replyToEmail} onChange={(value) => update("replyToEmail", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} disabled={props.isSaving} onClick={save}>
            Save draft
          </button>
          <button type="button" className={secondaryButtonClass} onClick={markReady}>
            Mark as ready
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => window.alert(sendIssues.find((issue) => issue.field === "provider")?.message || "Sending provider is not configured.")}
          >
            Send not configured
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <CampaignSummaryCard campaign={props.campaign} />
        <CampaignValidationPanel issues={readinessIssues} />
      </aside>
    </div>
  );
}

function CampaignTemplateMode(props: {
  campaign: Campaign;
  templates: SavedEmailTemplate[];
  onCreateAiTemplate: () => void;
  onCreateBuilderTemplate: () => void;
  onCreateCodeTemplate: () => void;
  onCreateExcelTemplate: () => void;
  onOpenTemplateLibrary: () => void;
  onSave: (input: Partial<Campaign>) => Promise<Campaign | null>;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    props.campaign.templateSnapshot?.templateId || props.templates[0]?.id || ""
  );
  const selectedTemplate = props.templates.find((template) => template.id === selectedTemplateId);
  const originalTemplate = props.campaign.templateSnapshot?.templateId
    ? props.templates.find((template) => template.id === props.campaign.templateSnapshot?.templateId)
    : null;

  async function saveSnapshot() {
    if (!selectedTemplate) {
      return;
    }

    const snapshot = createCampaignTemplateSnapshot(selectedTemplate);
    await props.onSave({
      templateReference: snapshot.templateId
        ? {
            templateId: snapshot.templateId,
            templateName: snapshot.templateName
          }
        : undefined,
      templateSnapshot: snapshot
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink">Selected template snapshot</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Campaigns keep a snapshot of MJML and compiled HTML. The original template can continue changing without altering prepared campaigns.
        </p>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-ink">Choose saved template</span>
          <select
            className={fieldClass}
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
          >
            <option value="">Select template</option>
            {props.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({templateSourceLabel(template)})
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} disabled={!selectedTemplate} onClick={saveSnapshot}>
            Save template snapshot
          </button>
          <button type="button" className={secondaryButtonClass} onClick={props.onOpenTemplateLibrary}>
            Open template library
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <TemplateActionCard title="AI-generated template" onClick={props.onCreateAiTemplate} />
          <TemplateActionCard title="Excel-generated template" onClick={props.onCreateExcelTemplate} />
          <TemplateActionCard title="MJML Builder template" onClick={props.onCreateBuilderTemplate} />
          <TemplateActionCard title="Raw MJML template" onClick={props.onCreateCodeTemplate} />
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-ink">Snapshot info</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <InfoRow label="Snapshot template" value={props.campaign.templateSnapshot?.templateName || "None"} />
            <InfoRow label="Source type" value={props.campaign.templateSnapshot?.sourceType || "-"} />
            <InfoRow label="Snapshot date" value={formatDate(props.campaign.templateSnapshot?.snapshotCreatedAt)} />
            <InfoRow label="Original updated" value={formatDate(props.campaign.templateSnapshot?.templateUpdatedAt)} />
            <InfoRow label="Original exists" value={originalTemplate ? "Yes" : props.campaign.templateSnapshot?.templateId ? "Missing" : "-"} />
          </dl>
        </section>

        <section className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line p-4">
            <h3 className="text-sm font-bold text-ink">Preview thumbnail</h3>
          </div>
          <div className="h-72 overflow-hidden bg-panel">
            {props.campaign.templateSnapshot?.html ? (
              <iframe
                title="Campaign template snapshot preview"
                className="h-[860px] w-[600px] origin-top-left scale-[0.45] bg-white"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={props.campaign.templateSnapshot.html}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">
                No template snapshot selected.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function CampaignRecipientsMode(props: {
  campaign: Campaign;
  onSave: (input: Partial<Campaign>) => Promise<Campaign | null>;
}) {
  const [manual, setManual] = useState({
    email: "",
    firstName: "",
    lastName: "",
    company: ""
  });
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState(props.campaign.recipients.invalidRows || []);
  const [localError, setLocalError] = useState("");

  async function saveRecipients(recipients: CampaignRecipient[], source = props.campaign.recipients.source) {
    await props.onSave({
      recipients: {
        ...props.campaign.recipients,
        source,
        recipients,
        invalidRows: importErrors,
        updatedAt: new Date().toISOString()
      }
    });
  }

  async function addManualRecipient() {
    const email = manual.email.trim().toLowerCase();
    setLocalError("");

    if (!isValidRecipientEmail(email)) {
      setLocalError("Zadejte validni e-mail prijemce.");
      return;
    }

    if (props.campaign.recipients.recipients.some((recipient) => recipient.email === email)) {
      setLocalError("Tento prijemce uz v kampani je.");
      return;
    }

    const recipient = createCampaignRecipient(
      {
        email,
        firstName: manual.firstName,
        lastName: manual.lastName,
        company: manual.company
      },
      "manual"
    );
    await saveRecipients([...props.campaign.recipients.recipients, recipient], "manual");
    setManual({ email: "", firstName: "", lastName: "", company: "" });
  }

  async function importRecipients() {
    const result = importRecipientsFromDelimitedText(
      importText,
      props.campaign.recipients.recipients,
      importText.includes("\t") ? "excel-paste" : "csv-import"
    );
    setImportErrors(result.errors);

    if (result.recipients.length) {
      await props.onSave({
        recipients: {
          ...props.campaign.recipients,
          source: importText.includes("\t") ? "excel-paste" : "csv-import",
          recipients: [...props.campaign.recipients.recipients, ...result.recipients],
          invalidRows: result.errors,
          duplicateCount: result.duplicateCount,
          updatedAt: new Date().toISOString()
        }
      });
      setImportText("");
    }
  }

  async function removeRecipient(id: string) {
    await saveRecipients(
      props.campaign.recipients.recipients.filter((recipient) => recipient.id !== id)
    );
  }

  async function updateRecipientStatus(id: string, status: CampaignRecipientStatus) {
    await saveRecipients(
      props.campaign.recipients.recipients.map((recipient) =>
        recipient.id === id ? { ...recipient, status } : recipient
      )
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Manual recipient</h2>
          <div className="mt-4 grid gap-3">
            <TextField label="Email" value={manual.email} onChange={(value) => setManual((current) => ({ ...current, email: value }))} />
            <TextField label="First name" value={manual.firstName} onChange={(value) => setManual((current) => ({ ...current, firstName: value }))} />
            <TextField label="Last name" value={manual.lastName} onChange={(value) => setManual((current) => ({ ...current, lastName: value }))} />
            <TextField label="Company" value={manual.company} onChange={(value) => setManual((current) => ({ ...current, company: value }))} />
            {localError ? <p className="text-sm text-red-700">{localError}</p> : null}
            <button type="button" className={primaryButtonClass} onClick={addManualRecipient}>
              Add recipient
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">CSV / Excel paste import</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Paste rows with headers like email, first_name, last_name, company. Copied Excel rows are kept separate from the template assembly workflow.
          </p>
          <textarea
            className={`${fieldClass} min-h-36 resize-y`}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={"email,first_name,last_name,company\njana@example.com,Jana,Novakova,Example"}
          />
          <button type="button" className={`${primaryButtonClass} mt-3`} onClick={importRecipients}>
            Import recipients
          </button>
        </section>
      </aside>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">Recipients</h2>
            <p className="mt-1 text-sm text-muted">
              {activeRecipientCount(props.campaign)} active of {props.campaign.recipients.recipients.length} total.
            </p>
          </div>
          <span className="rounded-md bg-panel px-3 py-2 text-sm font-bold text-muted">
            Source: {props.campaign.recipients.source}
          </span>
        </div>

        {importErrors.length ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-bold">Import notes</p>
            <ul className="mt-2 space-y-1">
              {importErrors.slice(0, 8).map((item) => (
                <li key={`${item.rowNumber}-${item.email || item.message}`}>
                  Row {item.rowNumber}: {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {props.campaign.recipients.recipients.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-panel text-xs uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {props.campaign.recipients.recipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td className="px-3 py-2 font-semibold text-ink">{recipient.email}</td>
                    <td className="px-3 py-2 text-muted">
                      {[recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td className="px-3 py-2 text-muted">{recipient.company || "-"}</td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded-md border border-line bg-white px-2 py-1 text-sm"
                        value={recipient.status}
                        onChange={(event) =>
                          updateRecipientStatus(
                            recipient.id,
                            event.target.value as CampaignRecipientStatus
                          )
                        }
                      >
                        <option value="active">Active</option>
                        <option value="unsubscribed">Unsubscribed</option>
                        <option value="suppressed">Suppressed</option>
                        <option value="invalid">Invalid</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className={secondaryButtonClass} onClick={() => removeRecipient(recipient.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 rounded-md border border-dashed border-line bg-panel p-6 text-center text-sm text-muted">
            No recipients yet. Add one manually or paste CSV / copied Excel rows.
          </p>
        )}
      </section>
    </div>
  );
}

function CampaignPreviewMode(props: { campaign: Campaign }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sample, setSample] = useState<CampaignRecipient>(() => createSampleCampaignRecipient());
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [testError, setTestError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const preview = useMemo(() => createCampaignPreview(props.campaign, sample), [props.campaign, sample]);

  function updateSample(key: "email" | "firstName" | "lastName" | "company", value: string) {
    setSample((current) => ({ ...current, [key]: value }));
  }

  async function sendTest() {
    setTestError("");
    setTestStatus("");

    if (!isValidRecipientEmail(testEmail)) {
      setTestError("Zadejte validni testovaci e-mail.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`/api/campaigns/${props.campaign.id}/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: testEmail.trim() })
      });
      const data = (await response.json()) as TestEmailResponse;

      if (!data.ok) {
        setTestError(data.error);
        return;
      }

      setTestStatus(data.message);
    } catch (error) {
      setTestError(
        error instanceof Error ? error.message : "Testovaci e-mail se nepodarilo odeslat."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Subject preview</h2>
          <div className="mt-3 rounded-md border border-line bg-panel p-3">
            <p className="text-sm font-bold text-ink">{preview.subject || "No subject"}</p>
            <p className="mt-1 text-xs text-muted">{preview.preheader || "No preheader"}</p>
            <p className="mt-2 text-xs text-muted">
              From: {props.campaign.sender.name || "-"} &lt;{props.campaign.sender.email || "-"}&gt;
            </p>
          </div>
          <InfoRow label="Template" value={props.campaign.templateSnapshot?.templateName || "None"} />
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Merge tag sample</h2>
          <div className="mt-3 grid gap-3">
            <TextField label="First name" value={sample.firstName || ""} onChange={(value) => updateSample("firstName", value)} />
            <TextField label="Last name" value={sample.lastName || ""} onChange={(value) => updateSample("lastName", value)} />
            <TextField label="Email" value={sample.email} onChange={(value) => updateSample("email", value)} />
            <TextField label="Company" value={sample.company || ""} onChange={(value) => updateSample("company", value)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {preview.mergeTags.length ? (
              preview.mergeTags.map((tag) => (
                <span key={tag} className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold text-muted">
                  {`{{${tag}}}`}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted">No merge tags detected.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink">Test email</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Test sending uses the campaign email provider interface. It currently returns not configured until a provider is connected.
          </p>
          <TextField label="Test recipient" value={testEmail} onChange={setTestEmail} />
          <button type="button" className={`${primaryButtonClass} mt-3`} disabled={isSending} onClick={sendTest}>
            {isSending ? "Sending..." : "Send test email"}
          </button>
          {testError ? <p className="mt-3 text-sm text-red-700">{testError}</p> : null}
          {testStatus ? <p className="mt-3 text-sm text-emerald-700">{testStatus}</p> : null}
        </section>
      </aside>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">Rendered HTML preview</h2>
            <p className="mt-1 text-sm text-muted">HTML is generated from the saved MJML snapshot.</p>
          </div>
          <div className="flex gap-1 rounded-md border border-line bg-white p-1">
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-bold ${device === "desktop" ? "bg-brand text-white" : "text-ink hover:bg-panel"}`}
              onClick={() => setDevice("desktop")}
            >
              Desktop
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-bold ${device === "mobile" ? "bg-brand text-white" : "text-ink hover:bg-panel"}`}
              onClick={() => setDevice("mobile")}
            >
              Mobile
            </button>
          </div>
        </div>
        <div className="mt-4 flex justify-center rounded-lg border border-line bg-panel p-4">
          {preview.html ? (
            <iframe
              title="Campaign preview"
              className={`${device === "mobile" ? "max-w-[390px]" : "max-w-[860px]"} h-[720px] w-full rounded-md border border-line bg-white`}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={preview.html}
            />
          ) : (
            <div className="flex h-[520px] w-full items-center justify-center rounded-md border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
              Select a valid template snapshot before previewing this campaign.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CampaignSettingsMode(props: {
  campaign: Campaign;
  onSave: (input: Partial<Campaign>) => Promise<Campaign | null>;
}) {
  const [draft, setDraft] = useState<CampaignSettingsDraft>(() => ({
    requireUnsubscribeLink: props.campaign.settings.requireUnsubscribeLink,
    requireCompanyAddress: props.campaign.settings.requireCompanyAddress,
    companyAddress: props.campaign.settings.companyAddress || "",
    unsubscribeUrlPlaceholder: props.campaign.settings.unsubscribeUrlPlaceholder,
    trackingEnabled: props.campaign.settings.trackingEnabled,
    scheduledAt: formatDateTimeInput(props.campaign.schedule.scheduledAt),
    notes: props.campaign.settings.notes || ""
  }));
  const [scheduleMessage, setScheduleMessage] = useState("");

  async function save() {
    await props.onSave({
      settings: {
        ...props.campaign.settings,
        requireUnsubscribeLink: draft.requireUnsubscribeLink,
        requireCompanyAddress: draft.requireCompanyAddress,
        companyAddress: draft.companyAddress,
        unsubscribeUrlPlaceholder: draft.unsubscribeUrlPlaceholder,
        trackingEnabled: draft.trackingEnabled,
        notes: draft.notes
      },
      schedule: {
        ...props.campaign.schedule,
        scheduledAt: dateTimeInputToIso(draft.scheduledAt),
        schedulerStatus: "not-configured"
      }
    });
  }

  function schedule() {
    const nextCampaign: Campaign = {
      ...props.campaign,
      schedule: {
        ...props.campaign.schedule,
        scheduledAt: dateTimeInputToIso(draft.scheduledAt)
      }
    };
    const issues = placeholderCampaignSchedulerService.validateSchedule(nextCampaign);
    setScheduleMessage(issues[0]?.message || "Scheduling configuration is ready.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink">Campaign settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md border border-line bg-panel p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.requireUnsubscribeLink}
              onChange={(event) => setDraft((current) => ({ ...current, requireUnsubscribeLink: event.target.checked }))}
              className="h-4 w-4 accent-brand"
            />
            Require unsubscribe link
          </label>
          <label className="flex items-center gap-2 rounded-md border border-line bg-panel p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.requireCompanyAddress}
              onChange={(event) => setDraft((current) => ({ ...current, requireCompanyAddress: event.target.checked }))}
              className="h-4 w-4 accent-brand"
            />
            Require company address
          </label>
          <TextField label="Unsubscribe placeholder" value={draft.unsubscribeUrlPlaceholder} onChange={(value) => setDraft((current) => ({ ...current, unsubscribeUrlPlaceholder: value }))} />
          <TextField label="Company address / footer text" value={draft.companyAddress} onChange={(value) => setDraft((current) => ({ ...current, companyAddress: value }))} />
          <label className="flex items-center gap-2 rounded-md border border-line bg-panel p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.trackingEnabled}
              onChange={(event) => setDraft((current) => ({ ...current, trackingEnabled: event.target.checked }))}
              className="h-4 w-4 accent-brand"
            />
            Tracking prepared
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Schedule date/time</span>
            <input
              type="datetime-local"
              className={fieldClass}
              value={draft.scheduledAt}
              onChange={(event) => setDraft((current) => ({ ...current, scheduledAt: event.target.value }))}
            />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-ink">Internal notes</span>
          <textarea
            className={`${fieldClass} min-h-32 resize-y`}
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} onClick={save}>
            Save settings
          </button>
          <button type="button" className={secondaryButtonClass} onClick={schedule}>
            Schedule not configured
          </button>
        </div>
        {scheduleMessage ? <p className="mt-3 text-sm text-amber-800">{scheduleMessage}</p> : null}
      </section>

      <aside className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink">Sending abstraction</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          No email provider is configured in this app. Campaigns can be drafted, validated, marked ready, exported, and prepared for a future provider.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <InfoRow label="Provider" value="Not configured" />
          <InfoRow label="Scheduler" value={props.campaign.schedule.schedulerStatus} />
          <InfoRow label="Timezone" value={props.campaign.schedule.timezone || "Europe/Prague"} />
        </dl>
      </aside>
    </div>
  );
}

function CampaignResultsMode(props: { campaign: Campaign }) {
  const summary = props.campaign.resultSummary;
  const metrics = [
    ["Sent", summary.sentCount],
    ["Delivered", summary.deliveredCount],
    ["Opened", summary.openCount],
    ["Clicked", summary.clickCount],
    ["Bounced", summary.bounceCount],
    ["Unsubscribed", summary.unsubscribeCount],
    ["Failed", summary.failedCount],
    ["Open rate", `${summary.openRate}%`],
    ["Click rate", `${summary.clickRate}%`]
  ];

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Campaign results</h2>
          <p className="mt-1 text-sm text-muted">
            Analytics are ready for future tracking events. No real analytics are shown until sending and tracking are connected.
          </p>
        </div>
        <StatusBadge status={props.campaign.status} />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-panel p-4">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-md border border-dashed border-line bg-panel p-6 text-center text-sm text-muted">
        No campaign events have been recorded.
      </div>
    </section>
  );
}

function CampaignSummaryCard(props: { campaign: Campaign }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-ink">Campaign status</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <InfoRow label="Status" value={statusLabels[props.campaign.status]} />
        <InfoRow label="Template" value={props.campaign.templateSnapshot?.templateName || "None"} />
        <InfoRow label="Recipients" value={String(activeRecipientCount(props.campaign))} />
        <InfoRow label="Updated" value={formatDate(props.campaign.updatedAt)} />
        <InfoRow label="Scheduled" value={formatDate(props.campaign.schedule.scheduledAt)} />
      </dl>
    </section>
  );
}

function CampaignValidationPanel(props: { issues: CampaignValidationIssue[] }) {
  const errors = props.issues.filter((issue) => issue.type === "error");
  const warnings = props.issues.filter((issue) => issue.type === "warning");

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Validation</h2>
        <span className="rounded-md bg-panel px-2 py-1 text-xs font-bold text-muted">
          {errors.length ? `${errors.length} errors` : warnings.length ? `${warnings.length} warnings` : "Ready"}
        </span>
      </div>
      {props.issues.length ? (
        <ul className="mt-3 space-y-2">
          {props.issues.map((issue) => (
            <li
              key={`${issue.field}-${issue.message}`}
              className={`rounded-md border p-3 text-sm ${
                issue.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <strong>{issue.field}:</strong> {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Campaign has the required basics for ready status.
        </p>
      )}
    </section>
  );
}

function StatusMessages(props: { error?: string; status?: string }) {
  return (
    <>
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
    </>
  );
}

function StatusBadge(props: { status: CampaignStatus }) {
  return (
    <span className={`w-fit rounded-md px-2 py-1 text-xs font-bold ${statusClass[props.status]}`}>
      {statusLabels[props.status]}
    </span>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{props.label}</span>
      <input
        className={fieldClass}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-b-0">
      <dt className="text-muted">{props.label}</dt>
      <dd className="max-w-[220px] text-right font-semibold text-ink">{props.value}</dd>
    </div>
  );
}

function TemplateActionCard(props: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-line bg-panel p-4 text-left transition hover:border-brand hover:bg-white"
      onClick={props.onClick}
    >
      <span className="block text-sm font-bold text-ink">{props.title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted">
        Open the existing template workflow, then return here to select the saved template.
      </span>
    </button>
  );
}

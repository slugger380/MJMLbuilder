import { activeCampaignRecipients, isValidRecipientEmail } from "@/lib/campaignRecipientService";
import type {
  Campaign,
  CampaignValidationIssue,
  TestEmailResponse
} from "@/lib/types";

export interface EmailProviderService {
  isConfigured(): boolean;
  sendTestEmail(input: {
    campaign: Campaign;
    recipientEmail: string;
  }): Promise<TestEmailResponse>;
  sendCampaign(input: { campaign: Campaign }): Promise<TestEmailResponse>;
}

export interface CampaignSendService {
  validateBeforeSend(
    campaign: Campaign,
    options?: { requireProvider?: boolean }
  ): CampaignValidationIssue[];
  sendTestCampaignEmail(campaign: Campaign, recipientEmail: string): Promise<TestEmailResponse>;
}

export interface CampaignSchedulerService {
  isConfigured(): boolean;
  validateSchedule(campaign: Campaign): CampaignValidationIssue[];
}

export const placeholderEmailProviderService: EmailProviderService = {
  isConfigured() {
    return false;
  },
  async sendTestEmail() {
    return {
      ok: false,
      error:
        "Odesilani neni nakonfigurovane. API kontrakt je pripraveny pro SMTP, SendGrid, Mailgun, SES, Resend, Brevo, Ecomail nebo SmartEmailing."
    };
  },
  async sendCampaign() {
    return {
      ok: false,
      error:
        "Odesilani kampani neni nakonfigurovane. Kampan muze byt pripravena jako draft nebo ready, ale nelze ji odeslat bez poskytovatele."
    };
  }
};

function hasUnsubscribePlaceholder(campaign: Campaign) {
  const source = `${campaign.templateSnapshot?.mjml || ""}\n${campaign.templateSnapshot?.html || ""}`;
  return (
    source.includes(campaign.settings.unsubscribeUrlPlaceholder) ||
    source.includes("{{unsubscribe.url}}") ||
    source.includes("{{unsubscribe_url}}")
  );
}

function hasCompanyAddress(campaign: Campaign) {
  const source = `${campaign.templateSnapshot?.mjml || ""}\n${campaign.templateSnapshot?.html || ""}`;
  return Boolean(
    campaign.settings.companyAddress?.trim() ||
      source.includes("{{company.address}}") ||
      source.includes("{{company_address}}")
  );
}

export function createCampaignSendService(
  provider: EmailProviderService = placeholderEmailProviderService
): CampaignSendService {
  return {
    validateBeforeSend(campaign, options = {}) {
      const issues: CampaignValidationIssue[] = [];

      if (!campaign.subject.trim()) {
        issues.push({
          type: "error",
          field: "subject",
          message: "Campaign needs a subject before sending."
        });
      }

      if (!campaign.sender.name.trim() || !isValidRecipientEmail(campaign.sender.email)) {
        issues.push({
          type: "error",
          field: "sender",
          message: "Campaign needs a sender name and valid sender email."
        });
      }

      if (!campaign.templateSnapshot?.mjml.trim() || !campaign.templateSnapshot.html.trim()) {
        issues.push({
          type: "error",
          field: "template",
          message: "Campaign needs a valid template snapshot with MJML and compiled HTML."
        });
      }

      if (activeCampaignRecipients(campaign.recipients.recipients).length === 0) {
        issues.push({
          type: "error",
          field: "recipients",
          message: "Campaign needs at least one active recipient."
        });
      }

      if (campaign.settings.requireUnsubscribeLink && !hasUnsubscribePlaceholder(campaign)) {
        issues.push({
          type: "warning",
          field: "compliance",
          message: `Template should include ${campaign.settings.unsubscribeUrlPlaceholder}.`
        });
      }

      if (campaign.settings.requireCompanyAddress && !hasCompanyAddress(campaign)) {
        issues.push({
          type: "warning",
          field: "compliance",
          message: "Campaign should include a company address in settings or template."
        });
      }

      if (options.requireProvider && !provider.isConfigured()) {
        issues.push({
          type: "error",
          field: "provider",
          message: "Sending provider is not configured."
        });
      }

      return issues;
    },

    async sendTestCampaignEmail(campaign, recipientEmail) {
      if (!isValidRecipientEmail(recipientEmail)) {
        return { ok: false, error: "Zadejte validni testovaci e-mail." };
      }

      const blockingIssues = this.validateBeforeSend(campaign, {
        requireProvider: true
      }).filter((issue) => issue.type === "error" && issue.field !== "recipients");

      if (blockingIssues.length) {
        return { ok: false, error: blockingIssues[0].message };
      }

      return provider.sendTestEmail({ campaign, recipientEmail });
    }
  };
}

export const placeholderCampaignSendService = createCampaignSendService();

export const placeholderCampaignSchedulerService: CampaignSchedulerService = {
  isConfigured() {
    return false;
  },
  validateSchedule(campaign) {
    const issues: CampaignValidationIssue[] = [];

    if (!campaign.schedule.scheduledAt) {
      issues.push({
        type: "error",
        field: "schedule",
        message: "Vyberte datum a cas kampane."
      });
    }

    if (!this.isConfigured()) {
      issues.push({
        type: "error",
        field: "scheduler",
        message: "Planovani kampani neni nakonfigurovane."
      });
    }

    return issues;
  }
};

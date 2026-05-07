import type { BuilderBlock, BuilderTheme } from "@/lib/mjmlBuilder";

export type EmailType =
  | "promo"
  | "informacni"
  | "upozorneni"
  | "onboarding"
  | "servisni";

export type BrandStyleAssetKind =
  | "logo"
  | "font"
  | "example-email"
  | "reference"
  | "image"
  | "other";

export type BrandStyleAsset = {
  id: string;
  styleId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  kind: BrandStyleAssetKind;
  url: string;
  extractedText?: string;
  createdAt: string;
};

export type BrandStyleProfile = {
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    mutedText?: string;
    border?: string;
    custom?: Record<string, string>;
  };
  typography: {
    bodyFont?: string;
    headingFont?: string;
    fallbackFont?: string;
    baseFontSize?: string;
    headingWeight?: string;
    bodyWeight?: string;
  };
  logo: {
    preferredAssetId?: string;
    altText?: string;
    width?: string;
    placement?: string;
  };
  buttonStyle: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    padding?: string;
    fontWeight?: string;
    notes?: string;
  };
  layoutPreferences: {
    maxWidth?: string;
    sectionPadding?: string;
    contentPadding?: string;
    borderRadius?: string;
    density?: string;
  };
  spacingPreferences?: string;
  imageStyle?: string;
  backgroundStyle?: string;
  headerStyle?: string;
  footerStyle?: string;
  toneOfVoice?: string;
  guidelines?: string;
  exampleTemplateNotes?: string;
  extractedFromAssets: {
    colors: string[];
    fonts: string[];
    notes: string[];
    updatedAt?: string;
  };
};

export type BrandStyle = {
  id: string;
  name: string;
  description?: string;
  profile: BrandStyleProfile;
  assets: BrandStyleAsset[];
  createdAt: string;
  updatedAt: string;
};

export type TemplateGenerationRequest = {
  templateId?: "ai";
  brandStyleId: string;
  prompt: string;
};

export type TemplateGenerationResult = {
  subject: string;
  preheader: string;
  mjml: string;
  html: string;
  usedVariables: string[];
  notes: string[];
  issues: ValidationIssue[];
};

export type GenerateEmailRequest = {
  brandStyleId?: string;
  prompt?: string;
  emailType?: EmailType;
  topic?: string;
  mainMessage?: string;
  ctaText?: string;
  ctaUrl?: string;
  notes?: string;
  templateId?: "ai" | "coupons-excel" | "mjml-builder";
  useAiMatching?: boolean;
  useAiReview?: boolean;
  includeSelfServiceAd?: boolean;
  couponMonth?: string;
};

export type GeneratedEmailJson = {
  subject: string;
  preheader: string;
  mjml: string;
  usedVariables: string[];
  notes: string[];
};

export type ValidationIssue = {
  type: "error" | "warning";
  message: string;
  details?: string;
  source?: "ai-review" | "excel-workbook";
  rowNumber?: number | null;
  field?: string | null;
  expected?: string | null;
  actual?: string | null;
  suggestion?: string | null;
};

export type AiSuggestionChange = {
  rowNumber?: number | null;
  field?: string | null;
  message: string;
  expected?: string | null;
  actual?: string | null;
  suggestion: string;
};

export type ApplyAiSuggestionsRequest = {
  subject: string;
  preheader: string;
  mjml: string;
  usedVariables: string[];
  notes: string[];
  suggestions: AiSuggestionChange[];
};

export type GenerateEmailResponse =
  | {
      ok: true;
      subject: string;
      preheader: string;
      mjml: string;
      html: string;
      usedVariables: string[];
      notes: string[];
      issues: ValidationIssue[];
    }
  | {
      ok: false;
      error: string;
      issues?: ValidationIssue[];
    };

export type CompileMjmlResponse =
  | {
      ok: true;
      html: string;
      issues: ValidationIssue[];
    }
  | {
      ok: false;
      error: string;
      issues?: ValidationIssue[];
    };

export type TemplateMode =
  | "dashboard"
  | "templates"
  | "new-template"
  | "ai"
  | "coupons-excel"
  | "mjml-builder"
  | "code"
  | "preview"
  | "settings"
  | "brand-styles"
  | "campaigns"
  | "contacts"
  | "reports"
  | "automation";

export type TemplateSourceType =
  | "blank"
  | "builder"
  | "ai"
  | "excel"
  | "code"
  | "imported";

export type ExcelTemplateSource = {
  fileName?: string;
  templateFileName?: string;
  sheetName?: string;
  month?: string;
  rowCount?: number;
  generatedAt?: string;
  options?: {
    useAiMatching?: boolean;
    useAiReview?: boolean;
    includeSelfServiceAd?: boolean;
  };
  notes?: string[];
};

export type BuilderTemplateState = {
  version: 1;
  source:
    | "builder"
    | "imported-mjml"
    | "ai-generated"
    | "excel-generated"
    | "raw-mjml";
  blocks: BuilderBlock[];
  theme: BuilderTheme;
  customHead: string;
  savedBlocks?: BuilderBlock[];
  mergeTagMocks?: Record<string, string>;
};

export type SavedEmailTemplate = {
  id: string;
  name: string;
  description?: string;
  sourceType?: TemplateSourceType;
  mode?: "builder" | "ai" | "excel" | "code";
  brandStyleId?: string;
  excelSource?: ExcelTemplateSource;
  metadata?: Record<string, string | number | boolean | null>;
  state: BuilderTemplateState;
  mjml: string;
  html: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateListResponse =
  | {
      ok: true;
      templates: SavedEmailTemplate[];
    }
  | {
      ok: false;
      error: string;
    };

export type TemplateResponse =
  | {
      ok: true;
      template: SavedEmailTemplate;
    }
  | {
      ok: false;
      error: string;
    };

export type TestEmailRequest = {
  templateId?: string;
  recipientEmail: string;
  mjml: string;
  html: string;
};

export type TestEmailResponse =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type CampaignStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "archived";

export type CampaignTemplateSourceType =
  | TemplateSourceType
  | "blank"
  | "unknown";

export type CampaignTemplateSnapshot = {
  templateId?: string;
  templateName: string;
  templateUpdatedAt?: string;
  snapshotCreatedAt: string;
  sourceType: CampaignTemplateSourceType;
  brandStyleId?: string;
  mjml: string;
  html: string;
  globalSettings?: Record<string, string | number | boolean | null>;
};

export type CampaignSender = {
  name: string;
  email: string;
  replyToEmail?: string;
};

export type CampaignRecipientStatus =
  | "active"
  | "unsubscribed"
  | "suppressed"
  | "invalid";

export type CampaignRecipientSource =
  | "manual"
  | "csv-import"
  | "excel-paste"
  | "segment";

export type CampaignRecipient = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customFields?: Record<string, string>;
  status: CampaignRecipientStatus;
  source: CampaignRecipientSource;
  createdAt: string;
};

export type CampaignSegment = {
  id: string;
  name: string;
  description?: string;
  recipientCount: number;
};

export type RecipientImportError = {
  rowNumber: number;
  email?: string;
  message: string;
};

export type CampaignRecipients = {
  source: "none" | CampaignRecipientSource;
  recipients: CampaignRecipient[];
  segments?: CampaignSegment[];
  invalidRows?: RecipientImportError[];
  duplicateCount?: number;
  updatedAt?: string;
};

export type CampaignSettings = {
  requireUnsubscribeLink: boolean;
  requireCompanyAddress: boolean;
  companyAddress?: string;
  unsubscribeUrlPlaceholder: string;
  trackingEnabled: boolean;
  notes?: string;
};

export type CampaignSchedule = {
  scheduledAt?: string;
  timezone?: string;
  schedulerStatus: "not-configured" | "draft" | "scheduled" | "cancelled";
};

export type CampaignTestSend = {
  id: string;
  recipientEmail: string;
  status: "not-configured" | "queued" | "sent" | "failed";
  message: string;
  createdAt: string;
};

export type CampaignEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "unsubscribed"
  | "complained"
  | "failed";

export type CampaignEvent = {
  id: string;
  type: CampaignEventType;
  recipientEmail?: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type CampaignResultSummary = {
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubscribeCount: number;
  failedCount: number;
  openRate: number;
  clickRate: number;
  lastActivityAt?: string;
};

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  sender: CampaignSender;
  status: CampaignStatus;
  templateReference?: {
    templateId: string;
    templateName: string;
  };
  templateSnapshot?: CampaignTemplateSnapshot;
  recipientSource: CampaignRecipients["source"];
  recipientCount: number;
  recipients: CampaignRecipients;
  settings: CampaignSettings;
  schedule: CampaignSchedule;
  testSends: CampaignTestSend[];
  resultSummary: CampaignResultSummary;
  events?: CampaignEvent[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  errorState?: string;
};

export type CampaignValidationIssue = {
  type: "error" | "warning";
  field: string;
  message: string;
};

export type CampaignListResponse =
  | {
      ok: true;
      campaigns: Campaign[];
    }
  | {
      ok: false;
      error: string;
    };

export type CampaignResponse =
  | {
      ok: true;
      campaign: Campaign;
    }
  | {
      ok: false;
      error: string;
    };

export type EmailType =
  | "promo"
  | "informacni"
  | "upozorneni"
  | "onboarding"
  | "servisni";

export type GenerateEmailRequest = {
  emailType: EmailType;
  topic: string;
  mainMessage: string;
  ctaText: string;
  ctaUrl: string;
  notes?: string;
  templateId?: "ai" | "coupons-excel" | "mjml-builder";
  useAiMatching?: boolean;
  useAiReview?: boolean;
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

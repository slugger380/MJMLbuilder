export const allowedVariables = [
  "company.logo_url",
  "company.name",
  "company.website",
  "company.support_email",
  "company.support_phone",
  "brand.primary_color",
  "brand.secondary_color",
  "brand.background_color",
  "client.first_name",
  "client.last_name",
  "client.email",
  "client.customer_number",
  "service.name",
  "service.type",
  "contract.number",
  "invoice.number",
  "invoice.amount",
  "invoice.due_date",
  "cta.url",
  "cta.label",
  "unsubscribe.url"
] as const;

export type AllowedVariable = (typeof allowedVariables)[number];

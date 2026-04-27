export const brandKit = {
  systemName: "Interni generator e-mailovych sablon",
  defaultFont:
    "Arial, Helvetica, sans-serif",
  colors: {
    primary: "{{brand.primary_color}}",
    secondary: "{{brand.secondary_color}}",
    background: "{{brand.background_color}}",
    text: "#172033",
    mutedText: "#667085",
    surface: "#FFFFFF",
    border: "#D9E1EC"
  },
  spacing: {
    emailPadding: "24px",
    sectionPadding: "20px 32px",
    compactSectionPadding: "12px 32px",
    blockGap: "16px"
  },
  maxWidth: "640px",
  button: {
    backgroundColor: "{{brand.primary_color}}",
    color: "#FFFFFF",
    borderRadius: "6px",
    padding: "14px 24px",
    fontWeight: "700"
  },
  footer: {
    backgroundColor: "#F4F7FB",
    textColor: "#667085",
    fontSize: "12px",
    requiredUnsubscribeUrl: "{{unsubscribe.url}}"
  },
  company: {
    logoUrl: "{{company.logo_url}}",
    name: "{{company.name}}",
    website: "{{company.website}}",
    supportEmail: "{{company.support_email}}",
    supportPhone: "{{company.support_phone}}"
  },
  toneOfVoice:
    "Srozumitelny, vecny, duveryhodny a profesionalni. Text ma byt lidsky, ale ne prehnane marketingovy. Sablony musi zustat obecne pro vice firem ve skupine."
} as const;

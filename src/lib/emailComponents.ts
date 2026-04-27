import { brandKit } from "@/config/brandKit";

export const emailComponentGuidelines = {
  header: `<mj-section padding="${brandKit.spacing.compactSectionPadding}" background-color="${brandKit.colors.surface}">
  <mj-column>
    <mj-image src="{{company.logo_url}}" alt="{{company.name}}" width="140px" align="left" padding="0" />
  </mj-column>
</mj-section>`,
  heroText: `<mj-section padding="${brandKit.spacing.sectionPadding}" background-color="${brandKit.colors.surface}">
  <mj-column>
    <mj-text font-size="28px" line-height="36px" font-weight="700" color="${brandKit.colors.text}" padding="0 0 12px">Hlavni nadpis</mj-text>
    <mj-text font-size="16px" line-height="25px" color="${brandKit.colors.text}" padding="0">Uvodni text e-mailu.</mj-text>
  </mj-column>
</mj-section>`,
  textSection: `<mj-section padding="${brandKit.spacing.sectionPadding}" background-color="${brandKit.colors.surface}">
  <mj-column>
    <mj-text font-size="15px" line-height="24px" color="${brandKit.colors.text}" padding="0">Textova sekce.</mj-text>
  </mj-column>
</mj-section>`,
  infoBox: `<mj-section padding="16px 32px" background-color="#F4F7FB">
  <mj-column>
    <mj-text font-size="14px" line-height="22px" color="${brandKit.colors.text}" padding="0">Dulezita informace.</mj-text>
  </mj-column>
</mj-section>`,
  ctaButton: `<mj-section padding="${brandKit.spacing.compactSectionPadding}" background-color="${brandKit.colors.surface}">
  <mj-column>
    <mj-button href="{{cta.url}}" background-color="{{brand.primary_color}}" color="#FFFFFF" border-radius="${brandKit.button.borderRadius}" font-weight="${brandKit.button.fontWeight}" inner-padding="${brandKit.button.padding}" padding="0">{{cta.label}}</mj-button>
  </mj-column>
</mj-section>`,
  divider: `<mj-section padding="8px 32px" background-color="${brandKit.colors.surface}">
  <mj-column>
    <mj-divider border-color="${brandKit.colors.border}" border-width="1px" padding="0" />
  </mj-column>
</mj-section>`,
  footer: `<mj-section padding="20px 32px" background-color="${brandKit.footer.backgroundColor}">
  <mj-column>
    <mj-text font-size="${brandKit.footer.fontSize}" line-height="19px" color="${brandKit.footer.textColor}" padding="0 0 8px">{{company.name}} | {{company.website}}</mj-text>
    <mj-text font-size="${brandKit.footer.fontSize}" line-height="19px" color="${brandKit.footer.textColor}" padding="0">Podpora: {{company.support_email}}, {{company.support_phone}}</mj-text>
    <mj-text font-size="${brandKit.footer.fontSize}" line-height="19px" color="${brandKit.footer.textColor}" padding="12px 0 0"><a href="{{unsubscribe.url}}" style="color: ${brandKit.footer.textColor};">Odhlasit odber</a></mj-text>
  </mj-column>
</mj-section>`
} as const;

export function getEmailComponentReference(): string {
  return Object.entries(emailComponentGuidelines)
    .map(([name, mjml]) => `Komponenta ${name}:\n${mjml}`)
    .join("\n\n");
}

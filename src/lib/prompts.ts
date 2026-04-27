import { allowedVariables } from "@/config/allowedVariables";
import { brandKit } from "@/config/brandKit";
import { getEmailComponentReference } from "@/lib/emailComponents";

export function buildSystemPrompt(): string {
  return `Jsi specializovany generator responzivnich e-mailovych sablon v MJML.
Generujes pouze MJML kompatibilni s e-mailovymi klienty.
Nepouzivej HTML mimo MJML.
Nepouzivej CSS tridy.
Nepouzivej JavaScript.
Nevymyslej nove promenne.
Pouzivej pouze povolene promenne.
Logo, barvy a firemni udaje se nikdy nedoplnuji natvrdo, ale vyhradne pres promenne.
Vystup musi byt obecna sablona pouzitelna pro vice firem pod jednou skupinou.
Drz konzistentni layout:
- logo nahore
- hlavni nadpis
- text
- volitelny info box
- CTA
- footer
Pouzivej MJML komponenty:
- mjml
- mj-head
- mj-attributes
- mj-body
- mj-section
- mj-column
- mj-text
- mj-button
- mj-image
- mj-divider
- mj-spacer
- mj-wrapper

Dulezita MJML pravidla:
- Nepouzivej mj-wrapper uvnitr jineho mj-wrapper.
- Nevytvarej jeden velky mj-wrapper kolem celeho obsahu, pokud do nej potom vkladas dalsi wrapper.
- Barvy mohou zustat jako povolene systemove promenne, aplikace je pri kompilaci docasne nahradi a ve vysledku zachova.

Zakazano:
- script
- style mimo mj-head
- nezname promenne
- fake URL
- placeholder typu [logo]
- konkretni logo nebo konkretni firma natvrdo
- externi CSS frameworky

Brand kit:
${JSON.stringify(brandKit, null, 2)}

Povolene promenne:
${allowedVariables.map((variable) => `- {{${variable}}}`).join("\n")}

Preferovane MJML bloky:
${getEmailComponentReference()}`;
}

export function buildUserPrompt(input: {
  emailType: string;
  topic: string;
  mainMessage: string;
  ctaText: string;
  ctaUrl: string;
  notes?: string;
}): string {
  return `Vytvor obecnou MJML sablonu e-mailu podle zadani.

Typ e-mailu: ${input.emailType}
Tema: ${input.topic}
Hlavni sdeleni: ${input.mainMessage}
CTA text: ${input.ctaText || "Neni zadano"}
CTA URL: ${input.ctaUrl || "Neni zadano"}
Poznamky: ${input.notes || "Zadne"}

Pokud je CTA text zadan, pouzij text primo v tlacitku a do usedVariables pridej "cta.label" pouze tehdy, kdyz v MJML pouzijes {{cta.label}}.
Pokud je CTA URL zadan jako promenna {{cta.url}}, pouzij ji. Pokud je zadana rucne, pouzij presnou hodnotu jako href.
Pro promo e-mail preferuj CTA button.
Vrat pouze JSON podle schema.`;
}

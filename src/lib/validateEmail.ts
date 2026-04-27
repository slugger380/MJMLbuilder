import { createRequire } from "node:module";
import type { ValidationIssue } from "@/lib/types";

const variablePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

const compilePlaceholderColors = [
  {
    variable: "brand.primary_color",
    placeholder: "{{brand.primary_color}}",
    compileColor: "#A10B1C"
  },
  {
    variable: "brand.secondary_color",
    placeholder: "{{brand.secondary_color}}",
    compileColor: "#B20C2D"
  },
  {
    variable: "brand.background_color",
    placeholder: "{{brand.background_color}}",
    compileColor: "#C30D3E"
  }
] as const;

type Mjml2Html = (
  mjml: string,
  options: {
    validationLevel: "soft";
    keepComments: boolean;
    minify: boolean;
  }
) => {
  html: string;
  errors: Array<{
    formattedMessage?: string;
    message: string;
    tagName?: string;
  }>;
};

function getMjmlCompiler(): Mjml2Html {
  const requireFromProject = createRequire(`${process.cwd()}/package.json`);
  const mjmlModule = requireFromProject("mjml") as { default?: unknown } | Mjml2Html;
  return (
    typeof mjmlModule === "function" ? mjmlModule : mjmlModule.default
  ) as Mjml2Html;
}

function createVariablePattern(variable: string) {
  return new RegExp(`\\{\\{\\s*${variable.replace(".", "\\.")}\\s*\\}\\}`, "g");
}

function makeMjmlSafeForCompile(mjml: string): {
  mjml: string;
  restorePlaceholders: (value: string) => string;
} {
  let safeMjml = mjml;

  for (const replacement of compilePlaceholderColors) {
    safeMjml = safeMjml.replace(
      createVariablePattern(replacement.variable),
      replacement.compileColor
    );
  }

  return {
    mjml: safeMjml,
    restorePlaceholders(value: string) {
      return compilePlaceholderColors.reduce((current, replacement) => {
        const colorPattern = new RegExp(replacement.compileColor, "gi");
        return current.replace(colorPattern, replacement.placeholder);
      }, value);
    }
  };
}

export function extractVariables(mjml: string): string[] {
  const variables = new Set<string>();
  for (const match of mjml.matchAll(variablePattern)) {
    variables.add(match[1].trim());
  }
  return Array.from(variables).sort();
}

export function validateVariables(
  mjml: string,
  allowedVariables: string[]
): ValidationIssue[] {
  const allowed = new Set(allowedVariables);
  return extractVariables(mjml)
    .filter((variable) => !allowed.has(variable))
    .map((variable) => ({
      type: "error",
      message: `Nepovolena promenna: {{${variable}}}`,
      details: "Model smi pouzit pouze whitelist promenne."
    }));
}

export function validateMjml(
  mjml: string,
  options: { requireSystemVariables?: boolean } = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requireSystemVariables = options.requireSystemVariables ?? true;
  const forbiddenPatterns = [
    { pattern: /<script\b/i, message: "MJML obsahuje zakazany tag <script>." },
    {
      pattern: /<style\b/i,
      message: "MJML obsahuje zakazany tag <style>. Stylovani patri do mj-head/mj-attributes."
    },
    {
      pattern: /(^|[\s<])class\s*=/i,
      message: "MJML obsahuje CSS tridy, ktere nejsou povolene."
    },
    {
      pattern: /\[logo\]|\[company\]|\[firma\]/i,
      message: "MJML obsahuje neplatny placeholder misto systemove promenne."
    }
  ];

  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(mjml)) {
      issues.push({ type: "error", message: rule.message });
    }
  }

  if (requireSystemVariables && !mjml.includes("{{company.logo_url}}")) {
    issues.push({
      type: "warning",
      message: "Sablona neobsahuje logo {{company.logo_url}}."
    });
  }

  if (requireSystemVariables && !mjml.includes("{{unsubscribe.url}}")) {
    issues.push({
      type: "warning",
      message: "Sablona neobsahuje odhlasovaci odkaz {{unsubscribe.url}}."
    });
  }

  return issues;
}

export function validateEmailRequirements(
  mjml: string,
  emailType: string
): ValidationIssue[] {
  if (emailType === "promo" && !/<mj-button\b/i.test(mjml)) {
    return [
      {
        type: "warning",
        message: "Promo e-mail by mel obsahovat CTA tlacitko."
      }
    ];
  }
  return [];
}

export function compileMjml(mjml: string): { html: string; errors: ValidationIssue[] } {
  try {
    const mjml2html = getMjmlCompiler();
    const compileSafe = makeMjmlSafeForCompile(mjml);
    const result = mjml2html(compileSafe.mjml, {
      validationLevel: "soft",
      keepComments: false,
      minify: false
    });

    const errors = result.errors.map((error) => ({
      type: "error" as const,
      message: compileSafe.restorePlaceholders(error.formattedMessage || error.message),
      details: error.tagName ? `Tag: ${error.tagName}` : undefined
    }));

    return { html: compileSafe.restorePlaceholders(result.html), errors };
  } catch (error) {
    return {
      html: "",
      errors: [
        {
          type: "error",
          message: "MJML se nepodarilo zkompilovat.",
          details: error instanceof Error ? error.message : "Neznama chyba"
        }
      ]
    };
  }
}

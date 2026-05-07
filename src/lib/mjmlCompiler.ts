import type { ValidationIssue } from "@/lib/types";
import { compileMjml, validateMjml } from "@/lib/validateEmail";

export type MjmlCompilationResult = {
  html: string;
  issues: ValidationIssue[];
};

export interface MjmlCompiler {
  compile(mjml: string, options?: { requireSystemVariables?: boolean }): MjmlCompilationResult;
}

export const defaultMjmlCompiler: MjmlCompiler = {
  compile(mjml, options = {}) {
    const mjmlIssues = validateMjml(mjml, options);
    const compiled = compileMjml(mjml);

    return {
      html: compiled.html,
      issues: [...mjmlIssues, ...compiled.errors]
    };
  }
};

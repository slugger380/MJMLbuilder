import {
  buildCouponsTemplate,
  type CouponTemplateInput,
  type CouponTemplateOptions
} from "@/lib/preparedTemplates";
import type { CouponWorkbookInput } from "@/lib/couponWorkbook";
import type { GenerateEmailRequest, GeneratedEmailJson, ValidationIssue } from "@/lib/types";

export type ExcelAssemblyRequest = {
  input: GenerateEmailRequest;
  workbook: CouponWorkbookInput;
  template?: CouponTemplateInput;
  options?: CouponTemplateOptions;
};

export type ExcelAssemblyResult = {
  generated: GeneratedEmailJson;
  html?: string;
  templateSourceType: "mjml" | "html";
  issues: ValidationIssue[];
};

export interface ExcelTemplateAssembler {
  assemble(request: ExcelAssemblyRequest): Promise<ExcelAssemblyResult>;
}

export const couponExcelTemplateAssembler: ExcelTemplateAssembler = {
  assemble(request) {
    return buildCouponsTemplate(
      request.input,
      request.workbook,
      request.template,
      request.options
    );
  }
};

import type { TestEmailRequest, TestEmailResponse } from "@/lib/types";

export interface TestEmailService {
  sendTestEmail(input: TestEmailRequest): Promise<TestEmailResponse>;
}

export const placeholderTestEmailService: TestEmailService = {
  async sendTestEmail() {
    return {
      ok: false,
      error:
        "Odesilani testovacich e-mailu zatim neni nakonfigurovane. UI a API kontrakt jsou pripravene pro napojeni SMTP nebo interni sluzby."
    };
  }
};

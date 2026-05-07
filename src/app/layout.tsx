import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Internal Email Platform",
  description: "Interni platforma pro spravu MJML e-mailovych sablon"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}

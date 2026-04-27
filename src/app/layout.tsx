import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "MJML Email Generator",
  description: "Interni MVP pro generovani MJML e-mailovych sablon"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}

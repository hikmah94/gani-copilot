import "@fontsource-variable/manrope";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GANI — Public Accountability Copilot",
  description: "Understand Niger State public budgets and verify every answer against the record.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

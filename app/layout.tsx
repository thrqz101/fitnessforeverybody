import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { PreviewProvider } from "@/components/preview/PreviewApp";
import "./globals.css";
import "./preview/preview.css";

export const metadata: Metadata = {
  title: "Fitness for Everybody",
  description: "Free AI nutrition tracking and meal recommendations for everyday fitness goals.",
  other: { "darkreader-lock": "true" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "only light",
  themeColor: "#ffffff"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <I18nProvider><PreviewProvider>{children}</PreviewProvider></I18nProvider>
      </body>
    </html>
  );
}

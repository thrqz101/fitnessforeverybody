import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/shared/i18n/i18n";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { AppProviders } from "@/app/_shell/AppRoot";
import "./globals.css";
import "./_shell/app-shell.css";

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
        <I18nProvider><AuthProvider><AppProviders>{children}</AppProviders></AuthProvider></I18nProvider>
      </body>
    </html>
  );
}

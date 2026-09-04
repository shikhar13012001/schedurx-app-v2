import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/shell/providers";
import { PwaSetup } from "@/components/shell/sw-register";

export const metadata: Metadata = {
  title: "ScheduRx — Clinic Command Center",
  description: "The operating system for your clinic. Queue, calendar, consults, patients — everything on your fingertips.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ScheduRx" },
  icons: {
    // Same media-scoped-array pattern as viewport.themeColor below — a
    // dark-mode browser gets the dark-background logo tab icon, and vice
    // versa, rather than one favicon that clashes with either theme.
    icon: [
      { url: "/icons/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/icons/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Two media-scoped tags instead of one static color — without this, a
  // dark-mode device shows the light color at first paint (before
  // ThemeApplier's client-side effect ever runs), which is exactly the
  // "notif bar spill" a system-dark-mode user would see on every load.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F7" },
    { media: "(prefers-color-scheme: dark)", color: "#181818" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="evergreen" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <Providers>
          <PwaSetup />
          {children}
        </Providers>
      </body>
    </html>
  );
}

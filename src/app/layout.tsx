import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AuthHashRedirect } from "@/components/auth-hash-redirect";
import { tryClientPortalSession } from "@/lib/client-accounts/session";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  getStudioTheme,
  STUDIO_THEME_COOKIE,
} from "@/lib/theme/studio";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument",
  style: ["normal", "italic"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outpost — Studio pipeline",
  description: "Leads, follow-ups, and projects for a small studio.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, clientSession, studioTheme] = await Promise.all([
    getCurrentProfile(),
    tryClientPortalSession(),
    getStudioTheme(),
  ]);
  const hideChrome = user.role === "Client" || Boolean(clientSession);
  const antiFlash = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${STUDIO_THEME_COOKIE}=([^;]+)/);if(m&&m[1]==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased${studioTheme === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFlash }} />
      </head>
      <body className="min-h-full">
        <AuthHashRedirect />
        <AppShell
          user={user}
          hideChrome={hideChrome}
          studioTheme={studioTheme}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

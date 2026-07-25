import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth/session";

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
  const user = await getCurrentProfile();

  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}

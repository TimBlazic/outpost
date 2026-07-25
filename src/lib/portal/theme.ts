import { cookies } from "next/headers";

export type PortalTheme = "light" | "dark";

const COOKIE = "outpost_portal_theme";
const MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function parsePortalTheme(value: string | undefined | null): PortalTheme {
  return value === "light" ? "light" : "dark";
}

export async function getPortalTheme(): Promise<PortalTheme> {
  const jar = await cookies();
  return parsePortalTheme(jar.get(COOKIE)?.value);
}

export async function setPortalThemeCookie(theme: PortalTheme) {
  const jar = await cookies();
  jar.set(COOKIE, theme, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export { COOKIE as PORTAL_THEME_COOKIE };

import { cookies } from "next/headers";

export type StudioTheme = "light" | "dark";

const COOKIE = "outpost_studio_theme";
const MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function parseStudioTheme(
  value: string | undefined | null
): StudioTheme {
  return value === "dark" ? "dark" : "light";
}

export async function getStudioTheme(): Promise<StudioTheme> {
  const jar = await cookies();
  return parseStudioTheme(jar.get(COOKIE)?.value);
}

export async function setStudioThemeCookie(theme: StudioTheme) {
  const jar = await cookies();
  jar.set(COOKIE, theme, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export { COOKIE as STUDIO_THEME_COOKIE };

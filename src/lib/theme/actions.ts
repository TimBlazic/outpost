"use server";

import {
  setStudioThemeCookie,
  type StudioTheme,
} from "@/lib/theme/studio";

export async function setStudioTheme(theme: StudioTheme) {
  if (theme !== "light" && theme !== "dark") {
    throw new Error("Invalid theme");
  }
  await setStudioThemeCookie(theme);
}

"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

import {
  getCurrentProfile,
  getCurrentUserId,
  updateCurrentProfile,
} from "@/lib/auth/session";
import {
  getTicketComments,
  saveTicketComments,
  getTickets,
  saveTickets,
} from "@/lib/store";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function revalidateEverywhere() {
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/docs");
  revalidatePath("/leads");
}

export async function updateProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const clearAvatar = String(formData.get("clearAvatar") ?? "") === "1";
  const file = formData.get("avatar");

  const before = await getCurrentProfile();
  const userId = await getCurrentUserId();
  let avatarUrl: string | null | undefined = undefined;

  if (clearAvatar) {
    avatarUrl = null;
  } else if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Avatar must be an image");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Avatar must be under 2MB");
    }

    const ext =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isSupabaseEnabled()) {
      const storagePath = `${userId}/avatar.${ext}`;
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("avatars")
        .upload(storagePath, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
      avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    } else {
      const rel = path.join("avatars", userId, `avatar.${ext}`);
      const dest = path.join(process.cwd(), "data", "uploads", rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, buffer);
      avatarUrl = `/api/files/${rel.split(path.sep).join("/")}?v=${Date.now()}`;
    }
  }

  const profile = await updateCurrentProfile({
    name,
    avatarUrl,
    clearAvatar,
  });

  if (before.name !== profile.name) {
    const comments = await getTicketComments();
    await saveTicketComments(
      comments.map((c) =>
        c.authorKind === "studio" &&
        (c.authorId === userId || c.authorName === before.name)
          ? { ...c, authorName: profile.name, authorId: c.authorId ?? userId }
          : c
      )
    );

    const tickets = await getTickets();
    await saveTickets(
      tickets.map((t) =>
        t.createdByKind === "studio" && t.createdByName === before.name
          ? { ...t, createdByName: profile.name }
          : t
      )
    );
  }

  revalidateEverywhere();
  return profile;
}

"use server";

import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

import { updateCurrentProfile } from "@/lib/auth/session";
import { requireClientSession } from "@/lib/client-accounts/session";
import { getClients, getProjects, saveClients, saveProjects } from "@/lib/store";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type OnboardingInput = {
  firstName: string;
  lastName: string;
  billingKind: "person" | "company";
  company?: string;
  billingAddress: string;
  taxNumber?: string;
  vatId?: string;
  registrationNumber?: string;
};

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function optionalText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function uploadAvatar(userId: string, file: File) {
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
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  const rel = path.join("avatars", userId, `avatar.${ext}`);
  const dest = path.join(process.cwd(), "data", "uploads", rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return `/api/files/${rel.split(path.sep).join("/")}?v=${Date.now()}`;
}

export async function completeClientOnboarding(
  input: OnboardingInput,
  options?: { avatar?: File | null }
) {
  const { client, userId } = await requireClientSession();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const billingAddress = input.billingAddress.trim();
  const company = input.company?.trim() ?? "";

  if (!firstName) throw new Error("First name is required");
  if (!lastName) throw new Error("Last name is required");
  if (!billingAddress) throw new Error("Billing address is required");
  if (input.billingKind !== "person" && input.billingKind !== "company") {
    throw new Error("Billing type is required");
  }
  if (input.billingKind === "company" && !company) {
    throw new Error("Company name is required for company billing");
  }

  let avatarUrl: string | undefined;
  const avatar = options?.avatar;
  if (avatar instanceof File && avatar.size > 0) {
    avatarUrl = await uploadAvatar(userId, avatar);
  }

  await updateCurrentProfile({
    name: fullName,
    avatarUrl,
  });

  const now = new Date().toISOString();
  const clients = await getClients();
  const existing = clients.find((item) => item.id === client.id);
  if (!existing) throw new Error("Client profile not found");

  await saveClients(
    clients.map((item) =>
      item.id === client.id
        ? {
            ...item,
            name: fullName,
            firstName,
            lastName,
            billingKind: input.billingKind,
            company: input.billingKind === "company" ? company : fullName,
            billingAddress,
            taxNumber: (input.taxNumber ?? "").trim(),
            vatId: (input.vatId ?? "").trim(),
            registrationNumber: (input.registrationNumber ?? "").trim(),
            onboardingCompletedAt: now,
          }
        : item
    )
  );

  // Keep denormalized project client names in sync.
  const projects = await getProjects();
  await saveProjects(
    projects.map((project) =>
      project.clientId === client.id ? { ...project, client: fullName } : project
    )
  );

  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/projects");
}

export async function completeClientOnboardingAction(formData: FormData) {
  const billingRaw = formData.get("billingKind");
  const billingKind =
    billingRaw === "company" || billingRaw === "person" ? billingRaw : null;
  if (!billingKind) throw new Error("Billing type is required");

  const input: OnboardingInput = {
    firstName: requiredText(formData.get("firstName"), "First name"),
    lastName: requiredText(formData.get("lastName"), "Last name"),
    billingKind,
    company: optionalText(formData.get("company")),
    billingAddress: requiredText(formData.get("billingAddress"), "Billing address"),
    taxNumber: optionalText(formData.get("taxNumber")),
    vatId: optionalText(formData.get("vatId")),
    registrationNumber: optionalText(formData.get("registrationNumber")),
  };

  const avatar = formData.get("avatar");
  await completeClientOnboarding(input, {
    avatar: avatar instanceof File && avatar.size > 0 ? avatar : null,
  });
}

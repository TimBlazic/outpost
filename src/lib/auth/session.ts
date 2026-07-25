import { promises as fs } from "fs";
import path from "path";

import {
  members as seedMembers,
  normalizeMember,
  initialsFromName,
  type Member,
} from "@/lib/data";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

function mapProfileRow(row: Record<string, unknown>): Member {
  const rawRole = row.role as string | undefined;
  return normalizeMember({
    id: row.id as string,
    name: (row.name as string) ?? "User",
    initials: (row.initials as string) ?? "?",
    role:
      rawRole === "Admin"
        ? "Admin"
        : rawRole === "Client"
          ? "Client"
          : "Member",
    avatarUrl: (row.avatar_url as string) ?? null,
  });
}

async function loadFileProfiles(): Promise<Member[]> {
  try {
    const raw = await fs.readFile(PROFILES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Member[];
    return parsed.map(normalizeMember);
  } catch {
    const seed = seedMembers.map(normalizeMember);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(PROFILES_FILE, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function saveFileProfiles(profiles: Member[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    PROFILES_FILE,
    JSON.stringify(profiles.map(normalizeMember), null, 2),
    "utf8"
  );
}

/**
 * Require an authenticated studio user (Admin or Member).
 * Rejects Client-role users to prevent client accounts from accessing
 * studio-only API routes.
 */
export async function requireStudioSession(): Promise<Member> {
  if (!isSupabaseEnabled()) {
    const profiles = await loadFileProfiles();
    return profiles.find((p) => p.id === "u1") ?? normalizeMember(seedMembers[0]);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data } = await supabase
    .from("profiles")
    .select("id, name, initials, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) throw new Error("Unauthorized");

  const profile = mapProfileRow(data as Record<string, unknown>);
  if (profile.role === "Client") {
    throw new Error("Forbidden: studio access required");
  }
  return profile;
}

export async function getCurrentUserId(): Promise<string> {
  if (!isSupabaseEnabled()) return "u1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? "u1";
}

export async function getCurrentProfile(): Promise<Member> {
  if (!isSupabaseEnabled()) {
    const profiles = await loadFileProfiles();
    return profiles.find((p) => p.id === "u1") ?? normalizeMember(seedMembers[0]);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return normalizeMember(seedMembers[0]);

    const { data } = await supabase
      .from("profiles")
      .select("id, name, initials, role, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (data) return mapProfileRow(data as Record<string, unknown>);

    const name =
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split("@")[0] ||
      "User";

    return normalizeMember({
      id: user.id,
      name,
      initials: initialsFromName(name),
      role: "Member",
      avatarUrl: null,
    });
  } catch {
    return normalizeMember(seedMembers[0]);
  }
}

export async function getTeamMembers(): Promise<Member[]> {
  if (!isSupabaseEnabled()) {
    return loadFileProfiles();
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, initials, role, avatar_url")
      .order("name");

    if (error || !data?.length) {
      const me = await getCurrentProfile();
      return [me];
    }

    return data.map((row) => mapProfileRow(row as Record<string, unknown>));
  } catch {
    return seedMembers.map(normalizeMember);
  }
}

export async function updateCurrentProfile(input: {
  name: string;
  avatarUrl?: string | null;
  clearAvatar?: boolean;
}): Promise<Member> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const initials = initialsFromName(name);

  if (!isSupabaseEnabled()) {
    const profiles = await loadFileProfiles();
    const id = await getCurrentUserId();
    const next = profiles.map((p) =>
      p.id === id
        ? normalizeMember({
            ...p,
            name,
            initials,
            avatarUrl: input.clearAvatar
              ? null
              : input.avatarUrl !== undefined
                ? input.avatarUrl
                : p.avatarUrl,
          })
        : p
    );
    if (!next.some((p) => p.id === id)) {
      next.push(
        normalizeMember({
          id,
          name,
          initials,
          role: "Admin",
          avatarUrl: input.clearAvatar ? null : input.avatarUrl ?? null,
        })
      );
    }
    await saveFileProfiles(next);
    return next.find((p) => p.id === id)!;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const patch: Record<string, unknown> = { name, initials };
  if (input.clearAvatar) patch.avatar_url = null;
  else if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id, name, initials, role, avatar_url")
    .single();

  if (error) {
    // Profile row may not exist yet — upsert.
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        name,
        initials,
        role: "Member",
        avatar_url: input.clearAvatar
          ? null
          : (input.avatarUrl ?? null),
      })
      .select("id, name, initials, role, avatar_url")
      .single();
    if (insertError) throw new Error(insertError.message);
    return mapProfileRow(inserted as Record<string, unknown>);
  }

  return mapProfileRow(data as Record<string, unknown>);
}

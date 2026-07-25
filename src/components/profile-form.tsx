"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";

import type { Member } from "@/lib/data";
import { updateProfile } from "@/lib/auth/profile-actions";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm({ profile }: { profile: Member }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name);
  const [preview, setPreview] = useState<string | null>(null);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const displayUrl = clearAvatar
    ? null
    : preview ?? profile.avatarUrl;

  function onPick(fileList: FileList | null) {
    const next = fileList?.[0] ?? null;
    if (!next) return;
    setFile(next);
    setClearAvatar(false);
    setPreview(URL.createObjectURL(next));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        if (clearAvatar) fd.set("clearAvatar", "1");
        if (file) fd.set("avatar", file);
        await updateProfile(fd);
        setFile(null);
        setPreview(null);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative rounded-full"
              title="Change photo"
            >
              <UserAvatar
                name={name || profile.name}
                avatarUrl={displayUrl}
                initials={profile.initials}
                size="lg"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-5 text-white" />
              </span>
            </button>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload photo
                </Button>
                {(displayUrl || profile.avatarUrl) && !clearAvatar && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setClearAvatar(true);
                      setFile(null);
                      setPreview(null);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG or PNG, up to 2MB.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile.role} disabled />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && (
            <p className="text-sm text-emerald-600">Profile saved.</p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={pending || !name.trim()}
            >
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

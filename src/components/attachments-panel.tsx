"use client";

import { useRef, useState, useTransition } from "react";
import {
  Link2,
  Trash2,
  Upload,
  FileText,
  Globe,
  Frame,
  Image as ImageIcon,
  FolderOpen,
  Paperclip,
  X,
  ExternalLink,
} from "lucide-react";

import type { Attachment, AttachmentKind, AttachmentParent } from "@/lib/data";
import { addAttachment, deleteAttachment, uploadAttachment } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { cn } from "@/lib/utils";

const linkKinds: AttachmentKind[] = [
  "website",
  "figma",
  "proposal",
  "doc",
  "screenshot",
  "drive",
];

const fileIcon: Record<AttachmentKind, React.ElementType> = {
  website: Globe,
  figma: Frame,
  proposal: FileText,
  doc: FileText,
  screenshot: ImageIcon,
  drive: FolderOpen,
  file: Paperclip,
};

function isImageAttachment(a: Attachment) {
  return (
    a.kind === "screenshot" ||
    Boolean(a.mime?.startsWith("image/")) ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(a.label) ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(a.url ?? "")
  );
}

export type StagedAttachmentFile = {
  id: string;
  file: File;
};

export type StagedAttachmentLink = {
  id: string;
  label: string;
  url: string;
  kind: AttachmentKind;
};

export function AttachmentsPanel({
  parentType,
  parentId,
  items,
  title = "Files & links",
  variant = "card",
  staging = false,
  stagedFiles = [],
  stagedLinks = [],
  onStagedFilesChange,
  onStagedLinksChange,
}: {
  parentType: AttachmentParent;
  parentId: string;
  items: Attachment[];
  title?: string;
  /** `inline` = Harvey-style compact block (tickets). `card` = legacy CRM card. */
  variant?: "card" | "inline";
  /** Queue files/links locally until the parent record exists. */
  staging?: boolean;
  stagedFiles?: StagedAttachmentFile[];
  stagedLinks?: StagedAttachmentLink[];
  onStagedFilesChange?: (files: StagedAttachmentFile[]) => void;
  onStagedLinksChange?: (links: StagedAttachmentLink[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"closed" | "link" | "upload">("closed");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<AttachmentKind>("website");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setLabel("");
    setUrl("");
    setKind("website");
    setFile(null);
    setMode("closed");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function submitLink() {
    if (!url.trim()) return;
    if (staging) {
      onStagedLinksChange?.([
        ...stagedLinks,
        {
          id: `staged_${Math.random().toString(36).slice(2, 9)}`,
          label: label.trim() || url.trim(),
          url: url.trim(),
          kind,
        },
      ]);
      reset();
      return;
    }
    startTransition(async () => {
      await addAttachment({
        parentType,
        parentId,
        label: label.trim() || url.trim(),
        kind,
        url: url.trim(),
      });
      reset();
    });
  }

  function submitUpload(selected?: File | null) {
    const f = selected ?? file;
    if (!f) return;
    if (staging) {
      onStagedFilesChange?.([
        ...stagedFiles,
        {
          id: `staged_${Math.random().toString(36).slice(2, 9)}`,
          file: f,
        },
      ]);
      reset();
      return;
    }
    const fd = new FormData();
    fd.set("parentType", parentType);
    fd.set("parentId", parentId);
    fd.set("label", label.trim() || f.name);
    fd.set("file", f);
    startTransition(async () => {
      await uploadAttachment(fd);
      reset();
    });
  }

  const stagedCount = stagedFiles.length + stagedLinks.length;
  const totalCount = items.length + stagedCount;

  if (variant === "inline") {
    const images = items.filter(isImageAttachment);
    const rest = items.filter((a) => !isImageAttachment(a));

    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Paperclip className="size-3" />
            Attachments
            {totalCount > 0 && (
              <span className="ml-0.5 font-semibold normal-case tracking-normal text-foreground">
                {totalCount}
              </span>
            )}
          </h4>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode((m) => (m === "link" ? "closed" : "link"))}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1">
                <Link2 className="size-3" /> Link
              </span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1">
                <Upload className="size-3" /> Upload
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) submitUpload(f);
              }}
            />
          </div>
        </div>

        {mode === "link" && (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="h-9"
              autoFocus
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="h-9"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitLink} disabled={pending || !url.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}

        {totalCount === 0 && mode === "closed" ? (
          <p className="py-1 text-xs text-muted-foreground">
            No attachments yet. Drop a link or upload a file.
          </p>
        ) : (
          <div className="space-y-3">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((a) => (
                  <div key={a.id} className="group relative">
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.url}
                          alt={a.label}
                          className="size-20 object-cover transition-opacity hover:opacity-90"
                        />
                      </a>
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-lg border border-border bg-muted/40">
                        <ImageIcon className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <ConfirmDelete
                      title="Remove attachment?"
                      description="This permanently removes the file or link."
                      pending={pending}
                      onConfirm={() =>
                        deleteAttachment(a.id, parentType, parentId)
                      }
                      trigger={
                        <button
                          type="button"
                          aria-label="Remove"
                          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-3 text-muted-foreground" />
                        </button>
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {(rest.length > 0 || stagedCount > 0) && (
              <ul className="space-y-1">
                {rest.map((a) => {
                  const Icon = fileIcon[a.kind] ?? Paperclip;
                  const href = a.url ?? undefined;
                  return (
                    <li
                      key={a.id}
                      className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/40"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium hover:underline"
                          >
                            <span className="truncate">{a.label}</span>
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <p className="truncate text-sm font-medium">{a.label}</p>
                        )}
                      </div>
                      <ConfirmDelete
                        title="Remove attachment?"
                        description="This permanently removes the file or link."
                        pending={pending}
                        onConfirm={() =>
                          deleteAttachment(a.id, parentType, parentId)
                        }
                        trigger={
                          <button
                            type="button"
                            aria-label="Remove"
                            className={cn(
                              "rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            )}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        }
                      />
                    </li>
                  );
                })}
                {stagedFiles.map((s) => (
                  <li
                    key={s.id}
                    className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/40"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
                      <Paperclip className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Ready to upload
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove"
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() =>
                        onStagedFilesChange?.(
                          stagedFiles.filter((f) => f.id !== s.id)
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
                {stagedLinks.map((s) => {
                  const Icon = fileIcon[s.kind] ?? Link2;
                  return (
                    <li
                      key={s.id}
                      className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/40"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {s.url}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove"
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={() =>
                          onStagedLinksChange?.(
                            stagedLinks.filter((l) => l.id !== s.id)
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode((m) => (m === "link" ? "closed" : "link"))}
          >
            <Link2 className="size-4" /> Add link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMode((m) => (m === "upload" ? "closed" : "upload"))
            }
          >
            <Upload className="size-4" /> Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === "link" && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as AttachmentKind)}
                className="h-9"
              >
                {linkKinds.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional)"
                className="h-9"
              />
            </div>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="h-9"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitLink} disabled={pending}>
                Add
              </Button>
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="h-9"
            />
            <Input
              type="file"
              className="h-9"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => submitUpload()}
                disabled={pending || !file}
              >
                Upload
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y">
          {items.map((f) => {
            const Icon = fileIcon[f.kind] ?? Paperclip;
            const href = f.url ?? undefined;
            return (
              <div
                key={f.id}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {f.label}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium">{f.label}</p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {f.url ?? f.storagePath ?? "—"}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {f.kind}
                </Badge>
                <ConfirmDelete
                  title="Remove attachment?"
                  description="This permanently removes the link or uploaded file."
                  pending={pending}
                  onConfirm={() =>
                    deleteAttachment(f.id, parentType, parentId)
                  }
                  trigger={
                    <button
                      aria-label="Remove"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  }
                />
              </div>
            );
          })}
          {items.length === 0 && mode === "closed" && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No files or links yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

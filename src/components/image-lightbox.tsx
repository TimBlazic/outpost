"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type LightboxImage = {
  src: string;
  alt?: string;
  name?: string;
};

async function downloadImage(src: string, filename: string) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "image";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Cross-origin / signed URL fallback
    const a = document.createElement("a");
    a.href = src;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = filename || "image";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function ImageLightbox({
  image,
  open,
  onClose,
  portal,
}: {
  image: LightboxImage | null;
  open: boolean;
  onClose: () => void;
  portal?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open || !image?.src) return null;

  const filename = image.name || image.alt || "image";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
        portal ? "portal-skin" : ""
      )}
      role="dialog"
      aria-modal="true"
      aria-label={filename}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90"
        aria-label="Close preview"
        onClick={onClose}
      />

      <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-medium">{filename}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => downloadImage(image.src, filename)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="size-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt || filename}
          className="max-h-full max-w-full object-contain select-none"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>,
    document.body
  );
}

/** Thumbnail that opens the fullscreen lightbox on click. */
export function ImageThumb({
  src,
  alt,
  name,
  className,
  imgClassName,
  portal,
  fallbackHref,
  fallbackLabel,
}: {
  src: string;
  alt?: string;
  name?: string;
  className?: string;
  imgClassName?: string;
  portal?: boolean;
  /** If the browser can't paint the image (e.g. HEIC), show a file link instead. */
  fallbackHref?: string;
  fallbackLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src) return null;

  if (failed) {
    return (
      <a
        href={fallbackHref || src}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
      >
        {fallbackLabel || name || alt || "Attachment"}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "block overflow-hidden rounded-lg text-left transition-opacity hover:opacity-90",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || name || "Image"}
          className={cn("object-cover", imgClassName)}
          onError={() => setFailed(true)}
        />
      </button>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        portal={portal}
        image={{ src, alt, name: name || alt }}
      />
    </>
  );
}

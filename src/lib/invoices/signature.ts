import { promises as fs } from "fs";
import path from "path";

import { isSupabaseEnabled } from "@/lib/supabase/env";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

export { signatureDisplayUrl } from "@/lib/invoices/signature-url";

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function loadSignatureBytes(
  signaturePath: string | null | undefined
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!signaturePath) return null;
  const clean = signaturePath.split("?")[0];

  try {
    // Local file-store URL
    if (clean.startsWith("/api/files/")) {
      const rel = clean.replace(/^\/api\/files\//, "");
      const filePath = path.join(process.cwd(), "data", "uploads", ...rel.split("/"));
      const bytes = await fs.readFile(filePath);
      return { bytes, contentType: contentTypeFor(filePath) };
    }

    // Absolute http(s)
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      const res = await fetch(clean);
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      const contentType =
        res.headers.get("content-type") || contentTypeFor(clean);
      return { bytes, contentType };
    }

    // Storage key (e.g. signatures/signature.png)
    if (!clean.startsWith("/")) {
      if (isSupabaseEnabled()) {
        const storagePath = clean;
        try {
          const supabase = await createSupabaseServerClient();
          const { data, error } = await supabase.storage
            .from("attachments")
            .download(storagePath);
          if (!error && data) {
            return {
              bytes: Buffer.from(await data.arrayBuffer()),
              contentType: contentTypeFor(storagePath),
            };
          }
        } catch {
          /* try admin */
        }
        if (hasAdminClient()) {
          const admin = createAdminClient();
          const { data, error } = await admin.storage
            .from("attachments")
            .download(storagePath);
          if (!error && data) {
            return {
              bytes: Buffer.from(await data.arrayBuffer()),
              contentType: contentTypeFor(storagePath),
            };
          }
        }
        return null;
      }

      // Local file-store: data/uploads/signatures/signature.png
      const filePath = path.join(
        process.cwd(),
        "data",
        "uploads",
        ...clean.split("/")
      );
      const bytes = await fs.readFile(filePath);
      return { bytes, contentType: contentTypeFor(filePath) };
    }

    return null;
  } catch {
    return null;
  }
}

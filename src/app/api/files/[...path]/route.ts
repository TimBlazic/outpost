import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  if (!parts?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Prevent path traversal
  if (parts.some((p) => p === ".." || p.includes("\0"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "data", "uploads", ...parts);
  const uploadsRoot = path.join(process.cwd(), "data", "uploads");
  if (!filePath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".webp"
              ? "image/webp"
              : "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

import { NextResponse } from "next/server";

/** Allowlisted hosts for moodboard image proxy (WKWebView / desktop often block pinimg). */
const ALLOWED_HOSTS = new Set(["i.pinimg.com"]);

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Referer: "https://www.pinterest.com/",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 502 });
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (err) {
    console.error("[moodboard-image]", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}

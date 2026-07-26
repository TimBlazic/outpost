import { promises as fs } from "fs";
import path from "path";

import type { FirmSettings, Quote } from "@/lib/data";
import { buildQuotePdf } from "./pdf";

async function readPublicFile(rel: string) {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", rel));
  } catch {
    return undefined;
  }
}

export async function renderQuotePdf(
  quote: Quote,
  settings: FirmSettings
): Promise<Uint8Array> {
  const [fontRegularBytes, fontBoldBytes] = await Promise.all([
    readPublicFile("fonts/LiberationSans-Regular.ttf"),
    readPublicFile("fonts/LiberationSans-Bold.ttf"),
  ]);

  return buildQuotePdf(
    quote,
    {
      name: settings.outboundFromName || settings.firmName || "Tim Blažič",
      companyName: settings.billingCompanyName || null,
      siteLabel: "timblazic.dev",
      email: settings.outboundFromEmail || settings.billingEmail || null,
    },
    {
      regular: fontRegularBytes,
      bold: fontBoldBytes,
    }
  );
}

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Deep link → open qualify dialog on Leads. */
export default async function QualifyLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const params = new URLSearchParams({ qualify: "1" });
  if (typeof url === "string" && url.trim()) {
    params.set("url", url.trim());
  }
  redirect(`/leads?${params.toString()}`);
}

import { notFound } from "next/navigation";

import { DocForm } from "@/components/doc-form";
import { getDocById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocById(id);
  if (!doc) notFound();
  return <DocForm doc={doc} />;
}

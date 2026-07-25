import { notFound } from "next/navigation";

import { ClientForm } from "@/components/client-form";
import { getClientById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();
  return <ClientForm client={client} />;
}

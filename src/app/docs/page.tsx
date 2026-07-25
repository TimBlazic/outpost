import { Plus } from "lucide-react";

import Link from "next/link";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DocsView } from "@/components/docs-view";
import { getDocs } from "@/lib/store";
import { getTeamMembers } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const [docs, members] = await Promise.all([getDocs(), getTeamMembers()]);
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Docs & playbook"
        description="Internal knowledge base — sales process, templates and checklists."
      >
        <Button asChild>
          <Link href="/docs/new">
            <Plus className="size-4" />
            New doc
          </Link>
        </Button>
      </PageHeader>
      <DocsView docs={docs} members={members} />
    </div>
  );
}

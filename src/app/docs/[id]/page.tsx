import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";

import { docContent } from "@/lib/data";
import { getDocs, getDocById, getAttachmentsFor } from "@/lib/store";
import { fmtDateLong } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";
import { DocActions } from "@/components/doc-actions";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocById(id);
  if (!doc) notFound();

  const content = doc.body ?? docContent[doc.id] ?? doc.excerpt;
  const files = await getAttachmentsFor("doc", doc.id);
  const related = (await getDocs())
    .filter((d) => d.category === doc.category && d.id !== doc.id)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Docs
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {doc.category}
              </Badge>
              {doc.favorite && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                  <Star className="size-3.5 fill-amber-400 text-amber-500" />
                  Favorite
                </span>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {doc.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Edited {fmtDateLong(doc.lastEdited)}
              {doc.tags.length > 0
                ? ` · ${doc.tags.map((t) => `#${t}`).join(" ")}`
                : ""}
            </p>
          </div>
          <DocActions docId={doc.id} favorite={doc.favorite} />
        </div>
      </header>

      <Tabs defaultValue="content" className="gap-5">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="related">
            Related ({related.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          <div className="prose-container rounded-xl border bg-background px-5 py-6 sm:px-8 sm:py-8">
            <Markdown source={content} />
          </div>
          {doc.tags.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((t) => (
                  <Badge key={t} variant="outline">
                    #{t}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="files">
          <AttachmentsPanel
            parentType="doc"
            parentId={doc.id}
            items={files}
            title="Attachments"
          />
        </TabsContent>

        <TabsContent value="related">
          <div className="divide-y rounded-xl border">
            {related.map((d) => (
              <Link
                key={d.id}
                href={`/docs/${d.id}`}
                className="block px-4 py-3 hover:bg-muted/50"
              >
                <p className="text-sm font-medium">{d.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {d.excerpt}
                </p>
              </Link>
            ))}
            {related.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No related docs in this category.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

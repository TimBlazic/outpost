"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Star, FileText, BookOpen } from "lucide-react";

import {
  docCategories,
  memberById,
  members as seedMembers,
  type Doc,
  type Member,
} from "@/lib/data";
import { fmtDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

export function DocsView({
  docs,
  members = seedMembers,
}: {
  docs: Doc[];
  members?: Member[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filtered = docs.filter((d) => {
    const q = query.toLowerCase();
    const matchesQuery =
      d.title.toLowerCase().includes(q) ||
      d.excerpt.toLowerCase().includes(q) ||
      d.tags.some((t) => t.includes(q));
    const matchesCat = !category || d.category === category;
    return matchesQuery && matchesCat;
  });

  const favorites = docs.filter((d) => d.favorite);

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Playbook is empty"
        description="Save outreach templates, pricing notes, and delivery checklists so you don’t rewrite them every time."
        actionLabel="New doc"
        actionHref="/docs/new"
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* sidebar */}
      <aside className="space-y-1">
        <button
          onClick={() => setCategory(null)}
          className={cn(
            "w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
            !category
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60"
          )}
        >
          All docs
        </button>
        {docCategories.map((c) => {
          const count = docs.filter((d) => d.category === c).length;
          if (count === 0) return null;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                category === c
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              )}
            >
              <span className="truncate">{c}</span>
              <span className="text-xs text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </aside>

      <div className="space-y-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the playbook…"
            className="h-10 pl-8"
          />
        </div>

        {!category && !query && favorites.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Star className="size-4 fill-amber-400 text-amber-500" /> Favorites
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {favorites.map((d) => (
                <DocCard key={d.id} doc={d} members={members} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            {category ?? "All docs"}{" "}
            <span className="text-muted-foreground">({filtered.length})</span>
          </h2>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No docs match"
              description="Try another search term or pick a different category."
              className="py-10"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((d) => (
                <DocCard key={d.id} doc={d} members={members} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DocCard({ doc, members }: { doc: Doc; members: Member[] }) {
  return (
    <Link href={`/docs/${doc.id}`}>
      <Card className="h-full cursor-pointer gap-0 transition-shadow hover:shadow-md">
        <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileText className="size-4" />
          </span>
          {doc.favorite && (
            <Star className="size-4 fill-amber-400 text-amber-500" />
          )}
        </div>
        <h3 className="font-medium leading-tight">{doc.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {doc.excerpt}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="secondary" className="text-[10px]">
            {doc.category}
          </Badge>
          {doc.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              #{t}
            </Badge>
          ))}
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          {memberById(doc.authorId, members).name} · edited{" "}
          {fmtDateLong(doc.lastEdited)}
        </p>
        </CardContent>
      </Card>
    </Link>
  );
}

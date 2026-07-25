"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Star } from "lucide-react";

import {
  docCategories,
  docContent,
  type Doc,
  type DocCategory,
} from "@/lib/data";
import { createDoc, updateDoc } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function DocForm({ doc }: { doc?: Doc }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = Boolean(doc);
  const back = doc ? `/docs/${doc.id}` : "/docs";

  const [title, setTitle] = useState(doc?.title ?? "");
  const [category, setCategory] = useState<DocCategory>(
    doc?.category ?? docCategories[0]
  );
  const [tags, setTags] = useState(doc?.tags.join(", ") ?? "");
  const [favorite, setFavorite] = useState(doc?.favorite ?? false);
  const [body, setBody] = useState(
    doc ? (doc.body ?? docContent[doc.id] ?? doc.excerpt) : ""
  );

  function submit() {
    if (!title.trim()) return;
    const input = {
      title: title.trim(),
      category,
      excerpt: "",
      body,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      favorite,
    };
    startTransition(async () => {
      if (doc) {
        await updateDoc(doc.id, input);
        router.push(`/docs/${doc.id}`);
      } else {
        const id = await createDoc(input);
        router.push(`/docs/${id}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Link
        href={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {editing ? "Edit doc" : "New doc"}
        </h1>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={back}>Cancel</Link>
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {editing ? "Save changes" : "Create doc"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="d-title" className="mb-1.5">
                Title
              </Label>
              <Input
                id="d-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cold email — first touch"
              />
            </div>
            <div>
              <Label htmlFor="d-body" className="mb-1.5">
                Body
              </Label>
              <Textarea
                id="d-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                className="font-mono text-sm"
                placeholder={"## Heading\n- bullet point\n1. numbered step\n\n**bold** and [[linked-doc]]"}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Supports markdown: <code>## heading</code>,{" "}
                <code>- bullet</code>, <code>1. step</code>,{" "}
                <code>**bold**</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5">Category</Label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
              >
                {docCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="d-tags" className="mb-1.5">
                Tags
              </Label>
              <Input
                id="d-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="email, cold"
              />
            </div>
            <button
              type="button"
              onClick={() => setFavorite((v) => !v)}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                favorite
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                  : "hover:bg-accent"
              )}
            >
              <Star
                className={cn(
                  "size-4",
                  favorite && "fill-amber-400 text-amber-500"
                )}
              />
              {favorite ? "Favorited" : "Mark as favorite"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

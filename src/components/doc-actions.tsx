"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Star, Pencil } from "lucide-react";

import { deleteDoc, toggleDocFavorite } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";

export function DocActions({
  docId,
  favorite,
}: {
  docId: string;
  favorite: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => toggleDocFavorite(docId))}
      >
        <Star
          className={favorite ? "size-4 fill-amber-400 text-amber-500" : "size-4"}
        />
        {favorite ? "Favorited" : "Favorite"}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/docs/${docId}/edit`}>
          <Pencil className="size-4" /> Edit
        </Link>
      </Button>
      <ConfirmDelete
        title="Delete doc?"
        description="This will permanently delete this document. This cannot be undone."
        pending={pending}
        onConfirm={() => deleteDoc(docId)}
      />
    </div>
  );
}

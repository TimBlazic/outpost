"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Quote } from "@/lib/data";
import { markQuoteSent, setQuoteStatus } from "@/lib/quotes/actions";
import { Button } from "@/components/ui/button";

export function QuoteStatusActions({
  quote,
  onChanged,
}: {
  quote: Quote;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function after() {
    router.refresh();
    onChanged?.();
  }

  if (quote.status === "draft") {
    return (
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markQuoteSent(quote.id);
            after();
          })
        }
      >
        Mark sent
      </Button>
    );
  }

  if (quote.status === "sent") {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setQuoteStatus(quote.id, "accepted");
              after();
            })
          }
        >
          Accepted
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setQuoteStatus(quote.id, "declined");
              after();
            })
          }
        >
          Declined
        </Button>
      </>
    );
  }

  return null;
}

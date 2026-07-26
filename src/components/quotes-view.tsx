"use client";

import { useCallback, useEffect, useState } from "react";

import type { FirmSettings, Quote } from "@/lib/data";
import { getQuoteDetailAction } from "@/lib/quotes/actions";
import { QuoteDetail } from "@/components/quote-detail";
import { QuotesTable } from "@/components/quotes-table";
import { SidePanel } from "@/components/side-panel";

type QuoteBundle = {
  quote: Quote;
  settings: FirmSettings;
  leadId: string | null;
  leadName: string | null;
  leadEmail: string | null;
};

export function QuotesView({ quotes }: { quotes: Quote[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<QuoteBundle | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBundle = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await getQuoteDetailAction(id);
      if (!data) {
        setBundle(null);
        setSelectedId(null);
        return;
      }
      setBundle(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setBundle(null);
      return;
    }
    void loadBundle(selectedId);
  }, [selectedId, loadBundle]);

  function closePanel() {
    setSelectedId(null);
    setBundle(null);
  }

  return (
    <>
      <QuotesTable quotes={quotes} onOpen={(id) => setSelectedId(id)} />
      <SidePanel
        open={Boolean(selectedId)}
        onClose={closePanel}
        className="max-w-4xl"
      >
        {bundle ? (
          <QuoteDetail
            quote={bundle.quote}
            settings={bundle.settings}
            leadId={bundle.leadId}
            leadName={bundle.leadName}
            leadEmail={bundle.leadEmail}
            mode="drawer"
            onClose={closePanel}
            onChanged={() => {
              if (selectedId) void loadBundle(selectedId);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {loading || selectedId ? "Loading quote…" : null}
          </div>
        )}
      </SidePanel>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import type { FirmSettings, Invoice } from "@/lib/data";
import { getInvoiceDetailAction } from "@/lib/invoices/actions";
import { InvoiceDetail } from "@/components/invoice-detail";
import { InvoicesTable } from "@/components/invoices-table";
import { SidePanel } from "@/components/side-panel";

type InvoiceBundle = {
  invoice: Invoice;
  settings: FirmSettings;
  projectName: string | null;
};

export function InvoicesView({ invoices }: { invoices: Invoice[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<InvoiceBundle | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBundle = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await getInvoiceDetailAction(id);
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
      <InvoicesTable invoices={invoices} onOpen={(id) => setSelectedId(id)} />
      <SidePanel
        open={Boolean(selectedId)}
        onClose={closePanel}
        className="max-w-4xl"
      >
        {bundle ? (
          <InvoiceDetail
            invoice={bundle.invoice}
            settings={bundle.settings}
            projectName={bundle.projectName}
            mode="drawer"
            onClose={closePanel}
            onChanged={() => {
              if (selectedId) void loadBundle(selectedId);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {loading || selectedId ? "Loading invoice…" : null}
          </div>
        )}
      </SidePanel>
    </>
  );
}

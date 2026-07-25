"use client";

import { Download } from "lucide-react";

import type { Lead } from "@/lib/data";
import { Button } from "@/components/ui/button";

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportLeadsButton({ leads }: { leads: Lead[] }) {
  function download() {
    const header = [
      "company",
      "contact",
      "email",
      "phone",
      "country",
      "status",
      "category",
      "source",
      "value",
      "probability",
      "nextFollowUp",
      "tags",
      "website",
    ];
    const rows = leads.map((l) =>
      [
        l.company,
        l.contact,
        l.email,
        l.phone,
        l.country,
        l.status,
        l.category,
        l.source,
        l.value,
        l.probability,
        l.nextFollowUp,
        l.tags.join("; "),
        l.website,
      ]
        .map(csvEscape)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outpost-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" onClick={download}>
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}

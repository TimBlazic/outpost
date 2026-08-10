"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import type {
  Client,
  FirmSettings,
  Invoice,
  InvoiceClientSnapshot,
  InvoiceLineItem,
  Project,
} from "@/lib/data";
import {
  computeInvoiceTotals,
  isArchived,
  snapshotFromClient,
} from "@/lib/data";
import {
  createInvoice,
  issueInvoice,
  updateInvoice,
  type InvoiceInput,
} from "@/lib/invoices/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EditorLine = {
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
};

function emptyLine(): EditorLine {
  return {
    description: "",
    qty: "1",
    unit: "",
    unitPrice: "",
    taxRate: "0",
  };
}

function toEditorLine(line: InvoiceLineItem): EditorLine {
  return {
    description: line.description,
    qty: String(line.qty ?? ""),
    unit: line.unit ?? "",
    unitPrice:
      line.unitPrice === 0 || line.unitPrice == null
        ? ""
        : String(line.unitPrice),
    taxRate: String(line.taxRate ?? 0),
  };
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function toInvoiceLine(line: EditorLine): InvoiceLineItem {
  return {
    description: line.description,
    qty: parseAmount(line.qty),
    unit: line.unit,
    unitPrice: parseAmount(line.unitPrice),
    taxRate: parseAmount(line.taxRate),
  };
}

function emptySnapshot(): InvoiceClientSnapshot {
  return {
    name: "",
    email: "",
    companyName: "",
    address: "",
    vatId: "",
    taxNumber: "",
    registrationNumber: "",
  };
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function money(currency: string, n: number) {
  return `${currency} ${n.toFixed(2)}`;
}

export function InvoiceEditor({
  clients,
  projects,
  settings,
  invoice,
  defaultClientId,
  defaultProjectId,
  mode,
}: {
  clients: Client[];
  projects: Project[];
  settings: FirmSettings;
  invoice?: Invoice;
  /** Prefill client on create (e.g. from client detail). */
  defaultClientId?: string;
  /** Prefill project on create (e.g. from project detail). */
  defaultProjectId?: string;
  /** When duplicating, prefilled invoice without an id save yet */
  mode: "create" | "edit" | "duplicate";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const preferredProject =
    projects.find(
      (p) =>
        p.id === (invoice?.projectId ?? defaultProjectId) && !isArchived(p)
    ) ?? null;
  const preferredClient =
    clients.find(
      (c) =>
        c.id ===
        (invoice?.clientId ?? preferredProject?.clientId ?? defaultClientId)
    ) ?? clients[0];
  const initialClientId = preferredClient?.id ?? "";
  const [clientId, setClientId] = useState(initialClientId);
  const [projectId, setProjectId] = useState(
    preferredProject?.id ?? invoice?.projectId ?? defaultProjectId ?? ""
  );
  const [snapshot, setSnapshot] = useState<InvoiceClientSnapshot>(
    invoice?.clientSnapshot ??
      (preferredClient ? snapshotFromClient(preferredClient) : emptySnapshot())
  );
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? today);
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ??
      addDays(
        today,
        preferredClient?.paymentTermsDays ?? settings.defaultPaymentTermsDays
      )
  );
  const [currency, setCurrency] = useState<Invoice["currency"]>(
    invoice?.currency ?? settings.defaultCurrency
  );
  const [lineItems, setLineItems] = useState<EditorLine[]>(
    invoice?.lineItems?.length
      ? invoice.lineItems.map(toEditorLine)
      : [emptyLine()]
  );
  const [monthlyItems, setMonthlyItems] = useState<EditorLine[]>(
    invoice?.monthlyItems?.length
      ? invoice.monthlyItems.map(toEditorLine)
      : []
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const parsedLines = useMemo(
    () => lineItems.map(toInvoiceLine),
    [lineItems]
  );
  const parsedMonthly = useMemo(
    () =>
      monthlyItems
        .map(toInvoiceLine)
        .filter((l) => l.description.trim()),
    [monthlyItems]
  );
  const totals = useMemo(
    () => computeInvoiceTotals(parsedLines),
    [parsedLines]
  );
  const monthlyTotals = useMemo(
    () => computeInvoiceTotals(parsedMonthly),
    [parsedMonthly]
  );

  const clientProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          !isArchived(p) &&
          (!clientId || p.clientId === clientId)
      ),
    [projects, clientId]
  );

  function applyClient(id: string) {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    setSnapshot(snapshotFromClient(client));
    const terms = client.paymentTermsDays ?? settings.defaultPaymentTermsDays;
    setDueDate(addDays(issueDate, terms));
    // Clear project if it belongs to another client
    if (projectId) {
      const linked = projects.find((p) => p.id === projectId);
      if (linked && linked.clientId !== id) setProjectId("");
    }
  }

  function applyProject(id: string) {
    setProjectId(id);
    if (!id) return;
    const project = projects.find((p) => p.id === id);
    if (!project?.clientId) return;
    if (project.clientId !== clientId) {
      applyClient(project.clientId);
    }
  }

  function updateLine(index: number, patch: Partial<EditorLine>) {
    setLineItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function updateMonthlyLine(index: number, patch: Partial<EditorLine>) {
    setMonthlyItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function buildInput(): InvoiceInput {
    return {
      clientId: clientId || null,
      projectId: projectId || null,
      clientSnapshot: { ...snapshot, name: "" },
      issueDate,
      dueDate,
      currency,
      lineItems: parsedLines,
      monthlyItems: parsedMonthly,
      notes,
    };
  }

  function handleSave(andIssue = false) {
    setError(null);
    const input = buildInput();
    if (!input.clientSnapshot.companyName.trim()) {
      setError("Company is required on the invoice");
      return;
    }
    startTransition(async () => {
      try {
        let id = invoice?.id;
        if (mode === "edit" && id) {
          await updateInvoice(id, input);
        } else {
          id = await createInvoice(input);
        }
        if (andIssue && id) {
          await issueInvoice(id);
        }
        router.push(`/invoices/${id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save invoice");
      }
    });
  }

  const backHref =
    mode === "edit" && invoice ? `/invoices/${invoice.id}` : "/invoices";
  const title =
    mode === "edit"
      ? "Edit invoice"
      : mode === "duplicate"
        ? "Duplicate invoice"
        : "New invoice";

  return (
    <form
      className="space-y-6 p-4 lg:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave(false);
      }}
    >
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save as draft — issue assigns the invoice number.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending} variant="outline">
            {pending ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => handleSave(true)}
          >
            {pending ? "Working…" : "Save & issue"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="clientId" className="mb-1.5">
                  Select client
                </Label>
                <Select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => applyClient(e.target.value)}
                >
                  <option value="">Custom / no client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company && c.company !== c.name
                        ? ` · ${c.company}`
                        : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="projectId" className="mb-1.5">
                  Project{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Select
                  id="projectId"
                  value={projectId}
                  onChange={(e) => applyProject(e.target.value)}
                  disabled={!clientId && clientProjects.length === 0}
                >
                  <option value="">No project</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Links this invoice to a delivery project for tracking — not
                  shown on the PDF.
                </p>
              </div>
              {(
                [
                  ["companyName", "Company"],
                  ["email", "Email"],
                  ["address", "Billing address"],
                  ["vatId", "VAT ID"],
                  ["taxNumber", "Tax number"],
                  ["registrationNumber", "Registration number"],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  className={
                    key === "address" || key === "companyName"
                      ? "sm:col-span-2"
                      : undefined
                  }
                >
                  <Label htmlFor={key} className="mb-1.5">
                    {label}
                  </Label>
                  <Input
                    id={key}
                    value={snapshot[key]}
                    onChange={(e) =>
                      setSnapshot((s) => ({ ...s, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">One-time</CardTitle>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  Setup, build, launch — billed once.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLineItems((rows) => [...rows, emptyLine()])}
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-[1fr_5rem_5rem_6rem_5rem_auto]"
                >
                  <div className="sm:col-span-1">
                    <Label className="mb-1.5">Description</Label>
                    <Input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(index, { description: e.target.value })
                      }
                      placeholder="Website build"
                      required
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Qty</Label>
                    <Input
                      inputMode="decimal"
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(index, { qty: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Unit</Label>
                    <Input
                      value={line.unit}
                      onChange={(e) =>
                        updateLine(index, { unit: e.target.value })
                      }
                      placeholder="h"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Unit price</Label>
                    <Input
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(index, { unitPrice: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Tax %</Label>
                    <Input
                      inputMode="decimal"
                      value={line.taxRate}
                      onChange={(e) =>
                        updateLine(index, { taxRate: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={lineItems.length <= 1}
                      onClick={() =>
                        setLineItems((rows) =>
                          rows.filter((_, i) => i !== index)
                        )
                      }
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Monthly</CardTitle>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  Hosting, support, retainer — optional on the document.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setMonthlyItems((rows) => [...rows, emptyLine()])
                }
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {monthlyItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No monthly items — add hosting or support if needed.
                </p>
              ) : (
                monthlyItems.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-[1fr_5rem_5rem_6rem_5rem_auto]"
                  >
                    <div className="sm:col-span-1">
                      <Label className="mb-1.5">Description</Label>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateMonthlyLine(index, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Hosting + support"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5">Qty</Label>
                      <Input
                        inputMode="decimal"
                        value={line.qty}
                        onChange={(e) =>
                          updateMonthlyLine(index, { qty: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5">Unit</Label>
                      <Input
                        value={line.unit}
                        onChange={(e) =>
                          updateMonthlyLine(index, { unit: e.target.value })
                        }
                        placeholder="mo"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5">Unit price</Label>
                      <Input
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateMonthlyLine(index, {
                            unitPrice: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5">Tax %</Label>
                      <Input
                        inputMode="decimal"
                        value={line.taxRate}
                        onChange={(e) =>
                          updateMonthlyLine(index, {
                            taxRate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setMonthlyItems((rows) =>
                            rows.filter((_, i) => i !== index)
                          )
                        }
                        aria-label="Remove monthly line"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Payment reference, thanks, etc."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dates & currency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="issueDate" className="mb-1.5">
                  Issue date
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => {
                    setIssueDate(e.target.value);
                    const client = clients.find((c) => c.id === clientId);
                    const terms =
                      client?.paymentTermsDays ??
                      settings.defaultPaymentTermsDays;
                    setDueDate(addDays(e.target.value, terms));
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dueDate" className="mb-1.5">
                  Due date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="currency" className="mb-1.5">
                  Currency
                </Label>
                <Select
                  id="currency"
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as Invoice["currency"])
                  }
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {money(currency, totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">
                  {money(currency, totals.taxTotal)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>One-time</span>
                <span className="tabular-nums">
                  {money(currency, totals.total)}
                </span>
              </div>
              {monthlyTotals.total > 0 ? (
                <div className="flex justify-between pt-1 text-sm font-semibold">
                  <span>Monthly</span>
                  <span className="tabular-nums">
                    {money(currency, monthlyTotals.total)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      / mo
                    </span>
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

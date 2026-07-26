"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Plus,
  Trash2,
  CircleDollarSign,
  Pencil,
  FileText,
  Loader2,
} from "lucide-react";

import {
  type Invoice,
  type Payment,
  paymentAmount,
} from "@/lib/data";
import {
  togglePaymentPaid,
  addPayment,
  updatePayment,
  removePayment,
} from "@/lib/actions";
import { createInvoiceFromPayment } from "@/lib/invoices/actions";
import { eur, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/status-pill";

const invTone: Record<Invoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  void: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export function PaymentSchedule({
  projectId,
  value,
  payments,
  invoices = [],
  variant = "card",
  onOpenInvoice,
}: {
  projectId: string;
  value: number;
  payments: Payment[];
  invoices?: Invoice[];
  variant?: "card" | "plain";
  onOpenInvoice?: (invoiceId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");
  const [dueOn, setDueOn] = useState("");

  const invoicesById = Object.fromEntries(invoices.map((i) => [i.id, i]));

  const scheduledPct = payments.reduce((s, p) => s + p.percent, 0);
  const paid = payments
    .filter((p) => p.paid)
    .reduce((s, p) => s + paymentAmount(value, p.percent), 0);
  const paidPct = value > 0 ? Math.round((paid / value) * 100) : 0;
  const outstanding = value - paid;

  function resetForm() {
    setLabel("");
    setPercent("");
    setDueOn("");
    setAdding(false);
    setEditingId(null);
  }

  function startEdit(p: Payment) {
    setAdding(false);
    setEditingId(p.id);
    setLabel(p.label);
    setPercent(String(p.percent));
    setDueOn(p.dueOn ?? "");
  }

  function handleSave() {
    const pct = Number(percent);
    if (!pct) return;
    const payload = {
      label: label.trim() || "Installment",
      percent: pct,
      dueOn: dueOn || null,
    };
    startTransition(async () => {
      if (editingId) {
        await updatePayment(projectId, editingId, payload);
      } else {
        await addPayment(projectId, payload);
      }
      resetForm();
    });
  }

  function invoiceThis(paymentId: string) {
    setError(null);
    setBusyPaymentId(paymentId);
    startTransition(async () => {
      try {
        const id = await createInvoiceFromPayment(projectId, paymentId);
        onOpenInvoice?.(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create invoice");
      } finally {
        setBusyPaymentId(null);
      }
    });
  }

  const body = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {variant === "plain" ? (
          <p className="text-sm text-muted-foreground">
            Track deposits and installments — Invoice this creates one draft at
            a time
          </p>
        ) : (
          <div className="flex items-center gap-2 text-base font-semibold">
            <CircleDollarSign className="size-4 text-muted-foreground" />
            Payment schedule
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingId(null);
            setAdding((a) => !a);
            setLabel("");
            setPercent("");
            setDueOn("");
          }}
        >
          <Plus className="size-4" /> Add installment
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <div className="flex items-end justify-between">
          <span className="text-sm text-muted-foreground">
            {eur(paid)} collected
          </span>
          <span className="text-sm text-muted-foreground">
            {eur(outstanding)} outstanding
          </span>
        </div>
        <Progress value={paidPct} className="mt-2" />
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{paidPct}% paid</span>
          <span
            className={cn(
              scheduledPct !== 100 && "font-medium text-amber-600"
            )}
          >
            {scheduledPct}% scheduled
            {scheduledPct !== 100 && " ⚠"}
          </span>
        </div>
      </div>

      {(adding || editingId) && (
        <div className="grid grid-cols-[1fr_90px_140px_auto] items-end gap-2 rounded-xl border bg-muted/20 p-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Deposit"
              className="h-8"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              %
            </label>
            <Input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              type="number"
              placeholder="20"
              className="h-8"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Due
            </label>
            <Input
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              type="date"
              className="h-8"
            />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={resetForm}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {editingId ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "divide-y",
          variant === "plain" && "rounded-xl border"
        )}
      >
        {payments.map((p) => {
          const amount = paymentAmount(value, p.percent);
          const inv = p.invoiceId ? invoicesById[p.invoiceId] : null;
          const statusLabel = p.paid
            ? "paid"
            : inv
              ? inv.status
              : "no invoice";
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-3",
                variant === "plain" ? "px-4 py-3" : "py-2.5"
              )}
            >
              <button
                type="button"
                onClick={() =>
                  startTransition(() => togglePaymentPaid(projectId, p.id))
                }
                disabled={pending}
                aria-label={p.paid ? "Mark unpaid" : "Mark paid"}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  p.paid
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-input hover:bg-accent"
                )}
              >
                {p.paid && <Check className="size-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{p.label}</p>
                  <StatusPill
                    label={statusLabel}
                    className={cn(
                      "capitalize",
                      p.paid
                        ? invTone.paid
                        : inv
                          ? invTone[inv.status]
                          : "bg-muted text-muted-foreground"
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.percent}%
                  {p.dueOn && ` · due ${fmtDate(p.dueOn)}`}
                  {p.paid && p.paidOn && ` · paid ${fmtDate(p.paidOn)}`}
                  {inv?.invoiceNumber ? ` · ${inv.invoiceNumber}` : null}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  p.paid ? "text-emerald-600" : "text-foreground"
                )}
              >
                {eur(amount)}
              </span>
              {onOpenInvoice ? (
                p.invoiceId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onOpenInvoice(p.invoiceId!)}
                  >
                    <FileText className="size-3.5" />
                    Open
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || p.paid}
                    onClick={() => invoiceThis(p.id)}
                  >
                    {busyPaymentId === p.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FileText className="size-3.5" />
                    )}
                    Invoice this
                  </Button>
                )
              ) : null}
              <button
                type="button"
                onClick={() => startEdit(p)}
                disabled={pending}
                aria-label="Edit installment"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(() => removePayment(projectId, p.id))
                }
                disabled={pending}
                aria-label="Remove installment"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
        {payments.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No payment schedule yet. Add installments like 30% / 30% / 40%.
          </p>
        )}
      </div>
    </div>
  );

  if (variant === "plain") return body;

  return (
    <Card>
      <CardContent className="pt-6">{body}</CardContent>
    </Card>
  );
}

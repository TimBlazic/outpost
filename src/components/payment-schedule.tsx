"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, CircleDollarSign, Pencil } from "lucide-react";

import { type Payment, paymentAmount } from "@/lib/data";
import {
  togglePaymentPaid,
  addPayment,
  updatePayment,
  removePayment,
} from "@/lib/actions";
import { eur, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export function PaymentSchedule({
  projectId,
  value,
  payments,
  variant = "card",
}: {
  projectId: string;
  value: number;
  payments: Payment[];
  variant?: "card" | "plain";
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");
  const [dueOn, setDueOn] = useState("");

  const scheduledPct = payments.reduce((s, p) => s + p.percent, 0);
  const paid = payments
    .filter((p) => p.paid)
    .reduce((s, p) => s + paymentAmount(value, p.percent), 0);
  const paidPct = Math.round((paid / value) * 100);
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

  const body = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {variant === "plain" ? (
          <p className="text-sm text-muted-foreground">
            Track deposits and installments against the project value
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
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-3",
                variant === "plain" ? "px-4 py-3" : "py-2.5"
              )}
            >
              <button
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
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">
                  {p.percent}%
                  {p.dueOn && ` · due ${fmtDate(p.dueOn)}`}
                  {p.paid && p.paidOn && ` · paid ${fmtDate(p.paidOn)}`}
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
              <button
                onClick={() => startEdit(p)}
                disabled={pending}
                aria-label="Edit installment"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
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
            No payment schedule yet. Add installments like 20% / 50% / 30%.
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

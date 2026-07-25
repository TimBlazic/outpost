"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { FirmSettings } from "@/lib/data";
import { updateFirmSettings } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsForm({ settings }: { settings: FirmSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [firmName, setFirmName] = useState(settings.firmName);
  const [revenueGoal, setRevenueGoal] = useState(String(settings.revenueGoal));
  const [goalYear, setGoalYear] = useState(String(settings.goalYear));
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateFirmSettings({
        firmName: firmName.trim() || "Studio",
        revenueGoal: Number(revenueGoal) || 0,
        goalYear: Number(goalYear) || new Date().getFullYear(),
        // Legacy column; dashboard now derives avg from project values.
        avgProjectValue: settings.avgProjectValue,
        // Kept for schema compatibility; chart now reads paid installments.
        monthlyRevenue: settings.monthlyRevenue,
      });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Studio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="firmName" className="mb-1.5">
              Firm name
            </Label>
            <Input
              id="firmName"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Your studio"
            />
          </div>
          <div>
            <Label htmlFor="goalYear" className="mb-1.5">
              Goal year
            </Label>
            <Input
              id="goalYear"
              type="number"
              value={goalYear}
              onChange={(e) => setGoalYear(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="revenueGoal" className="mb-1.5">
              Revenue goal (€)
            </Label>
            <Input
              id="revenueGoal"
              type="number"
              min={0}
              value={revenueGoal}
              onChange={(e) => setRevenueGoal(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Dashboard “projects to go” uses the average value of your active
              projects. Monthly revenue comes from paid installments.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/select";
import {
  dashboardRangeLabels,
  dashboardRanges,
  type DashboardRange,
} from "@/lib/dashboard-range";

export function DashboardRangeSelect({
  value,
  basePath = "/",
}: {
  value: DashboardRange;
  /** Path that receives `?range=` (default dashboard `/`). */
  basePath?: string;
}) {
  const router = useRouter();

  return (
    <Select
      aria-label="Time range"
      value={value}
      className="h-9 w-[12rem] bg-background"
      onChange={(e) => {
        const next = e.target.value as DashboardRange;
        const params = new URLSearchParams();
        if (next !== "this_year") params.set("range", next);
        const qs = params.toString();
        router.push(qs ? `${basePath}?${qs}` : basePath);
      }}
    >
      {dashboardRanges.map((key) => (
        <option key={key} value={key}>
          {dashboardRangeLabels[key]}
        </option>
      ))}
    </Select>
  );
}

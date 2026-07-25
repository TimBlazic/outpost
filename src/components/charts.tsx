"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axisStyle = {
  fontSize: 12,
  fill: "var(--muted-foreground)",
};

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function eurTick(v: number) {
  return v >= 1000 ? `€${v / 1000}k` : `€${v}`;
}

export function RevenueAreaChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={eurTick} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [eurTick(Number(v)), "Revenue"]}
          cursor={{ stroke: "var(--border)" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#rev)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PipelineLineChart({
  data,
}: {
  data: { month: string; revenue: number; pipeline: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={eurTick} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
        <Line type="monotone" dataKey="pipeline" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TypeBarChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={eurTick} />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [eurTick(Number(v)), "Value"]}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

export function SourcePieChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

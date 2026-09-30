"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPercent } from "@/lib/format";

export interface OeeFactorDatum {
  name: string;
  value: number;
}

const FACTOR_FILL: Record<string, string> = {
  "ความพร้อมเครื่อง": "#198387",
  ประสิทธิภาพ: "#41bfbe",
  คุณภาพ: "#ff9a2e",
};

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(213,219,227,.9)",
  fontSize: 12,
  padding: "8px 10px",
};

export function OeeFactorChart({ data }: { data: OeeFactorDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={6}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(133,151,172,.25)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#667a92" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#667a92" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => formatPercent(value)}
          cursor={{ fill: "rgba(25,131,135,.06)" }}
        />
        <ReferenceLine y={85} stroke="#e05c06" strokeDasharray="4 4" label={{ value: "เป้า 85%", position: "right", fontSize: 10, fill: "#b84209" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={54}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={FACTOR_FILL[entry.name] ?? "#667a92"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface TrendPoint {
  label: string;
  availability: number;
}

export function AvailabilityChart({ data, target }: { data: TrendPoint[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(133,151,172,.25)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667a92" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#667a92" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => formatPercent(value)}
          labelFormatter={(label: string) => `วันที่ ${label}`}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 11, color: "#667a92" }}
        />
        <ReferenceLine
          y={target}
          stroke="#e05c06"
          strokeDasharray="4 4"
          label={{ value: `เป้า ${target}%`, position: "insideTopRight", fontSize: 10, fill: "#b84209" }}
        />
        <Line
          type="monotone"
          dataKey="availability"
          name="ความพร้อมเครื่อง"
          stroke="#198387"
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface CauseDatum {
  cause: string;
  minutes: number;
}

const CAUSE_COLOURS = ["#198387", "#41bfbe", "#ff9a2e", "#e05c06", "#8597ac", "#b0bcca"];

export function DowntimeCauseChart({ data }: { data: CauseDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(133,151,172,.25)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#667a92" }} axisLine={false} tickLine={false} unit=" นาที" />
        <YAxis type="category" dataKey="cause" width={92} tick={{ fontSize: 11, fill: "#667a92" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value} นาที`} />
        <Bar dataKey="minutes" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((entry, index) => (
            <Cell key={entry.cause} fill={CAUSE_COLOURS[index % CAUSE_COLOURS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { PlotParams } from "react-plotly.js";

import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardTheme } from "@/lib/dashboard-themes";
import { buildPlotlyFigure, formatValue } from "@/lib/plotly/buildFigure";
import type { ChartSpec, ThemeConfig } from "@/types/api";
import { runDataQuery } from "@/lib/data/runDataQuery";

const Plot = dynamic<PlotParams>(() => import("react-plotly.js").then((module) => module.default), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

interface SpecChartProps {
  spec: ChartSpec;
  rows: Record<string, unknown>[] | null;
  dashboardTheme?: DashboardTheme;
  themeConfig?: ThemeConfig | null;
  /** Element id we set on the underlying Plotly div, so the export panel can call Plotly.toImage on it. */
  plotlyDivId?: string;
}

export function SpecChart({ spec, rows, dashboardTheme, themeConfig, plotlyDivId }: SpecChartProps) {
  const figure = useMemo(() => {
    if (!rows) return null;
    return buildPlotlyFigure({ rows, spec, dashboardTheme, themeConfig });
  }, [rows, spec, dashboardTheme, themeConfig]);

  if (!rows) {
    return <Skeleton className="h-full w-full rounded-lg" />;
  }

  // KPI cards render as a styled HTML block instead of a Plotly indicator so they
  // look like a real SaaS metric tile.
  if (spec.chart_type === "kpi") {
    return <KpiTile spec={spec} rows={rows} dashboardTheme={dashboardTheme} />;
  }

  if (!figure) return null;

  return (
    <Plot
      config={figure.config as PlotParams["config"]}
      data={figure.data as PlotParams["data"]}
      divId={plotlyDivId}
      layout={figure.layout as PlotParams["layout"]}
      style={{ height: "100%", width: "100%" }}
      useResizeHandler
    />
  );
}

function KpiTile({
  spec,
  rows,
  dashboardTheme,
}: {
  spec: ChartSpec;
  rows: Record<string, unknown>[];
  dashboardTheme?: DashboardTheme;
}) {
  const yKey = spec.data_query.y ?? spec.data_query.x;
  const aggregation = spec.data_query.aggregation && spec.data_query.aggregation !== "none"
    ? spec.data_query.aggregation
    : "sum";
  const result = useMemo(
    () =>
      runDataQuery(rows, {
        ...spec.data_query,
        aggregation,
        group_by: null,
        sort: "none",
        limit: null,
      }),
    [rows, spec.data_query, aggregation],
  );
  const value = useMemo(() => {
    if (!yKey) return result.rows.length;
    if (aggregation === "count") return result.rows.length || rows.length;
    return result.rows.reduce((acc, row) => acc + Number(row[yKey] ?? 0), 0);
  }, [result.rows, rows.length, yKey, aggregation]);
  const formatted = formatValue(value, spec.style.number_format ?? "auto");

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm"
      style={dashboardTheme ? { background: dashboardTheme.panel, borderColor: dashboardTheme.border, color: dashboardTheme.text } : undefined}
    >
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={dashboardTheme ? { color: dashboardTheme.muted } : undefined}>
          {aggregation.replace("_", " ")}
        </div>
        <div className="truncate text-sm font-semibold">{spec.title}</div>
      </div>
      <div className="truncate text-3xl font-semibold leading-tight tracking-tight" style={dashboardTheme ? { color: dashboardTheme.accent } : undefined}>
        {formatted}
      </div>
      {spec.explanation ? (
        <div className="line-clamp-2 text-xs" style={dashboardTheme ? { color: dashboardTheme.muted } : undefined}>
          {spec.explanation}
        </div>
      ) : null}
    </div>
  );
}

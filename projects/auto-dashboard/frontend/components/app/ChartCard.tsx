"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardTheme } from "@/lib/dashboard-themes";
import type { ChartResponse } from "@/types/api";

const Plot = dynamic<PlotParams>(() => import("react-plotly.js").then((module) => module.default), {
  ssr: false,
  loading: () => <Skeleton className="h-80 rounded-lg" />,
});

interface ChartCardProps {
  chart: ChartResponse;
  canvas?: boolean;
  compact?: boolean;
  showExplanation?: boolean;
  theme?: DashboardTheme;
}

export function ChartCard({ chart, canvas = false, compact = false, showExplanation = true, theme }: ChartCardProps) {
  const layout = {
    ...(chart.plotly_json.layout ?? {}),
    autosize: true,
    title: undefined,
    colorway: theme?.colorway,
    font: theme ? { family: "Inter, Geist, Arial, sans-serif", color: theme.text, size: canvas ? 10 : 12 } : undefined,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: theme?.plotBackground,
    margin: canvas ? { l: 42, r: 10, t: 2, b: 36 } : compact ? { l: 48, r: 24, t: 20, b: 44 } : { l: 56, r: 28, t: 24, b: 56 },
    legend: canvas
      ? {
          orientation: "h",
          y: -0.28,
          x: 0,
          font: theme ? { color: theme.muted, size: 9 } : { size: 9 },
        }
      : chart.plotly_json.layout?.legend,
    xaxis: {
      ...((chart.plotly_json.layout?.xaxis as object | undefined) ?? {}),
      gridcolor: theme?.grid,
      rangeslider: { visible: false },
      tickfont: theme ? { color: theme.muted } : undefined,
      titlefont: theme ? { color: theme.muted } : undefined,
    },
    yaxis: {
      ...((chart.plotly_json.layout?.yaxis as object | undefined) ?? {}),
      gridcolor: theme?.grid,
      automargin: true,
      tickfont: theme ? { color: theme.muted } : undefined,
      titlefont: theme ? { color: theme.muted } : undefined,
    },
  };

  return (
    <Card
      className={canvas ? "flex h-full min-h-0 flex-col gap-0 rounded-[3px] border-white/35 py-0 backdrop-blur-sm" : "rounded-lg"}
      size="sm"
      style={theme ? { background: theme.panel, borderColor: theme.border, boxShadow: theme.shadow, color: theme.text } : undefined}
    >
      <CardHeader className={canvas ? "shrink-0 gap-0.5 px-2.5 py-1.5" : undefined}>
        <CardTitle className={canvas ? "truncate text-[11px] leading-4" : undefined}>{chart.title}</CardTitle>
        <CardDescription className={canvas ? "text-[10px] leading-3" : undefined} style={theme ? { color: theme.muted } : undefined}>{chart.chart_type.replace("_", " ")}</CardDescription>
      </CardHeader>
      <CardContent className={canvas ? "flex min-h-0 flex-1 flex-col gap-1 px-1.5 pb-1.5" : "flex flex-col gap-3"}>
        <div className={canvas ? "min-h-0 flex-1 min-w-0" : compact ? "h-64 min-w-0" : "h-88 min-w-0"}>
          <Plot
            config={{ displaylogo: false, responsive: true }}
            data={(chart.plotly_json.data ?? []) as PlotParams["data"]}
            layout={layout as PlotParams["layout"]}
            style={{ height: "100%", width: "100%" }}
            useResizeHandler
          />
        </div>
        {showExplanation && chart.explanation ? (
          <p className="text-sm leading-6" style={theme ? { color: theme.muted } : undefined}>
            {chart.explanation}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

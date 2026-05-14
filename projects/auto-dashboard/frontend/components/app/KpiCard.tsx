import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTheme } from "@/lib/dashboard-themes";
import type { KpiCardResponse } from "@/types/api";

interface KpiCardProps {
  canvas?: boolean;
  kpi: KpiCardResponse;
  theme?: DashboardTheme;
}

export function KpiCard({ canvas = false, kpi, theme }: KpiCardProps) {
  if (canvas) {
    return (
      <section
        className="flex h-full min-h-0 overflow-hidden rounded-xl border p-3"
        style={theme ? { background: theme.panel, borderColor: theme.border, boxShadow: theme.shadow, color: theme.text } : undefined}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-start gap-0.5">
          <div className="truncate text-[10px] leading-3" style={theme ? { color: theme.muted } : undefined}>
            {kpi.aggregation.replace("_", " ")}
          </div>
          <div className="truncate text-[13px] font-semibold leading-4">{kpi.title}</div>
          <div className="mt-1 truncate text-xl font-semibold leading-6 tracking-[-0.04em]">{kpi.formatted_value}</div>
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={theme ? { background: theme.accentSoft, color: theme.accent } : undefined}>
          <TrendingUp className="size-3.5" />
        </div>
      </section>
    );
  }

  return (
    <Card
      className="rounded-lg"
      size="sm"
      style={theme ? { background: theme.panel, borderColor: theme.border, boxShadow: theme.shadow, color: theme.text } : undefined}
    >
      <CardHeader className="grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardDescription>{kpi.aggregation.replace("_", " ")}</CardDescription>
          <CardTitle className="truncate">{kpi.title}</CardTitle>
        </div>
        <div className="flex size-8 items-center justify-center rounded-lg" style={theme ? { background: theme.accentSoft, color: theme.accent } : undefined}>
          <TrendingUp className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="text-2xl font-semibold tracking-normal">{kpi.formatted_value}</div>
        {kpi.explanation ? <p className="text-xs leading-5" style={theme ? { color: theme.muted } : undefined}>{kpi.explanation}</p> : null}
      </CardContent>
    </Card>
  );
}

import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTheme } from "@/lib/dashboard-themes";

interface InsightPanelProps {
  insights: string[];
  theme?: DashboardTheme;
}

export function InsightPanel({ insights, theme }: InsightPanelProps) {
  if (!insights.length) {
    return null;
  }

  return (
    <Card className="rounded-lg" size="sm" style={theme ? { background: theme.panel, borderColor: theme.border, color: theme.text } : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-muted-foreground" />
          Recommended insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {insights.map((insight, index) => (
            <li
              className="rounded-lg border p-3 text-sm leading-6"
              key={index}
              style={theme ? { background: theme.panelStrong, borderColor: theme.border, color: theme.muted } : undefined}
            >
              {insight}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

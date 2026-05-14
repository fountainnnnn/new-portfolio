// Shared visual defaults so every chart type looks like a polished SaaS card.

import type { DashboardTheme } from "@/lib/dashboard-themes";
import type { ThemeConfig } from "@/types/api";

export interface RenderTheme {
  background: string;
  panel: string;
  text: string;
  muted: string;
  grid: string;
  accent: string;
  font: string;
  colorway: string[];
}

const DEFAULT_COLORWAY = [
  "#275EFE",
  "#10A37F",
  "#E7A321",
  "#D64545",
  "#7C3AED",
  "#0E7490",
  "#0F766E",
  "#F97316",
  "#9333EA",
  "#0284C7",
];

export function resolveRenderTheme(
  dashboardTheme: DashboardTheme | undefined,
  themeConfig?: ThemeConfig | null,
): RenderTheme {
  return {
    background: dashboardTheme?.background ?? themeConfig?.background ?? "#f4f6fb",
    panel: dashboardTheme?.panel ?? "#ffffff",
    text: dashboardTheme?.text ?? "#141414",
    muted: dashboardTheme?.muted ?? "#667085",
    grid: dashboardTheme?.grid ?? "#E8EDF5",
    accent: dashboardTheme?.accent ?? themeConfig?.accent ?? "#275EFE",
    font: themeConfig?.font ?? "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    colorway: dashboardTheme?.colorway ?? DEFAULT_COLORWAY,
  };
}

export function defaultLayout(
  theme: RenderTheme,
  opts: { show_legend?: boolean; show_grid?: boolean; showLegend?: boolean; showGrid?: boolean } = {},
): Record<string, unknown> {
  const showLegend = opts.show_legend ?? opts.showLegend ?? true;
  const showGrid = opts.show_grid ?? opts.showGrid ?? true;
  // Margins are tuned for small Plotly canvases (a chart can be as short as 200px
  // tall on the 1280x720 page). The legend lives ABOVE the plot in a horizontal
  // strip so it never overlaps the data, and the plot area gets the rest.
  const topMargin = showLegend ? 28 : 12;
  return {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: theme.font, color: theme.text, size: 11 },
    margin: { l: 44, r: 16, t: topMargin, b: 38 },
    colorway: theme.colorway,
    showlegend: showLegend,
    legend: showLegend
      ? {
          orientation: "h",
          yanchor: "bottom",
          y: 1.02, // sits in the top-margin band, ABOVE the plot area
          x: 0,
          xanchor: "left",
          bgcolor: "rgba(0,0,0,0)",
          font: { size: 10, color: theme.muted },
          // Put each legend swatch on the same row when possible; Plotly will wrap
          // automatically only when there isn't horizontal room.
          tracegroupgap: 4,
        }
      : undefined,
    hoverlabel: {
      bgcolor: "#0F172A",
      font: { color: "#FAFAFA", family: theme.font, size: 11 },
      bordercolor: theme.accent,
    },
    xaxis: {
      showgrid: showGrid,
      gridcolor: theme.grid,
      zeroline: false,
      automargin: true,
      tickfont: { color: theme.muted, size: 10 },
      title: { font: { color: theme.muted, size: 10 } },
      linecolor: theme.grid,
    },
    yaxis: {
      showgrid: showGrid,
      gridcolor: theme.grid,
      zeroline: false,
      automargin: true,
      tickfont: { color: theme.muted, size: 10 },
      title: { font: { color: theme.muted, size: 10 } },
      linecolor: theme.grid,
    },
  };
}

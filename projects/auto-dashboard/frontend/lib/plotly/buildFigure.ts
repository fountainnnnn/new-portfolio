// Deterministic Plotly figure builders.
// Input: ChartSpec + raw rows + render theme.
// Output: { data, layout, config } usable by react-plotly.js.
//
// No LLM-generated code is involved. Each chart type has a focused builder
// that consumes the spec and produces a figure with the same clean style.

import { COUNT_FIELD, runDataQuery } from "@/lib/data/runDataQuery";
import { defaultLayout, resolveRenderTheme, type RenderTheme } from "@/lib/plotly/theme";
import type { ChartSpec, NumberFormat, ThemeConfig } from "@/types/api";
import type { DashboardTheme } from "@/lib/dashboard-themes";

export interface PlotlyFigure {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface BuildFigureOptions {
  rows: Record<string, unknown>[];
  spec: ChartSpec;
  dashboardTheme?: DashboardTheme;
  themeConfig?: ThemeConfig | null;
}

const BASE_CONFIG: Record<string, unknown> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
};

export function buildPlotlyFigure(opts: BuildFigureOptions): PlotlyFigure {
  const theme = resolveRenderTheme(opts.dashboardTheme, opts.themeConfig);
  const builder = pickBuilder(opts.spec.chart_type);
  const figure = builder(opts.spec, opts.rows, theme);
  applyEncoding(figure, opts.spec, theme);
  return figure;
}

type Builder = (spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme) => PlotlyFigure;

function pickBuilder(kind: ChartSpec["chart_type"]): Builder {
  switch (kind) {
    case "bar":
      return buildBar;
    case "stacked_bar":
      return buildStackedBar;
    case "line":
      return buildLine;
    case "area":
      return buildArea;
    case "scatter":
      return buildScatter;
    case "histogram":
      return buildHistogram;
    case "box":
      return buildBox;
    case "pie":
      return buildPie;
    case "treemap":
      return buildTreemap;
    case "heatmap":
    case "correlation_heatmap":
      return buildHeatmap;
    case "kpi":
      return buildKpi;
    case "table":
      return buildTable;
    default:
      return buildBar;
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildBar(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const result = runDataQuery(rows, spec.data_query);
  const xKey = spec.data_query.x ?? "x";
  const yKey = countValueKey(spec);
  const groupKey = spec.data_query.group_by ?? null;
  const color = spec.style.color_override ?? theme.colorway[0];

  if (groupKey) {
    const series = splitByGroup(result.rows, groupKey);
    if (!series.some((entry) => hasRenderablePairs(entry.rows, xKey, yKey))) {
      return emptyFigure(spec, theme, "No chartable values for this view");
    }
    return {
      data: series.map((entry, index) => ({
        type: "bar",
        x: entry.rows.map((row) => row[xKey]),
        y: entry.rows.map((row) => row[yKey]),
        name: String(entry.key),
        marker: { color: theme.colorway[index % theme.colorway.length] },
        showlegend: series.length > 1,
      })),
      layout: { ...defaultLayout(theme, { ...spec.style, show_legend: series.length > 1 }), barmode: "group" },
      config: BASE_CONFIG,
    };
  }

  if (!hasRenderablePairs(result.rows, xKey, yKey)) {
    return emptyFigure(spec, theme, "No chartable values for this view");
  }

  return {
    data: [
      {
        type: "bar",
        x: result.rows.map((row) => row[xKey]),
        y: result.rows.map((row) => row[yKey]),
        marker: { color },
        showlegend: false,
        hovertemplate: `%{x}<br>${escapeLabel(yKey)}: %{y}<extra></extra>`,
      },
    ],
    layout: defaultLayout(theme, { ...spec.style, show_legend: false }),
    config: BASE_CONFIG,
  };
}

function buildStackedBar(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const figure = buildBar(spec, rows, theme);
  figure.layout = { ...figure.layout, barmode: "stack" };
  return figure;
}

function buildLine(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const result = runDataQuery(rows, spec.data_query);
  const xKey = spec.data_query.x ?? "x";
  const yKey = countValueKey(spec);
  const groupKey = spec.data_query.group_by ?? null;
  const color = spec.style.color_override ?? theme.colorway[0];

  if (groupKey) {
    const series = splitByGroup(result.rows, groupKey);
    if (!series.some((entry) => hasRenderablePairs(entry.rows, xKey, yKey))) {
      return emptyFigure(spec, theme, "No chartable values for this view");
    }
    return {
      data: series.map((entry, index) => ({
        type: "scatter",
        mode: "lines+markers",
        x: entry.rows.map((row) => row[xKey]),
        y: entry.rows.map((row) => row[yKey]),
        name: String(entry.key),
        line: { color: theme.colorway[index % theme.colorway.length], width: 2.4 },
        marker: { size: 6 },
        showlegend: series.length > 1,
      })),
      layout: defaultLayout(theme, { ...spec.style, show_legend: series.length > 1 }),
      config: BASE_CONFIG,
    };
  }

  if (!hasRenderablePairs(result.rows, xKey, yKey)) {
    return emptyFigure(spec, theme, "No chartable values for this view");
  }

  return {
    data: [
      {
        type: "scatter",
        mode: "lines+markers",
        x: result.rows.map((row) => row[xKey]),
        y: result.rows.map((row) => row[yKey]),
        line: { color, width: 2.4 },
        marker: { size: 6 },
        showlegend: false,
      },
    ],
    layout: defaultLayout(theme, { ...spec.style, show_legend: false }),
    config: BASE_CONFIG,
  };
}

function buildArea(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const figure = buildLine(spec, rows, theme);
  figure.data = figure.data.map((trace) => ({
    ...trace,
    fill: "tozeroy",
    fillcolor: addAlpha(getString(trace, "line.color") ?? theme.colorway[0], 0.18),
  }));
  return figure;
}

function buildScatter(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const xKey = spec.data_query.x;
  const yKey = spec.data_query.y;
  if (!xKey || !yKey) return emptyFigure(spec, theme, "Pick an X and Y column");
  const groupKey = spec.encoding.color_by ?? spec.data_query.group_by ?? null;
  const filtered = rows.filter((row) => row[xKey] != null && row[yKey] != null);
  const color = spec.style.color_override ?? theme.colorway[0];

  if (groupKey) {
    const series = splitByGroup(filtered, groupKey);
    return {
      data: series.map((entry, index) => ({
        type: "scatter",
        mode: "markers",
        x: entry.rows.map((row) => row[xKey]),
        y: entry.rows.map((row) => row[yKey]),
        name: String(entry.key),
        marker: { color: theme.colorway[index % theme.colorway.length], size: 8, opacity: 0.78 },
        showlegend: series.length > 1,
      })),
      layout: defaultLayout(theme, { ...spec.style, show_legend: series.length > 1 }),
      config: BASE_CONFIG,
    };
  }

  return {
    data: [
      {
        type: "scatter",
        mode: "markers",
        x: filtered.map((row) => row[xKey]),
        y: filtered.map((row) => row[yKey]),
        marker: { color, size: 8, opacity: 0.78 },
        showlegend: false,
      },
    ],
    layout: defaultLayout(theme, { ...spec.style, show_legend: false }),
    config: BASE_CONFIG,
  };
}

function buildHistogram(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const target = spec.data_query.x ?? spec.data_query.y;
  if (!target) return emptyFigure(spec, theme, "Pick a column to bin");
  const color = spec.style.color_override ?? theme.colorway[0];
  return {
    data: [
      {
        type: "histogram",
        x: rows.map((row) => row[target]),
        marker: { color, line: { color: "rgba(255,255,255,0.4)", width: 0.6 } },
        nbinsx: 30,
        showlegend: false,
      },
    ],
    layout: defaultLayout(theme, { ...spec.style, show_legend: false }),
    config: BASE_CONFIG,
  };
}

function buildBox(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const yKey = spec.data_query.y ?? spec.data_query.x;
  if (!yKey) return emptyFigure(spec, theme, "Pick a numeric column");
  const xKey = spec.data_query.x && spec.data_query.x !== yKey ? spec.data_query.x : null;
  return {
    data: [
      {
        type: "box",
        y: rows.map((row) => row[yKey]),
        x: xKey ? rows.map((row) => row[xKey]) : undefined,
        boxpoints: "outliers",
        marker: { color: spec.style.color_override ?? theme.colorway[0] },
        line: { color: theme.colorway[0] },
        showlegend: false,
      },
    ],
    layout: defaultLayout(theme, { ...spec.style, show_legend: false }),
    config: BASE_CONFIG,
  };
}

function buildPie(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const result = runDataQuery(rows, spec.data_query);
  const xKey = spec.data_query.x;
  const yKey = countValueKey(spec);
  if (!xKey) return emptyFigure(spec, theme, "Pick a category column");
  const labels = result.rows.map((row) => String(row[xKey] ?? ""));
  const values = result.rows.map((row) => Number(row[yKey] ?? 0));
  if (!labels.length || !values.some((value) => Number.isFinite(value) && value > 0)) {
    return emptyFigure(spec, theme, "No chartable values for this view");
  }
  return {
    data: [
      {
        type: "pie",
        labels,
        values,
        hole: 0.42,
        marker: { colors: theme.colorway.slice(0, Math.max(labels.length, 1)) },
        textinfo: "label+percent",
        textposition: "outside",
      },
    ],
    layout: { ...defaultLayout(theme, spec.style), showlegend: spec.style.show_legend ?? true },
    config: BASE_CONFIG,
  };
}

function buildTreemap(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const result = runDataQuery(rows, spec.data_query);
  const xKey = spec.data_query.x;
  const yKey = countValueKey(spec);
  if (!xKey) return emptyFigure(spec, theme, "Pick a category column");
  const labels = result.rows.map((row) => String(row[xKey] ?? ""));
  const values = result.rows.map((row) => Number(row[yKey] ?? 0));
  if (!labels.length || !values.some((value) => Number.isFinite(value) && value > 0)) {
    return emptyFigure(spec, theme, "No chartable values for this view");
  }
  return {
    data: [
      {
        type: "treemap",
        labels,
        values,
        parents: labels.map(() => ""),
        marker: { colors: theme.colorway.slice(0, Math.max(labels.length, 1)) },
        textinfo: "label+value",
      },
    ],
    layout: { ...defaultLayout(theme, spec.style), showlegend: false },
    config: BASE_CONFIG,
  };
}

function buildHeatmap(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const xKey = spec.data_query.x;
  const yKey = spec.data_query.y;
  // Two modes:
  //  a) explicit x,y,value pivot (group_by holds the value column)
  //  b) correlation heatmap across all numeric columns of the input rows.
  if (xKey && yKey && spec.data_query.group_by) {
    const valueKey = spec.data_query.group_by;
    const matrix = pivotForHeatmap(rows, xKey, yKey, valueKey);
    return {
      data: [
        {
          type: "heatmap",
          z: matrix.z,
          x: matrix.x,
          y: matrix.y,
          colorscale: "Blues",
        },
      ],
      layout: defaultLayout(theme, spec.style),
      config: BASE_CONFIG,
    };
  }

  // Correlation across numeric columns.
  const numericColumns = inferNumericColumns(rows);
  const matrix = correlationMatrix(rows, numericColumns);
  return {
    data: [
      {
        type: "heatmap",
        z: matrix,
        x: numericColumns,
        y: numericColumns,
        colorscale: "Blues",
        zmin: -1,
        zmax: 1,
        hovertemplate: "%{y} vs %{x}<br>r = %{z:.2f}<extra></extra>",
      },
    ],
    layout: defaultLayout(theme, spec.style),
    config: BASE_CONFIG,
  };
}

function buildKpi(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const result = runDataQuery(rows, {
    ...spec.data_query,
    aggregation: spec.data_query.aggregation && spec.data_query.aggregation !== "none"
      ? spec.data_query.aggregation
      : "sum",
    group_by: null,
    sort: "none",
    limit: null,
  });
  const yKey = spec.data_query.y ?? spec.data_query.x ?? "value";
  const value = result.rows.reduce((acc, row) => acc + Number(row[yKey] ?? 0), 0);
  const formatted = formatValue(value, spec.style.number_format ?? "auto");
  return {
    data: [
      {
        type: "indicator",
        mode: "number",
        value,
        number: {
          font: { color: theme.text, family: theme.font, size: 38 },
          valueformat: ",.0f",
          prefix: spec.style.number_format === "currency" ? "$" : undefined,
          suffix: spec.style.number_format === "percent" ? "%" : undefined,
        },
        // Display-only string (for fallback PNG export); real card UI overlays this.
        title: { text: spec.title || formatted, font: { size: 11, color: theme.muted } },
      },
    ],
    layout: { ...defaultLayout(theme, { showLegend: false, showGrid: false }), margin: { l: 24, r: 24, t: 24, b: 24 } },
    config: BASE_CONFIG,
  };
}

function buildTable(spec: ChartSpec, rows: Record<string, unknown>[], theme: RenderTheme): PlotlyFigure {
  const result = runDataQuery(rows, spec.data_query);
  const sample = result.rows[0] ?? rows[0] ?? {};
  const columns = Object.keys(sample).slice(0, 12);
  return {
    data: [
      {
        type: "table",
        header: {
          values: columns.map((column) => `<b>${column}</b>`),
          fill: { color: "rgba(39, 94, 254, 0.08)" },
          align: "left",
          font: { color: theme.text, family: theme.font, size: 12 },
        },
        cells: {
          values: columns.map((column) => result.rows.map((row) => row[column])),
          align: "left",
          fill: { color: "white" },
          font: { color: theme.text, family: theme.font, size: 11 },
          height: 26,
        },
      },
    ],
    layout: { ...defaultLayout(theme, { showLegend: false, showGrid: false }), margin: { l: 0, r: 0, t: 0, b: 0 } },
    config: BASE_CONFIG,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyEncoding(figure: PlotlyFigure, spec: ChartSpec, theme: RenderTheme): void {
  const layout = figure.layout as Record<string, Record<string, unknown> | unknown>;
  const xLabel = spec.encoding.x_label ?? spec.data_query.x ?? "";
  const yLabel = spec.encoding.y_label ?? countAxisLabel(spec);
  if (layout.xaxis && typeof layout.xaxis === "object") {
    (layout.xaxis as Record<string, unknown>).title = {
      text: xLabel,
      font: { size: 11, color: theme.muted },
    };
  }
  if (layout.yaxis && typeof layout.yaxis === "object") {
    (layout.yaxis as Record<string, unknown>).title = {
      text: yLabel,
      font: { size: 11, color: theme.muted },
    };
  }
  if (spec.style.height && spec.style.height > 0) {
    layout.height = spec.style.height;
  }
}

function countValueKey(spec: ChartSpec): string {
  return spec.data_query.aggregation === "count" && !spec.data_query.y ? COUNT_FIELD : spec.data_query.y ?? "y";
}

function countAxisLabel(spec: ChartSpec): string {
  if (spec.data_query.aggregation === "count" && !spec.data_query.y) return "Count";
  return spec.data_query.y ?? "";
}

function hasRenderablePairs(rows: Record<string, unknown>[], xKey: string, yKey: string): boolean {
  return rows.some((row) => row[xKey] != null && Number.isFinite(Number(row[yKey])));
}

function splitByGroup(
  rows: Record<string, unknown>[],
  groupKey: string,
): Array<{ key: unknown; rows: Record<string, unknown>[] }> {
  const buckets = new Map<string, { key: unknown; rows: Record<string, unknown>[] }>();
  for (const row of rows) {
    const key = row[groupKey];
    const id = key == null ? "__null__" : String(key);
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { key, rows: [] };
      buckets.set(id, bucket);
    }
    bucket.rows.push(row);
  }
  return Array.from(buckets.values());
}

function emptyFigure(spec: ChartSpec, theme: RenderTheme, message: string): PlotlyFigure {
  return {
    data: [],
    layout: {
      ...defaultLayout(theme, spec.style),
      annotations: [
        {
          text: message,
          xref: "paper",
          yref: "paper",
          x: 0.5,
          y: 0.5,
          showarrow: false,
          font: { color: theme.muted, size: 13 },
        },
      ],
    },
    config: BASE_CONFIG,
  };
}

function pivotForHeatmap(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  valueKey: string,
): { x: unknown[]; y: unknown[]; z: number[][] } {
  const xValues = uniqueValues(rows, xKey);
  const yValues = uniqueValues(rows, yKey);
  const z: number[][] = yValues.map(() => xValues.map(() => 0));
  const xIndex = new Map(xValues.map((v, i) => [String(v), i]));
  const yIndex = new Map(yValues.map((v, i) => [String(v), i]));
  for (const row of rows) {
    const xi = xIndex.get(String(row[xKey]));
    const yi = yIndex.get(String(row[yKey]));
    if (xi == null || yi == null) continue;
    z[yi][xi] = Number(row[valueKey] ?? 0);
  }
  return { x: xValues, y: yValues, z };
}

function uniqueValues(rows: Record<string, unknown>[], key: string): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const row of rows) {
    const value = row[key];
    const id = value == null ? "__null__" : String(value);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(value);
  }
  return out;
}

function inferNumericColumns(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];
  const sample = rows[0];
  return Object.keys(sample).filter((column) => {
    let numeric = 0;
    for (let i = 0; i < Math.min(rows.length, 50); i += 1) {
      const value = rows[i][column];
      if (typeof value === "number" && Number.isFinite(value)) numeric += 1;
    }
    return numeric >= Math.min(rows.length, 50) * 0.6;
  });
}

function correlationMatrix(rows: Record<string, unknown>[], columns: string[]): number[][] {
  if (!columns.length) return [];
  const series = columns.map((column) =>
    rows.map((row) => Number(row[column])).filter((value) => Number.isFinite(value)),
  );
  const matrix: number[][] = columns.map(() => columns.map(() => 0));
  for (let i = 0; i < columns.length; i += 1) {
    for (let j = 0; j < columns.length; j += 1) {
      matrix[i][j] = i === j ? 1 : pearson(series[i], series[j]);
    }
  }
  return matrix;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

function escapeLabel(value: string): string {
  return value.replace(/[<>&]/g, "");
}

function getString(trace: Record<string, unknown>, path: string): string | null {
  const parts = path.split(".");
  let current: unknown = trace;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === "string" ? current : null;
}

function addAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? color
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")
      : color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function formatValue(value: number, format: NumberFormat): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    case "percent":
      return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
    case "compact":
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
    case "number":
      return new Intl.NumberFormat("en-US").format(value);
    case "auto":
    default:
      if (Math.abs(value) >= 1_000_000) {
        return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
      }
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
}

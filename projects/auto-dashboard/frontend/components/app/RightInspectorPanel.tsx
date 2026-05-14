"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type {
  ChartSpec,
  DataQueryAggregation,
  DataQuerySort,
  DatasetProfile,
  NumberFormat,
  SupportedChartType,
} from "@/types/api";

const CHART_TYPES: SupportedChartType[] = [
  "kpi",
  "bar",
  "stacked_bar",
  "line",
  "area",
  "scatter",
  "histogram",
  "box",
  "pie",
  "treemap",
  "table",
  "heatmap",
  "correlation_heatmap",
];

const AGGREGATIONS: DataQueryAggregation[] = [
  "none",
  "sum",
  "avg",
  "mean",
  "median",
  "min",
  "max",
  "count",
  "unique_count",
];

const NUMBER_FORMATS: NumberFormat[] = ["auto", "number", "currency", "percent", "compact"];

const SORTS: DataQuerySort[] = ["none", "asc", "desc"];

interface RightInspectorPanelProps {
  spec: ChartSpec;
  profile?: DatasetProfile;
  isSaving: boolean;
  onClose: () => void;
  onChange: (next: ChartSpec) => void;
  onCommit: (next: ChartSpec) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

/**
 * Live editor for one ChartSpec. Every change calls `onChange` (instant local
 * update for re-rendering) and `onCommit` (debounced PUT to the backend).
 */
export function RightInspectorPanel({
  spec,
  profile,
  isSaving,
  onClose,
  onChange,
  onCommit,
  onDelete,
  onDuplicate,
}: RightInspectorPanelProps) {
  const columns = profile?.column_names ?? [];
  const numericColumns = profile?.numeric_columns ?? [];
  const datetimeColumns = profile?.datetime_columns ?? [];
  const categoricalColumns = profile?.categorical_columns ?? [];

  const semanticHints = useMemo(() => {
    if (!profile) return new Map<string, string>();
    return new Map(
      profile.columns.map((column) => [
        column.name,
        column.business_meaning ?? column.semantic_type ?? column.role ?? "",
      ]),
    );
  }, [profile]);

  function update<K extends keyof ChartSpec>(key: K, value: ChartSpec[K]) {
    const next = { ...spec, [key]: value };
    onChange(next);
    onCommit(next);
  }

  function updateQuery<K extends keyof ChartSpec["data_query"]>(key: K, value: ChartSpec["data_query"][K]) {
    const next = { ...spec, data_query: { ...spec.data_query, [key]: value } };
    onChange(next);
    onCommit(next);
  }

  function updateEncoding<K extends keyof ChartSpec["encoding"]>(key: K, value: ChartSpec["encoding"][K]) {
    const next = { ...spec, encoding: { ...spec.encoding, [key]: value } };
    onChange(next);
    onCommit(next);
  }

  function updateStyle<K extends keyof ChartSpec["style"]>(key: K, value: ChartSpec["style"][K]) {
    const next = { ...spec, style: { ...spec.style, [key]: value } };
    onChange(next);
    onCommit(next);
  }

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border border-[#dde4ef] bg-white shadow-lg">
      <header className="flex items-center justify-between border-b border-[#dde4ef] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]">Chart inspector</div>
          <div className="truncate text-sm font-semibold text-[#141414]">{spec.title}</div>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4 text-sm text-[#141414]">
        <Section label="Title">
          <Input onChange={(event) => update("title", event.target.value)} value={spec.title} />
        </Section>

        <Section label="Chart type">
          <Select
            onChange={(value) => update("chart_type", value as SupportedChartType)}
            options={CHART_TYPES.map((type) => ({ value: type, label: type.replace("_", " ") }))}
            value={spec.chart_type}
          />
        </Section>

        <Separator />

        <Section label="X column">
          <ColumnSelect
            columns={preferColumns(columns, [
              ...datetimeColumns,
              ...categoricalColumns,
              ...numericColumns,
            ])}
            hints={semanticHints}
            onChange={(value) => updateQuery("x", value || null)}
            value={spec.data_query.x ?? ""}
          />
        </Section>

        <Section label="Y column">
          <ColumnSelect
            columns={preferColumns(columns, [...numericColumns, ...categoricalColumns])}
            hints={semanticHints}
            onChange={(value) => updateQuery("y", value || null)}
            value={spec.data_query.y ?? ""}
          />
        </Section>

        <Section label="Group / color column">
          <ColumnSelect
            allowEmptyLabel="(none)"
            columns={preferColumns(columns, categoricalColumns)}
            hints={semanticHints}
            onChange={(value) => {
              updateQuery("group_by", value || null);
              updateEncoding("color_by", value || null);
            }}
            value={spec.data_query.group_by ?? ""}
          />
        </Section>

        <Section label="Aggregation">
          <Select
            onChange={(value) =>
              updateQuery("aggregation", (value === "none" ? "none" : (value as DataQueryAggregation)))
            }
            options={AGGREGATIONS.map((option) => ({ value: option, label: option }))}
            value={spec.data_query.aggregation ?? "none"}
          />
        </Section>

        <Section label="Sort">
          <Select
            onChange={(value) => updateQuery("sort", value as DataQuerySort)}
            options={SORTS.map((option) => ({ value: option, label: option }))}
            value={spec.data_query.sort ?? "none"}
          />
        </Section>

        <Section label="Limit (rows)">
          <Input
            inputMode="numeric"
            onChange={(event) => {
              const trimmed = event.target.value.trim();
              const limit = trimmed ? Math.max(1, Math.floor(Number(trimmed))) : null;
              updateQuery("limit", Number.isFinite(limit) ? limit : null);
            }}
            placeholder="No limit"
            value={spec.data_query.limit != null ? String(spec.data_query.limit) : ""}
          />
        </Section>

        <Separator />

        <Section label="X label">
          <Input
            onChange={(event) => updateEncoding("x_label", event.target.value || null)}
            placeholder={spec.data_query.x ?? ""}
            value={spec.encoding.x_label ?? ""}
          />
        </Section>
        <Section label="Y label">
          <Input
            onChange={(event) => updateEncoding("y_label", event.target.value || null)}
            placeholder={spec.data_query.y ?? ""}
            value={spec.encoding.y_label ?? ""}
          />
        </Section>

        <Separator />

        <Section label="Number format">
          <Select
            onChange={(value) => updateStyle("number_format", value as NumberFormat)}
            options={NUMBER_FORMATS.map((option) => ({ value: option, label: option }))}
            value={spec.style.number_format ?? "auto"}
          />
        </Section>

        <Section label="Color override">
          <div className="flex items-center gap-2">
            <input
              className="h-9 w-12 cursor-pointer rounded-md border border-[#dde4ef]"
              onChange={(event) => updateStyle("color_override", event.target.value || null)}
              type="color"
              value={spec.style.color_override ?? "#275efe"}
            />
            <Input
              onChange={(event) => updateStyle("color_override", event.target.value || null)}
              placeholder="#275efe"
              value={spec.style.color_override ?? ""}
            />
            {spec.style.color_override ? (
              <Button onClick={() => updateStyle("color_override", null)} size="sm" variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-2">
          <Toggle
            label="Show legend"
            checked={spec.style.show_legend ?? true}
            onChange={(checked) => updateStyle("show_legend", checked)}
          />
          <Toggle
            label="Show grid"
            checked={spec.style.show_grid ?? true}
            onChange={(checked) => updateStyle("show_grid", checked)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          {onDuplicate ? (
            <Button onClick={onDuplicate} size="sm" variant="outline">
              Duplicate
            </Button>
          ) : null}
          {onDelete ? (
            <Button onClick={onDelete} size="sm" variant="destructive">
              Delete
            </Button>
          ) : null}
        </div>

        <div className="text-[10px] uppercase tracking-[0.16em] text-[#a0a8b8]">
          {isSaving ? "Saving..." : "All changes saved"}
        </div>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ColumnSelect({
  value,
  onChange,
  columns,
  hints,
  allowEmptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  columns: string[];
  hints: Map<string, string>;
  allowEmptyLabel?: string;
}) {
  return (
    <select
      className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">{allowEmptyLabel ?? ""}</option>
      {columns.map((name) => {
        const hint = hints.get(name);
        return (
          <option key={name} value={name}>
            {hint ? `${name} - ${hint}` : name}
          </option>
        );
      })}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-[#dde4ef] px-2.5 py-2 text-xs">
      <span className="text-[#141414]">{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 cursor-pointer"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

/** Push the user-provided "preferred" list to the front of the column list, dedup. */
function preferColumns(all: string[], preferred: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const column of preferred) {
    if (all.includes(column) && !seen.has(column)) {
      out.push(column);
      seen.add(column);
    }
  }
  for (const column of all) {
    if (!seen.has(column)) {
      out.push(column);
      seen.add(column);
    }
  }
  return out;
}

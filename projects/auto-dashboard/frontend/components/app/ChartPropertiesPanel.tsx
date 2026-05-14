"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ChartResponse, ChartUpdateRequest, DatasetProfile, SupportedChartType } from "@/types/api";

const CHART_TYPES: SupportedChartType[] = [
  "bar",
  "line",
  "scatter",
  "histogram",
  "box",
  "pie",
  "correlation_heatmap",
];

const AGGREGATIONS = ["", "sum", "mean", "median", "min", "max", "count"];

interface ChartPropertiesPanelProps {
  chart: ChartResponse;
  profile?: DatasetProfile;
  isSaving: boolean;
  onClose: () => void;
  onSave: (updates: ChartUpdateRequest) => void;
}

export function ChartPropertiesPanel({ chart, profile, isSaving, onClose, onSave }: ChartPropertiesPanelProps) {
  const [title, setTitle] = useState(chart.title);
  const [chartType, setChartType] = useState<SupportedChartType>(chart.chart_type);
  const [xColumn, setXColumn] = useState<string>("");
  const [yColumn, setYColumn] = useState<string>("");
  const [colorColumn, setColorColumn] = useState<string>("");
  const [aggregation, setAggregation] = useState<string>("");
  const [colorOverride, setColorOverride] = useState<string>("");

  const columns = profile?.column_names ?? [];

  function handleSave() {
    const updates: ChartUpdateRequest = {};
    if (title !== chart.title) updates.title = title;
    if (chartType !== chart.chart_type) updates.chart_type = chartType;
    if (xColumn) updates.x_column = xColumn;
    if (yColumn) updates.y_column = yColumn;
    if (colorColumn) updates.color_column = colorColumn;
    if (aggregation) updates.aggregation = aggregation;
    if (colorOverride) updates.color_override = colorOverride;
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    onSave(updates);
  }

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border border-[#dde4ef] bg-white shadow-lg">
      <header className="flex items-center justify-between border-b border-[#dde4ef] px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-[#667085]">Chart</div>
          <div className="truncate text-sm font-semibold text-[#141414]">{chart.title}</div>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4 text-sm text-[#141414]">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">Title</label>
          <Input onChange={(event) => setTitle(event.target.value)} value={title} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">Chart type</label>
          <select
            className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
            onChange={(event) => setChartType(event.target.value as SupportedChartType)}
            value={chartType}
          >
            {CHART_TYPES.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">X column</label>
          <select
            className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
            onChange={(event) => setXColumn(event.target.value)}
            value={xColumn}
          >
            <option value="">(keep current)</option>
            {columns.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">Y column</label>
          <select
            className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
            onChange={(event) => setYColumn(event.target.value)}
            value={yColumn}
          >
            <option value="">(keep current)</option>
            {columns.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">Color / group column</label>
          <select
            className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
            onChange={(event) => setColorColumn(event.target.value)}
            value={colorColumn}
          >
            <option value="">(keep current)</option>
            {columns.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">Aggregation</label>
          <select
            className="h-9 rounded-md border border-[#dde4ef] bg-white px-2 text-sm"
            onChange={(event) => setAggregation(event.target.value)}
            value={aggregation}
          >
            {AGGREGATIONS.map((option) => (
              <option key={option || "none"} value={option}>
                {option || "(keep current)"}
              </option>
            ))}
          </select>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#667085]">Override color</label>
          <div className="flex items-center gap-2">
            <input
              className="h-9 w-12 cursor-pointer rounded-md border border-[#dde4ef]"
              onChange={(event) => setColorOverride(event.target.value)}
              type="color"
              value={colorOverride || "#275efe"}
            />
            <Input
              onChange={(event) => setColorOverride(event.target.value)}
              placeholder="#275efe"
              value={colorOverride}
            />
            {colorOverride ? (
              <Button onClick={() => setColorOverride("")} size="sm" variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-[#667085]">Tints the primary series of this chart only.</p>
        </div>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-[#dde4ef] px-4 py-3">
        <Button disabled={isSaving} onClick={onClose} size="sm" variant="outline">
          Cancel
        </Button>
        <Button disabled={isSaving} onClick={handleSave} size="sm">
          {isSaving ? "Applying..." : "Apply"}
        </Button>
      </footer>
    </aside>
  );
}

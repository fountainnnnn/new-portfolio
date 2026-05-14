"use client";

import { LoaderCircle, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardFilterControl, DashboardFilterRequest } from "@/types/api";
import type { DashboardTheme } from "@/lib/dashboard-themes";

interface DashboardControlsProps {
  controls: DashboardFilterControl[];
  filters: DashboardFilterRequest;
  isFiltering: boolean;
  onChange: (filters: DashboardFilterRequest) => void;
  onReset: () => void;
  theme?: DashboardTheme;
  variant?: "default" | "canvas" | "header";
}

export function DashboardControls({ controls, filters, isFiltering, onChange, onReset, theme, variant = "default" }: DashboardControlsProps) {
  if (!controls.length) {
    return null;
  }

  const hasActiveFilters =
    Object.values(filters.categorical_filters).some(Boolean) ||
    Object.values(filters.date_filters).some((dateFilter) => Boolean(dateFilter.start || dateFilter.end));

  function updateCategory(column: string, value: string) {
    onChange({
      ...filters,
      categorical_filters: {
        ...filters.categorical_filters,
        [column]: value,
      },
    });
  }

  function updateDate(column: string, field: "start" | "end", value: string) {
    onChange({
      ...filters,
      date_filters: {
        ...filters.date_filters,
        [column]: {
          ...(filters.date_filters[column] ?? {}),
          [field]: value || null,
        },
      },
    });
  }

  if (variant === "header") {
    return (
      <div className="flex h-full min-w-0 items-center justify-end gap-2 overflow-hidden">
        {controls.slice(0, 2).map((control) =>
          control.control_type === "category" ? (
            <label className="flex min-w-[180px] max-w-[240px] items-center gap-2 text-xs" key={control.control_id}>
              <span className="max-w-[82px] truncate font-medium" style={theme ? { color: theme.muted } : undefined}>
                {control.label}
              </span>
              <select
                className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-xs outline-none"
                disabled={isFiltering}
                onChange={(event) => updateCategory(control.column, event.target.value)}
                style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                value={filters.categorical_filters[control.column] ?? ""}
              >
                <option value="">All</option>
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex min-w-[180px] max-w-[240px] items-center gap-2 text-xs" key={control.control_id}>
              <span className="max-w-[82px] truncate font-medium" style={theme ? { color: theme.muted } : undefined}>
                {control.label}
              </span>
              <input
                className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-xs outline-none"
                disabled={isFiltering}
                max={control.max_value ?? undefined}
                min={control.min_value ?? undefined}
                onChange={(event) => updateDate(control.column, "start", event.target.value)}
                style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                type="date"
                value={filters.date_filters[control.column]?.start ?? ""}
              />
            </label>
          ),
        )}
        <Button disabled={!hasActiveFilters || isFiltering} onClick={onReset} size="xs" variant="outline">
          Reset
        </Button>
      </div>
    );
  }

  if (variant === "canvas") {
    return (
      <section className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden rounded-xl border p-3" style={theme ? { background: theme.panel, borderColor: theme.border, boxShadow: theme.shadow, color: theme.text } : undefined}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">Slicers</h2>
            <p className="text-[11px]" style={theme ? { color: theme.muted } : undefined}>CSV row filters</p>
          </div>
          <Button disabled={!hasActiveFilters || isFiltering} onClick={onReset} size="xs" variant="outline">
            Reset
          </Button>
        </div>
        <div className="grid min-h-0 w-full flex-1 grid-cols-2 gap-2 overflow-hidden">
          {controls.slice(0, 4).map((control) =>
            control.control_type === "category" ? (
              <label className="flex min-h-0 min-w-0 flex-col gap-1 text-xs" key={control.control_id}>
                <span className="truncate font-medium">{control.label}</span>
                <select
                  className="h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none"
                  disabled={isFiltering}
                  onChange={(event) => updateCategory(control.column, event.target.value)}
                  style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                  value={filters.categorical_filters[control.column] ?? ""}
                >
                  <option value="">All</option>
                  {control.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-col gap-1 text-xs" key={control.control_id}>
                <span className="truncate font-medium">{control.label}</span>
                <input
                  className="h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none"
                  disabled={isFiltering}
                  max={control.max_value ?? undefined}
                  min={control.min_value ?? undefined}
                  onChange={(event) => updateDate(control.column, "start", event.target.value)}
                  style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                  type="date"
                  value={filters.date_filters[control.column]?.start ?? ""}
                />
              </div>
            ),
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={theme ? { background: theme.panel, borderColor: theme.border, boxShadow: theme.shadow, color: theme.text } : undefined}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={theme ? { background: theme.accentSoft, color: theme.accent } : undefined}
          >
            <SlidersHorizontal className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Pick what to show</h2>
            <p className="mt-1 text-sm leading-6" style={theme ? { color: theme.muted } : undefined}>
              Filter the actual dashboard from the uploaded CSV. KPIs and Plotly charts refresh from the matching rows.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFiltering ? (
            <span className="flex items-center gap-2 text-xs" style={theme ? { color: theme.muted } : undefined}>
              <LoaderCircle className="size-3.5 animate-spin" />
              Updating
            </span>
          ) : null}
          <Button disabled={!hasActiveFilters || isFiltering} onClick={onReset} size="sm" variant="outline">
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {controls.map((control) =>
          control.control_type === "category" ? (
            <label className="flex flex-col gap-2 text-sm" key={control.control_id}>
              <span className="font-medium">{control.label}</span>
              <select
                className="h-10 rounded-md border bg-transparent px-3 text-sm outline-none transition focus:ring-2"
                disabled={isFiltering}
                onChange={(event) => updateCategory(control.column, event.target.value)}
                style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                value={filters.categorical_filters[control.column] ?? ""}
              >
                <option value="">All {control.label}</option>
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}{option.count ? ` (${option.count.toLocaleString()})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex flex-col gap-2 text-sm" key={control.control_id}>
              <span className="font-medium">{control.label}</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-md border bg-transparent px-3 text-sm outline-none transition focus:ring-2"
                  disabled={isFiltering}
                  max={control.max_value ?? undefined}
                  min={control.min_value ?? undefined}
                  onChange={(event) => updateDate(control.column, "start", event.target.value)}
                  style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                  type="date"
                  value={filters.date_filters[control.column]?.start ?? ""}
                />
                <input
                  className="h-10 rounded-md border bg-transparent px-3 text-sm outline-none transition focus:ring-2"
                  disabled={isFiltering}
                  max={control.max_value ?? undefined}
                  min={control.min_value ?? undefined}
                  onChange={(event) => updateDate(control.column, "end", event.target.value)}
                  style={theme ? { borderColor: theme.border, color: theme.text } : undefined}
                  type="date"
                  value={filters.date_filters[control.column]?.end ?? ""}
                />
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

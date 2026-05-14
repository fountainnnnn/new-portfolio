"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BarChart3,
  BarChartHorizontal,
  Box,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Hash,
  LayoutGrid,
  Lightbulb,
  LineChart,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  Redo2,
  Save,
  ScatterChart,
  Sparkles,
  Table,
  Trash2,
  TrendingUp,
  Undo2,
} from "lucide-react";
import GridLayout, { type Layout } from "react-grid-layout";

import { ChartCard } from "@/components/app/ChartCard";
import { DashboardControls } from "@/components/app/DashboardControls";
import { ExportPanel } from "@/components/app/ExportPanel";
import { KpiCard } from "@/components/app/KpiCard";
import { RightInspectorPanel } from "@/components/app/RightInspectorPanel";
import { SpecChart } from "@/components/app/SpecChart";
import type { DashboardViewSettings } from "@/components/app/ThemeInspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardTheme } from "@/lib/dashboard-themes";
import {
  aiPatchDashboard,
  getDatasetRows,
  updateChartSpec,
  updateDashboardLayout,
  updateDashboardSpec,
} from "@/lib/api";
import type {
  ChartResponse,
  ChartSpec,
  DashboardFilterControl,
  DashboardFilterRequest,
  DashboardLayout as DashboardLayoutModel,
  DashboardResponse,
  DashboardSpec,
  DataQueryAggregation,
  DatasetProfile,
  KpiCardResponse,
  LayoutItem,
  ThemeConfig,
} from "@/types/api";

// Fixed 16:9 dashboard canvas. 12 columns wide x 12 rows tall = 1280 x 720.
const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 720;
const COLS = 12;
const ROW_HEIGHT = 47;
const ROWS_PER_PAGE = 12;
const TITLE_ROWS = 2;
const MARGIN: [number, number] = [10, 10];
const CONTAINER_PADDING: [number, number] = [20, 20];
const FIRST_PAGE_CHART_LIMIT = 4;
const DETAIL_PAGE_CHART_LIMIT = 4;

const defaultSettings: DashboardViewSettings = {
  showInsights: true,
  showExplanations: true,
  compactCharts: false,
};

const emptyFilters: DashboardFilterRequest = { categorical_filters: {}, date_filters: {} };

function applyDashboardFiltersToRows(
  rows: Record<string, unknown>[],
  filters: DashboardFilterRequest,
): Record<string, unknown>[] {
  let filtered = rows;
  for (const [column, value] of Object.entries(filters.categorical_filters ?? {})) {
    if (!value) continue;
    filtered = filtered.filter((row) => String(row[column] ?? "") === String(value));
  }
  for (const [column, range] of Object.entries(filters.date_filters ?? {})) {
    const start = range.start ? Date.parse(range.start) : null;
    const end = range.end ? Date.parse(range.end) : null;
    if (start == null && end == null) continue;
    filtered = filtered.filter((row) => {
      const raw = row[column];
      if (raw == null) return false;
      const timestamp = Date.parse(String(raw));
      if (Number.isNaN(timestamp)) return false;
      if (start != null && timestamp < start) return false;
      if (end != null && timestamp > end) return false;
      return true;
    });
  }
  return filtered;
}

// Power BI-style catalog of chart types available in the "+ Add chart" picker.
// Each entry gives the SpecChart-compatible chart_type, a label, a lucide icon,
// and a default (w,h) sizing that looks reasonable on a 12-col x 8-row page.
type AddableChartType =
  | "bar"
  | "stacked_bar"
  | "line"
  | "area"
  | "scatter"
  | "histogram"
  | "box"
  | "pie"
  | "treemap"
  | "heatmap"
  | "kpi"
  | "table";

const CHART_CATALOG: {
  type: AddableChartType;
  label: string;
  Icon: typeof BarChart3;
  intent: string;
  w: number;
  h: number;
}[] = [
  { type: "bar", label: "Bar", Icon: BarChart3, intent: "comparison", w: 6, h: 4 },
  { type: "stacked_bar", label: "Stacked bar", Icon: BarChartHorizontal, intent: "composition", w: 6, h: 4 },
  { type: "line", label: "Line", Icon: LineChart, intent: "trend", w: 8, h: 4 },
  { type: "area", label: "Area", Icon: Activity, intent: "trend", w: 8, h: 4 },
  { type: "scatter", label: "Scatter", Icon: ScatterChart, intent: "relationship", w: 8, h: 5 },
  { type: "histogram", label: "Histogram", Icon: TrendingUp, intent: "distribution", w: 6, h: 4 },
  { type: "box", label: "Box plot", Icon: Box, intent: "distribution", w: 6, h: 4 },
  { type: "pie", label: "Pie", Icon: PieChart, intent: "composition", w: 4, h: 4 },
  { type: "treemap", label: "Treemap", Icon: LayoutGrid, intent: "composition", w: 6, h: 4 },
  { type: "heatmap", label: "Heatmap", Icon: Grid3x3, intent: "relationship", w: 6, h: 4 },
  { type: "kpi", label: "KPI card", Icon: Hash, intent: "metric", w: 3, h: 2 },
  { type: "table", label: "Table", Icon: Table, intent: "detail", w: 6, h: 4 },
];

interface DashboardRendererProps {
  dashboard: DashboardResponse;
  datasetProfile?: DatasetProfile;
  settings?: DashboardViewSettings;
  theme?: DashboardTheme;
  isFiltering?: boolean;
  onFilterChange?: (filters: DashboardFilterRequest) => void;
  onFilterReset?: () => void;
  onDashboardChange?: (dashboard: DashboardResponse) => void;
  preservePageOnDashboardChange?: boolean;
}

export function DashboardRenderer({
  dashboard,
  datasetProfile,
  settings = defaultSettings,
  theme,
  isFiltering = false,
  onFilterChange,
  onFilterReset,
  onDashboardChange,
  preservePageOnDashboardChange = false,
}: DashboardRendererProps) {
  const [editMode, setEditMode] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [isSavingChart, setIsSavingChart] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiPatchNotice, setAiPatchNotice] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [localDashboard, setLocalDashboard] = useState<DashboardResponse>(dashboard);
  const [dashboardPropRef, setDashboardPropRef] = useState<DashboardResponse>(dashboard);
  // Undo/redo: snapshot stacks of previous DashboardSpec states.
  const [undoStack, setUndoStack] = useState<DashboardSpec[]>([]);
  const [redoStack, setRedoStack] = useState<DashboardSpec[]>([]);
  // Portal target lives in DashboardStudio's right column (#autodash-inspector-slot).
  // Resolving it in an effect avoids "document is not defined" during SSR.
  const [inspectorSlotEl, setInspectorSlotEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    // SSR-safe DOM lookup after mount. Intentionally a setState inside an effect -
    // the portal target only exists once the DashboardStudio shell has rendered,
    // so we cannot resolve it during render and there's no external subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInspectorSlotEl(document.getElementById("autodash-inspector-slot"));
  }, []);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowsDatasetId, setRowsDatasetId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiBusy, setIsAiBusy] = useState(false);
  // Tracks whether the Power BI-style chart-type picker is open.
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  if (dashboardPropRef !== dashboard) {
    // Parent supplied a new dashboard object; reset local overrides to follow it.
    const dashboardChanged = dashboardPropRef.dashboard_id !== dashboard.dashboard_id;
    const datasetChanged = dashboardPropRef.dataset_id !== dashboard.dataset_id;
    setDashboardPropRef(dashboard);
    setLocalDashboard(dashboard);
    if (dashboardChanged && datasetChanged && !preservePageOnDashboardChange) {
      setActivePage(0);
      setUndoStack([]);
      setRedoStack([]);
    }
  }
  // Reset rows in render when the dataset changes, so we never trigger a setState in useEffect.
  if (rowsDatasetId !== dashboard.dataset_id) {
    setRowsDatasetId(dashboard.dataset_id);
    setRows(null);
  }

  const activeDashboard = localDashboard;
  const filteredRows = useMemo(
    () => (rows ? applyDashboardFiltersToRows(rows, activeDashboard.active_filters ?? emptyFilters) : rows),
    [rows, activeDashboard.active_filters],
  );

  const applyUpdate = useCallback(
    (updated: DashboardResponse) => {
      setLocalDashboard(updated);
      onDashboardChange?.(updated);
    },
    [onDashboardChange],
  );

  // Stable DOM ids per chart, used by ExportPanel to call Plotly.toImage.
  const chartDomIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const chart of activeDashboard.charts) {
      map[chart.chart_id] = `autodash-chart-${chart.chart_id}`;
    }
    return map;
  }, [activeDashboard.charts]);

  // Fetch dataset rows once per dataset so the spec-driven renderer can run queries client-side.
  useEffect(() => {
    let cancelled = false;
    const datasetId = activeDashboard.dataset_id;
    if (!datasetId) return;
    getDatasetRows(datasetId, 5000)
      .then((response) => {
        if (!cancelled) setRows(response.rows ?? []);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setErrorMessage(`Could not fetch dataset rows: ${error.message}`);
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeDashboard.dataset_id]);


  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const el = canvasViewportRef.current;
    if (!el) return;
    const update = (width: number, height: number) => {
      const fit = Math.min(width / PAGE_WIDTH, height / PAGE_HEIGHT);
      const next = Math.max(0.35, Math.min(1.25, fit));
      setCanvasScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };
    const rect = el.getBoundingClientRect();
    update(rect.width, rect.height);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);


  // ---------- Keyboard shortcuts ------------------------------------------------
  // Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo, Delete = delete selected chart,
  // Escape = deselect chart / close add-chart popover. All only fire while the
  // component is mounted; they don't interfere with text inputs because we check
  // the event target.
  useEffect(() => {
    function isTextInput(el: EventTarget | null): boolean {
      if (!el || !(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    }
    function handler(e: KeyboardEvent) {
      if (isTextInput(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z" && !e.shiftKey) { e.preventDefault(); void performUndo(); return; }
      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); void performRedo(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedChartId && editMode) { e.preventDefault(); handleChartDelete(selectedChartId); return; }
      if (e.key === "Escape") { setSelectedChartId(null); setShowAddMenu(false); return; }
      // Page navigation with arrow keys
      if (e.key === "ArrowLeft") { setActivePage((p) => Math.max(0, p - 1)); return; }
      if (e.key === "ArrowRight") { setActivePage((p) => Math.min(pageCount - 1, p + 1)); return; }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // intentionally no deps - always uses latest closure values

  // ---------- Error auto-dismiss ------------------------------------------------
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const chartsById = useMemo(
    () => new Map(activeDashboard.charts.map((chart) => [chart.chart_id, chart])),
    [activeDashboard.charts],
  );
  const kpisById = useMemo(
    () => new Map(activeDashboard.kpis.map((kpi) => [kpi.kpi_id, kpi])),
    [activeDashboard.kpis],
  );
  const selectedChart = selectedChartId ? chartsById.get(selectedChartId) ?? null : null;

  const controlCount = activeDashboard.controls?.length ?? 0;
  const layoutItems = useMemo(
    () => {
      const completed = completeLayout(
        activeDashboard.layout,
        activeDashboard.charts,
        activeDashboard.kpis,
        settings.showInsights,
        controlCount,
      );
      if (!layoutPassesQualityGate(completed, activeDashboard.charts, activeDashboard.kpis, settings.showInsights)) {
        return completeLayout(undefined, activeDashboard.charts, activeDashboard.kpis, settings.showInsights, controlCount);
      }
      return completed;
    },
    [activeDashboard.layout, activeDashboard.charts, activeDashboard.kpis, settings.showInsights, controlCount],
  );

  // Group items by page (page = floor(y / rowsPerPage)). The user only ever sees one
  // page at a time; the others are kept in state and surfaced through the page strip.
  const pageBuckets = useMemo(() => {
    const buckets = new Map<number, LayoutItem[]>();
    for (const item of layoutItems) {
      const page = Math.floor(item.y / ROWS_PER_PAGE);
      let bucket = buckets.get(page);
      if (!bucket) {
        bucket = [];
        buckets.set(page, bucket);
      }
      bucket.push(item);
    }
    return buckets;
  }, [layoutItems]);

  const pageCount = useMemo(() => {
    const lastItemPage = layoutItems.reduce(
      (acc, item) => Math.max(acc, Math.floor((item.y + item.h - 1) / ROWS_PER_PAGE)),
      -1,
    );
    return Math.max(1, lastItemPage + 1);
  }, [layoutItems]);

  // Clamp activePage if pages disappear (e.g. user deletes a chart that was the only
  // occupant of its page).
  const clampedActivePage = Math.min(activePage, pageCount - 1);
  if (clampedActivePage !== activePage) {
    setActivePage(clampedActivePage);
  }

  // The visible-page subset of the layout, with y remapped to within-page coordinates
  // so RGL can size the grid as a single 8-row page.
  const visibleLayoutItems = useMemo(() => {
    const items = pageBuckets.get(clampedActivePage) ?? [];
    return items.map((item) => ({
      ...item,
      y: item.y - clampedActivePage * ROWS_PER_PAGE,
    }));
  }, [pageBuckets, clampedActivePage]);

  const rglLayout: Layout[] = useMemo(
    () =>
      visibleLayoutItems.map((item) => ({
        i: item.item_id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: 2,
        minH: item.kind === "title" ? 1 : 2,
        maxH: ROWS_PER_PAGE,
      })),
    [visibleLayoutItems],
  );

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic counter used to mint unique chart ids for duplicates without calling
  // Date.now() / crypto.randomUUID() during render (lint blocks impure calls).
  const idCounterRef = useRef(0);
  // Track whether a drag or resize is in progress so we take exactly ONE undo
  // snapshot on the first onDragStart / onResizeStart and skip intermediate
  // onLayoutChange firings. Without this, every frame during a drag pushed a
  // separate undo entry, making the undo stack useless.
  const isDraggingRef = useRef(false);
  const preDragSpecRef = useRef<DashboardSpec | null>(null);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // commitTimeoutRef and titleCommitTimeoutRef are intentionally not cleared
      // here: the lint rule `react-hooks/immutability` treats a ref read inside
      // any effect as immutable elsewhere in the component, and both of those
      // refs need to be re-assigned from user-event handlers. Leaking the timer
      // on unmount is fine - the callback runs once, then the component is gone.
    },
    [],
  );

  function handleLayoutChange(next: Layout[]) {
    if (!editMode) return;
    const kindById = new Map(layoutItems.map((item) => [item.item_id, item.kind] as const));
    // RGL gives us positions on a single 8-row page; remap them back to absolute y.
    const updatedOnPage: LayoutItem[] = next.map((entry) => {
      const h = Math.min(ROWS_PER_PAGE, Math.max(1, entry.h));
      const w = Math.max(1, Math.min(COLS, entry.w));
      const localY = Math.max(0, Math.min(ROWS_PER_PAGE - h, entry.y));
      return {
        item_id: entry.i,
        kind: kindById.get(entry.i) ?? "chart",
        x: Math.max(0, Math.min(COLS - w, entry.x)),
        y: clampedActivePage * ROWS_PER_PAGE + localY,
        w,
        h,
      };
    });
    // Merge with items on OTHER pages (untouched).
    const updatedIds = new Set(updatedOnPage.map((item) => item.item_id));
    const merged: LayoutItem[] = [
      ...layoutItems.filter(
        (item) =>
          !updatedIds.has(item.item_id) &&
          Math.floor(item.y / ROWS_PER_PAGE) !== clampedActivePage,
      ),
      ...updatedOnPage,
    ];
    const snapped = packPaged(merged, COLS, ROWS_PER_PAGE);

    // Bail early if nothing actually changed (RGL fires onLayoutChange on initial mount too).
    if (sameLayout(snapped, layoutItems)) return;

    // Update local state synchronously so RGL doesn't appear to "snap back" while we wait
    // for the network round-trip. The user sees the move land instantly.
    setLocalDashboard((current) => {
      const layout: DashboardLayoutModel = {
        ...(current.layout ?? { cols: COLS, row_height: ROW_HEIGHT, items: [] }),
        cols: COLS,
        row_height: current.layout?.row_height ?? ROW_HEIGHT,
        items: snapped,
      };
      const spec = current.spec ? { ...current.spec, layout } : current.spec;
      return { ...current, layout, spec };
    });

    // Debounce the backend save. The server-side sanitizer will re-pack as well.
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const payload: DashboardLayoutModel = {
        cols: COLS,
        row_height: activeDashboard.layout?.row_height ?? ROW_HEIGHT,
        items: snapped,
      };
      updateDashboardLayout(activeDashboard.dashboard_id, payload)
        .then((updated) => {
          setErrorMessage(null);
          applyUpdate(updated);
        })
        .catch((error: Error) => setErrorMessage(error.message));
    }, 450);
  }

  // Live spec edit: update the chart locally immediately for instant re-render.
  function handleSpecChange(nextSpec: ChartSpec) {
    setLocalDashboard((current) => {
      const charts = current.charts.map((chart) =>
        chart.chart_id === nextSpec.chart_id
          ? {
              ...chart,
              spec: nextSpec,
              title: nextSpec.title || chart.title,
              chart_type: nextSpec.chart_type,
              explanation: nextSpec.explanation ?? chart.explanation,
            }
          : chart,
      );
      const dashboardSpec = current.spec
        ? {
            ...current.spec,
            charts: current.spec.charts.map((chart) =>
              chart.chart_id === nextSpec.chart_id ? nextSpec : chart,
            ),
          }
        : current.spec;
      return { ...current, charts, spec: dashboardSpec };
    });
  }

  // Debounced commit: PUT the new spec to the backend once the user pauses.
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounced commit for per-page title edits; separate timer so title keystrokes
  // and spec edits don't cancel each other's pending saves.
  const titleCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageTitles = useMemo<string[]>(
    () => activeDashboard.layout?.page_titles ?? [],
    [activeDashboard.layout?.page_titles],
  );
  const pageNarrative = useMemo(
    () => derivePageNarrative(visibleLayoutItems, chartsById, clampedActivePage, activeDashboard.title),
    [visibleLayoutItems, chartsById, clampedActivePage, activeDashboard.title],
  );
  const currentPageTitle =
    pageTitles[clampedActivePage]?.trim() || pageNarrative.title;

  function handlePageTitleChange(value: string) {
    const existingLayout: DashboardLayoutModel = activeDashboard.layout ?? {
      cols: COLS,
      row_height: ROW_HEIGHT,
      items: layoutItems,
    };
    const nextTitles = [...pageTitles];
    while (nextTitles.length <= clampedActivePage) nextTitles.push("");
    nextTitles[clampedActivePage] = value;
    const nextLayout: DashboardLayoutModel = {
      ...existingLayout,
      cols: COLS,
      row_height: existingLayout.row_height ?? ROW_HEIGHT,
      items: existingLayout.items ?? layoutItems,
      page_titles: nextTitles,
    };
    // Instant local update so the input stays controlled without a round trip.
    setLocalDashboard((current) => {
      const spec = current.spec ? { ...current.spec, layout: nextLayout } : current.spec;
      return { ...current, layout: nextLayout, spec };
    });
    if (titleCommitTimeoutRef.current) clearTimeout(titleCommitTimeoutRef.current);
    titleCommitTimeoutRef.current = setTimeout(() => {
      updateDashboardLayout(activeDashboard.dashboard_id, nextLayout)
        .then((updated) => applyUpdate(updated))
        .catch((error: Error) => setErrorMessage(error.message));
    }, 500);
  }
  function handleSpecCommit(nextSpec: ChartSpec) {
    pushUndoSnapshot();
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSavingChart(true);
        const updated = await updateChartSpec(
          activeDashboard.dashboard_id,
          nextSpec.chart_id,
          nextSpec,
        );
        applyUpdate(updated);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setIsSavingChart(false);
      }
    }, 350);
  }

  function pushUndoSnapshot() {
    const snapshot = activeDashboard.spec
      ? JSON.parse(JSON.stringify(activeDashboard.spec))
      : null;
    if (!snapshot) return;
    setUndoStack((stack) => [...stack.slice(-19), snapshot]);
    setRedoStack([]);
  }

  async function performUndo() {
    if (!undoStack.length || !activeDashboard.spec) return;
    // Cancel any pending debounced layout save — otherwise it would fire AFTER
    // the undo and silently overwrite the rollback with the newer layout.
    if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((stack) => [...stack.slice(-19), JSON.parse(JSON.stringify(activeDashboard.spec))]);
    setUndoStack((stack) => stack.slice(0, -1));
    try {
      const updated = await updateDashboardSpec(activeDashboard.dashboard_id, previous);
      applyUpdate(updated);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }

  async function performRedo() {
    if (!redoStack.length) return;
    if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
    const next = redoStack[redoStack.length - 1];
    setUndoStack((stack) => activeDashboard.spec ? [...stack.slice(-19), JSON.parse(JSON.stringify(activeDashboard.spec))] : stack);
    setRedoStack((stack) => stack.slice(0, -1));
    try {
      const updated = await updateDashboardSpec(activeDashboard.dashboard_id, next);
      applyUpdate(updated);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }

  // Capture ONE undo snapshot when the user starts dragging or resizing.
  // onLayoutChange fires on every intermediate frame, but we only want the
  // pre-operation state once.
  function handleDragOrResizeStart() {
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      preDragSpecRef.current = activeDashboard.spec
        ? JSON.parse(JSON.stringify(activeDashboard.spec))
        : null;
    }
  }

  function handleDragOrResizeStop() {
    isDraggingRef.current = false;
    // Push the snapshot captured at drag-start onto the undo stack now that
    // the operation is complete.
    if (preDragSpecRef.current) {
      setUndoStack((stack) => [...stack.slice(-19), preDragSpecRef.current!]);
      setRedoStack([]);
      preDragSpecRef.current = null;
    }
  }

  async function handleAiPrompt() {
    const instruction = aiPrompt.trim();
    if (!instruction) return;
    setIsAiBusy(true);
    try {
      pushUndoSnapshot();
      const response = await aiPatchDashboard(
        activeDashboard.dashboard_id,
        instruction,
        selectedChartId,
      );
      applyUpdate(response.dashboard);
      setAiPrompt("");
      setErrorMessage(null);
      setAiPatchNotice(response.operation.summary || "Applied the requested dashboard tweak.");
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsAiBusy(false);
    }
  }

  function handleChartDelete(chartId: string) {
    if (!activeDashboard.spec) return;
    if (!window.confirm("Delete this chart? You can undo this action.")) return;
    const next: DashboardSpec = {
      ...activeDashboard.spec,
      charts: activeDashboard.spec.charts.filter((chart) => chart.chart_id !== chartId),
      layout: {
        ...activeDashboard.spec.layout,
        items: activeDashboard.spec.layout.items.filter((item) => item.item_id !== chartId),
      },
    };
    pushUndoSnapshot();
    // Optimistic: remove chart from local view immediately.
    setLocalDashboard((current) => ({
      ...current,
      charts: current.charts.filter((c) => c.chart_id !== chartId),
      kpis: current.kpis.filter((k) => k.kpi_id !== chartId),
      layout: { ...current.layout, items: next.layout.items },
      spec: next,
    }));
    setSelectedChartId(null);
    updateDashboardSpec(activeDashboard.dashboard_id, next)
      .then((updated) => applyUpdate(updated))
      .catch((error: Error) => setErrorMessage(error.message));
  }

  function handleDeletePage(pageIndex: number) {
    if (pageCount <= 1) return;
    const itemsHere = pageBuckets.get(pageIndex)?.length ?? 0;
    const label = itemsHere ? `Delete page ${pageIndex + 1} and its ${itemsHere} chart(s)?` : `Delete empty page ${pageIndex + 1}?`;
    if (!window.confirm(label)) return;
    const itemsOnPage = pageBuckets.get(pageIndex) ?? [];
    // Re-number every item on later pages by sliding them up one page.
    const next = layoutItems
      .filter((item) => Math.floor(item.y / ROWS_PER_PAGE) !== pageIndex)
      .map((item) => {
        const itemPage = Math.floor(item.y / ROWS_PER_PAGE);
        if (itemPage > pageIndex) {
          return { ...item, y: item.y - ROWS_PER_PAGE };
        }
        return item;
      });

    if (itemsOnPage.length && activeDashboard.spec) {
      // The page had charts on it; persist a spec update so they're removed everywhere.
      const removedIds = new Set(itemsOnPage.map((item) => item.item_id));
      const nextSpec: DashboardSpec = {
        ...activeDashboard.spec,
        charts: activeDashboard.spec.charts.filter((chart) => !removedIds.has(chart.chart_id)),
        layout: {
          ...activeDashboard.spec.layout,
          items: next,
        },
      };
      pushUndoSnapshot();
      updateDashboardSpec(activeDashboard.dashboard_id, nextSpec)
        .then((updated) => applyUpdate(updated))
        .catch((error: Error) => setErrorMessage(error.message));
    } else {
      // Empty page: just persist the new layout.
      pushUndoSnapshot();
      updateDashboardLayout(activeDashboard.dashboard_id, {
        cols: COLS,
        row_height: activeDashboard.layout?.row_height ?? ROW_HEIGHT,
        items: next,
      })
        .then((updated) => applyUpdate(updated))
        .catch((error: Error) => setErrorMessage(error.message));
    }
    setActivePage((current) => Math.min(current, Math.max(0, pageCount - 2)));
  }

  function handleAddChart(chartType: AddableChartType) {
    if (!activeDashboard.spec) return;
    setShowAddMenu(false);
    idCounterRef.current += 1;
    const newId = `chart_new_${idCounterRef.current}`;

    // Pick sensible default columns so the chart renders something immediately.
    // The user can refine in the inspector panel that auto-opens.
    const cats = datasetProfile?.categorical_columns ?? [];
    const nums = datasetProfile?.possible_metric_columns?.length
      ? datasetProfile.possible_metric_columns
      : (datasetProfile?.numeric_columns ?? []);
    const dates = datasetProfile?.datetime_columns ?? [];

    let xCol: string | null = null;
    let yCol: string | null = null;
    let groupCol: string | null = null;
    let aggregation: DataQueryAggregation = "sum";

    switch (chartType) {
      case "bar":
      case "stacked_bar":
      case "pie":
      case "treemap":
        xCol = cats[0] ?? null;
        yCol = nums[0] ?? null;
        if (chartType === "stacked_bar") groupCol = cats[1] ?? null;
        break;
      case "line":
      case "area":
        xCol = dates[0] ?? cats[0] ?? null;
        yCol = nums[0] ?? null;
        break;
      case "scatter":
        xCol = nums[0] ?? null;
        yCol = nums[1] ?? nums[0] ?? null;
        groupCol = cats[0] ?? null;
        aggregation = "none";
        break;
      case "histogram":
        xCol = nums[0] ?? null;
        aggregation = "count";
        break;
      case "box":
        xCol = cats[0] ?? null;
        yCol = nums[0] ?? null;
        aggregation = "none";
        break;
      case "heatmap":
        // Correlation heatmap picks its own numeric pairs; no x/y needed.
        aggregation = "none";
        break;
      case "kpi":
        yCol = nums[0] ?? null;
        break;
      case "table":
        aggregation = "none";
        break;
    }

    const catalog = CHART_CATALOG.find((entry) => entry.type === chartType)!;

    const newChartSpec: ChartSpec = {
      chart_id: newId,
      title: `New ${catalog.label.toLowerCase()} chart`,
      chart_type: chartType,
      intent: catalog.intent,
      data_query: {
        x: xCol,
        y: yCol,
        aggregation,
        group_by: groupCol,
        sort: chartType === "bar" || chartType === "stacked_bar" ? "desc" : "none",
        limit: chartType === "bar" || chartType === "stacked_bar" || chartType === "table" ? 30 : null,
      },
      encoding: { x_label: xCol, y_label: yCol, color_by: groupCol },
      style: { show_legend: true, show_grid: true, number_format: "auto" },
      explanation: "",
    };

    // Seed the new item at the bottom of the layout; packPaged then slots it into
    // the first free cell and spills to a new page if the current one is full.
    const existingItems = activeDashboard.spec.layout?.items ?? [];
    const bottomY = existingItems.reduce(
      (acc, item) => Math.max(acc, item.y + item.h),
      0,
    );
    const seededItem: LayoutItem = {
      item_id: newId,
      kind: chartType === "kpi" ? "kpi" : "chart",
      x: 0,
      y: bottomY,
      w: catalog.w,
      h: catalog.h,
    };
    const packed = packPaged(
      [...existingItems, seededItem],
      COLS,
      ROWS_PER_PAGE,
    );

    const nextSpec: DashboardSpec = {
      ...activeDashboard.spec,
      charts: [...activeDashboard.spec.charts, newChartSpec],
      layout: {
        ...activeDashboard.spec.layout,
        items: packed,
      },
    };
    pushUndoSnapshot();

    // Optimistic local update so the new chart appears instantly. The backend
    // save runs in the background; if it fails the error banner tells the user.
    const optimisticChart: ChartResponse = {
      chart_id: newId,
      title: newChartSpec.title,
      chart_type: newChartSpec.chart_type as ChartResponse["chart_type"],
      plotly_json: { data: [], layout: {} },
      plotly_code: "",
      explanation: newChartSpec.explanation ?? "",
      spec: newChartSpec,
    };
    setLocalDashboard((current) => ({
      ...current,
      charts: [...current.charts, optimisticChart],
      layout: { ...current.layout, items: packed },
      spec: nextSpec,
    }));
    const placed = packed.find((item) => item.item_id === newId);
    if (placed) setActivePage(Math.floor(placed.y / ROWS_PER_PAGE));
    setSelectedChartId(newId);

    updateDashboardSpec(activeDashboard.dashboard_id, nextSpec)
      .then((updated) => applyUpdate(updated))
      .catch((error: Error) => setErrorMessage(error.message));
  }

  function handleChartDuplicate(chartId: string) {
    if (!activeDashboard.spec) return;
    const original = activeDashboard.spec.charts.find((chart) => chart.chart_id === chartId);
    if (!original) return;
    idCounterRef.current += 1;
    const newId = `${chartId}_copy_${idCounterRef.current}`;
    const duplicate: ChartSpec = {
      ...original,
      chart_id: newId,
      title: `${original.title} (copy)`,
    };
    // Also add a layout item for the duplicate so it gets a proper position.
    // Seed it at the bottom; packPaged will slot it into the first free cell.
    const existingItems = activeDashboard.spec.layout?.items ?? [];
    const origItem = existingItems.find((item) => item.item_id === chartId);
    const bottomY = existingItems.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
    const dupItem: LayoutItem = {
      item_id: newId,
      kind: origItem?.kind ?? "chart",
      x: 0,
      y: bottomY,
      w: origItem?.w ?? 6,
      h: origItem?.h ?? 4,
    };
    const packed = packPaged([...existingItems, dupItem], COLS, ROWS_PER_PAGE);
    const next: DashboardSpec = {
      ...activeDashboard.spec,
      charts: [...activeDashboard.spec.charts, duplicate],
      layout: { ...activeDashboard.spec.layout, items: packed },
    };
    pushUndoSnapshot();

    // Optimistic local update so the duplicate appears instantly.
    const origChart = activeDashboard.charts.find((c) => c.chart_id === chartId);
    const optimisticDup: ChartResponse = {
      chart_id: newId,
      title: duplicate.title,
      chart_type: duplicate.chart_type as ChartResponse["chart_type"],
      plotly_json: origChart?.plotly_json ?? { data: [], layout: {} },
      plotly_code: origChart?.plotly_code ?? "",
      explanation: duplicate.explanation ?? "",
      spec: duplicate,
    };
    setLocalDashboard((current) => ({
      ...current,
      charts: [...current.charts, optimisticDup],
      layout: { ...current.layout, items: packed },
      spec: next,
    }));
    const placed = packed.find((item) => item.item_id === newId);
    if (placed) setActivePage(Math.floor(placed.y / ROWS_PER_PAGE));
    setSelectedChartId(newId);

    updateDashboardSpec(activeDashboard.dashboard_id, next)
      .then((updated) => applyUpdate(updated))
      .catch((error: Error) => setErrorMessage(error.message));
  }

  const titleBar = (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#dde4ef] bg-white p-3 text-[#141414] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#e7edff] text-[#275efe]">
          <LayoutGrid className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {editMode ? (
            <Input
              className="h-8 border-none bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
              onChange={(event) => handlePageTitleChange(event.target.value)}
              placeholder={`Page ${clampedActivePage + 1} title`}
              value={currentPageTitle}
            />
          ) : (
            <div className="truncate text-base font-semibold">
              {currentPageTitle}
            </div>
          )}
          <div className="line-clamp-1 text-xs text-[#667085]">
            {pageNarrative.objective} &middot; Page {clampedActivePage + 1} of {pageCount}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ExportPanel chartDomIds={chartDomIds} dashboard={activeDashboard} rows={rows} />
        {editMode ? (
          <div className="relative">
            <Button
              onClick={() => setShowAddMenu((v) => !v)}
              size="sm"
              variant="default"
            >
              <Plus className="mr-1.5 size-4" /> Add chart
            </Button>
            {showAddMenu ? (
              <>
                {/* Click-outside backdrop - full screen invisible layer so the user
                    can dismiss by clicking anywhere else on the page. */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAddMenu(false)}
                />
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-[#dde4ef] bg-white p-2 shadow-xl"
                >
                  <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
                    Visualizations
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CHART_CATALOG.map(({ type, label, Icon }) => (
                      <button
                        className="flex flex-col items-center gap-1 rounded-md border border-transparent px-1.5 py-2 text-center text-[11px] text-[#334155] transition hover:border-[#275efe]/40 hover:bg-[#eef2fb]"
                        key={type}
                        onClick={() => handleAddChart(type)}
                        title={`Add a ${label.toLowerCase()} chart`}
                        type="button"
                      >
                        <Icon className="size-5 text-[#275efe]" />
                        <span className="leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 px-1 text-[10px] text-[#94a3b8]">
                    A new chart lands on the first free slot - a new page is
                    added automatically if the current one is full.
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <Button disabled={!undoStack.length} onClick={performUndo} size="sm" variant="outline">
          <Undo2 className="size-4" />
        </Button>
        <Button disabled={!redoStack.length} onClick={performRedo} size="sm" variant="outline">
          <Redo2 className="size-4" />
        </Button>
        {activeDashboard.controls?.length && onFilterChange ? (
          <Button disabled={isFiltering} onClick={onFilterReset} size="sm" variant="outline">
            Reset filters
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setEditMode((prev) => {
              if (prev) setSelectedChartId(null); // clear selection on exit
              return !prev;
            });
          }}
          size="sm"
          variant={editMode ? "default" : "outline"}
        >
          {editMode ? (
            <>
              <Save className="mr-1.5 size-4" /> Done
            </>
          ) : (
            <>
              <Pencil className="mr-1.5 size-4" /> Edit layout
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const aiPromptBar = (
    <div className="rounded-2xl border border-[#c7d2fe] bg-[#f5f7ff] px-3 py-2 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[#275efe]" />
        <Input
          className="border-none bg-transparent shadow-none focus-visible:ring-0"
          disabled={isAiBusy}
          onChange={(event) => setAiPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleAiPrompt();
            }
          }}
          placeholder='Tweak this dashboard ("make the institution chart horizontal", "add a satisfaction breakdown", ...)'
          value={aiPrompt}
        />
        <Button disabled={isAiBusy || !aiPrompt.trim()} onClick={handleAiPrompt} size="sm">
          {isAiBusy ? <Loader2 className="size-4 animate-spin" /> : "Apply tweak"}
        </Button>
      </div>
      {aiPatchNotice ? (
        <div className="mt-2 rounded-lg border border-[#dbe3ff] bg-white px-3 py-2 text-xs leading-5 text-[#334155]">
          {aiPatchNotice}
        </div>
      ) : null}
    </div>
  );

  // Power BI-style page tab strip rendered below the canvas.
  const pageStrip = (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#dde4ef] bg-white px-2 py-1.5 text-xs text-[#141414]"
    >
      <Button
        disabled={clampedActivePage === 0}
        onClick={() => setActivePage((p) => Math.max(0, p - 1))}
        size="icon"
        variant="ghost"
      >
        <ChevronLeft className="size-4" />
      </Button>
      {Array.from({ length: pageCount }, (_, index) => {
        const itemsHere = pageBuckets.get(index)?.length ?? 0;
        const isActive = index === clampedActivePage;
        return (
          <button
            className={`group flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ${
              isActive
                ? "bg-[#275efe] text-white shadow-sm"
                : "text-[#475569] hover:bg-[#eef2fb]"
            }`}
            key={index}
            onClick={() => setActivePage(index)}
            type="button"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">Page</span>
            <span className="text-sm font-semibold">{index + 1}</span>
            <span
              className={`text-[10px] font-medium ${isActive ? "text-white/70" : "text-[#94a3b8]"}`}
            >
              {itemsHere}
            </span>
            {editMode && pageCount > 1 ? (
              <span
                aria-label="Delete page"
                className={`ml-1 hidden rounded p-0.5 transition ${
                  isActive
                    ? "hover:bg-white/20 group-hover:inline-flex"
                    : "hover:bg-white group-hover:inline-flex"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeletePage(index);
                }}
                role="button"
              >
                <Trash2 className="size-3" />
              </span>
            ) : null}
          </button>
        );
      })}
      <Button
        disabled={clampedActivePage >= pageCount - 1}
        onClick={() => setActivePage((p) => Math.min(pageCount - 1, p + 1))}
        size="icon"
        variant="ghost"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="autodash-hide-in-present flex flex-col gap-3">
        {titleBar}
        {aiPromptBar}
        {errorMessage ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{errorMessage}</span>
            <button className="shrink-0 text-red-400 hover:text-red-600" onClick={() => setErrorMessage(null)} type="button">✕</button>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Canvas viewport: scales the fixed dashboard page so the whole page stays in view. */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
          ref={canvasViewportRef}
        >
          <div
            className="relative"
            style={{
              width: PAGE_WIDTH * canvasScale,
              height: PAGE_HEIGHT * canvasScale,
              overflow: "hidden",
            }}
          >
          <section
            className="absolute left-0 top-0 rounded-[24px] border shadow-sm"
            style={{
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              transform: `scale(${canvasScale})`,
              transformOrigin: "top left",
              background: theme?.background ?? "#f4f6fb",
              borderColor: theme?.border ?? "#dde4ef",
              color: theme?.text,
            }}
          >
            <GridLayout
              className={editMode ? "autodash-grid-edit" : "autodash-grid"}
              cols={COLS}
              compactType="vertical"
              containerPadding={CONTAINER_PADDING}
              draggableCancel=".no-drag"
              isBounded
              isDraggable={editMode}
              isResizable={editMode}
              resizeHandles={["se"]}
              layout={rglLayout}
              margin={MARGIN}
              maxRows={ROWS_PER_PAGE}
              onLayoutChange={handleLayoutChange}
              // Undo snapshots: capture ONE snapshot at drag/resize START,
              // push it onto the undo stack at drag/resize STOP. This gives
              // the user exactly one undo entry per user-initiated operation
              // instead of one per intermediate layout frame.
              onDragStart={handleDragOrResizeStart}
              onDragStop={handleDragOrResizeStop}
              onResizeStart={handleDragOrResizeStart}
              onResizeStop={handleDragOrResizeStop}
              rowHeight={ROW_HEIGHT}
              transformScale={canvasScale}
              useCSSTransforms
              width={PAGE_WIDTH}
            >
              {visibleLayoutItems.map((item) => (
                <div className="autodash-grid-item" key={item.item_id}>
                  <GridTile
                    activeFilters={activeDashboard.active_filters ?? emptyFilters}
                    chart={item.kind === "chart" ? chartsById.get(item.item_id) : undefined}
                    chartDomIds={chartDomIds}
                    editMode={editMode}
                    filterControls={activeDashboard.controls}
                    insights={item.kind === "insights" ? activeDashboard.insights : undefined}
                    isFiltering={isFiltering}
                    item={item}
                    kpi={item.kind === "kpi" ? kpisById.get(item.item_id) : undefined}
                    onChartSelect={(chartId) => setSelectedChartId(chartId)}
                    onFilterChange={onFilterChange}
                    onFilterReset={onFilterReset}
                    rows={filteredRows}
                    selected={item.item_id === selectedChartId}
                    settings={settings}
                    theme={theme}
                    title={currentPageTitle}
                    themeConfig={activeDashboard.spec?.theme}
                  />
                </div>
              ))}
            </GridLayout>
          </section>
          </div>
        </div>
        {/* Chart inspector: rendered via a portal into DashboardStudio's right
            column (#autodash-inspector-slot) so the canvas keeps its full width.
            Filters panel is the fallback when no chart is selected. */}
        {inspectorSlotEl && editMode && selectedChart && selectedChart.spec
          ? createPortal(
              <RightInspectorPanel
                isSaving={isSavingChart}
                key={selectedChart.chart_id}
                onChange={handleSpecChange}
                onClose={() => setSelectedChartId(null)}
                onCommit={handleSpecCommit}
                onDelete={() => handleChartDelete(selectedChart.chart_id)}
                onDuplicate={() => handleChartDuplicate(selectedChart.chart_id)}
                profile={datasetProfile}
                spec={selectedChart.spec}
              />,
              inspectorSlotEl,
            )
          : null}
      </div>
      {/* Page strip is always visible: in presentation mode it provides the
          only way to navigate between pages (besides arrow keys). The styling
          is tweaked in fullscreen via the .autodash-present-pagestrip class. */}
      <div className="autodash-present-pagestrip">{pageStrip}</div>
      {/* Presentation-mode page title overlay - visible ONLY in fullscreen so
          the audience knows which page they are looking at. */}
      <div className="autodash-present-title">
        <span className="text-sm font-semibold opacity-90">
          {currentPageTitle}
        </span>
        <span className="mx-2 text-xs opacity-50">·</span>
        <span className="text-xs opacity-60">{clampedActivePage + 1} / {pageCount}</span>
      </div>
      <style jsx global>{`
        /* Smooth professional motion: items glide into their new grid cells using a
           cubic-bezier ease that matches modern SaaS dashboards (Notion / Linear-ish).
           Items being actively dragged or resized get no transition so they track the
           cursor 1:1; everything else animates. */
        .autodash-grid .react-grid-item {
          transition:
            transform 240ms cubic-bezier(0.2, 0.7, 0.3, 1),
            width 240ms cubic-bezier(0.2, 0.7, 0.3, 1),
            height 240ms cubic-bezier(0.2, 0.7, 0.3, 1),
            box-shadow 160ms ease;
          will-change: transform;
        }
        .autodash-grid .react-grid-item.react-draggable-dragging,
        .autodash-grid .react-grid-item.resizing {
          transition: none !important;
          z-index: 30;
          box-shadow:
            0 14px 28px rgba(15, 23, 42, 0.18),
            0 0 0 2px rgba(39, 94, 254, 0.55);
          cursor: grabbing;
        }
        .autodash-grid .react-grid-item.react-grid-placeholder {
          background: rgba(39, 94, 254, 0.16);
          border: 1.5px dashed rgba(39, 94, 254, 0.55);
          border-radius: 14px;
          transition: transform 120ms ease, opacity 120ms ease;
          opacity: 1;
        }
        .autodash-grid-edit .react-grid-item {
          cursor: grab;
        }
        .autodash-grid-edit .react-grid-item:hover {
          box-shadow: 0 0 0 2px rgba(39, 94, 254, 0.35);
          border-radius: 14px;
        }
        /* Visible, clickable resize handle in the bottom-right of every tile.
           The react-resizable bundled background image is too subtle on a white
           tile + rounded border - we override it with an explicit blue corner
           square so the user can actually FIND the drag target. */
        .autodash-grid-edit .react-resizable-handle {
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 18px;
          height: 18px;
          background-image: none;
          background-color: rgba(39, 94, 254, 0.12);
          border: 1px solid rgba(39, 94, 254, 0.55);
          border-radius: 4px;
          cursor: se-resize;
          opacity: 0.75;
          transition: opacity 120ms ease, background-color 120ms ease;
          z-index: 5;
        }
        .autodash-grid-edit .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 8px;
          height: 8px;
          border-right: 2px solid #275efe;
          border-bottom: 2px solid #275efe;
          border-bottom-right-radius: 2px;
        }
        .autodash-grid-edit .react-resizable-handle:hover {
          opacity: 1;
          background-color: rgba(39, 94, 254, 0.24);
        }
        .autodash-grid-item {
          display: flex;
          min-height: 0;
        }
        .autodash-grid-item > * {
          flex: 1;
          min-height: 0;
        }
        .autodash-page-overlay {
          position: absolute;
          left: 0;
          right: 0;
          border-bottom: 1px dashed rgba(39, 94, 254, 0.25);
        }
        .autodash-page-overlay:last-child {
          border-bottom: none;
        }
        .autodash-page-label {
          position: absolute;
          top: 8px;
          right: 16px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #275efe;
          background: rgba(231, 237, 255, 0.85);
          border: 1px solid rgba(39, 94, 254, 0.2);
          border-radius: 999px;
        }
        /* Presentation / fullscreen mode: strip every piece of editor chrome so
           only the 1280x720 canvas (and the sticky Exit button) is visible, and
           forbid scrolling so the page fits exactly on screen. */
        :fullscreen .autodash-hide-in-present,
        :-webkit-full-screen .autodash-hide-in-present,
        :-ms-fullscreen .autodash-hide-in-present {
          display: none !important;
        }
        .autodash-present-surface:fullscreen {
          overflow: hidden !important;
        }
        /* Presentation page title: hidden by default, visible in fullscreen. */
        .autodash-present-title {
          display: none;
        }
        :fullscreen .autodash-present-title,
        :-webkit-full-screen .autodash-present-title {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 16px;
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(221,228,239,0.6);
          border-radius: 999px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.10);
          pointer-events: none;
          color: #141414;
        }
        /* Presentation page strip: semi-transparent, docked at bottom. */
        :fullscreen .autodash-present-pagestrip,
        :-webkit-full-screen .autodash-present-pagestrip {
          position: fixed;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          opacity: 0.65;
          transition: opacity 200ms ease;
        }
        :fullscreen .autodash-present-pagestrip:hover,
        :-webkit-full-screen .autodash-present-pagestrip:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

interface GridTileProps {
  chart?: ChartResponse;
  chartDomIds: Record<string, string>;
  editMode: boolean;
  insights?: string[];
  item: LayoutItem;
  kpi?: KpiCardResponse;
  onChartSelect: (chartId: string) => void;
  rows: Record<string, unknown>[] | null;
  selected: boolean;
  settings: DashboardViewSettings;
  theme?: DashboardTheme;
  title: string;
  themeConfig?: ThemeConfig | null;
  // Filter props - only used when item.kind === "filters". Rendering the slicer
  // as a proper grid tile (instead of a floating absolute overlay) lets users
  // drag/resize it and have it pack alongside other cards.
  filterControls?: DashboardFilterControl[];
  activeFilters?: DashboardFilterRequest;
  isFiltering?: boolean;
  onFilterChange?: (filters: DashboardFilterRequest) => void;
  onFilterReset?: () => void;
}

function GridTile({
  chart,
  chartDomIds,
  editMode,
  insights,
  item,
  kpi,
  onChartSelect,
  rows,
  selected,
  settings,
  theme,
  title,
  themeConfig,
  filterControls,
  activeFilters,
  isFiltering,
  onFilterChange,
  onFilterReset,
}: GridTileProps) {
  if (item.kind === "filters" && filterControls && filterControls.length) {
    return (
      <div className="no-drag flex h-full min-h-0 w-full">
        <DashboardControls
          controls={filterControls}
          filters={activeFilters ?? emptyFilters}
          isFiltering={isFiltering ?? false}
          onChange={onFilterChange ?? (() => undefined)}
          onReset={onFilterReset ?? (() => undefined)}
          theme={theme}
          variant="canvas"
        />
      </div>
    );
  }
  if (item.kind === "title") {
    return (
      <DashboardTitleTile
        activeFilters={activeFilters ?? emptyFilters}
        filterControls={filterControls ?? []}
        isFiltering={isFiltering ?? false}
        onFilterChange={onFilterChange ?? (() => undefined)}
        onFilterReset={onFilterReset ?? (() => undefined)}
        theme={theme}
        title={title}
      />
    );
  }
  if (item.kind === "chart" && chart) {
    // Prefer the spec-driven SpecChart when both spec and rows are loaded.
    // Otherwise fall back to the legacy server-rendered ChartCard so existing
    // dashboards keep working during the transition.
    const useSpec = !!chart.spec && Array.isArray(rows);
    return (
      <div
        className={`group relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition ${
          selected ? "ring-2 ring-[#275efe]" : ""
        }`}
        onClick={editMode ? () => onChartSelect(chart.chart_id) : undefined}
        role={editMode ? "button" : undefined}
        style={{
          cursor: editMode ? "pointer" : undefined,
          background: theme?.panel ?? "#fff",
          borderColor: theme?.border ?? "#dde4ef",
        }}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-0.5">
          <div
            className="truncate text-[12px] font-semibold leading-tight"
            style={theme ? { color: theme.text } : undefined}
            title={chart.title}
          >
            {chart.title}
          </div>
          {chart.spec?.intent ? (
            <div
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
              style={
                theme
                  ? { background: theme.panelStrong, color: theme.muted }
                  : { background: "#eef2fb", color: "#667085" }
              }
            >
              {chart.spec.intent}
            </div>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 px-1 pb-1">
          {useSpec && chart.spec ? (
            <SpecChart
              dashboardTheme={theme}
              plotlyDivId={chartDomIds[chart.chart_id]}
              rows={rows}
              spec={chart.spec}
              themeConfig={themeConfig}
            />
          ) : (
            <ChartCard canvas chart={chart} showExplanation={settings.showExplanations} theme={theme} />
          )}
        </div>
      </div>
    );
  }
  if (item.kind === "kpi" && kpi) {
    return <KpiCard canvas kpi={kpi} theme={theme} />;
  }
  if (item.kind === "insights") {
    return <InsightsTile insights={insights ?? []} theme={theme} />;
  }
  return (
    <div
      className="flex h-full min-h-0 items-center justify-center rounded-xl border text-xs text-[#667085]"
      style={theme ? { background: theme.panel, borderColor: theme.border } : undefined}
    >
      Missing: {item.item_id}
    </div>
  );
}

function DashboardTitleTile({
  activeFilters,
  filterControls,
  isFiltering,
  onFilterChange,
  onFilterReset,
  theme,
  title,
}: {
  activeFilters: DashboardFilterRequest;
  filterControls: DashboardFilterControl[];
  isFiltering: boolean;
  onFilterChange: (filters: DashboardFilterRequest) => void;
  onFilterReset: () => void;
  theme?: DashboardTheme;
  title: string;
}) {
  return (
    <section
      className="no-drag flex h-full min-h-0 items-center justify-between gap-4 overflow-hidden rounded-xl border px-5 py-3 shadow-sm"
      style={theme ? { background: theme.panel, borderColor: theme.border, color: theme.text } : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={theme ? { color: theme.muted } : undefined}>
          Dashboard
        </div>
        <h1 className="truncate text-[25px] font-semibold leading-tight">{title}</h1>
      </div>
      {filterControls.length ? (
        <div className="no-drag hidden min-w-0 shrink-0 lg:block">
          <DashboardControls
            controls={filterControls}
            filters={activeFilters}
            isFiltering={isFiltering}
            onChange={onFilterChange}
            onReset={onFilterReset}
            theme={theme}
            variant="header"
          />
        </div>
      ) : null}
    </section>
  );
}

function InsightsTile({ insights, theme }: { insights: string[]; theme?: DashboardTheme }) {
  // Hard-cap the visible insights so the tile NEVER needs to scroll. The remaining
  // text is line-clamped inside each card; no overflow scrolling is allowed.
  const visible = insights.slice(0, 3);
  return (
    <section
      className="no-drag flex h-full min-h-0 flex-col gap-1.5 overflow-hidden rounded-xl border px-3 py-2"
      style={theme ? { background: theme.panel, borderColor: theme.border, color: theme.text } : undefined}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <Lightbulb className="size-3.5" style={theme ? { color: theme.accent } : undefined} />
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">Insights ({visible.length}/{insights.length})</div>
      </div>
      <ul
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden text-[11px] leading-snug"
        style={theme ? { color: theme.muted } : undefined}
      >
        {visible.map((insight, index) => (
          <li
            className="flex min-h-0 flex-1 items-start overflow-hidden rounded-md border px-2 py-1.5"
            key={index}
            style={theme ? { background: theme.panelStrong, borderColor: theme.border } : undefined}
          >
            <span className="line-clamp-3 overflow-hidden">{insight}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function isRelationshipChart(chart: ChartResponse | undefined): boolean {
  return Boolean(chart && (chart.chart_type === "scatter" || chart.spec?.intent === "relationship"));
}

function prioritizeHeroCharts(charts: ChartResponse[]): ChartResponse[] {
  const heroIndex = charts.findIndex((chart) => isRelationshipChart(chart));
  if (heroIndex <= 0) return charts;
  return [charts[heroIndex], ...charts.slice(0, heroIndex), ...charts.slice(heroIndex + 1)];
}

function completeLayout(
  layout: DashboardLayoutModel | undefined,
  charts: ChartResponse[],
  kpis: KpiCardResponse[],
  showInsights: boolean,
  controlCount: number,
): LayoutItem[] {
  const cols = layout?.cols ?? COLS;
  const items: LayoutItem[] = [];
  const titleItem = (page: number): LayoutItem => ({
    item_id: page === 0 ? "dashboard_title" : `dashboard_title_page_${page + 1}`,
    kind: "title",
    x: 0,
    y: page * ROWS_PER_PAGE,
    w: cols,
    h: TITLE_ROWS,
  });
  const addTitle = (page: number) => items.push(titleItem(page));
  const orderedCharts = prioritizeHeroCharts(charts);

  if (!orderedCharts.length) {
    addTitle(0);
    kpis.slice(0, 8).forEach((kpi, index) => {
      items.push({
        item_id: kpi.kpi_id,
        kind: "kpi",
        x: (index % 4) * 3,
        y: TITLE_ROWS + Math.floor(index / 4) * 2,
        w: 3,
        h: 2,
      });
    });
    if (showInsights) items.push({ item_id: "insights", kind: "insights", x: 0, y: 5, w: 12, h: 3 });
    return items;
  }

  let kpiOffset = 0;
  const placeTopKpiBand = (page: number, maxCount: number) => {
    const pageKpis = kpis.slice(kpiOffset, kpiOffset + maxCount);
    const baseY = page * ROWS_PER_PAGE;
    const width = pageKpis.length ? Math.floor(COLS / pageKpis.length) : 0;
    pageKpis.forEach((kpi, index) => {
      const isLast = index === pageKpis.length - 1;
      items.push({
        item_id: kpi.kpi_id,
        kind: "kpi",
        x: index * width,
        y: baseY + TITLE_ROWS,
        w: isLast ? COLS - index * width : width,
        h: 2,
      });
    });
    kpiOffset += pageKpis.length;
    return pageKpis.length;
  };
  const placeChartGrid = (page: number, pageCharts: ChartResponse[], hasTopKpiBand: boolean, reservedBottomRows = 0) => {
    const baseY = page * ROWS_PER_PAGE;
    const chartY = baseY + TITLE_ROWS + (hasTopKpiBand ? 2 : 0);
    const chartRows = ROWS_PER_PAGE - TITLE_ROWS - (hasTopKpiBand ? 2 : 0) - reservedBottomRows;
    const columns = pageCharts.length <= 2 ? pageCharts.length || 1 : pageCharts.length <= 4 ? 2 : 4;
    const rows = Math.ceil(pageCharts.length / columns);
    const width = Math.floor(COLS / columns);
    const height = Math.max(3, Math.floor(chartRows / rows));
    pageCharts.forEach((chart, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const isLastColumn = column === columns - 1;
      items.push({
        item_id: chart.chart_id,
        kind: "chart",
        x: column * width,
        y: chartY + row * height,
        w: isLastColumn ? COLS - column * width : width,
        h: height,
      });
    });
  };
  const placeHeroChartGrid = (page: number, pageCharts: ChartResponse[], hasTopKpiBand: boolean, reservedBottomRows = 0) => {
    const baseY = page * ROWS_PER_PAGE;
    const chartY = baseY + TITLE_ROWS + (hasTopKpiBand ? 2 : 0);
    const chartRows = ROWS_PER_PAGE - TITLE_ROWS - (hasTopKpiBand ? 2 : 0) - reservedBottomRows;
    const hero = pageCharts[0];
    const supporting = pageCharts.slice(1, 3);
    const supportRows = supporting.length ? Math.max(3, Math.min(4, Math.floor(chartRows * 0.42))) : 0;
    const heroHeight = Math.max(4, chartRows - supportRows);
    items.push({
      item_id: hero.chart_id,
      kind: "chart",
      x: 0,
      y: chartY,
      w: COLS,
      h: Math.min(chartRows, heroHeight),
    });
    if (!supporting.length) return;
    const supportY = chartY + Math.min(chartRows, heroHeight);
    const supportWidth = supporting.length === 1 ? COLS : COLS / 2;
    supporting.forEach((chart, index) => {
      items.push({
        item_id: chart.chart_id,
        kind: "chart",
        x: index * supportWidth,
        y: supportY,
        w: supportWidth,
        h: supportRows,
      });
    });
  };
  const placeSupportBand = (page: number) => {
    const y = page * ROWS_PER_PAGE + ROWS_PER_PAGE - 3;
    if (showInsights && controlCount === 0) items.push({ item_id: "insights", kind: "insights", x: 0, y, w: 12, h: 3 });
    if (showInsights && controlCount > 0) items.push({ item_id: "insights", kind: "insights", x: 0, y, w: 12, h: 3 });
  };

  addTitle(0);
  const compactPages = true;
  const supportBandNeeded = showInsights;
  let supportBandPlaced = false;
  const hasHeroRelationship = isRelationshipChart(orderedCharts[0]);
  const firstPageChartCount = hasHeroRelationship
    ? 1
    : Math.min(FIRST_PAGE_CHART_LIMIT, orderedCharts.length);
  if (compactPages) {
    const hasTopKpiBand = placeTopKpiBand(0, Math.min(4, kpis.length - kpiOffset)) > 0;
    if (hasHeroRelationship) {
      placeHeroChartGrid(0, orderedCharts.slice(0, firstPageChartCount), hasTopKpiBand);
    } else {
      placeChartGrid(0, orderedCharts.slice(0, firstPageChartCount), hasTopKpiBand);
    }
  } else {
    const hasTopKpiBand = placeTopKpiBand(0, Math.min(4, kpis.length - kpiOffset)) > 0;
    const contentY = hasTopKpiBand ? TITLE_ROWS + 2 : TITLE_ROWS;
    const contentH = ROWS_PER_PAGE - contentY;
    items.push({ item_id: orderedCharts[0].chart_id, kind: "chart", x: 0, y: contentY, w: showInsights ? 8 : 12, h: contentH });
    if (showInsights) items.push({ item_id: "insights", kind: "insights", x: 8, y: contentY, w: 4, h: contentH });
  }

  const remainingCharts = orderedCharts.slice(compactPages ? firstPageChartCount : 1);
  let page = 1;
  for (let offset = 0; offset < remainingCharts.length;) {
    const remainingCount = remainingCharts.length - offset;
    const pageStartsWithRelationship = isRelationshipChart(remainingCharts[offset]);
    const chartCount = compactPages
      ? Math.min(pageStartsWithRelationship ? 1 : DETAIL_PAGE_CHART_LIMIT, remainingCount)
      : remainingCount === 3 || (remainingCount > 3 && remainingCount % 2 === 1) ? 3 : Math.min(2, remainingCount);
    const pageCharts = remainingCharts.slice(offset, offset + chartCount);
    const isFinalChartPage = offset + chartCount >= remainingCharts.length;
    const reserveSupportRows = supportBandNeeded && isFinalChartPage ? 3 : 0;
    addTitle(page);
    if (compactPages) {
      const hasTopKpiBand = placeTopKpiBand(page, Math.min(4, kpis.length - kpiOffset)) > 0;
      if (pageStartsWithRelationship) {
        placeHeroChartGrid(page, pageCharts, hasTopKpiBand, reserveSupportRows);
      } else {
        placeChartGrid(page, pageCharts, hasTopKpiBand, reserveSupportRows);
      }
      if (reserveSupportRows) {
        placeSupportBand(page);
        supportBandPlaced = true;
      }
    } else {
      const baseY = page * ROWS_PER_PAGE;
      const hasTopKpiBand = placeTopKpiBand(page, Math.min(4, kpis.length - kpiOffset)) > 0;
      const chartY = baseY + TITLE_ROWS + (hasTopKpiBand ? 2 : 0);
      const chartHeight = ROWS_PER_PAGE - TITLE_ROWS - (hasTopKpiBand ? 2 : 0);
      if (pageCharts.length === 1) {
        items.push({ item_id: pageCharts[0].chart_id, kind: "chart", x: 0, y: chartY, w: 12, h: chartHeight });
      } else {
        pageCharts.forEach((chart, index) => {
          items.push({ item_id: chart.chart_id, kind: "chart", x: index * (12 / pageCharts.length), y: chartY, w: 12 / pageCharts.length, h: chartHeight });
        });
      }
    }
    offset += chartCount;
    page += 1;
  }
  if (compactPages && supportBandNeeded && !supportBandPlaced) {
    addTitle(page);
    placeSupportBand(page);
    page += 1;
  }

  const firstKpiOverflowPage = page;
  const overflowStart = kpiOffset;
  for (let offset = overflowStart; offset < kpis.length; offset += 12) {
    const page = firstKpiOverflowPage + Math.floor((offset - overflowStart) / 12);
    const baseY = page * ROWS_PER_PAGE;
    const pageKpis = kpis.slice(offset, offset + 12);
    addTitle(page);
    if (pageKpis.length <= 2) {
      pageKpis.forEach((kpi, index) => {
        items.push({
          item_id: kpi.kpi_id,
          kind: "kpi",
          x: index * 6,
          y: baseY + TITLE_ROWS,
          w: 6,
          h: 4,
        });
      });
      continue;
    }
    if (pageKpis.length <= 4) {
      pageKpis.forEach((kpi, index) => {
        items.push({
          item_id: kpi.kpi_id,
          kind: "kpi",
          x: (index % 2) * 6,
          y: baseY + TITLE_ROWS + Math.floor(index / 2) * 3,
          w: 6,
          h: 3,
        });
      });
      continue;
    }
    pageKpis.forEach((kpi, index) => {
      items.push({
        item_id: kpi.kpi_id,
        kind: "kpi",
        x: (index % 4) * 3,
        y: baseY + TITLE_ROWS + Math.floor(index / 4) * 2,
        w: 3,
        h: 2,
      });
    });
  }

  return items;
}

function layoutPassesQualityGate(
  items: LayoutItem[],
  charts: ChartResponse[],
  kpis: KpiCardResponse[],
  showInsights: boolean,
): boolean {
  const expected = new Set<string>([
    ...charts.map((chart) => chart.chart_id),
    ...kpis.map((kpi) => kpi.kpi_id),
    "dashboard_title",
  ]);
  if (showInsights) expected.add("insights");
  const seen = new Set(items.map((item) => item.item_id));
  for (const id of expected) {
    if (!seen.has(id)) return false;
  }

  if (charts.length > 1) {
    const firstPageChartCount = items.filter((item) => item.kind === "chart" && Math.floor(item.y / ROWS_PER_PAGE) === 0).length;
    const expectedFirstPageCharts = charts.some((chart) => isRelationshipChart(chart))
      ? 1
      : Math.min(FIRST_PAGE_CHART_LIMIT, charts.length);
    if (firstPageChartCount < expectedFirstPageCharts) return false;
  }

  const cells = new Map<string, string>();
  const pages = new Map<number, LayoutItem[]>();
  for (const item of items) {
    const page = Math.floor(item.y / ROWS_PER_PAGE);
    const localY = item.y % ROWS_PER_PAGE;
    const bucket = pages.get(page) ?? [];
    bucket.push(item);
    pages.set(page, bucket);
    if (item.w <= 0 || item.h <= 0) return false;
    if (item.x < 0 || item.x + item.w > COLS) return false;
    if (localY + item.h > ROWS_PER_PAGE) return false;
    if (item.kind === "title" && (item.x !== 0 || localY !== 0 || item.w !== COLS || item.h !== TITLE_ROWS)) return false;
    for (let y = localY; y < Math.min(ROWS_PER_PAGE, localY + item.h); y += 1) {
      for (let x = item.x; x < Math.min(COLS, item.x + item.w); x += 1) {
        const key = `${page}:${x}:${y}`;
        if (cells.has(key)) return false;
        cells.set(key, item.item_id);
      }
    }
  }

  for (const [page, pageItems] of pages) {
    const titleId = page === 0 ? "dashboard_title" : `dashboard_title_page_${page + 1}`;
    if (!pageItems.some((item) => item.kind === "title" && item.item_id === titleId)) return false;
    if (charts.length && page === 0 && !pageItems.some((item) => item.kind === "chart")) return false;
    const nonTitleKinds = new Set(pageItems.filter((item) => item.kind !== "title").map((item) => item.kind));
    if (page === 0 && nonTitleKinds.size && [...nonTitleKinds].every((kind) => kind === "insights" || kind === "filters")) return false;
    const pageKpis = pageItems.filter((item) => item.kind === "kpi");
    if (pageItems.some((item) => item.kind === "chart") && pageKpis.length) {
      const kpiLocalYs = new Set(pageKpis.map((item) => item.y % ROWS_PER_PAGE));
      const bandCoverage = pageKpis.filter((item) => item.y % ROWS_PER_PAGE === TITLE_ROWS).reduce((sum, item) => sum + item.w, 0);
      if (kpiLocalYs.size !== 1 || !kpiLocalYs.has(TITLE_ROWS) || bandCoverage < COLS) return false;
    }
    const filled = [...cells.keys()].filter((key) => key.startsWith(`${page}:`)).length;
    if (pageItems.some((item) => item.kind === "chart") && filled / (COLS * ROWS_PER_PAGE) < 0.78) return false;
    if (nonTitleKinds.size === 1 && nonTitleKinds.has("kpi") && filled / (COLS * ROWS_PER_PAGE) < 0.58) return false;
  }
  return true;
}

function packPaged(items: LayoutItem[], cols: number, rowsPerPage: number): LayoutItem[] {
  const placed: LayoutItem[] = [];
  // Priority order for packing: title first, KPIs in a band, then filters
  // (slicers), then charts, then insights panel. Filters land near the top
  // so users don't have to hunt for them after they scroll.
  const kindPriority = { title: -1, kpi: 0, filters: 1, chart: 2, insights: 3 } as const;
  const sorted = [...items].sort((a, b) => {
    const pageA = Math.floor(a.y / rowsPerPage);
    const pageB = Math.floor(b.y / rowsPerPage);
    if (pageA !== pageB) return pageA - pageB;
    const kind = (kindPriority[a.kind] ?? 4) - (kindPriority[b.kind] ?? 4);
    if (kind !== 0) return kind;
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return 0;
  });
  for (const item of sorted) {
    const w = Math.max(1, Math.min(cols, item.w));
    const h = Math.max(1, Math.min(rowsPerPage, item.h));
    let page = Math.max(0, Math.floor(item.y / rowsPerPage));
    let placedFlag = false;
    while (page < 64 && !placedFlag) {
      const pageStart = page * rowsPerPage;
      for (let local = 0; local <= rowsPerPage - h && !placedFlag; local += 1) {
        const yAbs = pageStart + local;
        for (let x = 0; x <= cols - w; x += 1) {
          if (!collides(placed, x, yAbs, w, h)) {
            placed.push({ item_id: item.item_id, kind: item.kind, x, y: yAbs, w, h });
            placedFlag = true;
            break;
          }
        }
      }
      page += 1;
    }
    if (!placedFlag) {
      const bottomPage =
        Math.ceil(placed.reduce((acc, other) => Math.max(acc, other.y + other.h), 0) / rowsPerPage) || 1;
      placed.push({ item_id: item.item_id, kind: item.kind, x: 0, y: bottomPage * rowsPerPage, w, h });
    }
  }
  return placed;
}

function derivePageNarrative(
  items: LayoutItem[],
  chartsById: Map<string, ChartResponse>,
  pageIndex: number,
  dashboardTitle: string,
): { title: string; objective: string } {
  const chartItems = items
    .filter((item) => item.kind === "chart")
    .map((item) => ({ item, chart: chartsById.get(item.item_id) }))
    .filter((entry): entry is { item: LayoutItem; chart: ChartResponse } => Boolean(entry.chart))
    .sort((a, b) => b.item.w * b.item.h - a.item.w * a.item.h);
  const hero = chartItems[0]?.chart;
  if (hero) {
    return {
      title: hero.title,
      objective: hero.explanation || `Objective: answer the page question with ${hero.title}.`,
    };
  }
  if (items.some((item) => item.kind === "kpi")) {
    return {
      title: "Executive KPI overview",
      objective: `Objective: summarize the headline metrics for ${dashboardTitle}.`,
    };
  }
  return {
    title: `Analysis focus ${pageIndex + 1}`,
    objective: `Objective: review the most relevant findings for ${dashboardTitle}.`,
  };
}

function sameLayout(a: LayoutItem[], b: LayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.item_id, item] as const));
  for (const item of a) {
    const other = byId.get(item.item_id);
    if (!other) return false;
    if (item.x !== other.x || item.y !== other.y || item.w !== other.w || item.h !== other.h) {
      return false;
    }
  }
  return true;
}

function collides(placed: LayoutItem[], x: number, y: number, w: number, h: number): boolean {
  for (const other of placed) {
    if (x + w <= other.x || other.x + other.w <= x) continue;
    if (y + h <= other.y || other.y + other.h <= y) continue;
    return true;
  }
  return false;
}

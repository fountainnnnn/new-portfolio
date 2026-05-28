"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, FileDown, LoaderCircle, Maximize2, Minimize2, RotateCcw } from "lucide-react";

import { BrandMark } from "@/components/app/BrandLogo";

import { DashboardRenderer } from "@/components/app/DashboardRenderer";
import { StudioChatPanel } from "@/components/app/StudioChatPanel";
import { ThemeInspector, type DashboardViewSettings } from "@/components/app/ThemeInspector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DashboardTheme, DashboardThemeId } from "@/lib/dashboard-themes";
import type { DashboardFilterRequest, DashboardResponse, DatasetProfile } from "@/types/api";

interface DashboardStudioProps {
  dashboard: DashboardResponse;
  datasetProfile?: DatasetProfile;
  error: string | null;
  isExporting: boolean;
  isRefining: boolean;
  selectedTheme: DashboardTheme;
  settings: DashboardViewSettings;
  onApplyTheme: () => void;
  onBackToBuilder: () => void;
  onDashboardChange?: (dashboard: DashboardResponse) => void;
  onExportPowerBI: () => void;
  onNewDashboard: () => void;
  onFilterChange: (filters: DashboardFilterRequest) => void;
  onFilterReset: () => void;
  onRefine: (prompt: string) => void;
  onSettingsChange: (settings: DashboardViewSettings) => void;
  onThemeChange: (themeId: DashboardThemeId) => void;
  preservePageOnDashboardChange?: boolean;
}

export function DashboardStudio({
  dashboard,
  datasetProfile,
  error,
  isExporting,
  isRefining,
  selectedTheme,
  settings,
  onApplyTheme,
  onBackToBuilder,
  onDashboardChange,
  onExportPowerBI,
  onNewDashboard,
  onFilterChange,
  onFilterReset,
  onRefine,
  onSettingsChange,
  onThemeChange,
  preservePageOnDashboardChange = false,
}: DashboardStudioProps) {
  const dashboardFrameRef = useRef<HTMLElement | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsPresenting(document.fullscreenElement === dashboardFrameRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function togglePresentationMode() {
    if (!dashboardFrameRef.current) {
      return;
    }

    if (document.fullscreenElement === dashboardFrameRef.current) {
      await document.exitFullscreen();
      return;
    }

    await dashboardFrameRef.current.requestFullscreen();
  }

  return (
    <main className="flex h-[calc(100vh-80px)] min-h-0 flex-col overflow-hidden bg-[#f6f8fb] text-[#141414]">
      <header className="sticky top-0 z-30 border-b border-[#dde4ef] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark size={32} />
            <div>
              <div className="text-sm font-semibold flex items-center gap-1.5">
                Decidr Studio <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-md bg-[#e7edff] text-[#275efe] select-none">by Mervin</span>
              </div>
              <div className="text-xs text-[#667085]">
                Dashboard theme: {selectedTheme.label} · {dashboard.charts.length} Plotly charts
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRefining ? (
              <div className="flex items-center gap-2 rounded-full bg-[#e7edff] px-3 py-1 text-xs text-[#275efe]">
                <LoaderCircle className="size-3.5 animate-spin" />
                Agent working
              </div>
            ) : null}
            <Button onClick={onBackToBuilder} variant="outline">
              <ArrowLeft data-icon="inline-start" />
              Chat
            </Button>
            <Button onClick={togglePresentationMode} variant="outline">
              <Maximize2 data-icon="inline-start" />
              Present
            </Button>
            <Button disabled={isExporting} onClick={onExportPowerBI} variant="outline">
              {isExporting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <FileDown data-icon="inline-start" />}
              Power BI export
            </Button>
            <Button onClick={onNewDashboard} variant="outline">
              <RotateCcw data-icon="inline-start" />
              New
            </Button>
          </div>
        </div>
      </header>

      {/* Main grid: uses the full viewport width (no max-w cap) and flips to the
          side-by-side layout at 1280px instead of 1700px so typical laptop
          screens stop wasting the right margin. The right column is slimmed to
          380px so the tweak chat is visible without starving the canvas. */}
      <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-3 overflow-auto px-3 py-3 min-[1280px]:grid-cols-[minmax(0,1fr)_380px] min-[1280px]:overflow-hidden">
        <section
          // overflow-hidden (not auto): presentation mode never scrolls, and in
          // windowed mode the canvas scales itself to fit via ResizeObserver so
          // there is nothing to scroll to anyway.
          className="autodash-present-surface relative min-h-[480px] min-w-0 max-w-full overflow-hidden px-0 py-2 sm:px-2 sm:py-2 min-[1280px]:min-h-0 min-[1280px]:px-3 min-[1280px]:py-3"
          ref={dashboardFrameRef}
          // Browsers render :fullscreen elements with a black background by default,
          // which is why presentation mode used to look like a dark void regardless of
          // the selected theme. Setting an inline background that matches the theme
          // keeps the canvas consistent in both windowed and fullscreen modes.
          style={{ background: selectedTheme.background, color: selectedTheme.text }}
        >
          {isPresenting ? (
            <div className="sticky top-4 z-40 flex justify-end px-4">
              <Button onClick={togglePresentationMode} variant="outline">
                <Minimize2 data-icon="inline-start" />
                Exit presentation
              </Button>
            </div>
          ) : null}
          <DashboardRenderer
            dashboard={dashboard}
            datasetProfile={datasetProfile}
            isFiltering={isRefining}
            onDashboardChange={onDashboardChange}
            onFilterChange={onFilterChange}
            onFilterReset={onFilterReset}
            preservePageOnDashboardChange={preservePageOnDashboardChange}
            settings={settings}
            theme={selectedTheme}
          />
        </section>
        <aside className="min-h-0 overflow-visible min-[1280px]:overflow-auto">
          <div className="flex flex-col gap-3">
            {/* Portal target: when the user picks a chart in edit mode, the
                DashboardRenderer renders its RightInspectorPanel HERE instead
                of beside the canvas, so the canvas stays full-width. */}
            <div id="autodash-inspector-slot" />
            <ThemeInspector
              isApplying={isRefining}
              onApplyTheme={onApplyTheme}
              onSettingsChange={onSettingsChange}
              onThemeChange={onThemeChange}
              selectedTheme={selectedTheme}
              settings={settings}
            />
            {error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{error.startsWith("Export failed") ? "Export failed" : "Tweak failed"}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <StudioChatPanel
              isRefining={isRefining}
              onRefine={onRefine}
              toolCalls={dashboard.tool_calls}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { Palette, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { dashboardThemeList, type DashboardTheme, type DashboardThemeId } from "@/lib/dashboard-themes";

export interface DashboardViewSettings {
  showInsights: boolean;
  showExplanations: boolean;
  compactCharts: boolean;
}

interface ThemeInspectorProps {
  selectedTheme: DashboardTheme;
  settings: DashboardViewSettings;
  isApplying: boolean;
  onApplyTheme: () => void;
  onSettingsChange: (settings: DashboardViewSettings) => void;
  onThemeChange: (themeId: DashboardThemeId) => void;
}

export function ThemeInspector({
  selectedTheme,
  settings,
  isApplying,
  onApplyTheme,
  onSettingsChange,
  onThemeChange,
}: ThemeInspectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-[#dde4ef] bg-white p-4 text-[#141414]">
        <div className="flex items-center gap-2">
          <Palette className="size-4" />
          <h2 className="text-sm font-semibold">Themes</h2>
        </div>
        <div className="mt-4 grid gap-2">
          {dashboardThemeList.map((theme) => (
            <button
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-transform hover:-translate-y-0.5"
              key={theme.id}
              onClick={() => onThemeChange(theme.id)}
              style={{
                background: selectedTheme.id === theme.id ? "#E7EDFF" : "#F8FAFC",
                borderColor: selectedTheme.id === theme.id ? "#275EFE" : "#DDE4EF",
              }}
              type="button"
            >
              <span className="flex shrink-0 gap-1">
                {(theme.colorway ?? []).slice(0, 4).map((color) => (
                  <span className="size-3 rounded-full" key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{theme.label}</span>
                <span className="block text-xs leading-5 text-[#667085]">
                  {theme.description}
                </span>
              </span>
            </button>
          ))}
        </div>
        <Button className="mt-4 w-full" disabled={isApplying} onClick={onApplyTheme}>
          <WandSparkles data-icon="inline-start" />
          Apply with agent
        </Button>
      </section>

      <section className="rounded-lg border border-[#dde4ef] bg-white p-4 text-[#141414]">
        <h2 className="text-sm font-semibold">
          View controls
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <SettingRow
            checked={settings.showExplanations}
            label="Chart explanations"
            onChange={(checked) => onSettingsChange({ ...settings, showExplanations: checked })}
          />
          <SettingRow
            checked={settings.showInsights}
            label="Insight panel"
            onChange={(checked) => onSettingsChange({ ...settings, showInsights: checked })}
          />
          <SettingRow
            checked={settings.compactCharts}
            label="Compact chart cards"
            onChange={(checked) => onSettingsChange({ ...settings, compactCharts: checked })}
          />
        </div>
      </section>
    </div>
  );
}

function SettingRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

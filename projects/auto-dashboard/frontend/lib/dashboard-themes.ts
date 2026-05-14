export type DashboardThemeId =
  | "executive_light"
  | "midnight"
  | "finance"
  | "editorial"
  | "neon"
  | "minimal";

export interface DashboardTheme {
  id: DashboardThemeId;
  label: string;
  description: string;
  background: string;
  panel: string;
  panelStrong: string;
  panelSoft: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  plotBackground: string;
  grid: string;
  colorway: string[];
  shadow: string;
  isDark: boolean;
}

export const dashboardThemes: Record<DashboardThemeId, DashboardTheme> = {
  executive_light: {
    id: "executive_light",
    label: "Executive Light",
    description: "Crisp boardroom dashboards with confident color.",
    background: "#F6F8FB",
    panel: "#FFFFFF",
    panelStrong: "#F9FAFC",
    panelSoft: "#EEF3FA",
    border: "#DDE4EF",
    text: "#141414",
    muted: "#667085",
    accent: "#275EFE",
    accentSoft: "#E7EDFF",
    plotBackground: "rgba(255,255,255,0.88)",
    grid: "#E8EDF5",
    colorway: ["#275EFE", "#10A37F", "#E7A321", "#D64545", "#7C3AED", "#0E7490"],
    shadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
    isDark: false,
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    description: "Command center contrast for deep analysis sessions.",
    background: "#070B14",
    panel: "#0D1324",
    panelStrong: "#111A30",
    panelSoft: "#151F38",
    border: "#24304A",
    text: "#E8EEF9",
    muted: "#9AA8BF",
    accent: "#8AB4FF",
    accentSoft: "#172A4D",
    plotBackground: "rgba(10,15,28,0.78)",
    grid: "rgba(232,238,249,0.12)",
    colorway: ["#8AB4FF", "#7CF6C3", "#F6C177", "#F7768E", "#BB9AF7", "#7DCFFF"],
    shadow: "0 26px 80px rgba(0, 0, 0, 0.36)",
    isDark: true,
  },
  finance: {
    id: "finance",
    label: "Finance",
    description: "Measured, polished, and restrained for metric reviews.",
    background: "#F4F7F3",
    panel: "#FBFCF8",
    panelStrong: "#FFFFFF",
    panelSoft: "#EAF1EB",
    border: "#D9E5DB",
    text: "#18211F",
    muted: "#647067",
    accent: "#0F766E",
    accentSoft: "#DDF3EE",
    plotBackground: "rgba(248,250,247,0.88)",
    grid: "#E3ECE7",
    colorway: ["#0F766E", "#C0841A", "#334155", "#2563EB", "#9333EA", "#DC2626"],
    shadow: "0 22px 64px rgba(24, 33, 31, 0.10)",
    isDark: false,
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    description: "Publication-style hierarchy for narrative dashboards.",
    background: "#F7F3EC",
    panel: "#FEFCF8",
    panelStrong: "#FFFFFF",
    panelSoft: "#EFE7DA",
    border: "#DDD2C1",
    text: "#161616",
    muted: "#6B6B6B",
    accent: "#B45309",
    accentSoft: "#F7E3C2",
    plotBackground: "rgba(253,251,247,0.92)",
    grid: "#EAE4DA",
    colorway: ["#111827", "#B45309", "#0F766E", "#BE123C", "#4F46E5", "#6B7280"],
    shadow: "0 24px 62px rgba(89, 64, 34, 0.12)",
    isDark: false,
  },
  neon: {
    id: "neon",
    label: "Neon",
    description: "High-energy presentation mode for bold demos.",
    background: "#040810",
    panel: "#08111F",
    panelStrong: "#0C1729",
    panelSoft: "#111E33",
    border: "#18324C",
    text: "#F4FBFF",
    muted: "#A6B7C8",
    accent: "#00E5FF",
    accentSoft: "#082F40",
    plotBackground: "rgba(4,9,18,0.86)",
    grid: "rgba(0,229,255,0.16)",
    colorway: ["#00E5FF", "#B8FF4D", "#FF4DD8", "#FFD166", "#7C4DFF", "#FF6B6B"],
    shadow: "0 30px 90px rgba(0, 229, 255, 0.12)",
    isDark: true,
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    description: "Quiet grayscale for analysis that should disappear.",
    background: "#F5F5F5",
    panel: "#FEFEFE",
    panelStrong: "#FFFFFF",
    panelSoft: "#ECECEC",
    border: "#DDDDDF",
    text: "#18181B",
    muted: "#71717A",
    accent: "#18181B",
    accentSoft: "#E4E4E7",
    plotBackground: "rgba(250,250,250,0.94)",
    grid: "#ECECEF",
    colorway: ["#52525B", "#18181B", "#71717A", "#A1A1AA", "#3F3F46", "#D4D4D8"],
    shadow: "0 18px 52px rgba(24, 24, 27, 0.08)",
    isDark: false,
  },
};

export const dashboardThemeList = Object.values(dashboardThemes);

export function resolveDashboardTheme(themeId: string | undefined): DashboardTheme {
  if (themeId && themeId in dashboardThemes) {
    return dashboardThemes[themeId as DashboardThemeId];
  }
  return dashboardThemes.executive_light;
}

"use client";

import { useEffect, useRef, useState } from "react";

import { BuilderChatPage } from "@/components/app/BuilderChatPage";
import { AgentActivityToast } from "@/components/app/AgentActivityToast";
import { ChatHistorySidebar, type ChatHistoryItem } from "@/components/app/ChatHistorySidebar";
import { DashboardStudio } from "@/components/app/DashboardStudio";
import type { DashboardViewSettings } from "@/components/app/ThemeInspector";
import { ApiError, deleteChatSession, exportPowerBIBundle, filterDashboard, generateDashboard, listChatSessions, refineDashboard, saveChatSession, uploadDataset } from "@/lib/api";
import { dashboardThemes, resolveDashboardTheme, type DashboardThemeId } from "@/lib/dashboard-themes";
import type { ChatSessionRequest, ChatSessionResponse, DashboardFilterRequest, DashboardResponse, DatasetProfile, DatasetUploadResponse } from "@/types/api";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  dataset: DatasetUploadResponse | null;
  dashboard: DashboardResponse | null;
  prompt: string;
  messages: ChatMessage[];
  selectedThemeId: DashboardThemeId;
  settings: DashboardViewSettings;
  updatedAt: number;
}

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Upload a CSV and tell me the business question. I will profile the data, plan useful charts, validate the columns, and render an interactive dashboard.",
  },
];

const defaultPrompt = "Analyze this dataset and build the best dashboard.";
const defaultSettings: DashboardViewSettings = {
  showInsights: true,
  showExplanations: true,
  compactCharts: false,
};

const initialSession: ChatSession = {
  id: "chat_1",
  title: "New dashboard chat",
  dataset: null,
  dashboard: null,
  prompt: defaultPrompt,
  messages: initialMessages,
  selectedThemeId: "executive_light",
  settings: defaultSettings,
  updatedAt: 0,
};

export function AppShell() {
  const [sessions, setSessions] = useState<ChatSession[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState(initialSession.id);
  const [dataset, setDataset] = useState<DatasetUploadResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isFilteringDashboard, setIsFilteringDashboard] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<DashboardThemeId>("executive_light");
  const [settings, setSettings] = useState<DashboardViewSettings>(defaultSettings);

  const profile: DatasetProfile | null = dataset?.profile ?? null;
  const selectedTheme = resolveDashboardTheme(selectedThemeId);
  const historyItems = sessions.map(toHistoryItem);

  // Tracks whether the user has already started interacting (uploading a file,
  // etc.) so that the async `loadPersistedSessions` does NOT overwrite their
  // in-progress state when it resolves after the upload completes.
  const hasInteracted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedSessions() {
      try {
        const persisted = await listChatSessions();
        if (cancelled) {
          return;
        }

        // A page refresh should always drop the user into a fresh conversation
        // - previously we auto-activated the most recent persisted session,
        // which meant reloading the tab immediately showed the old dashboard.
        // Keep the historical sessions visible in the sidebar so the user can
        // click back into them, but start in a blank chat.
        const restored = persisted.map(fromPersistedSession);
        const blank = createBlankSession();
        setSessions(restored.length ? [blank, ...restored] : [blank]);

        // Only activate the blank session if the user hasn't already started
        // uploading a file. If they have, activating "blank" would reset their
        // dataset back to null and clear the profile card.
        if (!hasInteracted.current) {
          activateSession(blank);
        }
        // Deliberately do NOT persist the blank session here - it would clutter
        // the sidebar with an empty chat on every refresh. It will be persisted
        // as soon as the user actually does something in it (upload / prompt).
      } catch {
        return;
      }
    }

    void loadPersistedSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateActiveSession(update: Partial<ChatSession>) {
    const currentSession = sessions.find((session) => session.id === activeSessionId);
    if (!currentSession) {
      return;
    }

    const nextSession = {
      ...currentSession,
      ...update,
      updatedAt: Date.now(),
    };
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? nextSession : session)));
    persistSession(nextSession);
  }

  function activateSession(session: ChatSession) {
    setActiveSessionId(session.id);
    setDataset(session.dataset);
    setDashboard(session.dashboard);
    setPrompt(session.prompt);
    setMessages(session.messages);
    setError(null);
    setIsRefining(false);
    setIsExporting(false);
    setSelectedThemeId(session.selectedThemeId);
    setSettings(session.settings);
  }

  function handlePromptChange(value: string) {
    setPrompt(value);
    updateActiveSession({ prompt: value });
  }

  async function handleUpload(file: File) {
    // Mark as interacted immediately so loadPersistedSessions won't overwrite
    // our state when it resolves after this async upload completes.
    hasInteracted.current = true;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setDashboard(null);

    try {
      const uploaded = await uploadDataset(file);
      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: `Uploaded ${uploaded.filename}` },
        {
          role: "assistant",
          content: `Profile complete: ${uploaded.profile.row_count.toLocaleString()} rows, ${uploaded.profile.column_count.toLocaleString()} columns, ${uploaded.profile.numeric_columns.length} numeric fields, and ${uploaded.profile.datetime_columns.length} date fields detected.`,
        },
      ];
      setDataset(uploaded);
      setMessages(nextMessages);
      updateActiveSession({
        dataset: uploaded,
        dashboard: null,
        messages: nextMessages,
        title: uploaded.filename.replace(/\.csv$/i, ""),
      });
    } catch (caught) {
      setError(errorMessage(caught, "Could not upload or profile that CSV."));
    } finally {
      setIsUploading(false);
    }
  }


  async function handleGenerate() {
    if (!dataset) {
      setError("Upload a dataset before generating a dashboard.");
      return;
    }
    if (!prompt.trim()) {
      setError("Describe the dashboard you want to generate.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setDashboard(null);
    const pendingMessages: ChatMessage[] = [...messages, { role: "user", content: prompt.trim() }];
    setMessages(pendingMessages);
    updateActiveSession({ messages: pendingMessages, dashboard: null, prompt });

    try {
      const generated = await generateDashboard(dataset.dataset_id, prompt.trim(), selectedThemeId);
      const nextMessages: ChatMessage[] = [
        ...pendingMessages,
        {
          role: "assistant",
          content: `Generated "${generated.title}" with ${generated.kpis.length} KPIs, ${generated.charts.length} charts, ${generated.insights.length} insights, and ${generated.layout.page_titles?.length ?? 1} focused page objective(s).`,
        },
      ];
      setDashboard(generated);
      setMessages(nextMessages);
      updateActiveSession({
        dashboard: generated,
        messages: nextMessages,
        title: generated.title,
        selectedThemeId,
      });
    } catch (caught) {
      setError(errorMessage(caught, "Could not generate the dashboard."));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefine(refinePrompt: string) {
    if (!dashboard) {
      return;
    }

    setIsRefining(true);
    setError(null);
    try {
      const refined = await refineDashboard(dashboard.dashboard_id, refinePrompt, selectedThemeId);
      const refinedThemeId = coerceThemeId(refined.theme, selectedThemeId);
      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: refinePrompt },
        {
          role: "assistant",
          content: summarizeDashboardChange(dashboard, refined, refinePrompt),
        },
      ];
      setDashboard(refined);
      setSelectedThemeId(refinedThemeId);
      setMessages(nextMessages);
      updateActiveSession({
        dashboard: refined,
        messages: nextMessages,
        title: refined.title,
        selectedThemeId: refinedThemeId,
      });
    } catch (caught) {
      setError(errorMessage(caught, "Could not refine the dashboard."));
    } finally {
      setIsRefining(false);
    }
  }

  async function handleFilterChange(filters: DashboardFilterRequest) {
    if (!dashboard) {
      return;
    }

    const previousDashboard = dashboard;
    setDashboard({ ...dashboard, active_filters: filters });
    setIsFilteringDashboard(true);
    setIsRefining(true);
    setError(null);
    try {
      const filtered = await filterDashboard(dashboard.dashboard_id, filters);
      setDashboard(filtered);
      updateActiveSession({ dashboard: filtered });
    } catch (caught) {
      setDashboard(previousDashboard);
      setError(errorMessage(caught, "Could not filter the dashboard."));
    } finally {
      setIsRefining(false);
      window.setTimeout(() => setIsFilteringDashboard(false), 0);
    }
  }

  async function handleFilterReset() {
    await handleFilterChange({ categorical_filters: {}, date_filters: {} });
  }

  async function handleApplyTheme() {
    if (!dashboard) {
      return;
    }
    await handleRefine(`Restyle the existing dashboard using the ${dashboardThemes[selectedThemeId].label} theme. Keep the chart choices unless a theme-specific improvement is needed.`);
  }

  async function handleExportPowerBI() {
    if (!dashboard) {
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const bundle = await exportPowerBIBundle(dashboard.dashboard_id);
      const url = URL.createObjectURL(bundle.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = bundle.filename ?? `${slugify(dashboard.title)}.pbit`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(`Export failed: ${errorMessage(caught, "Could not export the Power BI bundle.")}`);
    } finally {
      setIsExporting(false);
    }
  }

  function handleNewDashboard() {
    const nextSession = createBlankSession();
    setSessions((current) => [nextSession, ...current]);
    activateSession(nextSession);
    persistSession(nextSession);
  }

  function handleSelectChat(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    activateSession(session);
  }

  function handleDeleteChat(sessionId: string) {
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    const replacement = nextSessions[0] ?? createBlankSession();
    setSessions(nextSessions.length ? nextSessions : [replacement]);
    if (sessionId === activeSessionId) {
      activateSession(replacement);
      if (!nextSessions.length) {
        persistSession(replacement);
      }
    }
    void deleteChatSession(sessionId).catch((caught) => {
      setError(errorMessage(caught, "Could not delete this chat session."));
    });
  }

  function handleThemeChange(themeId: DashboardThemeId) {
    setSelectedThemeId(themeId);
    updateActiveSession({ selectedThemeId: themeId });
  }

  function handleSettingsChange(nextSettings: DashboardViewSettings) {
    setSettings(nextSettings);
    updateActiveSession({ settings: nextSettings });
  }

  if (dashboard) {
    return (
      <div className="flex h-[calc(100vh-80px)] overflow-hidden">
        <AgentActivityToast isVisible={isRefining} mode="refine" />
        <ChatHistorySidebar
          activeSessionId={activeSessionId}
          items={historyItems}
          onDeleteChat={handleDeleteChat}
          onNewChat={handleNewDashboard}
          onSelectChat={handleSelectChat}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <DashboardStudio
            dashboard={dashboard}
            datasetProfile={dataset?.profile}
            error={error}
            isExporting={isExporting}
            isRefining={isRefining}
            onApplyTheme={handleApplyTheme}
            onBackToBuilder={() => {
              setDashboard(null);
            }}
            onDashboardChange={(next) => {
              setDashboard(next);
              updateActiveSession({ dashboard: next });
            }}
            onExportPowerBI={handleExportPowerBI}
            onFilterChange={handleFilterChange}
            onFilterReset={handleFilterReset}
            onNewDashboard={handleNewDashboard}
            onRefine={handleRefine}
            onSettingsChange={handleSettingsChange}
            onThemeChange={handleThemeChange}
            preservePageOnDashboardChange={isFilteringDashboard}
            selectedTheme={selectedTheme}
            settings={settings}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      <AgentActivityToast isVisible={isGenerating} mode="generate" />
      <ChatHistorySidebar
        activeSessionId={activeSessionId}
        items={historyItems}
        onDeleteChat={handleDeleteChat}
        onNewChat={handleNewDashboard}
        onSelectChat={handleSelectChat}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <BuilderChatPage
          datasetProfile={profile}
          error={error}
          filename={dataset?.filename}
          isGenerating={isGenerating}
          isUploading={isUploading}
          messages={messages}
          onGenerate={handleGenerate}
          onPromptChange={handlePromptChange}
          onUpload={handleUpload}
          prompt={prompt}
        />
      </div>
    </div>
  );
}

function createBlankSession(): ChatSession {
  return {
    ...initialSession,
    id: `chat_${Date.now()}`,
    messages: [...initialMessages],
    settings: { ...defaultSettings },
    updatedAt: Date.now(),
  };
}

function toHistoryItem(session: ChatSession): ChatHistoryItem {
  return {
    id: session.id,
    title: session.title,
    subtitle: session.dashboard
      ? `${session.dashboard.charts.length} charts generated`
      : session.dataset
        ? `${session.dataset.profile.row_count.toLocaleString()} rows uploaded`
        : "No dataset yet",
    updatedLabel: session.updatedAt ? "Updated recently" : "Ready to start",
    hasDashboard: Boolean(session.dashboard),
  };
}

function persistSession(session: ChatSession) {
  void saveChatSession(toPersistedSession(session)).catch(() => undefined);
}

function toPersistedSession(session: ChatSession): ChatSessionRequest {
  return {
    session_id: session.id,
    title: session.title,
    dataset: session.dataset,
    dashboard: session.dashboard,
    prompt: session.prompt,
    messages: session.messages,
    selected_theme_id: session.selectedThemeId,
    settings: { ...session.settings },
    updated_at: session.updatedAt,
    created_at: null,
  };
}

function fromPersistedSession(session: ChatSessionResponse): ChatSession {
  return {
    id: session.session_id,
    title: session.title,
    dataset: session.dataset,
    dashboard: session.dashboard,
    prompt: session.prompt || defaultPrompt,
    messages: session.messages.length ? session.messages : initialMessages,
    selectedThemeId: coerceThemeId(session.selected_theme_id, "executive_light"),
    settings: {
      ...defaultSettings,
      ...(session.settings as Partial<DashboardViewSettings>),
    },
    updatedAt: session.updated_at ?? Date.now(),
  };
}

function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    return caught.message;
  }
  if (caught instanceof TypeError) {
    return "Could not reach the Decidr backend. Make sure the Auto Dashboard API service is running.";
  }
  if (caught instanceof Error) {
    return caught.message;
  }
  return fallback;
}

function summarizeDashboardChange(before: DashboardResponse, after: DashboardResponse, prompt: string): string {
  const changes: string[] = [];
  const chartDelta = after.charts.length - before.charts.length;
  const kpiDelta = after.kpis.length - before.kpis.length;
  const insightDelta = after.insights.length - before.insights.length;
  if (chartDelta > 0) changes.push(`added ${chartDelta} chart${chartDelta === 1 ? "" : "s"}`);
  if (chartDelta < 0) changes.push(`removed ${Math.abs(chartDelta)} chart${chartDelta === -1 ? "" : "s"}`);
  if (kpiDelta > 0) changes.push(`added ${kpiDelta} KPI${kpiDelta === 1 ? "" : "s"}`);
  if (kpiDelta < 0) changes.push(`removed ${Math.abs(kpiDelta)} KPI${kpiDelta === -1 ? "" : "s"}`);
  if (insightDelta > 0) changes.push(`added ${insightDelta} insight${insightDelta === 1 ? "" : "s"}`);
  if (insightDelta < 0) changes.push(`removed ${Math.abs(insightDelta)} insight${insightDelta === -1 ? "" : "s"}`);
  if (after.insights.slice(0, 3).join("\n") !== before.insights.slice(0, 3).join("\n")) {
    changes.push("updated the visible insight cards");
  }
  const beforeTitles = new Set(before.charts.map((chart) => `${chart.chart_id}:${chart.title}`));
  const renamed = after.charts.filter((chart) => !beforeTitles.has(`${chart.chart_id}:${chart.title}`));
  if (renamed.length) changes.push(`updated ${renamed.length} chart title/type/configuration${renamed.length === 1 ? "" : "s"}`);
  if (after.theme !== before.theme) changes.push(`changed theme to ${after.theme.replaceAll("_", " ")}`);
  const pageDelta = (after.layout.page_titles?.length ?? 1) - (before.layout.page_titles?.length ?? 1);
  if (pageDelta !== 0) changes.push(`${pageDelta > 0 ? "added" : "removed"} ${Math.abs(pageDelta)} focused page${Math.abs(pageDelta) === 1 ? "" : "s"}`);
  const latestTool = after.tool_calls.at(-1)?.summary;
  const summary = changes.length ? changes.join(", ") : latestTool || "refreshed the dashboard plan, layout, and styling";
  return `Applied tweak: "${prompt}". Visible result: ${summary}.`;
}

function coerceThemeId(theme: string, fallback: DashboardThemeId): DashboardThemeId {
  return theme in dashboardThemes ? (theme as DashboardThemeId) : fallback;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "autodash-dashboard";
}

import type {
  AiPatchResponse,
  ChartSpec,
  ChartUpdateRequest,
  ChatSessionRequest,
  ChatSessionResponse,
  DashboardLayout,
  DashboardResponse,
  DashboardFilterRequest,
  DashboardSpec,
  DatasetProfile,
  DatasetRowsResponse,
  DatasetUploadResponse,
  GenerateDashboardRequest,
  RefineDashboardRequest,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Something went wrong while contacting Decidr.";
    try {
      const payload = (await response.json()) as { detail?: string };
      message = payload.detail ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export async function uploadDataset(file: File): Promise<DatasetUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  return parseResponse<DatasetUploadResponse>(response);
}

export async function getDatasetProfile(datasetId: string): Promise<DatasetProfile> {
  const response = await fetch(`${API_BASE_URL}/dataset/${datasetId}/profile`);
  return parseResponse<DatasetProfile>(response);
}

export async function listChatSessions(): Promise<ChatSessionResponse[]> {
  const response = await fetch(`${API_BASE_URL}/chat-sessions`);
  return parseResponse<ChatSessionResponse[]>(response);
}

export async function saveChatSession(session: ChatSessionRequest): Promise<ChatSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/chat-sessions/${session.session_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(session),
  });
  return parseResponse<ChatSessionResponse>(response);
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/chat-sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    let message = "Could not delete this chat session.";
    try {
      const payload = (await response.json()) as { detail?: string };
      message = payload.detail ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }
}

export async function generateDashboard(
  datasetId: string,
  prompt: string,
  theme = "executive_light",
): Promise<DashboardResponse> {
  const body: GenerateDashboardRequest = {
    dataset_id: datasetId,
    user_prompt: prompt,
    theme,
  };

  const response = await fetch(`${API_BASE_URL}/dashboard/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseResponse<DashboardResponse>(response);
}

export async function refineDashboard(
  dashboardId: string,
  prompt: string,
  theme?: string,
): Promise<DashboardResponse> {
  const body: RefineDashboardRequest = {
    dashboard_id: dashboardId,
    user_prompt: prompt,
    theme,
  };

  const response = await fetch(`${API_BASE_URL}/dashboard/refine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseResponse<DashboardResponse>(response);
}

export async function filterDashboard(
  dashboardId: string,
  filters: DashboardFilterRequest,
): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}/filter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
  });
  return parseResponse<DashboardResponse>(response);
}

export async function getDashboard(dashboardId: string): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}`);
  return parseResponse<DashboardResponse>(response);
}

export async function updateDashboardLayout(
  dashboardId: string,
  layout: DashboardLayout,
): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout }),
  });
  return parseResponse<DashboardResponse>(response);
}

export async function updateDashboardChart(
  dashboardId: string,
  chartId: string,
  updates: ChartUpdateRequest,
): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}/chart/${chartId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return parseResponse<DashboardResponse>(response);
}

export async function updateChartSpec(
  dashboardId: string,
  chartId: string,
  spec: ChartSpec,
): Promise<DashboardResponse> {
  const response = await fetch(
    `${API_BASE_URL}/dashboard/${dashboardId}/chart/${chartId}/spec`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
    },
  );
  return parseResponse<DashboardResponse>(response);
}

export async function updateDashboardSpec(
  dashboardId: string,
  spec: DashboardSpec,
): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}/spec`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec }),
  });
  return parseResponse<DashboardResponse>(response);
}

export async function getDatasetRows(
  datasetId: string,
  limit?: number,
): Promise<DatasetRowsResponse> {
  const url = new URL(`${API_BASE_URL}/dataset/${datasetId}/rows`);
  if (typeof limit === "number") url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString());
  return parseResponse<DatasetRowsResponse>(response);
}

export async function aiPatchDashboard(
  dashboardId: string,
  instruction: string,
  selectedChartId?: string | null,
): Promise<AiPatchResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}/ai-patch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, selected_chart_id: selectedChartId ?? null }),
  });
  return parseResponse<AiPatchResponse>(response);
}

export async function exportPowerBIBundle(dashboardId: string): Promise<{ blob: Blob; filename: string | null }> {
  let response = await fetch(`${API_BASE_URL}/powerbi/export/${dashboardId}`);
  if (response.status === 404) {
    response = await fetch(`${API_BASE_URL}/dashboard/${dashboardId}/powerbi/export`);
  }
  if (!response.ok) {
    let message = "Could not export the Power BI bundle.";
    try {
      const payload = (await response.json()) as { detail?: string };
      message = payload.detail ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }
  return {
    blob: await response.blob(),
    filename: filenameFromContentDisposition(response.headers.get("content-disposition")),
  };
}

function filenameFromContentDisposition(contentDisposition: string | null): string | null {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

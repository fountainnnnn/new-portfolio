export type SupportedChartType =
  | "bar"
  | "grouped_bar"
  | "line"
  | "scatter"
  | "histogram"
  | "box"
  | "pie"
  | "correlation_heatmap"
  | "kpi"
  | "table"
  | "treemap"
  | "stacked_bar"
  | "area"
  | "heatmap";

export type ColumnRole =
  | "metric"
  | "rate_metric"
  | "time"
  | "identifier"
  | "excluded"
  | "measure"
  | "dimension"
  | "datetime"
  | "id"
  | "text"
  | "geo"
  | "boolean";

export interface ColumnProfile {
  name: string;
  dtype: string;
  inferred_type: "numeric" | "datetime" | "categorical" | "text" | string;
  missing_count: number;
  missing_percent: number;
  unique_count: number;
  examples: unknown[];
  role?: ColumnRole | null;
  semantic_type?: string | null;
  business_meaning?: string | null;
  default_aggregation?: string | null;
  aliases?: string[];
  confidence?: number;
}

export interface DatasetProfile {
  row_count: number;
  column_count: number;
  column_names: string[];
  columns: ColumnProfile[];
  dtypes: Record<string, string>;
  missing_values: Record<string, number>;
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  possible_date_columns: string[];
  possible_metric_columns: string[];
  numeric_summaries: Record<string, Record<string, number | null>>;
  categorical_summaries: Record<string, { unique_count: number; top_values: { value: string; count: number }[] }>;
  sample_rows: Record<string, unknown>[];
  data_quality?: Record<string, unknown>;
  metric_candidates?: string[];
  rate_metric_candidates?: string[];
  dimension_candidates?: string[];
  time_candidates?: string[];
  identifier_candidates?: string[];
  excluded_columns?: string[];
  top_correlations?: Record<string, unknown>[];
  time_series?: Record<string, unknown>[];
  possible_row_grain?: string;
  possible_relationships?: Record<string, unknown>[];
}

export interface DatasetUploadResponse {
  dataset_id: string;
  filename: string;
  profile: DatasetProfile;
}

export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export interface ChatSessionResponse {
  session_id: string;
  title: string;
  dataset: DatasetUploadResponse | null;
  dashboard: DashboardResponse | null;
  prompt: string;
  messages: ChatMessage[];
  selected_theme_id: string;
  settings: Record<string, unknown>;
  updated_at?: number | null;
  created_at?: string | null;
}

export type ChatSessionRequest = ChatSessionResponse;

export interface GenerateDashboardRequest {
  dataset_id: string;
  user_prompt: string;
  theme?: string;
}

export interface RefineDashboardRequest {
  dashboard_id: string;
  user_prompt: string;
  theme?: string;
}

export interface DashboardFilterOption {
  label: string;
  value: string;
  count?: number | null;
}

export type DashboardControlType = "category" | "date_range";

export interface DashboardFilterControl {
  control_id: string;
  label: string;
  column: string;
  control_type: DashboardControlType;
  options: DashboardFilterOption[];
  min_value?: string | null;
  max_value?: string | null;
}

export interface DashboardDateFilter {
  start?: string | null;
  end?: string | null;
}

export interface DashboardFilterRequest {
  categorical_filters: Record<string, string>;
  date_filters: Record<string, DashboardDateFilter>;
}

export interface KpiCardResponse {
  kpi_id: string;
  title: string;
  value: unknown;
  formatted_value: string;
  aggregation: string;
  column: string | null;
  explanation: string;
}

export interface AgentToolCall {
  tool_name: string;
  status: string;
  summary: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface ChartResponse {
  chart_id: string;
  title: string;
  chart_type: SupportedChartType;
  plotly_json: {
    data?: unknown[];
    layout?: Record<string, unknown>;
    frames?: unknown[];
  };
  plotly_code: string;
  explanation: string;
  /** Canonical chart spec. The frontend prefers rendering from this. */
  spec?: ChartSpec | null;
}

export type LayoutKind = "chart" | "kpi" | "insights" | "filters" | "title";

export interface LayoutItem {
  item_id: string;
  kind: LayoutKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardLayout {
  cols: number;
  row_height: number;
  rows_per_page?: number;
  items: LayoutItem[];
  /** Optional per-page human title. Index = page number. */
  page_titles?: string[];
}

export interface DashboardResponse {
  dashboard_id: string;
  dataset_id: string;
  theme: string;
  title: string;
  description: string;
  kpis: KpiCardResponse[];
  charts: ChartResponse[];
  insights: string[];
  dashboard_code: string;
  tool_calls: AgentToolCall[];
  controls: DashboardFilterControl[];
  active_filters: DashboardFilterRequest;
  filtered_row_count?: number | null;
  total_row_count?: number | null;
  layout: DashboardLayout;
  /** Canonical spec-driven view of the dashboard. */
  spec?: DashboardSpec | null;
}

export interface ChartUpdateRequest {
  title?: string;
  chart_type?: SupportedChartType;
  x_column?: string;
  y_column?: string;
  color_column?: string | null;
  aggregation?: string | null;
  explanation?: string;
  color_override?: string;
}

// ---- Spec-driven dashboard model ----------------------------------------------
// DashboardSpec is the source of truth. The browser renders charts from it.

export type DataQueryAggregation =
  | "sum"
  | "avg"
  | "mean"
  | "median"
  | "min"
  | "max"
  | "count"
  | "unique_count"
  | "none";

export type DataQueryFilterOp =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "between"
  | "gte"
  | "lte"
  | "contains";

export type DataQuerySort = "asc" | "desc" | "none";

export type NumberFormat = "auto" | "number" | "currency" | "percent" | "compact";

export interface DataQueryFilter {
  field: string;
  op: DataQueryFilterOp;
  value: unknown;
}

export interface DataQuery {
  x?: string | null;
  y?: string | null;
  aggregation?: DataQueryAggregation | null;
  group_by?: string | null;
  filters?: DataQueryFilter[];
  sort?: DataQuerySort;
  limit?: number | null;
  calculation?: string | null;
}

export interface ChartEncoding {
  x_label?: string | null;
  y_label?: string | null;
  color_by?: string | null;
  color_palette?: string[] | null;
}

export interface ChartStyle {
  show_legend?: boolean;
  show_grid?: boolean;
  number_format?: NumberFormat;
  height?: number | null;
  color_override?: string | null;
}

export interface ChartSpec {
  chart_id: string;
  title: string;
  chart_type: SupportedChartType;
  intent?: string;
  data_query: DataQuery;
  encoding: ChartEncoding;
  style: ChartStyle;
  explanation?: string;
}

export interface ThemeConfig {
  template?: string;
  font?: string;
  background?: string;
  accent?: string | null;
}

export interface GlobalFilter {
  id: string;
  field: string;
  type: "multi_select" | "single_select" | "date_range" | "numeric_range";
  label: string;
  default_value?: unknown;
}

export interface DashboardSpec {
  dashboard_title: string;
  description?: string;
  theme: ThemeConfig;
  global_filters?: GlobalFilter[];
  charts: ChartSpec[];
  layout: DashboardLayout;
}

export interface DatasetRowsResponse {
  dataset_id: string;
  row_count: number;
  returned: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

export type AiPatchOperationKind =
  | "create_dashboard"
  | "add_chart"
  | "update_chart"
  | "remove_chart"
  | "update_theme"
  | "explain_dashboard"
  | "suggest_improvements";

export interface AiPatchOperation {
  operation: AiPatchOperationKind;
  chart_id?: string | null;
  patch?: Record<string, unknown> | null;
  chart?: ChartSpec | null;
  theme?: ThemeConfig | null;
  spec?: DashboardSpec | null;
  summary?: string;
}

export interface AiPatchResponse {
  operation: AiPatchOperation;
  dashboard: DashboardResponse;
}

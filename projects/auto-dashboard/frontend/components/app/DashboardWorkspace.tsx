import { Badge } from "@/components/ui/badge";
import { DashboardRenderer } from "@/components/app/DashboardRenderer";
import { EmptyState } from "@/components/app/EmptyState";
import { LoadingState } from "@/components/app/LoadingState";
import type { DashboardResponse, DatasetProfile } from "@/types/api";

interface DashboardWorkspaceProps {
  dashboard: DashboardResponse | null;
  profile: DatasetProfile | null;
  isGenerating: boolean;
}

export function DashboardWorkspace({ dashboard, profile, isGenerating }: DashboardWorkspaceProps) {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Dashboard workspace</span>
          <span className="text-sm text-muted-foreground">
            Interactive Plotly charts, KPI cards, data profile, and AI-generated insights.
          </span>
        </div>
        {profile ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.row_count.toLocaleString()} rows</Badge>
            <Badge variant="secondary">{profile.column_count.toLocaleString()} columns</Badge>
            <Badge variant="secondary">{profile.numeric_columns.length} metrics</Badge>
            <Badge variant="secondary">{profile.datetime_columns.length} date fields</Badge>
          </div>
        ) : null}
      </div>

      {isGenerating ? <LoadingState label="Planning dashboard, validating columns, and building Plotly specs..." /> : null}

      {!isGenerating && dashboard ? <DashboardRenderer dashboard={dashboard} /> : null}

      {!isGenerating && !dashboard ? (
        <EmptyState
          description="Upload a CSV, review the profile, and ask Decidr to assemble the first dashboard."
          title="No dashboard generated yet"
        />
      ) : null}
    </main>
  );
}

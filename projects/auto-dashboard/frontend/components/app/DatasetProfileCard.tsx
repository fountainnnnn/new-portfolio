import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatasetProfile } from "@/types/api";

interface DatasetProfileCardProps {
  profile: DatasetProfile | null;
  filename?: string;
}

export function DatasetProfileCard({ profile, filename }: DatasetProfileCardProps) {
  if (!profile) {
    return null;
  }

  const missingColumns = profile.columns.filter((column) => column.missing_count > 0).length;

  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>{filename ?? "Uploaded dataset"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <ProfileMetric label="Rows" value={profile.row_count.toLocaleString()} />
          <ProfileMetric label="Columns" value={profile.column_count.toLocaleString()} />
          <ProfileMetric label="Missing" value={missingColumns.toLocaleString()} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">Detected types</span>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.numeric_columns.length} numeric</Badge>
            <Badge variant="secondary">{profile.categorical_columns.length} categorical</Badge>
            <Badge variant="secondary">{profile.datetime_columns.length} dates</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">Columns</span>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-auto pr-1">
            {profile.columns.map((column) => (
              <Badge key={column.name} variant="outline">
                {column.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="text-base font-semibold leading-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

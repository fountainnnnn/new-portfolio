import { BarChart3, FileSpreadsheet } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  variant?: "upload" | "dashboard";
  className?: string;
}

export function EmptyState({ title, description, variant = "dashboard", className }: EmptyStateProps) {
  const Icon = variant === "upload" ? FileSpreadsheet : BarChart3;

  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card p-8 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

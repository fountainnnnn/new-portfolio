"use client";

import { LoaderCircle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  label: string;
  progress?: number;
}

export function LoadingState({ label, progress = 65 }: LoadingStateProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        <span>{label}</span>
      </div>
      <Progress value={progress} />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}

"use client";

import { AlertCircle, LoaderCircle, SendHorizontal, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DatasetProfileCard } from "@/components/app/DatasetProfileCard";
import { DatasetUploader } from "@/components/app/DatasetUploader";
import type { DatasetProfile } from "@/types/api";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ChatPanelProps {
  datasetProfile: DatasetProfile | null;
  filename?: string;
  error: string | null;
  isUploading: boolean;
  isGenerating: boolean;
  messages: ChatMessage[];
  prompt: string;
  onPromptChange: (value: string) => void;
  onUpload: (file: File) => void;
  onGenerate: () => void;
}

export function ChatPanel({
  datasetProfile,
  filename,
  error,
  isUploading,
  isGenerating,
  messages,
  prompt,
  onPromptChange,
  onUpload,
  onGenerate,
}: ChatPanelProps) {
  const canGenerate = Boolean(datasetProfile && prompt.trim() && !isGenerating && !isUploading);

  return (
    <section className="flex min-h-0 flex-col gap-4 overflow-auto p-4 lg:max-w-md lg:border-r">
      <DatasetUploader isUploading={isUploading} onUpload={onUpload} />
      <DatasetProfileCard filename={filename} profile={datasetProfile} />

      <Card className="rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>Analyst chat</CardTitle>
          <CardDescription>Describe the dashboard you want Decidr to build.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Something needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex max-h-60 flex-col gap-3 overflow-auto pr-1">
            {messages.map((message, index) => (
              <div
                className={
                  message.role === "assistant"
                    ? "rounded-lg bg-muted p-3 text-sm leading-6"
                    : "ml-6 rounded-lg bg-primary p-3 text-sm leading-6 text-primary-foreground"
                }
                key={`${message.role}-${index}`}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Textarea
              disabled={isGenerating}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Create a sales performance dashboard with KPIs, trends, and segment comparisons..."
              rows={5}
              value={prompt}
            />
            <Button disabled={!canGenerate} onClick={onGenerate}>
              {isGenerating ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <SendHorizontal data-icon="inline-start" />
              )}
              Generate Dashboard
            </Button>
          </div>

          {!datasetProfile ? (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5" />
              Upload a CSV first. The backend will profile rows, types, missing values, summaries, and samples.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

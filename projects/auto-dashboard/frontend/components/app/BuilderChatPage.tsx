"use client";

import { AlertCircle, Bot, CheckCircle2, LoaderCircle, SendHorizontal, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/app/BrandLogo";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DatasetProfileCard } from "@/components/app/DatasetProfileCard";
import { DatasetUploader } from "@/components/app/DatasetUploader";
import type { DatasetProfile } from "@/types/api";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface BuilderChatPageProps {
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

export function BuilderChatPage({
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
}: BuilderChatPageProps) {
  const canGenerate = Boolean(datasetProfile && prompt.trim() && !isGenerating && !isUploading);

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f6f8fb] p-4 text-[#141414]">
      <Card className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[#dde4ef] bg-white shadow-sm">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5">
          <div className="flex shrink-0 flex-col gap-3 border-b border-[#dde4ef] pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandMark size={36} />
                <div>
                  <div className="text-sm font-semibold">Decidr</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#475569]">Turn data into decisions</div>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-[#dde4ef] bg-[#f9fafc] px-3 py-1.5 text-xs text-[#667085] sm:flex">
                <Sparkles className="size-3.5" />
                Tool-using analyst agent
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl xl:text-4xl">
                Last-minute presentation? Build the dashboard now.
              </h1>
              <p className="max-w-5xl text-sm leading-6 text-[#667085]">
                Upload a CSV and get a presentable, data-backed Plotly dashboard in minutes.
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Something needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {/* Scrollable chat transcript. This is the ONLY region that scrolls -
                the header, uploader, and prompt bar are pinned so the user never
                has to scroll the whole page to reach controls. */}
            <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto rounded-lg bg-[#f9fafc] p-4">
              {messages.map((message, index) =>
                message.role === "assistant" && index === 0 ? (
                  <div
                    className="w-full max-w-7xl rounded-lg border border-[#dde4ef] bg-white p-4 text-center shadow-sm"
                    key={`${message.role}-${index}`}
                  >
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:text-left">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#141414] text-white">
                        <Bot className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#141414]">Ready to build your dashboard</div>
                        <p className="mt-1 text-sm leading-6 text-[#4f5f78]">{message.content}</p>
                        <div className="mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-3">
                          <InstructionStep label="Profile the data" />
                          <InstructionStep label="Call agent tools" />
                          <InstructionStep label="Render Plotly studio" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      message.role === "assistant"
                        ? "w-full max-w-7xl self-center rounded-lg bg-[#eef3fa] p-3 text-sm leading-6 text-[#273142]"
                        : "ml-auto max-w-[72%] self-end rounded-lg bg-[#141414] p-3 text-sm leading-6 text-white"
                    }
                    key={`${message.role}-${index}`}
                  >
                    {message.content}
                  </div>
                ),
              )}

              <div
                className={
                  datasetProfile
                    ? "grid w-full max-w-7xl gap-3 rounded-lg border border-[#dde4ef] bg-white p-3 shadow-sm xl:grid-cols-[1.15fr_0.85fr]"
                    : "w-full max-w-4xl rounded-lg border border-[#dde4ef] bg-white p-3 shadow-sm"
                }
              >
                {datasetProfile ? (
                  <>
                    <DatasetUploader isUploading={isUploading} onUpload={onUpload} />
                    <DatasetProfileCard filename={filename} profile={datasetProfile} />
                  </>
                ) : (
                  <DatasetUploader isUploading={isUploading} onUpload={onUpload} />
                )}
              </div>
            </div>

            <div className="sticky bottom-0 mt-auto flex shrink-0 flex-col gap-3 rounded-lg border border-[#dde4ef] bg-[#f9fafc] p-3 sm:p-4">
              <Textarea
                disabled={isGenerating}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="Build an executive sales dashboard with KPIs, trend analysis, segment comparisons, and outlier detection."
                rows={4}
                value={prompt}
              />
              <Button className="h-10" disabled={!canGenerate} onClick={onGenerate}>
                {isGenerating ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <SendHorizontal data-icon="inline-start" />
                )}
                Generate full-page dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function InstructionStep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#f6f8fb] px-3 py-2">
      <CheckCircle2 className="size-3.5 text-[#275efe]" />
      <span>{label}</span>
    </div>
  );
}

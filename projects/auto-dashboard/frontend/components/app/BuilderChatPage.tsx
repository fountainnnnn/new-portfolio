"use client";

import { AlertCircle, Bot, CheckCircle2, LoaderCircle, SendHorizontal, Sparkles } from "lucide-react";

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
          {/* Pinned Title & Description */}
          <div className="flex shrink-0 flex-col gap-1 border-b border-[#dde4ef] pb-3">
            <h1 className="text-xl font-bold tracking-normal sm:text-2xl xl:text-3xl text-[#141414]">
              Last-minute presentation? Build the dashboard now.
            </h1>
            <p className="max-w-5xl text-xs sm:text-sm leading-6 text-[#667085]">
              Upload a CSV and get a presentable, data-backed Plotly dashboard in minutes.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Something needs attention</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {/* Landing State: clean, spacious, completely scrollbar-free */}
            {!datasetProfile ? (
              <div className="flex-1 flex flex-col justify-between items-center max-w-4xl mx-auto w-full py-4 md:py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Upper Centered Upload Stack */}
                <div className="flex flex-col items-center justify-center flex-1 w-full gap-6 max-w-2xl">
                  {/* AI Badge */}
                  <div className="flex items-center gap-1.5 rounded-full border border-[#dde4ef] bg-[#f9fafc]/80 px-3 py-1 text-[11px] font-semibold text-[#275efe] select-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <Sparkles className="size-3 text-[#275efe]" />
                    <span>Decidr AI Analyst</span>
                  </div>

                  {/* Heading & Subtitle */}
                  <div className="flex flex-col items-center text-center gap-2">
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                      Turn CSV data into interactive dashboards
                    </h2>
                    <p className="max-w-lg text-xs md:text-sm text-[#667085] leading-relaxed">
                      Upload your dataset to profile columns, infer metrics, and ask business questions. Our AI analyst builds editable, premium Plotly charts in seconds.
                    </p>
                  </div>

                  {/* Uploader Box */}
                  <div className="w-full">
                    <DatasetUploader isUploading={isUploading} onUpload={onUpload} variant="borderless" />
                  </div>
                </div>

                {/* Lower Horizontal Steps Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-6 pt-6 border-t border-[#dde4ef]/60">
                  <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2.5 px-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-[#e7edff] text-xs font-bold text-[#275efe] shadow-sm select-none">
                      01
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-800">Profile columns & metrics</span>
                      <span className="text-[11px] text-[#667085] leading-relaxed">
                        FastAPI automatically parses row counts, types, and column statistics.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2.5 px-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-[#e7edff] text-xs font-bold text-[#275efe] shadow-sm select-none">
                      02
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-800">Plan useful charts</span>
                      <span className="text-[11px] text-[#667085] leading-relaxed">
                        The LLM plans relevant KPIs, bar charts, trend graphs, and outliers.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2.5 px-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-[#e7edff] text-xs font-bold text-[#275efe] shadow-sm select-none">
                      03
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-slate-800">Interactive Plotly Studio</span>
                      <span className="text-[11px] text-[#667085] leading-relaxed">
                        View and customize your dashboard in our responsive, drag-and-resize studio.
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* Active State: CSV uploaded, show chat view */
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

                <div className="grid w-full max-w-7xl gap-3 rounded-lg border border-[#dde4ef] bg-white p-3 shadow-sm xl:grid-cols-[1.15fr_0.85fr]">
                  <DatasetUploader isUploading={isUploading} onUpload={onUpload} />
                  <DatasetProfileCard filename={filename} profile={datasetProfile} />
                </div>
              </div>
            )}

            {/* Prompt area (always shown at the bottom of the card workspace) */}
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

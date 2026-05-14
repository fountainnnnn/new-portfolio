"use client";

import { Bot, LoaderCircle, SendHorizontal, Wrench } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AgentToolCall } from "@/types/api";

interface StudioChatPanelProps {
  toolCalls: AgentToolCall[];
  isRefining: boolean;
  onRefine: (prompt: string) => void;
}

export function StudioChatPanel({ toolCalls, isRefining, onRefine }: StudioChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const latestTool = (toolCalls ?? []).at(-1);

  function submit() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }
    onRefine(trimmed);
    setPrompt("");
  }

  return (
    <section className="rounded-2xl border border-[#c7d2fe] bg-[#f5f7ff] p-4 text-[#141414] shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#275efe] text-white">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Dashboard tweak chat</h2>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Ask for visible changes like chart type swaps, better page focus, denser layout, new comparisons, or executive polish.
          </p>
        </div>
      </div>

      {latestTool ? (
        <div className="mt-3 rounded-xl border border-[#dbe3ff] bg-white p-3 text-xs leading-5 text-[#334155]">
          <div className="mb-1 flex items-center gap-2 font-semibold text-[#141414]">
            <Wrench className="size-3.5 text-[#275efe]" />
            Latest change
          </div>
          {latestTool.summary}
        </div>
      ) : null}

      <div className="mt-3 flex max-h-52 flex-col gap-2 overflow-auto pr-1">
        {(toolCalls ?? []).slice(-5).map((tool, index) => (
          <div
            className="rounded-lg border border-[#dde4ef] bg-[#f8fafc] p-2 text-xs leading-5 text-[#667085]"
            key={`${tool.tool_name}-${index}`}
          >
            <div className="flex items-center gap-2 font-medium text-[#141414]">
              <Wrench className="size-3.5" />
              {tool.tool_name.replaceAll("_", " ")}
            </div>
            <div className="mt-1">{tool.summary}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Textarea
          className="min-h-28 bg-white"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Make page 1 focus on which institutions drive total students, fill empty space, and make the hero chart horizontal."
          rows={5}
          value={prompt}
        />
        <Button className="h-11" disabled={isRefining || !prompt.trim()} onClick={submit}>
          {isRefining ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <SendHorizontal data-icon="inline-start" />
          )}
          Tweak dashboard
        </Button>
      </div>
    </section>
  );
}

"use client";

import { Bot, CheckCircle2, LoaderCircle, Wrench } from "lucide-react";

interface AgentActivityToastProps {
  isVisible: boolean;
  mode: "generate" | "refine";
}

const generateSteps = [
  "Inspecting dataset profile",
  "Planning dashboard layout",
  "Validating chart fields",
  "Rendering Plotly specs",
];

const refineSteps = [
  "Loading current dashboard",
  "Revising chart plan",
  "Applying theme rules",
  "Regenerating Plotly code",
];

export function AgentActivityToast({ isVisible, mode }: AgentActivityToastProps) {
  if (!isVisible) {
    return null;
  }

  const steps = mode === "generate" ? generateSteps : refineSteps;

  return (
    <div className="fixed right-5 top-24 z-50 w-72 rounded-lg border border-[#dde4ef] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#141414] text-white">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#141414]">Agent is working</div>
          <div className="flex items-center gap-1.5 text-xs text-[#667085]">
            <LoaderCircle className="size-3 animate-spin" />
            Calling dashboard tools
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {steps.map((step, index) => (
          <div className="flex items-center gap-2 text-xs text-[#4f5f78]" key={step}>
            {index === 0 ? (
              <CheckCircle2 className="size-3.5 text-[#10a37f]" />
            ) : index === 1 ? (
              <LoaderCircle className="size-3.5 animate-spin text-[#275efe]" />
            ) : (
              <Wrench className="size-3.5 text-[#8a94a6]" />
            )}
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

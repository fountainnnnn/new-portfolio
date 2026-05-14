"use client";

import { History, Plus, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/app/BrandLogo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  onNewDashboard: () => void;
  dashboardTitle?: string;
}

const placeholderHistory = ["Sales performance", "Customer segments", "Operations overview"];

export function Sidebar({ onNewDashboard, dashboardTitle }: SidebarProps) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-b bg-card px-4 py-4 lg:w-72 lg:border-b-0 lg:border-r">
      <BrandLogo showTagline />

      <Button className="mt-5 w-full justify-start" onClick={onNewDashboard}>
        <Plus data-icon="inline-start" />
        New Dashboard
      </Button>

      <Separator className="my-5" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <History className="size-3.5" />
          Recent
        </div>
        <div className="flex flex-col gap-1">
          {dashboardTitle ? (
            <button className="truncate rounded-lg bg-muted px-3 py-2 text-left text-sm font-medium">
              {dashboardTitle}
            </button>
          ) : null}
          {placeholderHistory.map((item) => (
            <button
              className="truncate rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              key={item}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto hidden rounded-lg border bg-muted/40 p-3 lg:block">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-muted-foreground" />
          MVP mode
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Upload CSV data, prompt the analyst agent, and render live Plotly dashboards locally.
        </p>
      </div>
    </aside>
  );
}

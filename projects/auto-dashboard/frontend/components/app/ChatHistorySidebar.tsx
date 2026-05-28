"use client";

import { MessageSquareText, Plus, Sparkles, Trash2 } from "lucide-react";

import { BrandMark } from "@/components/app/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatHistoryItem {
  id: string;
  title: string;
  subtitle: string;
  updatedLabel: string;
  hasDashboard: boolean;
}

interface ChatHistorySidebarProps {
  activeSessionId: string;
  items: ChatHistoryItem[];
  isDark?: boolean;
  onDeleteChat: (sessionId: string) => void;
  onNewChat: () => void;
  onSelectChat: (sessionId: string) => void;
}

export function ChatHistorySidebar({
  activeSessionId,
  items,
  isDark = false,
  onDeleteChat,
  onNewChat,
  onSelectChat,
}: ChatHistorySidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-[calc(100vh-80px)] w-full shrink-0 flex-col border-r px-3 py-4 sm:w-72",
        isDark ? "border-white/10 bg-[#070b14] text-[#e8eef9]" : "border-[#dde4ef] bg-white text-[#141414]",
      )}
    >
      <div className="flex items-center gap-3 px-1">
        <BrandMark className="shrink-0" size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold flex items-center gap-1.5">
            Decidr <span className={cn("text-[9px] font-normal px-1.5 py-0.25 rounded select-none", isDark ? "bg-white/10 text-white" : "bg-[#e7edff] text-[#275efe]")}>by Mervin</span>
          </div>
          <div className={cn("text-xs", isDark ? "text-[#9aa8bf]" : "text-[#667085]")}>Chat history</div>
        </div>
      </div>

      <Button className="mt-5 w-full justify-start" onClick={onNewChat}>
        <Plus data-icon="inline-start" />
        New dashboard chat
      </Button>

      <div className="mt-5 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide opacity-70">
        <MessageSquareText className="size-3.5" />
        Recent chats
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-1">
        {items.map((item) => {
          const active = item.id === activeSessionId;
          return (
            <div
              className={cn(
                "group rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? isDark
                    ? "border-[#8ab4ff]/45 bg-[#172a4d]"
                    : "border-[#275efe]/30 bg-[#e7edff]"
                  : isDark
                    ? "border-transparent hover:bg-white/6"
                    : "border-transparent hover:bg-[#f3f6fb]",
              )}
              key={item.id}
            >
              <div className="flex items-center gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => onSelectChat(item.id)} type="button">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                </button>
                {item.hasDashboard ? <Sparkles className="size-3.5 shrink-0 opacity-70" /> : null}
                <button
                  aria-label={`Delete ${item.title}`}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md opacity-60 transition hover:opacity-100",
                    isDark ? "hover:bg-white/10 hover:text-[#f7768e]" : "hover:bg-[#fee4e2] hover:text-[#d92d20]",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteChat(item.id);
                  }}
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <button className="w-full text-left" onClick={() => onSelectChat(item.id)} type="button">
                <div className={cn("mt-1 truncate text-xs", isDark ? "text-[#9aa8bf]" : "text-[#667085]")}>
                  {item.subtitle}
                </div>
                <div className={cn("mt-1 text-[11px]", isDark ? "text-[#7f8da6]" : "text-[#8a94a6]")}>
                  {item.updatedLabel}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

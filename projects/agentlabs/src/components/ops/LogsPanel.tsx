
import { useEffect, useRef } from "react";
import type { BattleEvent } from "@/types/agentforge";

interface LogsPanelProps {
  events: BattleEvent[];
}

const TAG_COLORS: Record<string, string> = {
  wave: "#60A5FA",
  attack: "#FBBF24",
  fail: "#F87171",
  pass: "#4ADE80",
  patch: "#A78BFA",
  export: "#60A5FA",
};

const TAG_LABELS: Record<string, string> = {
  wave: "[WAVE]",
  attack: "[ATK]",
  fail: "[FAIL]",
  pass: "[PASS]",
  patch: "[PATCH]",
  export: "[SYS]",
};

export default function LogsPanel({ events }: LogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5" style={{ padding: "0 2px" }}>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
        >
          SYSTEM LOG
        </span>
        <button
          type="button"
          className="text-[10px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ color: "#5A6E86" }}
        >
          Clear
        </button>
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto rounded-lg font-mono text-[12px] leading-relaxed"
        style={{
          maxHeight: "200px",
          background: "#080C13",
          border: "1px solid rgba(110,130,160,0.15)",
          padding: "12px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(110,130,160,0.2) transparent",
        }}
      >
        {events.length === 0 && (
          <div
            className="py-2 px-1 text-[12px]"
            style={{ color: "#5A6E86" }}
          >
            Awaiting wave execution...
          </div>
        )}

        {events.map((evt) => {
          const tagColor = TAG_COLORS[evt.kind] || "#5A6E86";
          const tagLabel = TAG_LABELS[evt.kind] || `[${evt.kind.toUpperCase()}]`;

          return (
            <div
              key={evt.id}
              className="flex gap-1.5 py-0.5 rounded transition-colors"
              style={{ paddingLeft: "2px", paddingRight: "2px" }}
            >
              <span
                className="flex-shrink-0"
                style={{ color: "#5A6E86", width: "56px", fontSize: "11px" }}
              >
                {evt.timestamp}
              </span>
              <span
                className="font-semibold flex-shrink-0"
                style={{ color: tagColor, width: "52px" }}
              >
                {tagLabel}
              </span>
              <span
                className="truncate"
                style={{ color: "#8FA0B8" }}
              >
                {evt.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

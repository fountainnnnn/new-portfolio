
import { useEffect, useRef } from "react";
import type { BattleEvent } from "@/types/agentforge";

interface TrainingLogPanelProps {
  events: BattleEvent[];
}

const TAG_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  BATCH: { bg: "rgba(37, 99, 235, 0.12)", color: "#2563EB", label: "BATCH" },
  REWARD: { bg: "rgba(33, 134, 90, 0.12)", color: "#21865A", label: "REWARD" },
  GRADIENT: { bg: "rgba(199, 119, 0, 0.12)", color: "#C77700", label: "GRADIENT" },
  FREEZE: { bg: "rgba(2, 132, 199, 0.12)", color: "#0284C7", label: "FREEZE" },
  ADAPTER: { bg: "rgba(124, 58, 237, 0.12)", color: "#7C3AED", label: "ADAPTER" },
  EVAL: { bg: "rgba(37, 99, 235, 0.12)", color: "#2563EB", label: "EVAL" },
  CHECKPOINT: { bg: "rgba(124, 58, 237, 0.12)", color: "#7C3AED", label: "CHECKPOINT" },
  EXPORT: { bg: "rgba(33, 134, 90, 0.12)", color: "#21865A", label: "EXPORT" },
};

function getTagStyle(kind: string) {
  const upper = kind.toUpperCase();
  return TAG_STYLE[upper] || { bg: "rgba(87, 90, 96, 0.1)", color: "#575A60", label: upper };
}

export default function TrainingLogPanel({ events }: TrainingLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div
      className="cool-card rounded-xl flex flex-col"
      style={{
        background: "#F2F8FC",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "8px",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Training Log
        </span>
        <span className="text-[10px] font-semibold" style={{ color: "#7A7D85" }}>
          {events.length} events
        </span>
      </div>

      {/* Log container */}
      <div
        ref={scrollRef}
        className="overflow-y-auto rounded-lg font-mono text-[12px] leading-relaxed"
        style={{
          maxHeight: "240px",
          background: "#FFFFFF",
          border: "1px solid #DCD8CC",
          padding: "10px",
          scrollbarWidth: "thin",
          scrollbarColor: "#DCD8CC transparent",
        }}
      >
        {events.length === 0 && (
          <div className="py-2 px-1 text-[12px]" style={{ color: "#7A7D85" }}>
            Waiting for training to start...
          </div>
        )}

        {events.map((evt) => {
          const tag = getTagStyle(evt.kind);

          return (
            <div
              key={evt.id}
              className="flex gap-2 py-0.5"
              style={{ paddingLeft: "2px", paddingRight: "2px" }}
            >
              {/* Timestamp */}
              <span
                className="flex-shrink-0"
                style={{ color: "#7A7D85", width: "60px", fontSize: "11px" }}
              >
                {evt.timestamp}
              </span>

              {/* Tag badge */}
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                style={{
                  background: tag.bg,
                  color: tag.color,
                }}
              >
                {tag.label}
              </span>

              {/* Message */}
              <span
                className="truncate"
                style={{ color: "#575A60" }}
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

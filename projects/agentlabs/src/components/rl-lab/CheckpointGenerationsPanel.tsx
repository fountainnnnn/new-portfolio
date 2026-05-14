
import type { RLCheckpoint } from "@/types/agentforge";

interface CheckpointGenerationsPanelProps {
  checkpoints: RLCheckpoint[];
  activeId: string;
}

const STATUS_DOT: Record<string, { bg: string; label: string }> = {
  training: { bg: "#C77700", label: "training" },
  evaluating: { bg: "#2563EB", label: "evaluating" },
  completed: { bg: "#21865A", label: "completed" },
  exported: { bg: "#7C3AED", label: "exported" },
};

export default function CheckpointGenerationsPanel({
  checkpoints,
  activeId,
}: CheckpointGenerationsPanelProps) {
  return (
    <div
      className="lavender-card rounded-xl flex flex-col"
      style={{
        background: "#F4F1F8",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
      }}
    >
      {/* Header */}
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Checkpoint Generations
      </span>

      {/* Vertical timeline */}
      <div className="flex flex-col" style={{ gap: "2px" }}>
        {checkpoints.map((cp, idx) => {
          const isActive = cp.id === activeId;
          const dot = STATUS_DOT[cp.status] || STATUS_DOT.completed;
          const isLast = idx === checkpoints.length - 1;

          return (
            <div key={cp.id} className="flex gap-3">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center" style={{ width: "16px" }}>
                <div
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: isActive ? "10px" : "8px",
                    height: isActive ? "10px" : "8px",
                    background: dot.bg,
                    boxShadow: isActive ? `0 0 6px ${dot.bg}` : "none",
                    marginTop: "10px",
                  }}
                />
                {!isLast && (
                  <div
                    style={{
                      width: "1px",
                      flex: 1,
                      minHeight: "12px",
                      background: "#DCD8CC",
                    }}
                  />
                )}
              </div>

              {/* Checkpoint card */}
              <div
                className="flex-1 rounded-lg flex flex-col px-3 py-2 mb-1 transition-all"
                style={{
                  background: isActive ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                  border: isActive
                    ? "1px solid rgba(124, 58, 237, 0.3)"
                    : "1px solid #DCD8CC",
                  boxShadow: isActive
                    ? "0 1px 4px rgba(124, 58, 237, 0.12)"
                    : "none",
                }}
              >
                {/* Name + status */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "#1D1D1F" }}
                  >
                    {cp.name}
                  </span>
                  <span
                    className="badge"
                    style={{ background: `${dot.bg}1A`, color: dot.bg }}
                  >
                    {dot.label}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] font-mono font-semibold" style={{ color: "#21865A" }}>
                    R: {cp.rewardScore.toFixed(1)}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "#C2414B" }}>
                    Fail: {cp.failureRate}%
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "#2563EB" }}>
                    Refusal: {cp.refusalPrecision}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

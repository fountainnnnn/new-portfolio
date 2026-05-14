
import type { AgentGeneration, GenerationStatus } from "@/types/agentforge";

interface AgentGenerationsPanelProps {
  generations: AgentGeneration[];
  activeId: string;
}

const STATUS_DOT: Record<GenerationStatus, { bg: string; label: string }> = {
  active: { bg: "#4ADE80", label: "active" },
  patched: { bg: "#A78BFA", label: "patched" },
  failed: { bg: "#F87171", label: "failed" },
  final: { bg: "#60A5FA", label: "final" },
};

function AgentPortrait({ status }: { status: GenerationStatus }) {
  const isActive = status === "active" || status === "final";
  return (
    <div
      className="rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        width: "24px",
        height: "24px",
        background: isActive ? "#1A2338" : "#0F1624",
        border: "1px solid rgba(110,130,160,0.15)",
        position: "relative",
      }}
    >
      {/* Grey round head */}
      <div
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          background: "#5A6E86",
          position: "absolute",
          top: "3px",
        }}
      />
      {/* Two eye dots */}
      <div
        style={{
          width: "2px",
          height: "2px",
          borderRadius: "50%",
          background: "#E8EDF4",
          position: "absolute",
          top: "8px",
          left: "8px",
        }}
      />
      <div
        style={{
          width: "2px",
          height: "2px",
          borderRadius: "50%",
          background: "#E8EDF4",
          position: "absolute",
          top: "8px",
          right: "8px",
        }}
      />
      {/* Blue scarf line */}
      <div
        style={{
          width: "14px",
          height: "2px",
          background: "#60A5FA",
          position: "absolute",
          bottom: "3px",
          borderRadius: "1px",
        }}
      />
    </div>
  );
}

export default function AgentGenerationsPanel({
  generations,
  activeId,
}: AgentGenerationsPanelProps) {
  return (
    <div>
      <div className="flex items-center mb-1.5" style={{ padding: "0 2px" }}>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
        >
          AGENT GENERATIONS
        </span>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {generations.map((gen) => {
          const isActive = gen.id === activeId;
          const dot = STATUS_DOT[gen.status];

          return (
            <div
              key={gen.id}
              className="flex-shrink-0 rounded-lg flex flex-col items-center pt-2.5 pb-2 px-2 transition-all"
              style={{
                width: "96px",
                background: "#151D2E",
                border: isActive
                  ? "1px solid #60A5FA"
                  : "1px solid rgba(110,130,160,0.15)",
                boxShadow: isActive
                  ? "0 0 8px rgba(96,165,250,0.2)"
                  : "none",
              }}
            >
              <AgentPortrait status={gen.status} />

              <span
                className="text-[11px] font-mono font-bold mt-1.5"
                style={{ color: "#E8EDF4" }}
              >
                {gen.version}
              </span>

              <div
                className="flex items-center gap-1 mt-1"
              >
                <div
                  className="rounded-full"
                  style={{
                    width: "5px",
                    height: "5px",
                    background: dot.bg,
                  }}
                />
                <span
                  className="text-[9px] uppercase tracking-wider"
                  style={{ color: "#5A6E86" }}
                >
                  {dot.label}
                </span>
              </div>
            </div>
          );
        })}

        {/* Locked slot */}
        <div
          className="flex-shrink-0 rounded-lg flex flex-col items-center justify-center"
          style={{
            width: "96px",
            background: "#151D2E",
            border: "1px solid rgba(110,130,160,0.15)",
            opacity: 0.5,
            minHeight: "84px",
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#5A6E86" }}
          >
            LOCKED
          </span>
        </div>
      </div>
    </div>
  );
}

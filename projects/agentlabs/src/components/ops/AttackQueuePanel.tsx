
import type { AttackScenario, AttackCategory, Severity } from "@/types/agentforge";

interface AttackQueuePanelProps {
  attacks: AttackScenario[];
  onAttackClick: (attackId: string) => void;
}

const CATEGORY_COLORS: Record<AttackCategory, string> = {
  prompt_injection: "#F87171",
  role_impersonation: "#A78BFA",
  emotional_manipulation: "#FBBF24",
  tool_abuse: "#FBBF24",
  policy_extraction: "#22D3EE",
  multi_turn_escalation: "#F87171",
};

const SEVERITY_BG: Record<Severity, string> = {
  low: "rgba(90,110,134,0.15)",
  medium: "rgba(251,191,36,0.12)",
  high: "rgba(248,113,113,0.15)",
  critical: "rgba(248,113,113,0.25)",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#5A6E86",
  medium: "#FBBF24",
  high: "#F87171",
  critical: "#F87171",
};

const STATUS_STYLE: Record<string, { text: string; color: string }> = {
  pending: { text: "PENDING", color: "#5A6E86" },
  running: { text: "RUNNING", color: "#FBBF24" },
  blocked: { text: "BLOCKED", color: "#60A5FA" },
  failed: { text: "FAILED", color: "#F87171" },
  passed: { text: "PASSED", color: "#4ADE80" },
};

export default function AttackQueuePanel({
  attacks,
  onAttackClick,
}: AttackQueuePanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5" style={{ padding: "0 2px" }}>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
        >
          ATTACK QUEUE
        </span>
        <span
          className="text-[10px] font-semibold rounded-full px-2 py-0.5"
          style={{
            background: "rgba(110,130,160,0.12)",
            color: "#8FA0B8",
          }}
        >
          {attacks.length}
        </span>
      </div>

      <div className="flex flex-col" style={{ gap: "4px" }}>
        {attacks.map((atk) => {
          const dotColor = CATEGORY_COLORS[atk.category] || "#5A6E86";
          const sevBg = SEVERITY_BG[atk.severity] || "rgba(90,110,134,0.15)";
          const sevColor = SEVERITY_COLOR[atk.severity] || "#5A6E86";
          const statusInfo = STATUS_STYLE[atk.status] || STATUS_STYLE.pending;

          return (
            <button
              key={atk.id}
              type="button"
              onClick={() => onAttackClick(atk.id)}
              className="w-full flex items-center rounded-md transition-all text-left cursor-pointer"
              style={{
                height: "48px",
                padding: "0 10px",
                background: "#151D2E",
                border: "1px solid rgba(110,130,160,0.08)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1A2338";
                e.currentTarget.style.borderColor = "rgba(110,130,160,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#151D2E";
                e.currentTarget.style.borderColor = "rgba(110,130,160,0.08)";
              }}
            >
              {/* Enemy icon placeholder */}
              <div
                className="rounded flex-shrink-0"
                style={{
                  width: "12px",
                  height: "12px",
                  background: dotColor,
                  opacity: 0.85,
                  marginRight: "10px",
                  borderRadius: "3px",
                }}
              />

              {/* Label */}
              <span
                className="text-[13px] font-medium truncate flex-1"
                style={{ color: "#E8EDF4" }}
              >
                {atk.label}
              </span>

              {/* Severity pill */}
              <span
                className="rounded-full text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 flex-shrink-0"
                style={{
                  background: sevBg,
                  color: sevColor,
                  marginRight: "8px",
                }}
              >
                {atk.severity}
              </span>

              {/* Status badge */}
              <span
                className="text-[10px] font-semibold tracking-wider flex-shrink-0"
                style={{ color: statusInfo.color, width: "56px", textAlign: "right" }}
              >
                {statusInfo.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

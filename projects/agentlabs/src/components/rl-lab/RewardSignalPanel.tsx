
import type { RewardComponents } from "@/types/agentforge";

interface RewardSignalPanelProps {
  components: RewardComponents;
}

const POSITIVE_SIGNALS: { key: keyof RewardComponents; label: string }[] = [
  { key: "policyAdherence", label: "policy" },
  { key: "correctness", label: "correctness" },
  { key: "refusalAccuracy", label: "refusal" },
  { key: "toolSafety", label: "tool safety" },
  { key: "consistency", label: "consistency" },
];

const NEGATIVE_SIGNALS: { key: keyof RewardComponents; label: string }[] = [
  { key: "leakagePenalty", label: "leakage" },
  { key: "hallucinationPenalty", label: "hallucination" },
  { key: "unsafeCompliancePenalty", label: "unsafe" },
  { key: "rewardHackingPenalty", label: "hacking" },
];

export default function RewardSignalPanel({ components }: RewardSignalPanelProps) {
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
        Reward Signal
      </span>

      {/* Formula */}
      <div
        className="rounded-lg px-3 py-2.5 text-[12px] font-mono leading-relaxed"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCD8CC",
          color: "#575A60",
        }}
      >
        <span style={{ color: "#1D1D1F", fontWeight: 600 }}>Final reward</span>
        <span> = + </span>
        {POSITIVE_SIGNALS.map((s, i) => (
          <span key={s.key}>
            <span style={{ color: "#21865A" }}>{s.label}</span>
            {i < POSITIVE_SIGNALS.length - 1 && <span> + </span>}
          </span>
        ))}
        <span> - </span>
        {NEGATIVE_SIGNALS.map((s, i) => (
          <span key={s.key}>
            <span style={{ color: "#C2414B" }}>{s.label}</span>
            {i < NEGATIVE_SIGNALS.length - 1 && <span> - </span>}
          </span>
        ))}
      </div>

      {/* Component values */}
      <div className="flex flex-col gap-1">
        {POSITIVE_SIGNALS.map((s) => {
          const value = components[s.key] as number;
          return (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-lg px-3 py-1.5"
              style={{ background: "#FFFFFF", border: "1px solid #DCD8CC" }}
            >
              <span className="text-[12px]" style={{ color: "#575A60" }}>
                {s.label}
              </span>
              <span
                className="text-[13px] font-bold font-mono"
                style={{ color: "#21865A" }}
              >
                +{value.toFixed(1)}
              </span>
            </div>
          );
        })}
        {NEGATIVE_SIGNALS.map((s) => {
          const value = components[s.key] as number;
          return (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-lg px-3 py-1.5"
              style={{ background: "#FFFFFF", border: "1px solid #DCD8CC" }}
            >
              <span className="text-[12px]" style={{ color: "#575A60" }}>
                {s.label}
              </span>
              <span
                className="text-[13px] font-bold font-mono"
                style={{ color: "#C2414B" }}
              >
                -{Math.abs(value).toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{
          background: "rgba(124, 58, 237, 0.08)",
          border: "1px solid rgba(124, 58, 237, 0.2)",
        }}
      >
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#7C3AED" }}>
          Total Reward
        </span>
        <span
          className="text-[16px] font-bold font-mono"
          style={{
            color: components.total >= 0 ? "#21865A" : "#C2414B",
          }}
        >
          {components.total >= 0 ? "+" : ""}
          {components.total.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

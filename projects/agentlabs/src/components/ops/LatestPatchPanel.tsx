
import type { PatchSummary } from "@/types/agentforge";

interface LatestPatchPanelProps {
  patch: PatchSummary | null;
}

export default function LatestPatchPanel({ patch }: LatestPatchPanelProps) {
  if (!patch) {
    return (
      <div>
        <div className="flex items-center mb-1.5" style={{ padding: "0 2px" }}>
          <span
            className="text-[11px] font-bold tracking-widest"
            style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
          >
            LATEST PATCH
          </span>
        </div>
        <div
          className="rounded-lg flex items-center justify-center"
          style={{
            background: "#151D2E",
            border: "1px solid rgba(110,130,160,0.15)",
            padding: "16px",
          }}
        >
          <span className="text-[13px]" style={{ color: "#5A6E86" }}>
            No patches applied
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-1.5" style={{ padding: "0 2px" }}>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
        >
          LATEST PATCH
        </span>
      </div>

      <div
        className="rounded-lg"
        style={{
          background: "#151D2E",
          border: "1px solid rgba(110,130,160,0.15)",
          padding: "12px",
        }}
      >
        {/* Version badge + applied status */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="rounded-full text-[10px] font-bold px-2.5 py-0.5"
            style={{
              background: "rgba(167,139,250,0.15)",
              color: "#A78BFA",
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
          >
            v{patch.patchType === "Prompt Guard" ? "1.2.1" : "0.9.4"}
          </span>
          <div className="flex items-center gap-1">
            <div
              className="rounded-full"
              style={{ width: "5px", height: "5px", background: "#4ADE80" }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "#4ADE80" }}
            >
              Applied
            </span>
          </div>
        </div>

        {/* Patch summary text */}
        <p
          className="text-[13px] leading-relaxed mb-2.5"
          style={{ color: "#8FA0B8" }}
        >
          {patch.addedRules[0] || patch.title}
        </p>

        {/* Improvement stats */}
        <div className="flex gap-3 mb-2.5">
          <span
            className="text-[11px] font-bold font-mono"
            style={{ color: "#4ADE80" }}
          >
            +12% Survival
          </span>
          <span
            className="text-[11px] font-bold font-mono"
            style={{ color: "#4ADE80" }}
          >
            -8% Damage Taken
          </span>
        </div>

        {/* View Diff button */}
        <button
          type="button"
          className="text-[11px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "#A78BFA" }}
        >
          View Diff
        </button>
      </div>
    </div>
  );
}

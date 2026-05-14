
import React from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ArenaSpeedControlsProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1.0 },
  { label: "2x", value: 2.0 },
  { label: "Skip", value: 999 },
] as const;

/* ------------------------------------------------------------------ */
/*  ArenaSpeedControls                                                */
/* ------------------------------------------------------------------ */

export default function ArenaSpeedControls({
  currentSpeed,
  onSpeedChange,
}: ArenaSpeedControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "2px",
        background: "rgba(255, 255, 255, 0.06)",
        borderRadius: "8px",
        padding: "2px",
        border: "1px solid rgba(110, 130, 160, 0.12)",
      }}
    >
      {SPEED_OPTIONS.map((opt) => {
        const isActive = currentSpeed === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSpeedChange(opt.value)}
            title={opt.label === "Skip" ? "Skip to end of current attack" : `Set speed to ${opt.label}`}
            style={{
              background: isActive ? "rgba(34, 211, 238, 0.15)" : "transparent",
              color: isActive ? "#22D3EE" : "#8FA0B8",
              border: isActive ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid transparent",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s ease",
              outline: "none",
              whiteSpace: "nowrap",
              minWidth: "44px",
              textAlign: "center",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.color = "#E8EDF4";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#8FA0B8";
              }
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

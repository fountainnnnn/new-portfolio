
import { useEffect, useState } from "react";
import type { BattlePhase } from "@/types/agentforge";

interface ArenaHeaderProps {
  currentWave: number;
  status: BattlePhase;
}

function formatStatus(status: BattlePhase): string {
  switch (status) {
    case "idle":
      return "IDLE";
    case "running_wave":
      return "RUNNING";
    case "attack_blocked":
      return "BLOCKED";
    case "attack_failed":
      return "BREACHED";
    case "patching":
      return "PATCHING";
    case "upgraded":
      return "UPGRADED";
    case "completed":
      return "COMPLETE";
    case "collapsed":
      return "COLLAPSED";
    default: {
      const s: string = status;
      return s.toUpperCase();
    }
  }
}

function statusColor(status: BattlePhase): string {
  switch (status) {
    case "idle":
      return "#5A6E86";
    case "running_wave":
    case "patching":
      return "#22D3EE";
    case "attack_blocked":
      return "#4ADE80";
    case "attack_failed":
    case "collapsed":
      return "#F87171";
    case "upgraded":
      return "#A78BFA";
    case "completed":
      return "#4ADE80";
    default:
      return "#5A6E86";
  }
}

export default function ArenaHeader({ currentWave, status }: ArenaHeaderProps) {
  const [elapsed, setElapsed] = useState("00:00");
  const [startTime, setStartTime] = useState(0);

  const isActive =
    status === "running_wave" ||
    status === "patching" ||
    status === "attack_blocked" ||
    status === "attack_failed";

  // Set startTime only on client to avoid hydration mismatch
  useEffect(() => {
    if (isActive && startTime === 0) {
      setStartTime(Date.now());
    }
  }, [isActive, startTime]);

  useEffect(() => {
    if (!isActive || startTime === 0) return;

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  // Reset elapsed when becoming active
  useEffect(() => {
    if (isActive) {
      setElapsed("00:00");
      setStartTime(0);
    }
  }, [isActive, status]);

  return (
    <div
      className="flex items-center justify-between px-4 flex-shrink-0"
      style={{
        height: "44px",
        background: "#0D1421",
        borderBottom: "1px solid rgba(110, 130, 160, 0.15)",
      }}
    >
      {/* Left: LIVE ARENA with pulsing dot */}
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isActive ? "animate-ping" : ""
            }`}
            style={{
              background: isActive ? "#22D3EE" : "#5A6E86",
              animationDuration: "1.5s",
            }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: isActive ? "#22D3EE" : "#5A6E86" }}
          />
        </span>
        <span
          className="text-[12px] font-semibold tracking-wider"
          style={{ color: "#E8EDF4" }}
        >
          LIVE ARENA
        </span>
      </div>

      {/* Center: Wave indicator + status */}
      <div className="flex items-center gap-3">
        <span
          className="text-[13px] font-bold font-mono"
          style={{ color: "#22D3EE" }}
        >
          Wave {String(currentWave).padStart(2, "0")}
        </span>
        <span
          className="text-[10px] font-mono font-semibold uppercase tracking-wider"
          style={{ color: statusColor(status) }}
        >
          {formatStatus(status)}
        </span>
      </div>

      {/* Right: Elapsed time */}
      <div
        className="text-[12px] font-mono tabular-nums"
        style={{ color: "#8FA0B8" }}
      >
        {elapsed}
      </div>
    </div>
  );
}

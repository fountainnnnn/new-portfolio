
import { useMemo } from "react";
import type { AttackCategory } from "@/types/agentforge";
import { getWaveComposition, isBossWave } from "./EnemySwarm";
import type { EnemyInstance } from "./EnemySwarm";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface WaveStats {
  failures: number;
  blocked: number;
  score: number;
}

interface WaveLadderProps {
  currentWave: number;
  completedWaves: number[];
  waveStats?: Record<number, WaveStats>;
  onWaveClick?: (wave: number) => void;
  maxWaves?: number;
}

/* ------------------------------------------------------------------ */
/*  Category icons (emoji-free, all text/symbol based)                */
/* ------------------------------------------------------------------ */

const CATEGORY_ICONS: Record<AttackCategory, string> = {
  prompt_injection: "><",
  role_impersonation: "@@",
  emotional_manipulation: "~~",
  tool_abuse: "//",
  policy_extraction: "??",
  multi_turn_escalation: "##",
};

const CATEGORY_COLORS: Record<AttackCategory, string> = {
  prompt_injection: "#FF5C7A",
  role_impersonation: "#A78BFA",
  emotional_manipulation: "#F97316",
  tool_abuse: "#EAB308",
  policy_extraction: "#22D3EE",
  multi_turn_escalation: "#EF4444",
};

/* ------------------------------------------------------------------ */
/*  WaveLadder                                                        */
/* ------------------------------------------------------------------ */

export default function WaveLadder({
  currentWave,
  completedWaves,
  waveStats = {},
  onWaveClick,
  maxWaves = 20,
}: WaveLadderProps) {
  const completedSet = useMemo(() => new Set(completedWaves), [completedWaves]);

  const waves = useMemo(() => {
    const result: {
      wave: number;
      isCompleted: boolean;
      isCurrent: boolean;
      isBoss: boolean;
      categories: AttackCategory[];
    }[] = [];

    for (let w = 1; w <= maxWaves; w++) {
      const comp = getWaveComposition(w);
      result.push({
        wave: w,
        isCompleted: completedSet.has(w),
        isCurrent: w === currentWave,
        isBoss: comp.bossWave,
        categories: comp.categories,
      });
    }

    return result;
  }, [maxWaves, completedSet, currentWave]);

  return (
    <div
      className="w-full overflow-y-auto"
      style={{
        maxHeight: "100%",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(110, 130, 160, 0.2) transparent",
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-3 py-2 text-[9px] uppercase tracking-widest font-bold"
        style={{
          color: "#5A6E86",
          background: "rgba(10, 14, 23, 0.95)",
          borderBottom: "1px solid rgba(110, 130, 160, 0.08)",
        }}
      >
        Wave Ladder
      </div>

      {/* Wave list */}
      <div className="flex flex-col" style={{ gap: "1px" }}>
        {waves.map((w) => (
          <WaveRow
            key={w.wave}
            wave={w.wave}
            isCompleted={w.isCompleted}
            isCurrent={w.isCurrent}
            isBoss={w.isBoss}
            categories={w.categories}
            stats={waveStats[w.wave]}
            onClick={onWaveClick ? () => onWaveClick(w.wave) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WaveRow                                                           */
/* ------------------------------------------------------------------ */

interface WaveRowProps {
  wave: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isBoss: boolean;
  categories: AttackCategory[];
  stats?: WaveStats;
  onClick?: () => void;
}

function WaveRow({
  wave,
  isCompleted,
  isCurrent,
  isBoss,
  categories,
  stats,
  onClick,
}: WaveRowProps) {
  const uniqueCategories = useMemo(
    () => Array.from(new Set(categories)),
    [categories]
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isCompleted && !isCurrent}
      className="w-full text-left transition-all duration-150"
      style={{
        padding: "6px 10px",
        background: isCurrent
          ? "rgba(34, 211, 238, 0.08)"
          : isCompleted
            ? "rgba(74, 222, 128, 0.04)"
            : "transparent",
        borderLeft: isCurrent
          ? "2px solid #22D3EE"
          : isCompleted
            ? "2px solid rgba(74, 222, 128, 0.25)"
            : "2px solid transparent",
        cursor: onClick && (isCompleted || isCurrent) ? "pointer" : "default",
        opacity: !isCompleted && !isCurrent ? 0.45 : 1,
      }}
    >
      {/* Top row: wave number + status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {/* Wave number */}
          <span
            className="font-mono font-bold text-[11px]"
            style={{
              color: isCurrent
                ? "#22D3EE"
                : isCompleted
                  ? "#4ADE80"
                  : "#5A6E86",
            }}
          >
            {String(wave).padStart(2, "0")}
          </span>

          {/* Boss badge */}
          {isBoss && (
            <span
              className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                color: "#EF4444",
              }}
            >
              BOSS
            </span>
          )}
        </div>

        {/* Status indicator */}
        <div>
          {isCompleted && (
            <span
              className="text-[9px] font-bold"
              style={{ color: "#4ADE80" }}
            >
              &#10003;
            </span>
          )}
          {isCurrent && (
            <span
              className="text-[8px] font-bold uppercase tracking-wider animate-pulse"
              style={{ color: "#22D3EE" }}
            >
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Category icons row */}
      <div className="flex items-center gap-1 flex-wrap">
        {uniqueCategories.slice(0, 4).map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm"
            style={{
              background: `${CATEGORY_COLORS[cat]}10`,
              color: CATEGORY_COLORS[cat],
              border: `1px solid ${CATEGORY_COLORS[cat]}20`,
            }}
            title={cat.replace(/_/g, " ")}
          >
            {CATEGORY_ICONS[cat]}
          </span>
        ))}
        {uniqueCategories.length > 4 && (
          <span
            className="text-[7px] font-mono"
            style={{ color: "#5A6E86" }}
          >
            +{uniqueCategories.length - 4}
          </span>
        )}
      </div>

      {/* Stats (only for completed waves with data) */}
      {stats && isCompleted && (
        <div
          className="flex items-center gap-2 mt-1 text-[8px] font-mono"
          style={{ color: "#5A6E86" }}
        >
          <span>{stats.failures} fail</span>
          <span>{stats.blocked} blocked</span>
          <span style={{ color: "#FBBF24" }}>+{stats.score}</span>
        </div>
      )}
    </button>
  );
}

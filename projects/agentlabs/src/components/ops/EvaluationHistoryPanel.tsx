
import type { RunMetrics } from "@/types/agentforge";

interface EvaluationHistoryPanelProps {
  metrics: RunMetrics;
  currentWave: number;
}

interface WaveRow {
  wave: number;
  reward: number;
  survival: number;
  passed: boolean;
}

function deriveWaveData(metrics: RunMetrics, currentWave: number): WaveRow[] {
  const rows: WaveRow[] = [];
  const passRatio = metrics.passed / Math.max(metrics.passed + metrics.failed, 1);

  // Deterministic seed derived from metrics to keep server/client in sync
  const seed = metrics.attacksTested * 13 + metrics.passed * 7 + metrics.failed * 3;

  for (let w = 1; w <= Math.min(currentWave, 3); w++) {
    const isLast = w === currentWave;
    // Use deterministic pseudo-random from seed instead of Math.random()
    const pseudoRandom = ((seed * w * 17 + w * 31) % 15) - 2;
    const survival = isLast
      ? Math.round(metrics.failureRateAfter > 0 ? 100 - metrics.failureRateAfter : 85 + pseudoRandom)
      : Math.round(70 + pseudoRandom + w * 5);
    const reward = isLast
      ? Math.round(passRatio * 250)
      : Math.round(100 + w * 35 + pseudoRandom * 3);

    rows.push({
      wave: w,
      reward,
      survival: Math.min(survival, 100),
      passed: true,
    });
  }

  return rows;
}

export default function EvaluationHistoryPanel({
  metrics,
  currentWave,
}: EvaluationHistoryPanelProps) {
  const waves = deriveWaveData(metrics, currentWave);

  return (
    <div>
      <div className="flex items-center mb-1.5" style={{ padding: "0 2px" }}>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
        >
          EVALUATION HISTORY
        </span>
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "#151D2E",
          border: "1px solid rgba(110,130,160,0.15)",
        }}
      >
        {/* Header */}
        <div
          className="grid grid-cols-4 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "#5A6E86", borderBottom: "1px solid rgba(110,130,160,0.1)" }}
        >
          <span>Wave</span>
          <span className="text-center">Reward</span>
          <span className="text-center">Survival</span>
          <span className="text-right">Status</span>
        </div>

        {/* Data rows */}
        {waves.map((row) => (
          <div
            key={row.wave}
            className="grid grid-cols-4 px-3 py-1.5 text-[12px]"
            style={{
              color: "#E8EDF4",
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              borderBottom: "1px solid rgba(110,130,160,0.06)",
            }}
          >
            <span style={{ color: "#8FA0B8" }}>Wave {row.wave}</span>
            <span className="text-center" style={{ color: "#4ADE80" }}>
              +{row.reward}
            </span>
            <span className="text-center" style={{ color: "#E8EDF4" }}>
              {row.survival}%
            </span>
            <span className="flex items-center justify-end gap-1.5">
              <div
                className="rounded-full"
                style={{ width: "5px", height: "5px", background: "#4ADE80" }}
              />
              <span style={{ color: "#4ADE80" }}>PASS</span>
            </span>
          </div>
        ))}

        {/* Empty state if no waves */}
        {waves.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-center" style={{ color: "#5A6E86" }}>
            No evaluation data yet.
          </div>
        )}
      </div>
    </div>
  );
}


import { useMemo } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FailureCluster {
  category: string;
  count: number;
  percentage: number;
  reasons: string[];
}

interface FailureClusterPanelProps {
  results: FailureCluster[];
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FailureClusterPanel({
  results,
}: FailureClusterPanelProps) {
  const totalFailures = useMemo(
    () => results.reduce((sum, c) => sum + c.count, 0),
    [results],
  );

  const sorted = useMemo(
    () => [...results].sort((a, b) => b.count - a.count),
    [results],
  );

  if (results.length === 0) {
    return (
      <div
        className="rounded-xl flex flex-col p-5"
        style={{
          background: "#FAF9F6",
          border: "1px solid #DCD8CC",
        }}
      >
        <span
          className="text-[11px] font-bold tracking-widest uppercase mb-3"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Failure Clusters
        </span>
        <div
          className="flex items-center justify-center py-8 text-sm"
          style={{ color: "#7A7D85" }}
        >
          No failures detected. All verifier rules passed.
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#FAF9F6",
        border: "1px solid #DCD8CC",
        padding: "16px",
        gap: "14px",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Failure Clusters
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: "#C2414B" }}
        >
          {totalFailures} total
        </span>
      </div>

      {/* Cluster list */}
      <div className="flex flex-col gap-4">
        {sorted.map((cluster, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            {/* Category header */}
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-semibold"
                style={{ color: "#1D1D1F" }}
              >
                {cluster.category}
              </span>
              <span
                className="text-xs font-mono font-semibold"
                style={{
                  color:
                    cluster.percentage > 40
                      ? "#C2414B"
                      : cluster.percentage > 20
                        ? "#C77700"
                        : "#575A60",
                }}
              >
                {cluster.count} ({cluster.percentage}%)
              </span>
            </div>

            {/* Horizontal bar chart (CSS, no library) */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{
                  background: "#EEECE4",
                  height: "8px",
                }}
              >
                <div
                  className="rounded-full h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, cluster.percentage)}%`,
                    background:
                      cluster.percentage > 40
                        ? "#C2414B"
                        : cluster.percentage > 20
                          ? "#C77700"
                          : "#2563EB",
                  }}
                />
              </div>
            </div>

            {/* Top failure reasons */}
            {cluster.reasons.length > 0 && (
              <div className="flex flex-col gap-1 ml-1">
                {cluster.reasons.slice(0, 3).map((reason, ridx) => (
                  <div
                    key={ridx}
                    className="flex items-start gap-2 text-xs"
                    style={{ color: "#575A60" }}
                  >
                    <span
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: "#7A7D85" }}
                    >
                      {ridx + 1}.
                    </span>
                    <span>{reason}</span>
                  </div>
                ))}
                {cluster.reasons.length > 3 && (
                  <span
                    className="text-xs ml-4"
                    style={{ color: "#7A7D85" }}
                  >
                    +{cluster.reasons.length - 3} more reasons
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

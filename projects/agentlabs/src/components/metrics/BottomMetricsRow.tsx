
import type { RunMetrics } from "@/types/agentforge";

interface BottomMetricsRowProps {
  metrics: RunMetrics;
}

export default function BottomMetricsRow({ metrics }: BottomMetricsRowProps) {
  const totalReward = Math.round(metrics.robustnessGain * 10);
  const survivalTime = metrics.attacksTested * 4;
  const winRatePct = Math.round((metrics.passed / Math.max(metrics.attacksTested, 1)) * 100);
  const damageTaken = metrics.failed;

  return (
    <div className="grid grid-cols-4 gap-3">
      <MetricCard
        label="Total Reward"
        value={totalReward}
        suffix="pts"
        valueColor="#E8EDF4"
        bars={[24, 48, 32, 56, 40]}
        barColors={["#4ADE80", "#60A5FA", "#A78BFA", "#22D3EE", "#FBBF24"]}
      />
      <MetricCard
        label="Survival Time"
        value={survivalTime}
        suffix="s"
        valueColor="#E8EDF4"
        bars={[40, 56, 68, 48, 72]}
        barColors={["#60A5FA", "#22D3EE", "#4ADE80", "#A78BFA", "#FBBF24"]}
      />
      <MetricCard
        label="Win Rate"
        value={winRatePct}
        suffix="%"
        valueColor="#4ADE80"
        bars={[32, 44, 60, 72, 84]}
        barColors={["#4ADE80", "#60A5FA", "#22D3EE", "#A78BFA", "#4ADE80"]}
      />
      <MetricCard
        label="Damage Taken"
        value={damageTaken}
        suffix="hits"
        valueColor="#F87171"
        bars={[56, 40, 28, 16, 8]}
        barColors={["#F87171", "#FBBF24", "#60A5FA", "#4ADE80", "#22D3EE"]}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  valueColor,
  bars,
  barColors,
}: {
  label: string;
  value: number;
  suffix: string;
  valueColor: string;
  bars: number[];
  barColors: string[];
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: "#151D2E",
        border: "1px solid rgba(110, 130, 160, 0.15)",
      }}
    >
      {/* Label */}
      <span
        className="uppercase tracking-wider"
        style={{
          fontSize: "10px",
          color: "#5A6E86",
          fontWeight: 600,
        }}
      >
        {label}
      </span>

      {/* Large value */}
      <div className="flex items-baseline gap-1">
        <span
          className="font-bold font-mono"
          style={{
            fontSize: "24px",
            color: valueColor,
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "13px",
            color: "#5A6E86",
          }}
        >
          {suffix}
        </span>
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-[3px] h-4 mt-1">
        {bars.map((height, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{
              width: "2px",
              height: `${Math.max(4, height)}%`,
              maxHeight: "16px",
              background: barColors[i % barColors.length],
              borderRadius: "1px",
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    </div>
  );
}

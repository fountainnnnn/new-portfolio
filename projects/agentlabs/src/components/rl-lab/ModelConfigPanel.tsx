
interface ModelConfigPanelProps {
  baseModel: string;
  trainingMode: string;
  frozenBase: boolean;
  adapterRank: number;
  rewardObjective: string;
  batchSize: number;
  trainingSteps: number;
  onLoadDemoConfig: () => void;
  onBaseModelChange?: (value: string) => void;
  onTrainingModeChange?: (value: string) => void;
  onFrozenBaseChange?: (value: boolean) => void;
  onAdapterRankChange?: (value: number) => void;
}

export default function ModelConfigPanel({
  baseModel,
  trainingMode,
  frozenBase,
  adapterRank,
  rewardObjective,
  batchSize,
  trainingSteps,
  onLoadDemoConfig,
}: ModelConfigPanelProps) {
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
      {/* Header + demo button */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Model Configuration
        </span>
        <button
          type="button"
          onClick={onLoadDemoConfig}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
          style={{
            background: "rgba(124, 58, 237, 0.1)",
            color: "#7C3AED",
            border: "1px solid rgba(124, 58, 237, 0.2)",
          }}
        >
          Load Demo Config
        </button>
      </div>

      {/* Form grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {/* Base Model */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Base Model
          </label>
          <div
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {baseModel}
          </div>
        </div>

        {/* Training Mode */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Training Mode
          </label>
          <div
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {trainingMode}
          </div>
        </div>

        {/* Frozen Base */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Frozen Base
          </label>
          <div className="flex items-center gap-2">
            <div
              className="rounded w-4 h-4 flex items-center justify-center"
              style={{
                background: frozenBase ? "#7C3AED" : "#FFFFFF",
                border: frozenBase ? "1px solid #7C3AED" : "1px solid #DCD8CC",
              }}
            >
              {frozenBase && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-[13px]" style={{ color: "#575A60" }}>
              {frozenBase ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Adapter Rank */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Adapter Rank
          </label>
          <div
            className="rounded-lg px-3 py-1.5 text-[13px] font-mono font-medium"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            r={adapterRank}
          </div>
        </div>

        {/* Reward Objective */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Reward Objective
          </label>
          <div
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {rewardObjective}
          </div>
        </div>

        {/* Batch Size */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Batch Size
          </label>
          <div
            className="rounded-lg px-3 py-1.5 text-[13px] font-mono font-medium"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {batchSize}
          </div>
        </div>

        {/* Training Steps (full width) */}
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Training Steps
          </label>
          <div
            className="rounded-lg px-3 py-1.5 text-[13px] font-mono font-medium"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {trainingSteps.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

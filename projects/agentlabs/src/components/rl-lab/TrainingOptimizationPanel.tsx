
import { useState, useCallback, useMemo } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TrainingConfig {
  trainingSteps: number;
  batchSize: number;
  learningRate: number;
  adapterRank: number;
  checkpointInterval: number;
  earlyStoppingPatience: number;
}

interface TrainingMetrics {
  samplesPerSec: number;
  tokensPerSec: number;
  memoryEstimate: string;
}

interface TrainingOptimizationPanelProps {
  trainingConfig: TrainingConfig;
  currentStep: number;
  metrics: TrainingMetrics;
  onUpdateConfig: (config: Partial<TrainingConfig>) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TrainingOptimizationPanel({
  trainingConfig,
  currentStep,
  metrics,
  onUpdateConfig,
}: TrainingOptimizationPanelProps) {
  const [localConfig, setLocalConfig] = useState<TrainingConfig>(trainingConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = useCallback(
    (key: keyof TrainingConfig, value: number) => {
      setLocalConfig((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    [],
  );

  const handleSave = useCallback(() => {
    setIsSaving(true);
    setTimeout(() => {
      onUpdateConfig(localConfig);
      setIsDirty(false);
      setIsSaving(false);
    }, 400);
  }, [localConfig, onUpdateConfig]);

  // Computed values
  const effectiveBatchSize = useMemo(
    () => localConfig.batchSize * 4, // simulated gradient accumulation steps
    [localConfig.batchSize],
  );

  const totalParams = useMemo(() => {
    // Simulated param counts: 3B base model with LoRA
    const baseParams = 3_000_000_000;
    const trainablePerRank = 2_000_000; // ~2M params per rank for LoRA
    const trainable = localConfig.adapterRank * trainablePerRank;
    const frozen = baseParams - trainable;
    return { trainable, frozen };
  }, [localConfig.adapterRank]);

  const progress = useMemo(
    () =>
      localConfig.trainingSteps > 0
        ? Math.min(100, Math.round((currentStep / localConfig.trainingSteps) * 100))
        : 0,
    [currentStep, localConfig.trainingSteps],
  );

  const estTimeRemaining = useMemo(() => {
    const remaining = localConfig.trainingSteps - currentStep;
    const secondsPerStep = 1.2; // simulated
    const totalSec = Math.round(remaining * secondsPerStep);
    if (totalSec < 60) return `${totalSec}s`;
    if (totalSec < 3600) return `${Math.round(totalSec / 60)}m ${totalSec % 60}s`;
    return `${Math.floor(totalSec / 3600)}h ${Math.round((totalSec % 3600) / 60)}m`;
  }, [currentStep, localConfig.trainingSteps]);

  const needsEarlyStopping = useMemo(() => {
    // Simulated: if progress is > 50% and we haven't checked in a while
    return progress > 50 && progress < 80;
  }, [progress]);

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#F4F1F8",
        border: "1px solid #DCD8CC",
        padding: "14px",
        gap: "12px",
      }}
    >
      {/* Header */}
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Training Optimization
      </span>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "#7A7D85" }}>Progress</span>
          <span className="font-mono font-semibold" style={{ color: "#1D1D1F" }}>
            {currentStep} / {localConfig.trainingSteps} ({progress}%)
          </span>
        </div>
        <div
          className="rounded-full overflow-hidden"
          style={{ background: "#DCD8CC", height: "6px" }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#7C3AED",
              borderRadius: "9999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* 2-column config grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {/* Training Steps */}
        <div className="flex flex-col gap-1 col-span-2">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Training Steps
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={100}
              max={10000}
              step={100}
              value={localConfig.trainingSteps}
              onChange={(e) => handleChange("trainingSteps", Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: "#7C3AED" }}
            />
            <span
              className="text-sm font-mono font-semibold w-20 text-right"
              style={{ color: "#1D1D1F" }}
            >
              {localConfig.trainingSteps.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Batch Size */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Batch Size
          </label>
          <input
            type="number"
            min={1}
            max={256}
            value={localConfig.batchSize}
            onChange={(e) => handleChange("batchSize", Math.max(1, Number(e.target.value)))}
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono outline-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          />
        </div>

        {/* Effective Batch Size (computed) */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Effective Batch Size
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
            style={{
              background: "#F2F8FC",
              border: "1px solid #DCD8CC",
              color: "#575A60",
            }}
          >
            {effectiveBatchSize} (x4 GA)
          </div>
        </div>

        {/* Learning Rate */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Learning Rate
          </label>
          <input
            type="number"
            min={1e-7}
            max={1e-3}
            step={1e-6}
            value={localConfig.learningRate}
            onChange={(e) =>
              handleChange("learningRate", Number(e.target.value))
            }
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono outline-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          />
        </div>

        {/* Adapter Rank */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Adapter Rank
          </label>
          <input
            type="number"
            min={1}
            max={256}
            value={localConfig.adapterRank}
            onChange={(e) => handleChange("adapterRank", Math.max(1, Number(e.target.value)))}
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono outline-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          />
        </div>

        {/* Trainable Params Estimate */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Trainable Params
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#21865A",
            }}
          >
            {(totalParams.trainable / 1_000_000).toFixed(1)}M
          </div>
        </div>

        {/* Frozen Params Estimate */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Frozen Params
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#575A60",
            }}
          >
            {(totalParams.frozen / 1_000_000_000).toFixed(2)}B
          </div>
        </div>

        {/* Samples/sec */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Samples/sec
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {metrics.samplesPerSec.toFixed(1)}
          </div>
        </div>

        {/* Tokens/sec */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Tokens/sec
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {metrics.tokensPerSec.toFixed(1)}
          </div>
        </div>

        {/* Est. Time Remaining */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Est. Time Remaining
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono font-semibold"
            style={{
              background: "#FBF5DF",
              border: "1px solid #DCD8CC",
              color: "#C77700",
            }}
          >
            {estTimeRemaining}
          </div>
        </div>

        {/* Memory Estimate */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Memory Estimate
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          >
            {metrics.memoryEstimate}
          </div>
        </div>

        {/* Checkpoint Interval */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Checkpoint Interval
          </label>
          <input
            type="number"
            min={50}
            max={5000}
            step={50}
            value={localConfig.checkpointInterval}
            onChange={(e) =>
              handleChange("checkpointInterval", Math.max(50, Number(e.target.value)))
            }
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono outline-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          />
        </div>

        {/* Early Stopping Indicator */}
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Early Stopping
          </label>
          <div
            className="w-full rounded-lg px-3 py-1.5 text-sm font-mono flex items-center gap-2"
            style={{
              background: needsEarlyStopping
                ? "rgba(199, 119, 0, 0.08)"
                : "#FFFFFF",
              border: needsEarlyStopping
                ? "1px solid rgba(199, 119, 0, 0.3)"
                : "1px solid #DCD8CC",
              color: needsEarlyStopping ? "#C77700" : "#7A7D85",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: needsEarlyStopping ? "#C77700" : "#21865A",
              }}
            />
            {needsEarlyStopping
              ? "Patience: " + localConfig.earlyStoppingPatience + " steps"
              : "Not needed"}
          </div>
        </div>
      </div>

      {/* Update Config Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || isSaving}
        className="w-full h-9 rounded-lg text-sm font-bold transition-all"
        style={{
          background: isDirty && !isSaving ? "#7C3AED" : "#DCD8CC",
          color: isDirty && !isSaving ? "#FFFFFF" : "#7A7D85",
          border: "none",
          cursor: isDirty && !isSaving ? "pointer" : "not-allowed",
        }}
      >
        {isSaving ? "Updating..." : "Update Config"}
      </button>
    </div>
  );
}

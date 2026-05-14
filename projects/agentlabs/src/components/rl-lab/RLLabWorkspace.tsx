
import ModelConfigPanel from "@/components/rl-lab/ModelConfigPanel";
import RewardSignalPanel from "@/components/rl-lab/RewardSignalPanel";
import CheckpointGenerationsPanel from "@/components/rl-lab/CheckpointGenerationsPanel";
import TrainingLogPanel from "@/components/rl-lab/TrainingLogPanel";
import type {
  RLLabState,
  RewardComponents,
  RLCheckpoint,
  BattleEvent,
  WaveDefinition,
  RunMetrics,
} from "@/types/agentforge";

interface RLLabWorkspaceProps {
  state: RLLabState;
  isRunning: boolean;

  onLoadDemoConfig: () => void;
  onExportCheckpoint: () => void;
  onExportAdapter: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;

  onRunBatch: () => void;
  onEvaluate: () => void;
  onTrainAdapter: () => void;

  derivedMetrics: RunMetrics;
  waves: WaveDefinition[];
  currentWave: number;
}

export default function RLLabWorkspace({
  state,
  isRunning,
  onLoadDemoConfig,
  onExportCheckpoint,
  onExportAdapter,
  onExportReport,
  onExportBundle,
  onRunBatch,
  onEvaluate,
  onTrainAdapter,
  derivedMetrics,
  waves,
  currentWave,
}: RLLabWorkspaceProps) {
  return (
    <div className="flex flex-1 w-full overflow-hidden">
      {/* Left panel: 450px */}
      <div
        className="flex-shrink-0 overflow-y-auto flex flex-col"
        style={{
          width: "450px",
          background: "#FAF9F6",
          borderRight: "1px solid #DCD8CC",
          padding: "14px",
          gap: "14px",
          scrollbarWidth: "thin",
          scrollbarColor: "#DCD8CC transparent",
        }}
      >
        <ModelConfigPanel
          baseModel={state.modelName}
          trainingMode={state.trainingMode}
          frozenBase={state.frozenBase}
          adapterRank={state.adapterRank}
          rewardObjective={
            state.rewardComponents
              ? "Constitutional RL"
              : "Standard RL"
          }
          batchSize={state.batchSize}
          trainingSteps={state.trainingSteps}
          onLoadDemoConfig={onLoadDemoConfig}
        />

        <DatasetPanel
          ready={state.datasetReady}
          generated={state.harnessesGenerated}
          currentStep={state.currentStep}
          totalSteps={state.trainingSteps}
        />

        <RLHarnessArmyPanel
          status={state.status}
          checkpoints={state.checkpoints}
          activeId={state.activeCheckpointId}
        />

        <RewardSignalPanel components={state.rewardComponents} />

        <CheckpointGenerationsPanel
          checkpoints={state.checkpoints}
          activeId={state.activeCheckpointId}
        />

        <TrainingLogPanel events={state.events} />

        <RLLabExportPanel
          onExportCheckpoint={onExportCheckpoint}
          onExportAdapter={onExportAdapter}
          onExportReport={onExportReport}
          onExportBundle={onExportBundle}
        />
      </div>

      {/* Right panel: flex-1 */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ background: "#FCFCF7" }}
      >
        {/* Arena + training area */}
        <div className="flex-1 flex flex-col p-4 gap-3" style={{ minHeight: 0 }}>
          {/* PixiArenaWrapper placeholder */}
          <div
            className="flex-1 rounded-xl flex flex-col items-center justify-center"
            style={{
              background: "#FAF9F6",
              border: "1px solid #DCD8CC",
              minHeight: "280px",
            }}
          >
            <div
              className="arena-grid w-full h-full rounded-xl flex flex-col items-center justify-center"
              style={{ position: "relative", overflow: "hidden" }}
            >
              {/* RL visualization icon */}
              <div className="flex items-center gap-3 mb-2" style={{ pointerEvents: "none" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#7C3AED" strokeWidth="1.5" fill="rgba(124,58,237,0.08)" />
                  <path d="M12 7V12L15 15" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="2" fill="#7C3AED" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold" style={{ color: "#7A7D85" }}>
                RL Training Arena
              </span>
              <span className="text-[11px]" style={{ color: "#7A7D85", marginTop: "2px" }}>
                Step {state.currentStep} / {state.trainingSteps} | {state.modelName}
              </span>
              {isRunning && (
                <div
                  className="mt-3 w-8 h-8 rounded-full border-2"
                  style={{
                    borderColor: "#DCD8CC",
                    borderTopColor: "#7C3AED",
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
            </div>
          </div>

          {/* Bottom metrics */}
          <LabMetricsRow
            currentStep={state.currentStep}
            totalSteps={state.trainingSteps}
            rewardComponents={state.rewardComponents}
          />

          {/* Wave ladder */}
          <WaveLadder waves={waves} currentWave={currentWave} />
        </div>
      </div>
    </div>
  );
}

/* ========== Inline sub-components ========== */

/* --- DatasetPanel --- */

function DatasetPanel({
  ready,
  generated,
  currentStep,
  totalSteps,
}: {
  ready: boolean;
  generated: boolean;
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#F2F8FC",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Dataset
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #DCD8CC" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>Status</span>
          <span className="text-[13px] font-semibold" style={{ color: ready ? "#21865A" : "#C77700" }}>
            {ready ? "Ready" : "Loading"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #DCD8CC" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>Harnesses</span>
          <span className="text-[13px] font-semibold" style={{ color: generated ? "#21865A" : "#7A7D85" }}>
            {generated ? "Generated" : "Pending"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg px-3 py-2 col-span-2" style={{ background: "#FFFFFF", border: "1px solid #DCD8CC" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>Categories</span>
          <span className="text-[13px]" style={{ color: "#575A60" }}>
            jailbreak, deceptive, unsafe compliance, correct refusal, hallucination, exfiltration, role confusion, tool safety, consistency, multi-turn, policy generalization, reward hacking
          </span>
        </div>
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: "#DCD8CC", height: "4px" }}
      >
        <div
          style={{
            width: `${Math.min(100, (currentStep / Math.max(totalSteps, 1)) * 100)}%`,
            height: "100%",
            background: "#7C3AED",
            borderRadius: "2px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

/* --- RLHarnessArmyPanel --- */

function RLHarnessArmyPanel({
  status,
  checkpoints,
  activeId,
}: {
  status: RLLabState["status"];
  checkpoints: RLCheckpoint[];
  activeId: string;
}) {
  const activeCheckpoint = checkpoints.find((c) => c.id === activeId);
  const totalGenerated = checkpoints.length * 50;

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#FBF5DF",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        RL Harness Army
      </span>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>Generated</span>
          <span className="text-[24px] font-bold font-mono" style={{ color: "#1D1D1F", lineHeight: 1.1 }}>{totalGenerated}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>Checkpoints</span>
          <span className="text-[24px] font-bold font-mono" style={{ color: "#7C3AED", lineHeight: 1.1 }}>{checkpoints.length}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>Status</span>
          <span
            className="text-[13px] font-bold font-mono mt-1"
            style={{
              color:
                status === "completed"
                  ? "#21865A"
                  : status === "runningBatch" || status === "computingRewards" || status === "trainingAdapter"
                    ? "#C77700"
                    : "#7A7D85",
            }}
          >
            {status === "idle" ? "Idle" : status === "runningBatch" ? "Training" : status === "computingRewards" ? "Scoring" : status === "trainingAdapter" ? "Adapter" : status === "evaluating" ? "Eval" : "Done"}
          </span>
        </div>
      </div>
      {activeCheckpoint && (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "#575A60" }}>
          <span className="font-semibold">Active:</span>
          <span style={{ color: "#7C3AED" }}>{activeCheckpoint.name}</span>
          <span style={{ color: "#21865A" }}>R: {activeCheckpoint.rewardScore.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

/* --- RLLabExportPanel --- */

function RLLabExportPanel({
  onExportCheckpoint,
  onExportAdapter,
  onExportReport,
  onExportBundle,
}: {
  onExportCheckpoint: () => void;
  onExportAdapter: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
}) {
  const buttons = [
    { label: "Export checkpoint.json", onClick: onExportCheckpoint },
    { label: "Export adapter.bin", onClick: onExportAdapter },
    { label: "Export report.json", onClick: onExportReport },
    { label: "Export bundle.zip", onClick: onExportBundle },
  ];

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#F2F8FC",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "8px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Export
      </span>
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            className="h-9 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "#FFFFFF",
              color: "#575A60",
              border: "1px solid #DCD8CC",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --- LabMetricsRow (replacement for BottomMetricsRow) --- */

function LabMetricsRow({
  currentStep,
  totalSteps,
  rewardComponents,
}: {
  currentStep: number;
  totalSteps: number;
  rewardComponents: RewardComponents;
}) {
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
  const bestReward = Math.max(
    rewardComponents.policyAdherence,
    rewardComponents.correctness,
    rewardComponents.refusalAccuracy,
    rewardComponents.toolSafety,
    rewardComponents.consistency
  );
  const totalPenalty = Math.abs(
    rewardComponents.leakagePenalty +
    rewardComponents.hallucinationPenalty +
    rewardComponents.unsafeCompliancePenalty +
    rewardComponents.rewardHackingPenalty
  );

  return (
    <div className="grid grid-cols-4 gap-3">
      <LabMetricCard label="Progress" value={progress} suffix="%" valueColor="#1D1D1F" />
      <LabMetricCard
        label="Net Reward"
        value={Math.round(rewardComponents.total * 10) / 10}
        suffix="pts"
        valueColor={rewardComponents.total >= 0 ? "#21865A" : "#C2414B"}
        helper="Higher is better; below 0 is bad"
      />
      <LabMetricCard
        label="Top Signal"
        value={bestReward.toFixed(2)}
        suffix="/ 1.00"
        valueColor="#0284C7"
        helper="Best reward component; higher is better"
      />
      <LabMetricCard label="Penalty Sum" value={totalPenalty.toFixed(1)} suffix="pts" valueColor="#C2414B" />
    </div>
  );
}

function LabMetricCard({
  label,
  value,
  suffix,
  valueColor,
  helper,
}: {
  label: string;
  value: string | number;
  suffix: string;
  valueColor: string;
  helper?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        background: "#FAF9F6",
        border: "1px solid #DCD8CC",
      }}
    >
      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-bold font-mono" style={{ fontSize: "22px", color: valueColor, lineHeight: 1.1 }}>
          {value}
        </span>
        <span className="text-[12px] font-mono" style={{ color: "#7A7D85" }}>
          {suffix}
        </span>
      </div>
      {helper ? (
        <span className="text-[11px] font-semibold leading-tight" style={{ color: "#7A7D85" }}>
          {helper}
        </span>
      ) : null}
    </div>
  );
}

/* --- WaveLadder --- */

function WaveLadder({
  waves,
  currentWave,
}: {
  waves: WaveDefinition[];
  currentWave: number;
}) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#FAF9F6",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "8px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Wave Ladder
      </span>
      <div className="flex items-center gap-2">
        {waves.map((wave, idx) => {
          const isActive = wave.waveNumber === currentWave;
          const isPast = wave.waveNumber < currentWave;
          const isBoss = wave.isBossWave;

          return (
            <div key={wave.waveNumber} className="flex items-center gap-2 flex-1">
              <div
                className="flex-1 rounded-lg flex flex-col items-center py-2 transition-all"
                style={{
                  background: isActive
                    ? "rgba(124, 58, 237, 0.08)"
                    : isPast
                      ? "rgba(33, 134, 90, 0.06)"
                      : "#FFFFFF",
                  border: isActive
                    ? "1px solid rgba(124, 58, 237, 0.3)"
                    : isBoss
                      ? "1px solid rgba(194, 65, 75, 0.2)"
                      : "1px solid #DCD8CC",
                }}
              >
                <span
                  className="text-[13px] font-bold font-mono"
                  style={{
                    color: isActive
                      ? "#7C3AED"
                      : isPast
                        ? "#21865A"
                        : "#7A7D85",
                  }}
                >
                  {wave.waveNumber}
                </span>
                <span
                  className="text-[9px] uppercase tracking-wider font-semibold mt-0.5"
                  style={{
                    color: isBoss
                      ? "#C2414B"
                      : isActive
                        ? "#7C3AED"
                        : "#7A7D85",
                  }}
                >
                  {isBoss ? "BOSS" : wave.harnessCount + " atk"}
                </span>
              </div>
              {idx < waves.length - 1 && (
                <div
                  style={{
                    width: "8px",
                    height: "1px",
                    background: "#DCD8CC",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

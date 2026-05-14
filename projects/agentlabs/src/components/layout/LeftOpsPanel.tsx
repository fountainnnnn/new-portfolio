
import LogsPanel from "@/components/ops/LogsPanel";
import SettingsPanel from "@/components/ops/SettingsPanel";
import AgentGenerationsPanel from "@/components/ops/AgentGenerationsPanel";
import AttackQueuePanel from "@/components/ops/AttackQueuePanel";
import EvaluationHistoryPanel from "@/components/ops/EvaluationHistoryPanel";
import LatestPatchPanel from "@/components/ops/LatestPatchPanel";
import type { BattleState } from "@/types/agentforge";

interface LeftOpsPanelProps {
  state: BattleState;
  isRunning: boolean;
  onAttackClick: (attackId: string) => void;
}

export default function LeftOpsPanel({ state, isRunning, onAttackClick }: LeftOpsPanelProps) {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        background: "#0F1624",
        padding: "14px",
        gap: "14px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(110,130,160,0.2) transparent",
      }}
    >
      <LogsPanel events={state.events} />
      <SettingsPanel />
      <AgentGenerationsPanel generations={state.generations} activeId={state.activeGenerationId} />
      <AttackQueuePanel attacks={state.attacks} onAttackClick={onAttackClick} />
      <EvaluationHistoryPanel metrics={state.metrics} currentWave={state.currentWave} />
      <LatestPatchPanel patch={state.latestPatch} />
    </div>
  );
}

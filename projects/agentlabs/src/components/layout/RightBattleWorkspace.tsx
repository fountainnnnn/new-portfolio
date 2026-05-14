
import ArenaHeader from "@/components/arena/ArenaHeader";
import LiveArenaPanel from "@/components/arena/LiveArenaPanel";
import BottomMetricsRow from "@/components/metrics/BottomMetricsRow";
import ExportAndNextWavePanel from "@/components/export/ExportAndNextWavePanel";
import type { BattleState } from "@/types/agentforge";

interface RightBattleWorkspaceProps {
  state: BattleState;
  narration: string;
  onRunWave: () => void;
  onExportAgent: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
  isRunning: boolean;
}

export default function RightBattleWorkspace({
  state,
  narration,
  onRunWave,
  onExportAgent,
  onExportReport,
  onExportBundle,
  isRunning,
}: RightBattleWorkspaceProps) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#0A0E17" }}>
      {/* Compact top header strip */}
      <ArenaHeader currentWave={state.currentWave} status={state.status} />

      {/* Live arena centerpiece -- includes built-in HUD and narration bar */}
      <LiveArenaPanel state={state} narration={narration} />

      {/* Bottom metrics & export / wave controls */}
      <div
        className="flex flex-col gap-3 px-4 pb-4"
        style={{ paddingTop: "12px" }}
      >
        <BottomMetricsRow metrics={state.metrics} />
        <ExportAndNextWavePanel
          onRunWave={onRunWave}
          onExportAgent={onExportAgent}
          onExportReport={onExportReport}
          onExportBundle={onExportBundle}
          isRunning={isRunning}
        />
      </div>
    </div>
  );
}

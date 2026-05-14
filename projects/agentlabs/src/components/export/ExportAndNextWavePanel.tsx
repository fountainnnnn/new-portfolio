
interface ExportAndNextWavePanelProps {
  onRunWave: () => void;
  onExportAgent: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
  isRunning: boolean;
}

export default function ExportAndNextWavePanel({
  onRunWave,
  onExportAgent,
  onExportReport,
  onExportBundle,
  isRunning,
}: ExportAndNextWavePanelProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Export & Share panel */}
      <ExportSubPanel
        onExportReport={onExportReport}
        onExportBundle={onExportBundle}
        onExportAgent={onExportAgent}
      />

      {/* Next Wave panel */}
      <NextWavePanel onRunWave={onRunWave} isRunning={isRunning} />
    </div>
  );
}

function ExportSubPanel({
  onExportReport,
  onExportBundle,
  onExportAgent,
}: {
  onExportReport: () => void;
  onExportBundle: () => void;
  onExportAgent: () => void;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "#151D2E",
        border: "1px solid rgba(110, 130, 160, 0.15)",
      }}
    >
      {/* Header */}
      <span
        className="uppercase tracking-wider"
        style={{
          fontSize: "10px",
          color: "#5A6E86",
          fontWeight: 600,
        }}
      >
        EXPORT & SHARE
      </span>

      {/* Export buttons */}
      <div className="flex flex-col gap-2">
        <ExportButton
          label="Export Logs"
          onClick={onExportReport}
          iconColor="#4ADE80"
          iconShadow="rgba(74,222,128,0.3)"
        />
        <ExportButton
          label="Export Replay"
          onClick={onExportBundle}
          iconColor="#60A5FA"
          iconShadow="rgba(96,165,250,0.3)"
        />
        <ExportButton
          label="Export Agent"
          onClick={onExportAgent}
          iconColor="#A78BFA"
          iconShadow="rgba(167,139,250,0.3)"
        />
      </div>
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  iconColor,
  iconShadow,
}: {
  label: string;
  onClick: () => void;
  iconColor: string;
  iconShadow: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all hover:opacity-80 px-3"
      style={{
        height: "40px",
        background: "#151D2E",
        border: "1px solid rgba(110, 130, 160, 0.15)",
        color: "#E8EDF4",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(110, 130, 160, 0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(110, 130, 160, 0.15)";
      }}
    >
      {/* Icon placeholder */}
      <span
        className="rounded flex-shrink-0"
        style={{
          width: "16px",
          height: "16px",
          background: iconColor,
          boxShadow: `0 0 8px ${iconShadow}`,
          opacity: 0.7,
        }}
      />
      <span>{label}</span>
    </button>
  );
}

function NextWavePanel({
  onRunWave,
  isRunning,
}: {
  onRunWave: () => void;
  isRunning: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "#151D2E",
        border: "1px solid rgba(110, 130, 160, 0.15)",
      }}
    >
      {/* Header */}
      <span
        className="uppercase tracking-wider"
        style={{
          fontSize: "10px",
          color: "#5A6E86",
          fontWeight: 600,
        }}
      >
        NEXT WAVE
      </span>

      {/* Description */}
      <p
        style={{
          fontSize: "12px",
          color: "#8FA0B8",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Run the next wave of adversarial attacks against the current agent
        generation.
      </p>

      {/* Run Wave button */}
      <button
        onClick={onRunWave}
        disabled={isRunning}
        className="w-full rounded-lg font-bold text-base transition-all disabled:cursor-not-allowed"
        style={{
          height: "48px",
          background: isRunning
            ? "rgba(74, 222, 128, 0.4)"
            : "#4ADE80",
          color: "#0A0E17",
          border: "none",
          opacity: isRunning ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isRunning) {
            e.currentTarget.style.background = "#65E89A";
          }
        }}
        onMouseLeave={(e) => {
          if (!isRunning) {
            e.currentTarget.style.background = "#4ADE80";
          }
        }}
      >
        {isRunning ? "Running..." : "Run Wave"}
      </button>
    </div>
  );
}

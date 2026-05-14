import { Link, NavLink } from "react-router-dom";

interface TopNavigationBarProps {
  mode?: "LoRA Lab" | string;
  currentWave?: number;
  activeLabel?: string;
  harnessCount?: number;
  onSpawnHarnesses?: () => void;
  onRunWave?: () => void;
  onReplay?: () => void;
  onApplyPatch?: () => void;
  onExport?: () => void;
  isRunning?: boolean;
}

function getModeMeta(mode?: string) {
  if (mode === "LoRA Lab" || mode === "RL Lab") {
    return {
      label: "LoRA Lab",
      accent: "#7C3AED",
      generationLabel: "Checkpoint",
      runLabel: "Run Batch",
      upgradeLabel: "Train LoRA",
      statusLabel: "Adapter Simulation Mode",
    };
  }

  return {
    label: "LoRA Lab",
    accent: "#7C3AED",
    generationLabel: "Checkpoint",
    runLabel: "Run Batch",
    upgradeLabel: "Train LoRA",
    statusLabel: "Demo ready",
  };
}

export default function TopNavigationBar({
  mode,
  currentWave = 1,
  activeLabel = "ckpt-base",
  harnessCount = 0,
  onSpawnHarnesses,
  onRunWave,
  onReplay,
  onApplyPatch,
  onExport,
  isRunning = false,
}: TopNavigationBarProps) {
  const meta = getModeMeta(mode);

  return (
    <header className="af-topbar flex w-full flex-shrink-0 items-center justify-between gap-4 px-5">
      <Link to="/" aria-label="AgentLabs LoRA workbench" className="af-brand-link">
        <img
          src="/assets/agentforge/brand/agentforge-logo.png"
          alt=""
          aria-hidden="true"
          className="af-brand-logo"
        />
        <span className="min-w-0">
          <span className="af-brand-word">AgentLabs</span>
          <span className="af-brand-subtitle">
            LoRA adversarial training workbench
          </span>
        </span>
      </Link>

      <nav className="hidden items-center gap-1 min-[1680px]:flex" aria-label="Primary">
        <NavLink to="/" className="af-button af-button-quiet">
          Lab
        </NavLink>
        <NavLink to="/reports" className="af-button af-button-quiet">
          Reports
        </NavLink>
        <NavLink to="/exports" className="af-button af-button-quiet">
          Exports
        </NavLink>
      </nav>

      <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
        <span className="af-status-chip" style={{ color: meta.accent }}>
          {meta.label}
        </span>
        <span className="af-status-chip">
          <span
            className="af-status-dot"
            style={{ background: isRunning ? "#C77700" : "#21865A" }}
          />
          {isRunning ? "Running" : "Ready"}
        </span>
        <span className="af-status-chip">{meta.statusLabel}</span>
        <span className="af-status-chip af-mono">
          Wave {String(currentWave).padStart(2, "0")}
        </span>
        <span className="af-status-chip">
          {meta.generationLabel}: <span className="af-mono">{activeLabel}</span>
        </span>
        <span className="af-status-chip af-mono">
          {harnessCount.toLocaleString()} harnesses
        </span>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSpawnHarnesses}
          disabled={!onSpawnHarnesses || isRunning}
          className="af-button hidden min-[1680px]:inline-flex"
        >
          Spawn Harnesses
        </button>
        <button
          type="button"
          onClick={onRunWave}
          disabled={!onRunWave || isRunning}
          className="af-button af-button-purple"
        >
          {isRunning ? "Running" : meta.runLabel}
        </button>
        <button
          type="button"
          onClick={onApplyPatch}
          disabled={!onApplyPatch || isRunning}
          className="af-button hidden md:inline-flex"
        >
          {meta.upgradeLabel}
        </button>
        <button
          type="button"
          onClick={onReplay}
          disabled={!onReplay}
          className="af-button hidden min-[1680px]:inline-flex"
        >
          Replay
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport}
          className="af-button"
        >
          Export
        </button>
      </div>
    </header>
  );
}

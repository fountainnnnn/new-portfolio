
interface MainWorkspaceProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export default function MainWorkspace({ leftPanel, rightPanel }: MainWorkspaceProps) {
  return (
    <div className="flex flex-1 w-full overflow-hidden">
      {/* Left panel */}
      <div
        className="flex-shrink-0 overflow-y-auto"
        style={{
          width: "420px",
          background: "#0F1624",
          borderRight: "1px solid rgba(110, 130, 160, 0.15)",
        }}
      >
        {leftPanel}
      </div>

      {/* Right panel */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ background: "#0A0E17" }}
      >
        {rightPanel}
      </div>
    </div>
  );
}


import { useMemo } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PatchDiff {
  addedRules: string[];
  removedRules: string[];
  modifiedRules: Array<{ rule: string; before: string; after: string }>;
  systemPromptBefore: string;
  systemPromptAfter: string;
  toolsBefore: string[];
  toolsAfter: string[];
  outputFiltersBefore: string[];
  outputFiltersAfter: string[];
}

interface PatchDiffViewProps {
  diff: PatchDiff;
  title?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PatchDiffView({
  diff,
  title = "Patch Diff",
}: PatchDiffViewProps) {
  // Compute deltas
  const deltas = useMemo(() => {
    const addedTools = diff.toolsAfter.filter(
      (t) => !diff.toolsBefore.includes(t),
    );
    const removedTools = diff.toolsBefore.filter(
      (t) => !diff.toolsAfter.includes(t),
    );
    const commonTools = diff.toolsAfter.filter((t) =>
      diff.toolsBefore.includes(t),
    );

    const addedFilters = diff.outputFiltersAfter.filter(
      (f) => !diff.outputFiltersBefore.includes(f),
    );
    const removedFilters = diff.outputFiltersBefore.filter(
      (f) => !diff.outputFiltersAfter.includes(f),
    );

    return {
      addedTools,
      removedTools,
      commonTools,
      addedFilters,
      removedFilters,
    };
  }, [diff]);

  const changeCount =
    diff.addedRules.length +
    diff.removedRules.length +
    diff.modifiedRules.length +
    deltas.addedTools.length +
    deltas.removedTools.length +
    deltas.addedFilters.length +
    deltas.removedFilters.length;

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
          {title}
        </span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded"
          style={{
            background:
              changeCount > 0
                ? "rgba(199, 119, 0, 0.1)"
                : "rgba(33, 134, 90, 0.1)",
            color: changeCount > 0 ? "#C77700" : "#21865A",
          }}
        >
          {changeCount} change{changeCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* No changes */}
      {changeCount === 0 && (
        <div
          className="text-sm py-6 text-center"
          style={{ color: "#7A7D85" }}
        >
          No changes detected. Agent configuration is identical.
        </div>
      )}

      {/* Added Rules */}
      {diff.addedRules.length > 0 && (
        <ChangeSection
          title="Added Rules"
          color="#21865A"
          bgColor="rgba(33, 134, 90, 0.06)"
          borderColor="rgba(33, 134, 90, 0.2)"
        >
          {diff.addedRules.map((rule, idx) => (
            <ChangeItem key={idx} prefix="+" color="#21865A">
              {rule}
            </ChangeItem>
          ))}
        </ChangeSection>
      )}

      {/* Removed Rules */}
      {diff.removedRules.length > 0 && (
        <ChangeSection
          title="Removed Rules"
          color="#C2414B"
          bgColor="rgba(194, 65, 75, 0.06)"
          borderColor="rgba(194, 65, 75, 0.15)"
        >
          {diff.removedRules.map((rule, idx) => (
            <ChangeItem key={idx} prefix="-" color="#C2414B" strikethrough>
              {rule}
            </ChangeItem>
          ))}
        </ChangeSection>
      )}

      {/* Modified Rules */}
      {diff.modifiedRules.length > 0 && (
        <ChangeSection
          title="Modified Rules"
          color="#C77700"
          bgColor="rgba(199, 119, 0, 0.06)"
          borderColor="rgba(199, 119, 0, 0.2)"
        >
          {diff.modifiedRules.map((mod, idx) => (
            <div
              key={idx}
              className="rounded-lg px-3 py-2"
              style={{
                background: "rgba(199, 119, 0, 0.04)",
                border: "1px solid rgba(199, 119, 0, 0.15)",
              }}
            >
              <div
                className="text-xs font-semibold mb-1"
                style={{ color: "#1D1D1F" }}
              >
                {mod.rule}
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-start gap-2">
                  <span style={{ color: "#C2414B" }}>-</span>
                  <span style={{ color: "#C2414B", textDecoration: "line-through" }}>
                    {mod.before}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span style={{ color: "#21865A" }}>+</span>
                  <span style={{ color: "#21865A" }}>{mod.after}</span>
                </div>
              </div>
            </div>
          ))}
        </ChangeSection>
      )}

      {/* System Prompt Side-by-Side */}
      {(diff.systemPromptBefore || diff.systemPromptAfter) && (
        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            System Prompt
          </span>

          {/* Timeline labels */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-t-lg"
              style={{
                background: "rgba(37, 99, 235, 0.08)",
                color: "#2563EB",
              }}
            >
              Before
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-t-lg"
              style={{
                background: "rgba(33, 134, 90, 0.08)",
                color: "#21865A",
              }}
            >
              After
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Before */}
            <div
              className="rounded-b-lg px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap"
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCD8CC",
                color: "#575A60",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {diff.systemPromptBefore || "(empty)"}
            </div>

            {/* After */}
            <div
              className="rounded-b-lg px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap"
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCD8CC",
                color: "#1D1D1F",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {diff.systemPromptAfter || "(empty)"}
            </div>
          </div>
        </div>
      )}

      {/* Tool Changes */}
      {(deltas.addedTools.length > 0 ||
        deltas.removedTools.length > 0 ||
        deltas.commonTools.length > 0) && (
        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Tool Changes
          </span>

          <div className="grid grid-cols-2 gap-3">
            {/* Before */}
            <div className="flex flex-col gap-1">
              {diff.toolsBefore.length === 0 && (
                <span className="text-xs italic" style={{ color: "#7A7D85" }}>
                  No tools
                </span>
              )}
              {diff.toolsBefore.map((tool, idx) => {
                const isRemoved = deltas.removedTools.includes(tool);
                return (
                  <div
                    key={idx}
                    className="rounded-lg px-3 py-1.5 text-xs"
                    style={{
                      background: isRemoved
                        ? "rgba(194, 65, 75, 0.06)"
                        : "#FFFFFF",
                      border: isRemoved
                        ? "1px solid rgba(194, 65, 75, 0.2)"
                        : "1px solid #DCD8CC",
                      color: isRemoved ? "#C2414B" : "#575A60",
                      textDecoration: isRemoved ? "line-through" : "none",
                    }}
                  >
                    {tool}
                  </div>
                );
              })}
            </div>

            {/* After */}
            <div className="flex flex-col gap-1">
              {diff.toolsAfter.length === 0 && (
                <span className="text-xs italic" style={{ color: "#7A7D85" }}>
                  No tools
                </span>
              )}
              {diff.toolsAfter.map((tool, idx) => {
                const isAdded = deltas.addedTools.includes(tool);
                return (
                  <div
                    key={idx}
                    className="rounded-lg px-3 py-1.5 text-xs"
                    style={{
                      background: isAdded
                        ? "rgba(33, 134, 90, 0.06)"
                        : "#FFFFFF",
                      border: isAdded
                        ? "1px solid rgba(33, 134, 90, 0.2)"
                        : "1px solid #DCD8CC",
                      color: isAdded ? "#21865A" : "#1D1D1F",
                    }}
                  >
                    {tool}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ChangeSection({
  title,
  color,
  bgColor,
  borderColor,
  children,
}: {
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg flex flex-col gap-1.5 px-3 py-2.5"
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function ChangeItem({
  prefix,
  color,
  strikethrough,
  children,
}: {
  prefix: string;
  color: string;
  strikethrough?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span
        className="font-mono font-bold flex-shrink-0"
        style={{ color }}
      >
        {prefix}
      </span>
      <span
        style={{
          color,
          textDecoration: strikethrough ? "line-through" : "none",
        }}
      >
        {children}
      </span>
    </div>
  );
}

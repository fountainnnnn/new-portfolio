
import { useState, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SourceOption = "demo" | "upload" | "local" | "huggingface";

interface ValidationResult {
  valid: boolean;
  paramEstimate: string | null;
  message: string;
}

interface ModelUploadPanelProps {
  onUpload: (files: File[]) => void;
  onSelectDemo: () => void;
  onSelectLocal: (path: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ModelUploadPanel({
  onUpload,
  onSelectDemo,
  onSelectLocal,
}: ModelUploadPanelProps) {
  const [selectedSource, setSelectedSource] = useState<SourceOption>("demo");
  const [localPath, setLocalPath] = useState("");
  const [hfModelId, setHfModelId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSourceChange = useCallback((source: SourceOption) => {
    setSelectedSource(source);
    setValidation(null);
    if (source === "demo") {
      setSelectedFiles([]);
      setLocalPath("");
      setHfModelId("");
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setSelectedFiles(files);
      if (files.length > 0) {
        const hasConfig = files.some(
          (f) =>
            f.name === "config.json" ||
            f.name.endsWith(".json"),
        );
        const hasWeights = files.some(
          (f) =>
            f.name.endsWith(".bin") ||
            f.name.endsWith(".safetensors") ||
            f.name.endsWith(".pt"),
        );
        setValidation({
          valid: hasConfig || hasWeights,
          paramEstimate: hasWeights ? "~3B params (estimated)" : null,
          message: hasConfig
            ? "Config detected. Model structure valid."
            : hasWeights
              ? "Weights detected. Model ready for training."
              : "No recognized model files found.",
        });
      } else {
        setValidation(null);
      }
    },
    [],
  );

  const handleLoadModel = useCallback(() => {
    setIsLoading(true);

    // Simulate loading delay
    setTimeout(() => {
      switch (selectedSource) {
        case "demo":
          onSelectDemo();
          break;
        case "upload":
          if (selectedFiles.length > 0) {
            onUpload(selectedFiles);
          }
          break;
        case "local":
          if (localPath.trim()) {
            onSelectLocal(localPath.trim());
          }
          break;
        case "huggingface":
          if (hfModelId.trim()) {
            // For HF, we simulate selecting the model by path
            onSelectLocal(`hf://${hfModelId.trim()}`);
          }
          break;
      }
      setIsLoading(false);
    }, 600);
  }, [selectedSource, selectedFiles, localPath, hfModelId, onUpload, onSelectDemo, onSelectLocal]);

  const canLoad = (() => {
    switch (selectedSource) {
      case "demo":
        return true;
      case "upload":
        return selectedFiles.length > 0;
      case "local":
        return localPath.trim().length > 0;
      case "huggingface":
        return hfModelId.trim().length > 0;
      default:
        return false;
    }
  })();

  // ─── Source Card ──────────────────────────────────────────────────────────────

  function SourceCard({
    value,
    label,
    description,
    icon,
  }: {
    value: SourceOption;
    label: string;
    description: string;
    icon: string;
  }) {
    const isActive = selectedSource === value;

    return (
      <button
        type="button"
        onClick={() => handleSourceChange(value)}
        className="w-full text-left rounded-lg p-3 transition-all"
        style={{
          background: isActive ? "#FFFFFF" : "transparent",
          border: isActive
            ? "2px solid #7C3AED"
            : "1px solid #DCD8CC",
          cursor: "pointer",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{
              background: isActive
                ? "rgba(124, 58, 237, 0.12)"
                : "#FCFCF7",
              color: isActive ? "#7C3AED" : "#575A60",
            }}
          >
            {icon}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="text-sm font-semibold"
              style={{
                color: isActive ? "#1D1D1F" : "#575A60",
              }}
            >
              {label}
            </span>
            <span
              className="text-xs mt-0.5 truncate"
              style={{ color: "#7A7D85" }}
            >
              {description}
            </span>
          </div>
        </div>
      </button>
    );
  }

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
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Model Source
        </span>
        {selectedSource === "demo" && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{
              background: "rgba(33, 134, 90, 0.1)",
              color: "#21865A",
            }}
          >
            Pre-selected
          </span>
        )}
      </div>

      {/* Source Cards */}
      <div className="flex flex-col gap-2">
        <SourceCard
          value="demo"
          label="Demo Simulation"
          description="No model needed, works instantly"
          icon={"▶"}
        />
        <SourceCard
          value="upload"
          label="Upload Model Folder"
          description="config.json, .bin, .safetensors, .pt, tokenizer files"
          icon={"↑"}
        />
        <SourceCard
          value="local"
          label="Local Path"
          description="Filesystem path to model directory"
          icon={"📁"}
        />
        <SourceCard
          value="huggingface"
          label="Hugging Face Model"
          description="Model ID from Hugging Face Hub"
          icon={"HF"}
        />
      </div>

      {/* Source-specific input */}
      {selectedSource === "upload" && (
        <div
          className="rounded-lg p-4 flex flex-col items-center justify-center gap-2"
          style={{
            background: "#FCFCF7",
            border: "2px dashed #DCD8CC",
            minHeight: "80px",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            /* webkitdirectory is not in standard TS types but works in browsers */
            {...({ webkitdirectory: "" } as any)}
          />
          {selectedFiles.length > 0 ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold" style={{ color: "#1D1D1F" }}>
                {selectedFiles.length} file(s) selected
              </span>
              <span className="text-xs" style={{ color: "#7A7D85" }}>
                {selectedFiles
                  .slice(0, 4)
                  .map((f) => f.name)
                  .join(", ")}
                {selectedFiles.length > 4 && ` +${selectedFiles.length - 4} more`}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold mt-1"
                style={{ color: "#7C3AED" }}
              >
                Change selection
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-semibold"
              style={{ color: "#7C3AED" }}
            >
              Click to select model folder
            </button>
          )}
        </div>
      )}

      {selectedSource === "local" && (
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Filesystem Path
          </label>
          <input
            type="text"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder={"/path/to/model/directory"}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          />
        </div>
      )}

      {selectedSource === "huggingface" && (
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#7A7D85" }}
          >
            Hugging Face Model ID
          </label>
          <input
            type="text"
            value={hfModelId}
            onChange={(e) => setHfModelId(e.target.value)}
            placeholder={"org/model-name (e.g. meta-llama/Llama-3.2-3B)"}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DCD8CC",
              color: "#1D1D1F",
            }}
          />
        </div>
      )}

      {/* Validation Status */}
      {validation && (
        <div
          className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
          style={{
            background: validation.valid
              ? "rgba(33, 134, 90, 0.08)"
              : "rgba(194, 65, 75, 0.08)",
            border: validation.valid
              ? "1px solid rgba(33, 134, 90, 0.2)"
              : "1px solid rgba(194, 65, 75, 0.2)",
            color: validation.valid ? "#21865A" : "#C2414B",
          }}
        >
          <span className="font-bold">{validation.valid ? "✓" : "✗"}</span>
          <span>{validation.message}</span>
        </div>
      )}

      {/* Parameter Estimate / Mode Indicator */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "#575A60" }}>
        {selectedSource === "demo" && (
          <span className="font-medium" style={{ color: "#7A7D85" }}>
            Mode: Simulation (no model required)
          </span>
        )}
        {validation?.paramEstimate && (
          <span className="font-medium" style={{ color: "#7A7D85" }}>
            {validation.paramEstimate}
          </span>
        )}
      </div>

      {/* Load Button */}
      <button
        type="button"
        onClick={handleLoadModel}
        disabled={!canLoad || isLoading}
        className="w-full h-10 rounded-lg text-sm font-bold transition-all"
        style={{
          background: canLoad && !isLoading ? "#7C3AED" : "#DCD8CC",
          color: canLoad && !isLoading ? "#FFFFFF" : "#7A7D85",
          border: "none",
          cursor: canLoad && !isLoading ? "pointer" : "not-allowed",
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span
              className="w-3 h-3 rounded-full border-2 border-transparent border-t-white animate-spin"
              style={{ borderTopColor: "#FFFFFF" }}
            />
            Loading...
          </span>
        ) : (
          "Load Model"
        )}
      </button>
    </div>
  );
}

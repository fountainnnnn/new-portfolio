"use client";

import { FileUp, LoaderCircle, Lock } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DatasetUploaderProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  variant?: "card" | "borderless";
}

/**
 * DatasetUploader
 *
 * Implementation notes:
 * - The <input type="file"> is overlaid DIRECTLY on the visible click target using
 *   absolute positioning within a `relative` container.  This makes it technically
 *   "in the viewport", which is a requirement for Playwright's setInputFiles to
 *   dispatch synthetic change events.
 * - We keep the input visually invisible, but it still receives pointer events.
 *   That preserves native file-picker behavior and lets Playwright's setInputFiles
 *   dispatch file-selection events against the real control.
 * - The input also has a native listener fallback because browser automation
 *   surfaces are not perfectly consistent about React's synthetic file events.
 */
export function DatasetUploader({ onUpload, isUploading, variant = "card" }: DatasetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(() => {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    onUpload(file);
    // Reset so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }, [onUpload]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.addEventListener("change", handleChange);
    input.addEventListener("input", handleChange);

    return () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("input", handleChange);
    };
  }, [handleChange]);

  function openFilePicker() {
    if (!isUploading) {
      inputRef.current?.click();
    }
  }

  const dropzone = (
    <div
      role="button"
      tabIndex={0}
      aria-label={isUploading ? "Uploading CSV…" : "Upload CSV file"}
      onClick={openFilePicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFilePicker();
        }
      }}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-center justify-center text-center transition-all duration-300",
        variant === "borderless"
          ? "min-h-56 rounded-2xl border border-dashed border-[#d6deea] bg-white p-8 md:p-12 shadow-[0_4px_20px_rgba(39,94,254,0.01)] hover:border-[#275efe] hover:bg-[#f8faff] hover:shadow-[0_8px_30px_rgba(39,94,254,0.05)]"
          : "min-h-44 rounded-lg border border-dashed border-[#d6deea] bg-[#f9fafc] p-6 hover:bg-[#eef3fa]"
      )}
    >
      {/* The file input is overlaid on the dropzone so it is "in the viewport"
          for Playwright while still preserving native click behavior. */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={isUploading}
        onChange={handleChange}
        onInput={handleChange}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-white shadow-sm border border-[#dde4ef]/40 transition-all duration-300",
          variant === "borderless"
            ? "size-16 group-hover:-translate-y-1.5 group-hover:text-[#275efe] group-hover:shadow-md group-hover:border-[#275efe]/20 text-slate-500"
            : "size-14 text-[#667085]"
        )}
      >
        {isUploading ? (
          <LoaderCircle className={cn(variant === "borderless" ? "size-6" : "size-5", "animate-spin")} />
        ) : (
          <FileUp className={cn(variant === "borderless" ? "size-6" : "size-5")} />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <span
          className={cn(
            "font-semibold transition-colors duration-300",
            variant === "borderless"
              ? "text-base text-slate-800 group-hover:text-[#275efe]"
              : "text-base"
          )}
        >
          {isUploading ? "Profiling dataset..." : "Choose CSV file"}
        </span>
        <span className={cn(variant === "borderless" ? "text-xs max-w-sm mt-0.5 text-slate-500" : "text-sm text-[#667085]")}>
          Pandas reads and profiles it locally through FastAPI.
        </span>
      </div>

      {variant === "borderless" && (
        <div className="mt-5 flex items-center gap-1.5 rounded-full border border-slate-200/50 bg-slate-100/50 px-3 py-1 text-[10px] font-medium text-slate-400 select-none">
          <Lock className="size-3 text-slate-400" />
          <span>Processed locally and privately</span>
        </div>
      )}
    </div>
  );

  if (variant === "borderless") {
    return dropzone;
  }

  return (
    <Card className="w-full rounded-lg border-[#dde4ef] bg-white" size="sm">
      <CardHeader className="items-center text-center">
        <CardTitle className="text-lg">Dataset</CardTitle>
        <CardDescription className="max-w-2xl">
          Upload a CSV file to profile columns, infer metrics, and generate dashboard-ready charts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{dropzone}</CardContent>
    </Card>
  );
}

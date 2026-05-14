"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { ChangeEvent } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface DatasetUploaderProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function DatasetUploader({ onUpload, isUploading }: DatasetUploaderProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    event.target.value = "";
  }

  return (
    <Card className="w-full rounded-lg border-[#dde4ef] bg-white" size="sm">
      <CardHeader className="items-center text-center">
        <CardTitle className="text-lg">Dataset</CardTitle>
        <CardDescription className="max-w-2xl">
          Upload a CSV file to profile columns, infer metrics, and generate dashboard-ready charts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[#d6deea] bg-[#f9fafc] p-6 text-center transition-colors hover:bg-[#eef3fa]">
          <div className="flex size-14 items-center justify-center rounded-lg bg-white text-[#667085] shadow-sm">
            {isUploading ? <LoaderCircle className="size-5 animate-spin" /> : <FileUp className="size-5" />}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold">{isUploading ? "Profiling dataset..." : "Choose CSV file"}</span>
            <span className="text-sm text-[#667085]">Pandas reads and profiles it locally through FastAPI.</span>
          </div>
          <Input
            accept=".csv,text/csv"
            className="sr-only"
            disabled={isUploading}
            onChange={handleFileChange}
            type="file"
          />
        </label>
      </CardContent>
    </Card>
  );
}

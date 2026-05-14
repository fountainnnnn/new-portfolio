
import type { ReactNode } from "react";

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#FCFCF7] text-[#1D1D1F]">
      {children}
    </div>
  );
}


export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: "#0A0E17" }}
    >
      {children}
    </div>
  );
}

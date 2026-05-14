
interface ArenaNarrationBarProps {
  text: string;
}

export default function ArenaNarrationBar({ text }: ArenaNarrationBarProps) {
  return (
    <div
      className="absolute bottom-4 left-1/2 z-10"
      style={{ transform: "translateX(-50%)" }}
    >
      <div
        className="px-4 py-2.5 rounded-lg text-center text-[12px] font-mono leading-relaxed"
        style={{
          background: "rgba(8, 12, 19, 0.85)",
          border: "1px solid rgba(110, 130, 160, 0.15)",
          backdropFilter: "blur(8px)",
          color: "#8FA0B8",
          height: "38px",
          minWidth: "300px",
          maxWidth: "520px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.3s ease",
        }}
      >
        {text}
      </div>
    </div>
  );
}


export default function SettingsPanel() {
  return (
    <div>
      <div className="flex items-center mb-1.5" style={{ padding: "0 2px" }}>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#E8EDF4", letterSpacing: "0.08em" }}
        >
          CONFIGURATION
        </span>
      </div>

      <div
        className="grid grid-cols-2 gap-2.5 rounded-lg"
        style={{
          background: "#151D2E",
          border: "1px solid rgba(110,130,160,0.15)",
          padding: "12px",
        }}
      >
        {/* Environment */}
        <div>
          <label
            className="block text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#5A6E86" }}
          >
            Environment
          </label>
          <select
            className="w-full rounded-md text-[13px] font-medium px-2 py-1.5 appearance-none cursor-pointer"
            style={{
              background: "#080C13",
              color: "#E8EDF4",
              border: "1px solid rgba(110,130,160,0.15)",
              height: "30px",
            }}
            defaultValue="sandbox"
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label
            className="block text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#5A6E86" }}
          >
            Difficulty
          </label>
          <select
            className="w-full rounded-md text-[13px] font-medium px-2 py-1.5 appearance-none cursor-pointer"
            style={{
              background: "#080C13",
              color: "#E8EDF4",
              border: "1px solid rgba(110,130,160,0.15)",
              height: "30px",
            }}
            defaultValue="standard"
          >
            <option value="standard">Standard</option>
            <option value="aggressive">Aggressive</option>
            <option value="adaptive">Adaptive</option>
          </select>
        </div>

        {/* Max Steps */}
        <div>
          <label
            className="block text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#5A6E86" }}
          >
            Max Steps
          </label>
          <div
            className="w-full rounded-md text-[13px] font-medium flex items-center px-2"
            style={{
              background: "#080C13",
              color: "#E8EDF4",
              border: "1px solid rgba(110,130,160,0.15)",
              height: "30px",
            }}
          >
            24
          </div>
        </div>

        {/* Seed */}
        <div>
          <label
            className="block text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#5A6E86" }}
          >
            Seed
          </label>
          <div
            className="w-full rounded-md text-[13px] font-medium flex items-center px-2"
            style={{
              background: "#080C13",
              color: "#E8EDF4",
              border: "1px solid rgba(110,130,160,0.15)",
              height: "30px",
            }}
          >
            42069
          </div>
        </div>
      </div>
    </div>
  );
}

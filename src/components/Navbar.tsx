"use client";
import { useEffect, useState } from "react";

interface Props {
  onPaste: () => void;
  scanning: boolean;
}

export default function Navbar({ onPaste, scanning }: Props) {
  const [cfg, setCfg] = useState<{ armoriqConfigured: boolean; openrouterConfigured: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(setCfg).catch(() => {});
  }, []);

  return (
    <div className="topbar">
      <span style={{ fontFamily: "var(--font-code)", fontSize: 14, color: "var(--cg-text)", fontWeight: 500 }}>
        code-guardian
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {cfg && (
          <span style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)" }}>
            {cfg.armoriqConfigured ? "armoriq: connected" : "armoriq: offline"}
            {" · "}
            gemini-2.5-flash
          </span>
        )}
        <button className="btn-primary" onClick={onPaste} disabled={scanning}>
          {scanning ? "scanning..." : "Paste code →"}
        </button>
      </div>
    </div>
  );
}

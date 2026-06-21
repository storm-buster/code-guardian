"use client";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

interface Props {
  onPaste: () => void;
  scanning: boolean;
}

export default function Navbar({ onPaste, scanning }: Props) {
  const { data: session, status } = useSession();
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
          <span style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", display: "flex", alignItems: "center", gap: 4 }}>
            {cfg.armoriqConfigured && <span className="connected-dot" />}
            {cfg.armoriqConfigured ? "armoriq: connected" : "armoriq: offline"}
            {" · "}
          
          </span>
        )}

        <button className="btn-primary" onClick={onPaste} disabled={scanning}>
          {scanning ? "scanning..." : "Paste code →"}
        </button>

        {status === "authenticated" && session?.user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                width={24}
                height={24}
                style={{ borderRadius: "50%" }}
              />
            )}
            <span style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)" }}>
              @{session.user.name || "user"}
            </span>
            <span
              onClick={() => signOut()}
              style={{ fontSize: 11, color: "var(--cg-dim)", cursor: "pointer", fontFamily: "var(--font-code)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-muted)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-dim)")}
            >
              disconnect
            </span>
          </div>
        ) : (
          <button
            onClick={() => signIn("github")}
            style={{
              background: "transparent",
              border: "1px solid var(--cg-border2)",
              color: "var(--cg-text)",
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--cg-text)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--cg-border2)")}
          >
            Connect GitHub
          </button>
        )}
      </div>
    </div>
  );
}

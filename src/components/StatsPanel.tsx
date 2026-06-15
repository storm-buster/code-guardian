"use client";
import { ScanResult } from "@/lib/types";

interface Props {
  stats: ScanResult["stats"] | null;
  filename?: string;
}

export default function StatsPanel({ stats, filename }: Props) {
  const bars = [
    { label: "critical", count: stats?.critical ?? null, color: "var(--sev-critical)" },
    { label: "high", count: stats?.high ?? null, color: "var(--sev-high)" },
    { label: "medium", count: stats?.medium ?? null, color: "var(--sev-medium)" },
    { label: "low", count: stats?.low ?? null, color: "var(--sev-low)" },
  ];

  return (
    <div>
      <div className="sh">severity</div>
      {bars.map(b => (
        <div key={b.label} className="sev-bar">
          <div className="dot" style={{ background: b.color }} />
          <div className="cnt">{b.count !== null ? b.count : "--"}</div>
          <div className="lbl">{b.label}</div>
        </div>
      ))}
      <div className="divider" />
      <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)" }}>
        {stats ? `${stats.totalFindings} findings` : "-- findings"}
        {filename ? ` in ${filename}` : ""}
      </div>
      {stats && (
        <>
          <div className="divider" />
          <div className="sh">triage</div>
          <div className="sev-bar">
            <div className="dot" style={{ background: "var(--sev-critical)" }} />
            <div className="cnt">{stats.blocked}</div>
            <div className="lbl">blocked</div>
          </div>
          <div className="sev-bar">
            <div className="dot" style={{ background: "var(--sev-medium)" }} />
            <div className="cnt">{stats.flagged}</div>
            <div className="lbl">flagged</div>
          </div>
          <div className="sev-bar">
            <div className="dot" style={{ background: "var(--sev-safe)" }} />
            <div className="cnt">{stats.autoApproved}</div>
            <div className="lbl">approved</div>
          </div>
          <div className="divider" />
          <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)" }}>
            {stats.scanDuration}ms
          </div>
        </>
      )}
    </div>
  );
}

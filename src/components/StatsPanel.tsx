"use client";
import { ScanResult } from "@/lib/types";

interface Props {
  stats: ScanResult["stats"] | null;
  filename?: string;
  triageCounts?: { blocked: number; flagged: number; approved: number };
}

export default function StatsPanel({ stats, filename, triageCounts }: Props) {
  const blocked = triageCounts?.blocked ?? stats?.blocked ?? 0;
  const flagged = triageCounts?.flagged ?? stats?.flagged ?? 0;
  const approved = triageCounts?.approved ?? stats?.autoApproved ?? 0;

  const bars = [
    { label: "critical", count: stats?.critical ?? null, color: "var(--sev-critical)", cls: "colored-critical" },
    { label: "high", count: stats?.high ?? null, color: "var(--sev-high)", cls: "colored-high" },
    { label: "medium", count: stats?.medium ?? null, color: "var(--sev-medium)", cls: "colored-medium" },
    { label: "low", count: stats?.low ?? null, color: "var(--sev-low)", cls: "colored-low" },
  ];

  return (
    <div>
      <div className="sh">severity</div>
      {bars.map(b => (
        <div key={b.label} className="sev-bar">
          <div
            className={`dot${b.count && b.count > 0 ? " pulsing" : ""}`}
            style={{ background: b.color, color: b.color }}
          />
          <div className={`cnt ${b.cls}`}>{b.count !== null ? b.count : "--"}</div>
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
            <div className={`dot${blocked > 0 ? " pulsing" : ""}`} style={{ background: "var(--accent-red)", color: "var(--accent-red)" }} />
            <div className="cnt colored-block">{blocked}</div>
            <div className="lbl">blocked</div>
          </div>
          <div className="sev-bar">
            <div className={`dot${flagged > 0 ? " pulsing" : ""}`} style={{ background: "var(--accent-amber)", color: "var(--accent-amber)" }} />
            <div className="cnt colored-flag">{flagged}</div>
            <div className="lbl">flagged</div>
          </div>
          <div className="sev-bar">
            <div className={`dot${approved > 0 ? " pulsing" : ""}`} style={{ background: "var(--accent-green)", color: "var(--accent-green)" }} />
            <div className="cnt colored-safe">{approved}</div>
            <div className="lbl">approved</div>
          </div>
          <div className="divider" />
          <div className="scan-duration">{stats.scanDuration}ms</div>
        </>
      )}
    </div>
  );
}

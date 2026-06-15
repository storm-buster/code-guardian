"use client";
import { useState } from "react";
import { AuditEntry, AgentDecision } from "@/lib/types";

interface Props {
  entries: AuditEntry[];
  decisions: AgentDecision[];
}

export default function AuditLog({ entries, decisions }: Props) {
  const [expanded, setExpanded] = useState(false);

  const latest = entries.length > 0 ? entries[entries.length - 1].timestamp : "";
  const latestTime = latest ? new Date(latest).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  // Build merged decision rows from audit entries that have decisions
  const decisionEntries = entries.filter(e => e.decision);

  return (
    <div className={`audit-strip ${expanded ? "expanded" : "collapsed"}`}>
      <div className="audit-hdr" onClick={() => setExpanded(!expanded)}>
        audit log <span>· {entries.length} events</span>
        {latestTime && <span>· {latestTime}</span>}
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{expanded ? "▼" : "▲"}</span>
      </div>
      {expanded && (
        <div className="audit-body">
          {decisionEntries.length > 0 ? decisionEntries.map((e, i) => {
            const dec = decisions.find(d => e.message?.includes(d.findingId));
            return (
              <div key={i} className="audit-row">
                <span className="ats">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span className="atk">{dec?.policyRef || "—"}</span>
                <span className={`adc ${e.decision || ""}`}>{e.decision || "—"}</span>
                <span className="afl">{e.message}</span>
              </div>
            );
          }) : entries.map((e, i) => (
            <div key={i} className="audit-row">
              <span className="ats">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className="atk">{e.id}</span>
              <span className={`adc ${e.decision || ""}`}>{e.decision || e.action}</span>
              <span className="afl">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

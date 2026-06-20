"use client";
import { useState } from "react";
import { AuditEntry, AgentDecision } from "@/lib/types";

interface ActionResult {
  findingId: string;
  type: "block" | "flag" | "approve";
  issueUrl?: string;
  issueNumber?: number;
  prUrl?: string;
  prNumber?: number;
  branchName?: string;
  error?: string;
}

interface ScanContext {
  owner: string;
  repo: string;
  filePath: string;
  defaultBranch: string;
  fileSha: string;
  fullFileContent: string;
}

interface Props {
  entries: AuditEntry[];
  decisions: AgentDecision[];
  actionResults?: ActionResult[];
  scanCtx?: ScanContext | null;
}

export default function AuditLog({ entries, decisions, actionResults = [], scanCtx }: Props) {
  const [expanded, setExpanded] = useState(false);

  const latest = entries.length > 0 ? entries[entries.length - 1].timestamp : "";
  const latestTime = latest ? new Date(latest).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  const totalEvents = entries.length + actionResults.length;

  const decisionEntries = entries.filter(e => e.decision);

  return (
    <div className={`audit-strip ${expanded ? "expanded" : "collapsed"}`}>
      <div className="audit-hdr" onClick={() => setExpanded(!expanded)}>
        audit log <span>· {totalEvents} events</span>
        {latestTime && <span>· {latestTime}</span>}
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{expanded ? "▼" : "▲"}</span>
      </div>
      {expanded && (
        <div className="audit-body">
          {/* GitHub action results */}
          {actionResults.filter(ar => !ar.error).map((ar, i) => {
            const repoFile = scanCtx ? `${scanCtx.repo}/${scanCtx.filePath}` : "";
            const url = ar.issueUrl || ar.prUrl || "";
            return (
              <div key={`ar-${i}`} className="audit-row">
                <span className="ats">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span className="atk">{ar.findingId}</span>
                <span className={`adc ${ar.type === "block" ? "block" : ar.type === "flag" ? "flag" : "approve"}`}>
                  {ar.type}
                </span>
                <span className="afl">{repoFile}</span>
                {url && (
                  <a href={url} target="_blank" rel="noreferrer"
                    style={{ color: "var(--cg-dim)", fontSize: 11, textDecoration: "none", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-dim)")}
                  >↗</a>
                )}
              </div>
            );
          })}

          {/* Original audit entries */}
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

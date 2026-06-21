"use client";
import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import StatsPanel from "@/components/StatsPanel";
import FindingsPanel from "@/components/FindingsPanel";
import ScanAnimation from "@/components/ScanAnimation";
import AuditLog from "@/components/AuditLog";
import RepoPicker from "@/components/RepoPicker";
import ToastContainer, { showToast } from "@/components/ToastContainer";
import { ScanResult, Finding } from "@/lib/types";

const ParticleBackground = dynamic(() => import("@/components/ParticleBackground"), { ssr: false });

interface ScanContext {
  owner: string;
  repo: string;
  filePath: string;
  defaultBranch: string;
  fileSha: string;
  fullFileContent: string;
}

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

function slugify(filePath: string): string {
  const name = filePath.split("/").pop() || filePath;
  return name.toLowerCase().replace(/[.\s/]/g, "-");
}

function isValidBranch(name: string): boolean {
  return name.length > 0 && !/[\s~^:?*\[\]\\]/.test(name);
}

export default function Home() {
  const { data: session } = useSession();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [code, setCode] = useState("");
  const [lang, setLang] = useState("python");
  const [tab, setTab] = useState<"paste" | "github">("paste");
  const [ghUrl, setGhUrl] = useState("");
  const [ghFetching, setGhFetching] = useState(false);
  const [ghInfo, setGhInfo] = useState("");
  const [scanFilenames, setScanFilenames] = useState<string[]>([]);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [scanCtx, setScanCtx] = useState<ScanContext | null>(null);

  // Triage action state
  const [actionResults, setActionResults] = useState<Map<string, ActionResult>>(new Map());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approveMode, setApproveMode] = useState<string | null>(null); // findingId
  const [branchName, setBranchName] = useState("");

  const doScan = useCallback(async (c: string, language: string, filename?: string) => {
    if (!c.trim()) return;
    setShowPaste(false);
    setScanning(true);
    setResult(null);
    setSelected(null);
    setActionResults(new Map());
    setApproveMode(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, language, filename }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      if (data.findings.length > 0) setSelected(data.findings[0]);
    } catch (err) {
      console.error("scan failed:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  const fetchGh = async () => {
    if (!ghUrl.trim()) return;
    setGhFetching(true);
    setGhInfo("");
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ghUrl }),
      });
      const data = await res.json();
      if (data.error) { setGhInfo(data.error); return; }
      setCode(data.combinedCode);
      setScanFilenames((data.files || []).map((f: { path: string }) => f.path));
      setGhInfo(`${data.repo} · ${data.filesScanned} files · ${data.combinedCode.split("\n").length} lines`);
    } catch { setGhInfo("fetch failed"); }
    finally { setGhFetching(false); }
  };

  const handleScanFile = (ctx: {
    owner: string; repo: string; filePath: string;
    defaultBranch: string; fileSha: string; fileContent: string;
  }) => {
    setScanCtx({
      owner: ctx.owner,
      repo: ctx.repo,
      filePath: ctx.filePath,
      defaultBranch: ctx.defaultBranch,
      fileSha: ctx.fileSha,
      fullFileContent: ctx.fileContent,
    });
    setScanFilenames([ctx.filePath]);
    const ext = ctx.filePath.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = { py: "python", js: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript", go: "go", java: "java", rb: "ruby", php: "php", rs: "rust" };
    doScan(ctx.fileContent, langMap[ext] || "python", ctx.filePath);
  };

  const handleScanRepo = (ctx: {
    owner: string; repo: string; defaultBranch: string;
    combinedCode: string; filenames: string[];
  }) => {
    // When scanning a whole repo, we don't have a single file context for PRs.
    // The scan context is set to null to disable block/flag/approve actions that require file paths.
    setScanCtx(null);
    setScanFilenames(ctx.filenames);
    doScan(ctx.combinedCode, "typescript", ctx.filenames[0]); // Default to TS for syntax highlighting
  };

  const resetToRepoPicker = () => {
    setResult(null);
    setSelected(null);
    setScanCtx(null);
    setActionResults(new Map());
    setApproveMode(null);
  };

  // --- Triage actions ---
  const doBlock = async (finding: Finding) => {
    if (!scanCtx) return;
    setActionLoading(finding.id);
    try {
      const res = await fetch("/api/github/actions/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: scanCtx.owner, repo: scanCtx.repo, filePath: scanCtx.filePath,
          finding, policyId: decision(finding.id)?.policyRef || "POL-SEC-001",
        }),
      });
      const data = await res.json();
      setActionResults(prev => new Map(prev).set(finding.id, {
        findingId: finding.id, type: "block",
        ...(data.error ? { error: data.error } : { issueUrl: data.issueUrl, issueNumber: data.issueNumber }),
      }));
      if (!data.error) showToast({ type: "block", title: finding.title, message: `Issue #${data.issueNumber} created`, policyId: decision(finding.id)?.policyRef });
      else showToast({ type: "error", title: "Block failed", message: data.error });
    } catch { setActionResults(prev => new Map(prev).set(finding.id, { findingId: finding.id, type: "block", error: "action failed: network error" })); showToast({ type: "error", title: "Block failed", message: "Network error" }); }
    finally { setActionLoading(null); }
  };

  const doFlag = async (finding: Finding) => {
    if (!scanCtx) return;
    setActionLoading(finding.id);
    try {
      const res = await fetch("/api/github/actions/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: scanCtx.owner, repo: scanCtx.repo, filePath: scanCtx.filePath,
          finding, policyId: decision(finding.id)?.policyRef || "POL-REV-002",
        }),
      });
      const data = await res.json();
      setActionResults(prev => new Map(prev).set(finding.id, {
        findingId: finding.id, type: "flag",
        ...(data.error ? { error: data.error } : { issueUrl: data.issueUrl, issueNumber: data.issueNumber }),
      }));
      if (!data.error) showToast({ type: "flag", title: finding.title, message: `Issue #${data.issueNumber} created`, policyId: decision(finding.id)?.policyRef });
      else showToast({ type: "error", title: "Flag failed", message: data.error });
    } catch { setActionResults(prev => new Map(prev).set(finding.id, { findingId: finding.id, type: "flag", error: "action failed: network error" })); showToast({ type: "error", title: "Flag failed", message: "Network error" }); }
    finally { setActionLoading(null); }
  };

  const startApprove = (finding: Finding) => {
    const cwe = finding.cwe?.replace("CWE-", "") || "unknown";
    const slug = slugify(finding.file);
    setBranchName(`code-guardian/fix-cwe-${cwe}-${slug}`);
    setApproveMode(finding.id);
  };

  const doApprove = async (finding: Finding) => {
    if (!scanCtx || !branchName) return;
    setActionLoading(finding.id);
    try {
      const res = await fetch("/api/github/actions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: scanCtx.owner, repo: scanCtx.repo, filePath: scanCtx.filePath,
          fileSha: scanCtx.fileSha, defaultBranch: scanCtx.defaultBranch,
          branchName, finding, suggestedFix: finding.ai_fix || "",
          fullFileContent: scanCtx.fullFileContent,
          policyId: decision(finding.id)?.policyRef || "POL-LOW-003",
        }),
      });
      const data = await res.json();
      setActionResults(prev => new Map(prev).set(finding.id, {
        findingId: finding.id, type: "approve",
        ...(data.error ? { error: data.error } : { prUrl: data.prUrl, prNumber: data.prNumber, branchName: data.branchName }),
      }));
      setApproveMode(null);
      if (!data.error) showToast({ type: "approve", title: finding.title, message: `PR #${data.prNumber} opened on ${data.branchName}`, policyId: decision(finding.id)?.policyRef });
      else showToast({ type: "error", title: "Approve failed", message: data.error });
    } catch { setActionResults(prev => new Map(prev).set(finding.id, { findingId: finding.id, type: "approve", error: "fix failed: network error" })); showToast({ type: "error", title: "Approve failed", message: "Network error" }); }
    finally { setActionLoading(null); }
  };

  const decision = (fId: string) => result?.decisions.find(d => d.findingId === fId);

  const parseSnippet = (snippet: string, vulnLine: number) => {
    return snippet.split("\n").map(raw => {
      const m = raw.match(/^(\d+)\s*\|\s?(.*)/);
      const ln = m ? parseInt(m[1]) : 0;
      const content = m ? m[2] : raw;
      return { ln, content, vuln: ln === vulnLine };
    });
  };

  const renderAI = (text: string) => {
    const parts = text.split(/`([^`]+)`/g);
    return parts.map((p, i) =>
      i % 2 === 1 ? <code key={i} className="ic">{p}</code> : <span key={i}>{p}</span>
    );
  };

  const hasGhActions = !!scanCtx && !!session?.accessToken;
  const branchValid = isValidBranch(branchName);

  // Local triage — works without GitHub, updates state + toast + sidebar
  const doLocalTriage = (action: "block" | "flag" | "approve", finding: Finding) => {
    const policyId = decision(finding.id)?.policyRef || "LOCAL";
    setActionResults(prev => new Map(prev).set(finding.id, {
      findingId: finding.id, type: action,
    }));
    showToast({ type: action, title: finding.title, message: `${finding.file} · line ${finding.line}`, policyId });
  };

  // Live triage counts from action results
  const triageCounts = useMemo(() => {
    let blocked = 0, flagged = 0, approved = 0;
    actionResults.forEach(ar => {
      if (ar.error) return;
      if (ar.type === "block") blocked++;
      else if (ar.type === "flag") flagged++;
      else if (ar.type === "approve") approved++;
    });
    return { blocked, flagged, approved };
  }, [actionResults]);

  // --- Render triage section for selected finding ---
  const renderTriage = (finding: Finding) => {
    const ar = actionResults.get(finding.id);
    const isLoading = actionLoading === finding.id;

    // Action completed
    if (ar && !ar.error) {
      if (ar.type === "block") return (
        <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)", marginTop: 20 }}>
          {ar.issueNumber ? (
            <>
              issue opened · #{ar.issueNumber} ·{" "}
              <a href={ar.issueUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--cg-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-muted)")}
              >view →</a>
            </>
          ) : (
            <>GitHub not configured — local block only</>
          )}
        </div>
      );
      if (ar.type === "flag") return (
        <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)", marginTop: 20 }}>
          {ar.issueNumber ? (
            <>
              flagged for review · #{ar.issueNumber} ·{" "}
              <a href={ar.issueUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--cg-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-muted)")}
              >view →</a>
            </>
          ) : (
            <>GitHub not configured — local flag only</>
          )}
        </div>
      );
      if (ar.type === "approve") return (
        <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)", marginTop: 20 }}>
          {ar.prNumber ? (
            <>
              PR #{ar.prNumber} opened · <code className="ic">{ar.branchName}</code> ·{" "}
              <a href={ar.prUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--cg-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-muted)")}
              >view PR →</a>
            </>
          ) : (
            <>GitHub not configured — local approval only</>
          )}
        </div>
      );
    }

    // Action failed
    if (ar?.error) return (
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: ar.type === "approve" ? "var(--sev-critical)" : "var(--cg-muted)" }}>
          {ar.error}
          {" · "}
          <span
            onClick={() => { setActionResults(prev => { const m = new Map(prev); m.delete(finding.id); return m; }); if (ar.type === "approve") startApprove(finding); }}
            style={{ cursor: "pointer", textDecoration: "underline" }}
          >retry</span>
        </div>
      </div>
    );

    // Approve mode — branch name input
    if (approveMode === finding.id) return (
      <div style={{ marginTop: 20 }}>
        <div className="sh" style={{ marginBottom: 6 }}>branch name</div>
        <input
          value={branchName}
          onChange={e => setBranchName(e.target.value)}
          style={{
            width: "100%", background: "var(--cg-surface2)", border: "1px solid var(--cg-border2)",
            borderRadius: 4, fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-text)",
            padding: "6px 10px", outline: "none",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#3A4260")}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--cg-border2)")}
        />
        {branchName && !branchValid && (
          <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--sev-critical)", marginTop: 4 }}>
            invalid branch name
          </div>
        )}
        <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", marginTop: 4 }}>
          will be created from <code className="ic">{scanCtx?.defaultBranch || "main"}</code>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <span
            onClick={() => setApproveMode(null)}
            style={{ fontSize: 12, color: "var(--cg-muted)", cursor: "pointer", padding: "5px 0" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-muted)")}
          >Cancel</span>
          <button
            onClick={() => doApprove(finding)}
            disabled={!branchValid || isLoading}
            style={{
              border: "1px solid var(--cg-border2)", background: "transparent", color: "var(--cg-text)",
              fontSize: 12, padding: "5px 12px", borderRadius: 4, cursor: !branchValid || isLoading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-ui)", opacity: !branchValid || isLoading ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (branchValid && !isLoading) { e.currentTarget.style.borderColor = "#16A34A"; e.currentTarget.style.color = "#16A34A"; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cg-border2)"; e.currentTarget.style.color = "var(--cg-text)"; }}
          >
            {isLoading ? "creating..." : "Create branch & open PR →"}
          </button>
        </div>
      </div>
    );

    // Default buttons
    return (
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["block", "flag", "approve"] as const).map(a => {
            const isActive = decision(finding.id)?.action === a;
            const isTriaged = !!actionResults.get(finding.id);
            const triagedAs = actionResults.get(finding.id)?.type;
            const isThis = triagedAs === a;
            return (
              <button
                key={a}
                className={`tb ${a}${isActive || isThis ? " active" : ""}${isTriaged && !isThis ? " triaged-other" : ""}${isLoading && actionLoading === finding.id ? " loading" : ""}`}
                disabled={isLoading || (isTriaged && !isThis)}
                onClick={() => {
                  if (isTriaged) return;
                  if (hasGhActions) {
                    if (a === "block") doBlock(finding);
                    else if (a === "flag") doFlag(finding);
                    else startApprove(finding);
                  } else {
                    doLocalTriage(a, finding);
                  }
                }}
              >
                {a}
              </button>
            );
          })}
        </div>
        {decision(finding.id)?.policyRef && (
          <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", marginTop: 8 }}>
            policy: {decision(finding.id)?.policyRef}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <ParticleBackground />
    <ToastContainer />
    <div className="app-layout">
      <Navbar onPaste={() => setShowPaste(true)} scanning={scanning} />

      {/* Left panel — RepoPicker or StatsPanel */}
      <div className="stats-col">
        {result ? (
          <>
            {scanCtx && (
              <div
                onClick={resetToRepoPicker}
                style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", cursor: "pointer", marginBottom: 8 }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-muted)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-dim)")}
              >
                ← change file
              </div>
            )}
            <StatsPanel stats={result.stats} filename={scanFilenames[0] || "code"} triageCounts={triageCounts} />
          </>
        ) : (
          <RepoPicker onScanFile={handleScanFile} onScanRepo={handleScanRepo} />
        )}
      </div>

      <div className="main-col">
        <div className="content-split">
          <div className="findings-col">
            {scanning && <div className="scan-beam" />}
            {scanning ? (
              <ScanAnimation filenames={scanFilenames} />
            ) : result ? (
              <FindingsPanel findings={result.findings} selected={selected} onSelect={(f) => { setSelected(f); setMobileDetail(true); setApproveMode(null); }} />
            ) : (
              <div className="empty-state">paste code above to begin</div>
            )}
          </div>

          <div className={`detail-col${mobileDetail && selected ? " mobile-open" : ""}`}>
            {selected ? (
              <div>
                <div className="mobile-only mobile-detail-back" onClick={() => setMobileDetail(false)}>
                  ← back to findings
                </div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-code)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: `var(--sev-${selected.severity})`, marginBottom: 4 }}>
                  {selected.severity}
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "var(--cg-text)", marginBottom: 4 }}>
                  {selected.title}
                </div>
                <div className="dp-breadcrumb">
                  {selected.file.split("/").map((seg, i) => (
                    <span key={i}>{i > 0 && <span className="sep"> / </span>}{seg}</span>
                  ))}
                  <span className="sep"> · </span>
                  <span>line {selected.line}</span>
                  {selected.cwe && <><span className="sep"> · </span><span>{selected.cwe}</span></>}
                </div>
                <div className="detail-gradient-line" />

                <div className="cb">
                  {parseSnippet(selected.code_snippet, selected.line).map((l, i) => (
                    <div key={i} className={`cl${l.vuln ? " vuln" : ""}`}>
                      <span className="cln">{l.ln || ""}</span>
                      <span className="clc">{l.content}</span>
                    </div>
                  ))}
                </div>

                <div className="sh">analysis</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--cg-text)", marginBottom: 20 }}>
                  {renderAI(selected.ai_explanation || selected.raw_description)}
                </div>

                {selected.ai_fix && (
                  <>
                    <div className="sh">suggested fix</div>
                    <div className="cb">
                      {selected.ai_fix.split("\n").map((l, i) => (
                        <div key={i} className="cl">
                          <span className="cln">{i + 1}</span>
                          <span className="clc">{l}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {renderTriage(selected)}
              </div>
            ) : !scanning ? (
              <div className="empty-state">
                {result ? "select a finding" : "paste code above to begin"}
              </div>
            ) : null}
          </div>
        </div>

        {result ? (
          <AuditLog entries={result.auditLog} decisions={result.decisions} actionResults={Array.from(actionResults.values())} scanCtx={scanCtx} />
        ) : (
          <div className="audit-strip collapsed">
            <div className="audit-hdr">audit log <span>· 0 events</span></div>
          </div>
        )}
      </div>

      {/* Paste modal */}
      {showPaste && (
        <div className="paste-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPaste(false); }}>
          <div className="paste-modal">
            <div className="paste-modal-header">
              <h2>scan code</h2>
              <button className="btn-ghost" onClick={() => setShowPaste(false)} style={{ padding: "4px 10px", fontSize: 11 }}>esc</button>
            </div>
            <div className="tab-row">
              <button className={`tab-btn ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>paste</button>
              {!session?.accessToken && (
                <button className={`tab-btn ${tab === "github" ? "active" : ""}`} onClick={() => setTab("github")}>github url</button>
              )}
            </div>
            <div className="paste-modal-body">
              {tab === "paste" ? (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["python", "javascript", "typescript"].map(l => (
                      <button key={l} className={`tab-btn ${lang === l ? "active" : ""}`} onClick={() => setLang(l)}
                        style={{ fontSize: 11, padding: "4px 10px", border: "none", borderBottom: lang === l ? "2px solid var(--cg-text)" : "2px solid transparent" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="paste code here..." spellCheck={false} />
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={ghUrl} onChange={e => setGhUrl(e.target.value)} placeholder="https://github.com/owner/repo" onKeyDown={e => e.key === "Enter" && fetchGh()} />
                    <button className="btn-ghost" onClick={fetchGh} disabled={ghFetching}>{ghFetching ? "fetching..." : "fetch"}</button>
                  </div>
                  {ghInfo && <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)" }}>{ghInfo}</div>}
                  {code && <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="fetched code will appear here..." spellCheck={false} />}
                </>
              )}
            </div>
            <div className="paste-modal-footer">
              <span style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)" }}>
                {code ? `${code.split("\n").length} lines · ${code.length} chars` : "no code loaded"}
              </span>
              <button className="btn-primary" onClick={() => { setScanCtx(null); doScan(code, lang, scanFilenames[0]); }} disabled={!code.trim()}>Scan</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

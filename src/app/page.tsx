"use client";
import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import StatsPanel from "@/components/StatsPanel";
import FindingsPanel from "@/components/FindingsPanel";
import ScanAnimation from "@/components/ScanAnimation";
import AuditLog from "@/components/AuditLog";
import { ScanResult, Finding } from "@/lib/types";

export default function Home() {
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

  const doScan = useCallback(async (c: string, language: string, filename?: string) => {
    if (!c.trim()) return;
    setShowPaste(false);
    setScanning(true);
    setResult(null);
    setSelected(null);
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

  const decision = (fId: string) => result?.decisions.find(d => d.findingId === fId);

  // Parse code snippet into lines with line numbers
  const parseSnippet = (snippet: string, vulnLine: number) => {
    return snippet.split("\n").map(raw => {
      const m = raw.match(/^(\d+)\s*\|\s?(.*)/);
      const ln = m ? parseInt(m[1]) : 0;
      const content = m ? m[2] : raw;
      return { ln, content, vuln: ln === vulnLine };
    });
  };

  // Render AI text with inline code
  const renderAI = (text: string) => {
    const parts = text.split(/`([^`]+)`/g);
    return parts.map((p, i) =>
      i % 2 === 1 ? <code key={i} className="ic">{p}</code> : <span key={i}>{p}</span>
    );
  };

  return (
    <div className="app-layout">
      <Navbar onPaste={() => setShowPaste(true)} scanning={scanning} />

      <div className="stats-col">
        <StatsPanel
          stats={result?.stats || null}
          filename={result ? scanFilenames[0] || "code" : undefined}
        />
      </div>

      <div className="main-col">
        <div className="content-split">
          {/* Findings column */}
          <div className="findings-col">
            {scanning ? (
              <ScanAnimation filenames={scanFilenames} />
            ) : result ? (
              <FindingsPanel findings={result.findings} selected={selected} onSelect={(f) => { setSelected(f); setMobileDetail(true); }} />
            ) : (
              <div className="empty-state">paste code above to begin</div>
            )}
          </div>

          {/* Detail pane */}
          <div className={`detail-col${mobileDetail && selected ? " mobile-open" : ""}`}>
            {selected ? (
              <div>
                {/* Mobile back button */}
                <div className="mobile-only mobile-detail-back" onClick={() => setMobileDetail(false)}>
                  ← back to findings
                </div>
                {/* Header */}
                <div style={{ fontSize: 11, fontFamily: "var(--font-code)", fontWeight: 600, textTransform: "uppercase", color: `var(--sev-${selected.severity})`, marginBottom: 4 }}>
                  {selected.severity}
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "var(--cg-text)", marginBottom: 4 }}>
                  {selected.title}
                </div>
                <div className="dp-breadcrumb">
                  {selected.file.split("/").map((seg, i, arr) => (
                    <span key={i}>
                      {i > 0 && <span className="sep"> / </span>}
                      {seg}
                    </span>
                  ))}
                  <span className="sep"> · </span>
                  <span>line {selected.line}</span>
                  {selected.cwe && <><span className="sep"> · </span><span>{selected.cwe}</span></>}
                </div>

                {/* Code block */}
                <div className="cb">
                  {parseSnippet(selected.code_snippet, selected.line).map((l, i) => (
                    <div key={i} className={`cl${l.vuln ? " vuln" : ""}`}>
                      <span className="cln">{l.ln || ""}</span>
                      <span className="clc">{l.content}</span>
                    </div>
                  ))}
                </div>

                {/* Analysis */}
                <div className="sh">analysis</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--cg-text)", marginBottom: 20 }}>
                  {renderAI(selected.ai_explanation || selected.raw_description)}
                </div>

                {/* Fix suggestion */}
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

                {/* Triage */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
                  {(["block", "flag", "approve"] as const).map(a => (
                    <button key={a} className={`tb ${a} ${decision(selected.id)?.action === a ? "active" : ""}`}>
                      {a}
                    </button>
                  ))}
                </div>
                {decision(selected.id)?.policyRef && (
                  <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", marginTop: 8 }}>
                    policy: {decision(selected.id)?.policyRef}
                  </div>
                )}
              </div>
            ) : !scanning ? (
              <div className="empty-state">
                {result ? "select a finding" : "paste code above to begin"}
              </div>
            ) : null}
          </div>
        </div>

        {/* Audit strip */}
        {result ? (
          <AuditLog entries={result.auditLog} decisions={result.decisions} />
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
              <button className={`tab-btn ${tab === "github" ? "active" : ""}`} onClick={() => setTab("github")}>github url</button>
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
                  <textarea
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="paste code here..."
                    spellCheck={false}
                  />
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={ghUrl}
                      onChange={e => setGhUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      onKeyDown={e => e.key === "Enter" && fetchGh()}
                    />
                    <button className="btn-ghost" onClick={fetchGh} disabled={ghFetching}>
                      {ghFetching ? "fetching..." : "fetch"}
                    </button>
                  </div>
                  {ghInfo && <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)" }}>{ghInfo}</div>}
                  {code && (
                    <textarea
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="fetched code will appear here..."
                      spellCheck={false}
                    />
                  )}
                </>
              )}
            </div>
            <div className="paste-modal-footer">
              <span style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)" }}>
                {code ? `${code.split("\n").length} lines · ${code.length} chars` : "no code loaded"}
              </span>
              <button className="btn-primary" onClick={() => doScan(code, lang, scanFilenames[0])} disabled={!code.trim()}>
                Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

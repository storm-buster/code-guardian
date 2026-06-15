import { NextRequest, NextResponse } from "next/server";
import { scanCode } from "@/lib/scanner";
import { batchAnalyze } from "@/lib/llm";
import { armoriq } from "@/lib/armoriq";
import { Finding, AuditEntry, ScanResult } from "@/lib/types";

export const maxDuration = 60; // Allow up to 60s for LLM calls on Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, language, filename } = body;

    if (!code || code.trim().length === 0) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const startTime = Date.now();
    const auditLog: AuditEntry[] = [];
    const ts = () => new Date().toISOString();
    let auditIdx = 0;
    const nextAuditId = () => `AUD-${String(++auditIdx).padStart(3, "0")}`;

    // ─── 1. SCAN START ───
    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "scan_start",
      message: `Scan initiated for ${filename || "uploaded code"} (${language || "auto-detect"})`,
      details: `Code size: ${code.length} bytes, ${code.split("\n").length} lines | ArmorIQ SDK: ${armoriq.isConfigured ? "Connected ✓" : "Not configured"}`,
    });

    // ─── 2. STATIC ANALYSIS ───
    const rawFindings = scanCode(code, filename || "code");

    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "finding_detected",
      message: `Static analysis complete: ${rawFindings.length} potential vulnerabilities detected`,
      details: `Scanner checked 15 vulnerability patterns across ${code.split("\n").length} lines`,
    });

    // ─── 3. AI ANALYSIS (Real LLM via OpenRouter) ───
    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "ai_analysis",
      message: `AI analysis started: sending ${rawFindings.length} findings to LLM for context-aware explanation...`,
      details: `Model: google/gemini-2.5-flash via OpenRouter | Batch size: 5`,
    });

    const llmResults = await batchAnalyze(rawFindings);

    // Merge scanner findings + LLM analysis
    const findings: Finding[] = rawFindings.map((f, idx) => ({
      ...f,
      ai_explanation: llmResults[idx]?.ai_explanation || "Analysis pending.",
      ai_fix: llmResults[idx]?.ai_fix || "Fix suggestion pending.",
      confidence: llmResults[idx]?.confidence || 75,
    }));

    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "ai_analysis",
      message: `AI analysis complete: ${findings.length} findings enriched with real LLM-generated explanations`,
      details: `Average confidence: ${Math.round(findings.reduce((a, f) => a + f.confidence, 0) / Math.max(findings.length, 1))}%`,
    });

    // ─── 4. AGENT TRIAGE via ArmorIQ SDK ───
    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "agent_decision",
      message: `Agent triage started: processing ${findings.length} findings through ArmorIQ policy engine...`,
    });

    // Get base URL for proxy endpoints routing
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    const { decisions, armoriqConnected, planHash, tokenId, policyResults } =
      await armoriq.processFindings(findings, baseUrl);

    // Log ArmorIQ SDK status
    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "ai_analysis",
      message: `ArmorIQ SDK: ${armoriqConnected ? "Plan captured + intent token issued" : "Running in local-triage mode"}`,
      details: armoriqConnected
        ? `Plan hash: ${planHash} | Token: ${tokenId} | Policy results: ${policyResults.filter((r) => r.status === "executed").length} approved, ${policyResults.filter((r) => r.status === "policy_blocked").length} blocked, ${policyResults.filter((r) => r.status === "policy_hold").length} held for review`
        : "ArmorIQ SDK not connected or invalid API key.",
    });

    // Add per-finding decision to audit log
    for (const decision of decisions) {
      const finding = findings.find((f) => f.id === decision.findingId);
      auditLog.push({
        id: nextAuditId(),
        timestamp: ts(),
        action: "agent_decision",
        severity: finding?.severity,
        message: `Agent ${decision.action.toUpperCase()}: [${decision.findingId}] ${finding?.title || "Unknown"}`,
        details: decision.reason,
        decision: decision.action,
      });
    }

    // ─── 5. SCAN COMPLETE ───
    const scanDuration = Date.now() - startTime;

    const stats = {
      totalFindings: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      info: findings.filter((f) => f.severity === "info").length,
      autoApproved: decisions.filter((d) => d.action === "approve").length,
      flagged: decisions.filter((d) => d.action === "flag").length,
      blocked: decisions.filter((d) => d.action === "block").length,
      scanDuration,
    };

    auditLog.push({
      id: nextAuditId(),
      timestamp: ts(),
      action: "scan_complete",
      message: `Scan complete in ${scanDuration}ms — ${stats.totalFindings} findings | ${stats.blocked} blocked | ${stats.flagged} flagged | ${stats.autoApproved} approved`,
      details: `LLM calls: ${findings.length} | ArmorIQ SDK: ${armoriqConnected ? "Active" : "Local"} | Plan: ${planHash || "N/A"}`,
    });

    const result: ScanResult = { findings, decisions, auditLog, stats };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: "Internal scan error: " + (error instanceof Error ? error.message : "Unknown") },
      { status: 500 }
    );
  }
}

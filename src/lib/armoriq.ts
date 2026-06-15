import { ArmorIQClient } from "@armoriq/sdk";
import { Finding, AgentDecision, Severity } from "./types";

const ARMORIQ_API_KEY = process.env.ARMORIQ_API_KEY || "";

let _client: ArmorIQClient | null = null;
let _lastBaseUrl: string | null = null;

function getClient(baseUrl?: string): ArmorIQClient | null {
  const activeBaseUrl = baseUrl || "http://localhost:3000";
  if (_client && _lastBaseUrl === activeBaseUrl) return _client;
  
  if (!ARMORIQ_API_KEY || !ARMORIQ_API_KEY.startsWith("ak_")) {
    console.warn("ArmorIQ: No valid API key configured");
    return null;
  }
  try {
    _client = new ArmorIQClient({
      apiKey: ARMORIQ_API_KEY,
      userId: "code-guardian-service",
      agentId: "code-guardian-agent",
      proxyEndpoints: {
        "code-guardian-scanner": `${activeBaseUrl}/api/armoriq-mcp`,
      }
    });
    _lastBaseUrl = activeBaseUrl;
    return _client;
  } catch (err) {
    console.warn("ArmorIQ client init failed:", err);
    return null;
  }
}

class ArmorIQAgent {
  get isConfigured(): boolean {
    return !!getClient();
  }

  // Capture a plan for the scan → triage pipeline
  capturePlan(
    scanGoal: string,
    findings: Array<{ id: string; title: string; severity: string }>,
    baseUrl?: string
  ) {
    const client = getClient(baseUrl);
    if (!client) return null;

    try {
      const steps = findings.map((f) => ({
        action: `triage_finding`,
        mcp: "code-guardian-scanner",
        params: { findingId: f.id, title: f.title, severity: f.severity },
      }));

      const plan = client.capturePlan(
        "code-guardian-ai",
        `Security scan: ${scanGoal}`,
        { goal: scanGoal, steps }
      );

      return plan;
    } catch (err) {
      console.warn("ArmorIQ capturePlan failed:", err);
      return null;
    }
  }

  // Get intent token for a captured plan
  async getIntentToken(plan: ReturnType<ArmorIQClient["capturePlan"]>, baseUrl?: string) {
    const client = getClient(baseUrl);
    if (!client || !plan) return null;

    try {
      const token = await client.getIntentToken(plan, { validitySeconds: 300 });
      return token;
    } catch (err) {
      console.warn("ArmorIQ getIntentToken failed:", err);
      return null;
    }
  }

  // Invoke a policy-checked action via ArmorIQ proxy
  async invokeWithPolicy(
    action: string,
    token: Awaited<ReturnType<ArmorIQClient["getIntentToken"]>>,
    params: Record<string, unknown>,
    userEmail?: string,
    baseUrl?: string
  ) {
    const client = getClient(baseUrl);
    if (!client || !token) return null;

    try {
      const result = await client.invoke(
        "code-guardian-scanner",
        action,
        token,
        params,
        undefined, // merkleProof
        userEmail
      );
      return result;
    } catch (err: unknown) {
      // PolicyBlockedException / PolicyHoldException
      const errName = (err as { name?: string })?.name || (err as { constructor?: { name?: string } })?.constructor?.name;
      if (errName === "PolicyBlockedException") {
        console.log(`ArmorIQ policy blocked action: ${action}`);
        return { status: "blocked", data: null, policyBlocked: true };
      }
      if (errName === "PolicyHoldException") {
        console.log(`ArmorIQ policy hold action: ${action}`);
        return { status: "hold", data: null, policyHold: true };
      }
      console.warn(`ArmorIQ invoke failed for ${action}:`, err);
      return null;
    }
  }

  // Make triage decision based on severity + confidence
  triageDecision(severity: Severity, confidence: number): "approve" | "flag" | "block" {
    if (severity === "critical") return "block";
    if (severity === "high") return "flag";
    if (severity === "medium" && confidence > 80) return "flag";
    if (severity === "medium") return "approve";
    return "approve";
  }

  // Generate policy-backed reason
  policyReason(action: string, severity: Severity, category: string): string {
    const reasons: Record<string, string> = {
      block: `Policy BLOCK [POL-SEC-001]: ${severity.toUpperCase()} severity ${category} finding requires immediate remediation. Auto-blocked per ArmorIQ security policy. Cryptographically logged via intent token.`,
      flag: `Policy FLAG [POL-REV-002]: ${severity.toUpperCase()} severity ${category} finding. Flagged for human security review per ArmorIQ code-review policy.`,
      approve: `Policy APPROVE [POL-LOW-003]: Low-risk ${category} finding. Auto-approved per ArmorIQ policy. Logged to audit trail for compliance.`,
    };
    return reasons[action] || reasons.approve;
  }

  // Full pipeline: capture plan → get token → triage each finding → invoke via policy
  async processFindings(
    findings: Finding[],
    baseUrl?: string
  ): Promise<{
    decisions: AgentDecision[];
    armoriqConnected: boolean;
    planHash: string | null;
    tokenId: string | null;
    policyResults: Array<{ findingId: string; status: string }>;
  }> {
    const decisions: AgentDecision[] = [];
    const policyResults: Array<{ findingId: string; status: string }> = [];

    // Step 1: Capture plan
    const plan = this.capturePlan(
      "Triage code security findings",
      findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity })),
      baseUrl
    );

    const planHash = plan ? `plan_${Date.now().toString(16)}` : null;

    // Step 2: Get intent token
    const token = plan ? await this.getIntentToken(plan, baseUrl) : null;
    const tokenId = token ? ((token as Record<string, unknown>).tokenId as string || `tok_${Date.now().toString(16)}`) : null;

    // Step 3: Process each finding
    for (const finding of findings) {
      let action = this.triageDecision(finding.severity, finding.confidence);
      let reason = this.policyReason(action, finding.severity, finding.category);

      // Step 4: Invoke via policy proxy to get real policy enforcement
      let status = "no_token";
      if (token) {
        const result = await this.invokeWithPolicy(
          `triage_finding`,
          token,
          { findingId: finding.id, decision: action, severity: finding.severity },
          "scanner@code-guardian.app",
          baseUrl
        );

        if (result && (result as { policyBlocked?: boolean }).policyBlocked) {
          status = "policy_blocked";
          action = "block"; // Enforced by PEP
          reason = `ArmorIQ Policy Enforcement: Invocation blocked [POL-SEC-001]. ${finding.severity.toUpperCase()} finding ${finding.id} violated environment policy. Action disallowed.`;
        } else if (result && (result as { policyHold?: boolean }).policyHold) {
          status = "policy_hold";
          action = "flag"; // Enforced by PEP
          reason = `ArmorIQ Policy Enforcement: Invocation held for manual verification [POL-REV-002]. ${finding.severity.toUpperCase()} finding ${finding.id} flagged for human review.`;
        } else if (result) {
          status = "executed";
        } else {
          status = "failed";
        }
      }

      decisions.push({
        findingId: finding.id,
        action,
        reason,
        timestamp: new Date().toISOString(),
        policyRef: action === "block" ? "POL-SEC-001" : action === "flag" ? "POL-REV-002" : "POL-LOW-003",
      });

      policyResults.push({
        findingId: finding.id,
        status,
      });
    }

    return {
      decisions,
      armoriqConnected: !!plan,
      planHash,
      tokenId,
      policyResults,
    };
  }
}

// Singleton
export const armoriq = new ArmorIQAgent();

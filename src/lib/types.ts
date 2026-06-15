export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  line: number;
  column?: number;
  file: string;
  code_snippet: string;
  raw_description: string;
  ai_explanation: string;
  ai_fix: string;
  confidence: number; // 0-100
  category: string;
  cwe?: string;
}

export interface AgentDecision {
  findingId: string;
  action: "approve" | "flag" | "block";
  reason: string;
  timestamp: string;
  policyRef?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: "scan_start" | "finding_detected" | "ai_analysis" | "agent_decision" | "scan_complete";
  severity?: Severity;
  message: string;
  details?: string;
  decision?: "approve" | "flag" | "block";
}

export interface ScanResult {
  findings: Finding[];
  decisions: AgentDecision[];
  auditLog: AuditEntry[];
  stats: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    autoApproved: number;
    flagged: number;
    blocked: number;
    scanDuration: number;
  };
}

export interface ScanRequest {
  code: string;
  language: string;
  filename?: string;
}

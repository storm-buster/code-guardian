# Code Guardian: ArmorIQ Integration Summary

**Code Guardian** is a 2026-era AI-powered security code review agent. It leverages the **ArmorIQ SDK** (`@armoriq/sdk`) to ensure that all automated, AI-driven triage actions (like approving fixes, blocking PRs, or flagging issues) are cryptographically captured, authorized via intent tokens, and securely logged.

This document summarizes the architecture and the specific role ArmorIQ plays in the lifecycle of a security scan within the application.

---

## 1. Core Architecture Overview

- **Frontend & UI**: Built with Next.js 16 (App Router), React, and `@react-three/fiber` to provide a futuristic, highly responsive "Threat Terminal" dashboard.
- **Scanner Pipeline**: Uses a custom regex-based AST scanner to detect 15+ CWE vulnerability patterns (SQLi, XSS, Path Traversal, etc.).
- **AI Brain**: Sends findings to Google Gemini 2.5 Flash (via OpenRouter) to generate detailed, beginner-friendly explanations and precise remediation code snippets.
- **GitHub Orchestration**: Uses `@octokit/rest` and NextAuth OAuth tokens to operate on behalf of the user—automatically creating branches, committing AI fixes, opening Pull Requests, and creating Security Issues.
- **ArmorIQ Security Layer**: Wraps the AI's intended actions in a strict security policy envelope using the ArmorIQ SDK.

---

## 2. The ArmorIQ SDK Integration Workflow

The application heavily utilizes the `@armoriq/sdk` to govern what the AI is allowed to do. The integration is primarily managed in `src/lib/armoriq.ts` and executed inside the core scanning route (`src/app/api/scan/route.ts`).

### Step 1: Client Initialization and Proxy Setup
When a scan is initiated, the application initializes the `ArmorIQClient`. It configures a localized MCP (Model Context Protocol) proxy endpoint:
```typescript
_client = new ArmorIQClient({
  apiKey: ARMORIQ_API_KEY,
  userId: "code-guardian-service",
  agentId: "code-guardian-agent",
  proxyEndpoints: {
    "code-guardian-scanner": `\${activeBaseUrl}/api/armoriq-mcp`,
  }
});
```
This tells ArmorIQ where to route policy evaluation requests.

### Step 2: Plan Capture (`capturePlan`)
Before the AI agent is allowed to execute any GitHub triage actions, it must first "declare its intent" to ArmorIQ. The application calls `client.capturePlan()`, passing in the goal (e.g., "Analyze vulnerabilities") and the precise steps the AI intends to take (one step per vulnerability found).

This returns a `Plan` object, which is cryptographically hashed (`planHash`), creating an immutable record of what the AI *said* it was going to do.

### Step 3: Intent Token Issuance (`getIntentToken`)
The application takes the captured plan and requests an **Intent Token** from ArmorIQ via `client.getIntentToken()`. This token is time-bound (e.g., valid for 300 seconds) and binds the AI's execution context securely to the captured plan.

### Step 4: Policy Enforcement & Invocation (`invoke`)
For every finding the AI analyzes, Code Guardian attempts to invoke a triage action (e.g., `triage_finding`) using the Intent Token. 
```typescript
const result = await client.invoke(
  "code-guardian-scanner", // Target Proxy
  "triage_finding",        // Action
  token,                   // Intent Token
  { severity: "critical", ... } // Params
);
```
ArmorIQ intercepts this invocation, evaluates the parameters against configured policies (e.g., "Critical severities must be Blocked", "Low severities can be Approved"), and returns a `result.status`.
- **`executed`**: The policy allowed the action.
- **`policy_blocked`**: The policy strictly rejected the action.
- **`policy_hold`**: The action requires human review.

### Step 5: Triage Decision Mapping
Code Guardian maps the ArmorIQ policy responses back to tangible UI and GitHub actions:
- **Block (`security-blocked`)**: Usually mapped from Critical/High severities. Opens an Issue.
- **Flag (`needs-security-review`)**: Usually mapped from Medium severities. Opens an Issue.
- **Approve**: Usually mapped from Low/Info severities. Creates a PR with the AI-generated fix.

---

## 3. Graceful Local Fallback

If the user does not provide an `ARMORIQ_API_KEY`, or if the SDK fails to connect, Code Guardian is designed to gracefully degrade into **Local Triage Mode**. 

In local mode, the application bypasses the cryptographic `capturePlan` and `invoke` steps, and instead uses a localized ruleset (e.g., `severity === "critical" -> "block"`) to determine the triage action. While this lacks the immutable audit trail and strict policy controls of the ArmorIQ platform, it allows the application to remain functional for rapid prototyping and local testing.

---

## 4. The Audit Trail UI

Every action—from the moment the scan starts, through the LLM analysis, down to the issuance of the ArmorIQ Intent Token—is appended to an `AuditLog` array.

In the user interface (`src/components/AuditLog.tsx`), this log is displayed at the bottom of the "Threat Terminal". When ArmorIQ is active, the UI proudly displays the successful issuance of the token, the `planHash`, and the cryptographic proof that the AI Agent acted securely within its defined constraints.

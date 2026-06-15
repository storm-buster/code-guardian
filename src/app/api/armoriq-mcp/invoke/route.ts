import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mcp, action, params, intent_token } = body;

    // Validate request structure
    if (!mcp || !action || !intent_token) {
      return NextResponse.json(
        { error: "Invalid request payload: mcp, action, and intent_token are required" },
        { status: 400 }
      );
    }

    console.log(`[ArmorIQ Mock PEP] Intercepted invoke for MCP: ${mcp}, action: ${action}`);
    console.log(`[ArmorIQ Mock PEP] Intent token ID: ${intent_token.intent_reference || "unknown"}`);

    // Policy rules check:
    // If the finding is CRITICAL severity, enforce a Policy BLOCK
    const severity = params?.severity || "info";
    const findingId = params?.findingId || "unknown";

    if (severity === "critical") {
      console.log(`[ArmorIQ Mock PEP] POLICY VIOLATION: Critical finding ${findingId} blocked by security policy [POL-SEC-001]`);
      return NextResponse.json({
        enforcement: {
          action: "block",
        },
        message: `Policy BLOCK [POL-SEC-001]: Critical severity vulnerability ${findingId} auto-blocked per ArmorIQ security policy.`,
      });
    }

    // If the finding is HIGH severity, enforce a Policy HOLD (for review)
    if (severity === "high") {
      console.log(`[ArmorIQ Mock PEP] POLICY WARNING: High finding ${findingId} flagged for human review [POL-REV-002]`);
      return NextResponse.json({
        enforcement: {
          action: "hold",
        },
        message: `Policy HOLD [POL-REV-002]: High severity vulnerability ${findingId} flagged for human review per ArmorIQ policy.`,
      });
    }

    // Success response for medium/low
    return NextResponse.json({
      result: {
        status: "success",
        findingId,
        decision: "approved",
        message: `Policy APPROVE [POL-LOW-003]: Vulnerability ${findingId} auto-approved.`,
      },
    });
  } catch (err) {
    console.error("[ArmorIQ Mock PEP] Invoke handler error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal PEP error" },
      { status: 500 }
    );
  }
}

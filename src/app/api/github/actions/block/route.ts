import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Octokit } from "@octokit/rest";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, filePath, finding, policyId } = body;
    const token = session.accessToken;
    const octokit = new Octokit({ auth: token });

    // 1. Ensure label exists
    try {
      await octokit.issues.getLabel({ owner, repo, name: "security-blocked" });
    } catch (e: any) {
      if (e.status === 404) {
        try {
          await octokit.issues.createLabel({ owner, repo, name: "security-blocked", color: "DC2626" });
        } catch (_) { /* ignore if already created */ }
      }
    }

    // 2. Create issue
    const issueBody = `## Security Finding Blocked\n\n**Severity:** ${finding.severity.toUpperCase()}\n**CWE:** ${finding.cwe || "N/A"}\n**File:** \`${filePath}\`\n**Line:** ${finding.line || finding.lineNumber || "unknown"}\n\n### Analysis\n${finding.ai_explanation || finding.raw_description}\n\n---\n*Blocked by Code Guardian · ArmorIQ policy: ${policyId}*`;

    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: `[BLOCKED] ${finding.title} in ${filePath}`,
      body: issueBody,
      labels: ["security-blocked"],
    });

    return NextResponse.json({ issueUrl: issue.html_url, issueNumber: issue.number });
  } catch (error: any) {
    console.error("Block action failed:", error);
    const message = error?.response?.data?.message || error?.message || "unknown";
    return NextResponse.json({ error: "action failed: " + message }, { status: 500 });
  }
}


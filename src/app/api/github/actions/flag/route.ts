import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, filePath, finding, policyId } = body;
    const token = session.accessToken;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Code-Guardian/1.0",
    };

    // 1. Ensure label exists
    const labelRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/labels/needs-security-review`,
      { headers }
    );
    if (labelRes.status === 404) {
      await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "needs-security-review", color: "CA8A04" }),
      });
    }

    // 2. Create issue
    const issueBody = `## Security Finding Flagged\n\n**Severity:** ${finding.severity.toUpperCase()}\n**CWE:** ${finding.cwe || "N/A"}\n**File:** \`${filePath}\`\n**Line:** ${finding.line}\n\n### Analysis\n${finding.ai_explanation || finding.raw_description}\n\n---\n*Flagged by Code Guardian · ArmorIQ policy: ${policyId}*`;

    const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `[FLAGGED] ${finding.title} in ${filePath}`,
        body: issueBody,
        labels: ["needs-security-review"],
      }),
    });

    if (!issueRes.ok) {
      return NextResponse.json({ error: `action failed: ${issueRes.status}` }, { status: issueRes.status });
    }

    const issue = await issueRes.json();
    return NextResponse.json({ issueUrl: issue.html_url, issueNumber: issue.number });
  } catch (err) {
    return NextResponse.json({ error: "action failed: " + (err instanceof Error ? err.message : "unknown") }, { status: 500 });
  }
}

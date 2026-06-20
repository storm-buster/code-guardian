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
    const { owner, repo, filePath, fileSha, defaultBranch, branchName, finding, suggestedFix, fullFileContent, policyId } = body;
    const token = session.accessToken;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Code-Guardian/1.0",
    };

    let finalBranch = branchName;

    // Step A — get current HEAD sha of defaultBranch
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
      { headers }
    );
    if (!refRes.ok) {
      return NextResponse.json({ error: `fix failed: could not read branch ${defaultBranch}` }, { status: 400 });
    }
    const refData = await refRes.json();
    const baseSha = refData.object.sha;

    // Step B — create branch (retry with -v2 if exists)
    let branchCreated = false;
    for (const suffix of ["", "-v2"]) {
      const tryBranch = branchName + suffix;
      const createRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ ref: `refs/heads/${tryBranch}`, sha: baseSha }),
        }
      );
      if (createRes.ok || createRes.status === 201) {
        finalBranch = tryBranch;
        branchCreated = true;
        break;
      }
      if (createRes.status !== 422) {
        const err = await createRes.text();
        return NextResponse.json({ error: `fix failed: branch creation error ${createRes.status}` }, { status: 400 });
      }
    }
    if (!branchCreated) {
      return NextResponse.json({ error: "fix failed: branch already exists" }, { status: 409 });
    }

    // Step C — apply fix
    let fixedContent = fullFileContent;
    if (suggestedFix && finding.line) {
      const lines = fullFileContent.split("\n");
      const fixLines = suggestedFix.split("\n");
      const startLine = Math.max(0, finding.line - 1);
      const endLine = Math.min(lines.length, startLine + fixLines.length);
      lines.splice(startLine, endLine - startLine, ...fixLines);
      fixedContent = lines.join("\n");
    }

    // Step D — commit fixed file
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `fix(security): remediate ${finding.cwe || "vulnerability"} in ${filePath}`,
          content: Buffer.from(fixedContent).toString("base64"),
          sha: fileSha,
          branch: finalBranch,
        }),
      }
    );

    if (!commitRes.ok) {
      // Rollback branch
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${finalBranch}`,
        { method: "DELETE", headers }
      );
      return NextResponse.json({ error: "fix failed: commit rejected" }, { status: 400 });
    }

    // Step E — open PR
    const cweId = finding.cwe || "unknown";
    const prBody = `## Automated Security Fix\n\n**Finding:** ${finding.title}\n**Severity:** ${finding.severity.toUpperCase()} · ${cweId}\n**File:** \`${filePath}\` · Line ${finding.line}\n\n### What changed\nReplaced vulnerable code with a remediated version that addresses ${finding.title}.\n\n### Analysis\n${finding.ai_explanation || finding.raw_description}\n\n---\n> Auto-remediation by Code Guardian · ArmorIQ policy: ${policyId}\n> Review carefully before merging.`;

    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `[Code Guardian] Fix ${cweId}: ${finding.title}`,
          body: prBody,
          head: finalBranch,
          base: defaultBranch,
        }),
      }
    );

    if (!prRes.ok) {
      // Rollback branch
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${finalBranch}`,
        { method: "DELETE", headers }
      );
      return NextResponse.json({ error: "fix failed: PR creation rejected" }, { status: 400 });
    }

    const pr = await prRes.json();
    return NextResponse.json({ prUrl: pr.html_url, prNumber: pr.number, branchName: finalBranch });
  } catch (err) {
    return NextResponse.json({ error: "fix failed: " + (err instanceof Error ? err.message : "unknown") }, { status: 500 });
  }
}

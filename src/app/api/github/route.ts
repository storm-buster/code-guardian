import { NextRequest, NextResponse } from "next/server";

const SCANNABLE_EXTENSIONS = [
  ".py", ".js", ".ts", ".jsx", ".tsx",
  ".java", ".rb", ".php", ".go",
  ".yaml", ".yml", ".json", ".toml",
  ".env", ".cfg", ".ini", ".conf",
  ".sh", ".bash",
];

const SKIP_DIRS = [
  "node_modules", ".git", "__pycache__", ".next", "dist", "build",
  "vendor", ".venv", "venv", "env", ".env",
  "coverage", ".nyc_output", ".cache",
];

interface GithubFile {
  path: string;
  content: string;
  size: number;
}

// Parse GitHub URL → owner/repo/branch/path
function parseGithubUrl(url: string): { owner: string; repo: string; branch: string; path: string } | null {
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch
  // https://github.com/owner/repo/tree/branch/path
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?$/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] || "main",
    path: match[4] || "",
  };
}

// Fetch repo tree from GitHub API
async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<Array<{ path: string; type: string; url: string; size: number }>> {
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Code-Guardian-Scanner/1.0",
      },
    }
  );

  if (!resp.ok) {
    // Try "master" if "main" fails
    if (branch === "main") {
      const resp2 = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Code-Guardian-Scanner/1.0",
          },
        }
      );
      if (!resp2.ok) {
        throw new Error(`GitHub API error: ${resp2.status} — repo may be private or not found`);
      }
      const data2 = await resp2.json();
      return data2.tree || [];
    }
    throw new Error(`GitHub API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.tree || [];
}

// Fetch file content from GitHub raw
async function fetchFileContent(owner: string, repo: string, branch: string, path: string): Promise<string> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const resp = await fetch(rawUrl, {
    headers: { "User-Agent": "Code-Guardian-Scanner/1.0" },
  });
  if (!resp.ok) return "";
  return resp.text();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Use format: https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    const { owner, repo, branch, path: subPath } = parsed;

    // Fetch repo tree
    const tree = await fetchRepoTree(owner, repo, branch);

    // Filter to scannable files
    const scannableFiles = tree.filter((item) => {
      if (item.type !== "blob") return false;
      const filePath = item.path;

      // Skip large files (>100KB)
      if (item.size > 100000) return false;

      // Skip non-scannable directories
      if (SKIP_DIRS.some((dir) => filePath.includes(`${dir}/`) || filePath.startsWith(`${dir}/`))) {
        return false;
      }

      // Filter by subpath if provided
      if (subPath && !filePath.startsWith(subPath)) return false;

      // Check extension
      const ext = "." + filePath.split(".").pop()?.toLowerCase();
      return SCANNABLE_EXTENSIONS.includes(ext);
    });

    // Limit to 20 files to avoid rate limits
    const filesToScan = scannableFiles.slice(0, 20);

    // Fetch file contents (5 at a time)
    const files: GithubFile[] = [];
    for (let i = 0; i < filesToScan.length; i += 5) {
      const batch = filesToScan.slice(i, i + 5);
      const contents = await Promise.all(
        batch.map(async (f) => {
          const content = await fetchFileContent(owner, repo, branch, f.path);
          return { path: f.path, content, size: f.size };
        })
      );
      files.push(...contents.filter((f) => f.content.length > 0));
    }

    // Combine all file contents with file markers
    const combinedCode = files
      .map((f) => `# ══════ FILE: ${f.path} ══════\n${f.content}`)
      .join("\n\n");

    return NextResponse.json({
      owner,
      repo,
      branch,
      filesScanned: files.length,
      totalFilesInRepo: scannableFiles.length,
      files: files.map((f) => ({ path: f.path, size: f.size, lines: f.content.split("\n").length })),
      combinedCode,
    });
  } catch (error) {
    console.error("GitHub fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch repository" },
      { status: 500 }
    );
  }
}

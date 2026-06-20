import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".php", ".rb", ".rs"];
const SKIP_DIRS = ["node_modules/", ".next/", "dist/", "build/", "vendor/", "__pycache__/", ".git/"];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") || "main";

    if (!owner || !repo) {
      return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Code-Guardian/1.0",
        },
      }
    );

    if (res.status === 403) {
      const reset = res.headers.get("X-RateLimit-Reset");
      const mins = reset ? Math.ceil((parseInt(reset) * 1000 - Date.now()) / 60000) : 5;
      return NextResponse.json({ error: `github rate limit reached · try again in ${mins} min` }, { status: 429 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `github error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const files = (data.tree || [])
      .filter((item: any) => {
        if (item.type !== "blob") return false;
        const path = item.path;
        if (SKIP_DIRS.some(d => path.includes(d))) return false;
        const ext = "." + path.split(".").pop()?.toLowerCase();
        return SCAN_EXTENSIONS.includes(ext);
      })
      .map((item: any) => ({ path: item.path, sha: item.sha }));

    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: "failed to load file tree" }, { status: 500 });
  }
}

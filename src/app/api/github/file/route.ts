import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const path = searchParams.get("path");

    if (!owner || !repo || !path) {
      return NextResponse.json({ error: "owner, repo, and path required" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Code-Guardian/1.0",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `github error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    if (data.size > 500000) {
      return NextResponse.json({ error: "file too large to scan · choose another" }, { status: 413 });
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return NextResponse.json({ content, sha: data.sha });
  } catch (err) {
    return NextResponse.json({ error: "failed to load file" }, { status: 500 });
  }
}

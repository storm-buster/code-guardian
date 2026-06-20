import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member",
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
    const repos = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      updated_at: r.updated_at,
      default_branch: r.default_branch,
    }));

    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json({ error: "failed to load repositories" }, { status: 500 });
  }
}

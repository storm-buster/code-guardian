"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Lock, Globe } from "lucide-react";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  default_branch: string;
}

interface FileItem {
  path: string;
  sha: string;
}

interface Props {
  onScanFile: (ctx: {
    owner: string;
    repo: string;
    filePath: string;
    defaultBranch: string;
    fileSha: string;
    fileContent: string;
  }) => void;
  onScanRepo: (ctx: {
    owner: string;
    repo: string;
    defaultBranch: string;
    combinedCode: string;
    filenames: string[];
  }) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RepoPicker({ onScanFile, onScanRepo }: Props) {
  const { data: session } = useSession();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fetchingFile, setFetchingFile] = useState(false);
  const [scanningRepo, setScanningRepo] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRepos(data.repos || []);
    } catch {
      setError("failed to load repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.accessToken) fetchRepos();
  }, [session, fetchRepos]);

  const selectRepo = async (repo: Repo) => {
    setSelectedRepo(repo);
    setSelectedFile(null);
    setFilesLoading(true);
    setFilesError("");
    const [owner, name] = repo.full_name.split("/");
    try {
      const res = await fetch(`/api/github/tree?owner=${owner}&repo=${name}&branch=${repo.default_branch}`);
      const data = await res.json();
      if (data.error) { setFilesError(data.error); return; }
      setFiles((data.files || []).sort((a: FileItem, b: FileItem) => a.path.localeCompare(b.path)));
    } catch {
      setFilesError("failed to load file tree");
    } finally {
      setFilesLoading(false);
    }
  };

  const handleScanFile = async () => {
    if (!selectedRepo || !selectedFile) return;
    setFetchingFile(true);
    const [owner, name] = selectedRepo.full_name.split("/");
    try {
      const res = await fetch(`/api/github/file?owner=${owner}&repo=${name}&path=${encodeURIComponent(selectedFile.path)}`);
      const data = await res.json();
      if (data.error) { setFilesError(data.error); return; }
      onScanFile({
        owner,
        repo: name,
        filePath: selectedFile.path,
        defaultBranch: selectedRepo.default_branch,
        fileSha: data.sha,
        fileContent: data.content,
      });
    } catch {
      setFilesError("failed to load file");
    } finally {
      setFetchingFile(false);
    }
  };

  const handleScanRepo = async () => {
    if (!selectedRepo) return;
    setScanningRepo(true);
    setFilesError("");
    try {
      const ghUrl = `https://github.com/${selectedRepo.full_name}`;
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ghUrl }),
      });
      const data = await res.json();
      if (data.error) { setFilesError(data.error); return; }
      const [owner, name] = selectedRepo.full_name.split("/");
      onScanRepo({
        owner,
        repo: name,
        defaultBranch: selectedRepo.default_branch,
        combinedCode: data.combinedCode,
        filenames: (data.files || []).map((f: { path: string }) => f.path),
      });
    } catch {
      setFilesError("failed to fetch repository");
    } finally {
      setScanningRepo(false);
    }
  };

  if (!session?.accessToken) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontFamily: "var(--font-code)", color: "var(--cg-dim)" }}>
          connect github to browse repos
        </div>
      </div>
    );
  }

  const filtered = repos.filter(r => r.full_name.toLowerCase().includes(filter.toLowerCase()));
  const isBusy = fetchingFile || scanningRepo;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="sh" style={{ marginBottom: 0 }}>
          {selectedRepo ? selectedRepo.full_name.split("/")[1] : "repository"}
        </span>
        {selectedRepo ? (
          <span
            onClick={() => { setSelectedRepo(null); setFiles([]); setSelectedFile(null); }}
            style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-muted)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-dim)")}
          >
            ← change repo
          </span>
        ) : (
          <span
            onClick={fetchRepos}
            style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--cg-muted)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--cg-dim)")}
          >
            ↺
          </span>
        )}
      </div>

      {/* Repo list or file list */}
      {!selectedRepo ? (
        <>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="filter repos..."
            style={{
              width: "100%", background: "var(--cg-surface2)", border: "1px solid var(--cg-border)",
              borderRadius: 4, padding: "5px 8px", fontSize: 12, fontFamily: "var(--font-code)",
              color: "var(--cg-text)", outline: "none", marginBottom: 8,
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--cg-border2)")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--cg-border)")}
          />

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 18, background: "var(--cg-surface2)", borderRadius: 3,
                  opacity: 0.3, marginBottom: 6, animation: "shimmer 1.5s infinite",
                }} />
              ))
            ) : error ? (
              <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)" }}>
                {error} ·{" "}
                <span onClick={fetchRepos} style={{ cursor: "pointer", textDecoration: "underline" }}>retry ↺</span>
              </div>
            ) : (
              filtered.map(repo => (
                <div
                  key={repo.id}
                  onClick={() => selectRepo(repo)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 4px",
                    cursor: "pointer", borderRadius: 3, fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--cg-surface2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {repo.private ? <Lock size={12} color="var(--cg-dim)" /> : <Globe size={12} color="var(--cg-dim)" />}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {repo.full_name}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", flexShrink: 0 }}>
                    {timeAgo(repo.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Scan entire repo button */}
          <button
            onClick={handleScanRepo}
            disabled={isBusy || filesLoading}
            style={{
              width: "100%", border: "1px solid var(--cg-border2)", background: "transparent",
              color: "var(--cg-text)", fontSize: 12, padding: 6, borderRadius: 4,
              cursor: isBusy || filesLoading ? "not-allowed" : "pointer", marginBottom: 10,
              fontFamily: "var(--font-ui)", opacity: isBusy || filesLoading ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!isBusy) e.currentTarget.style.background = "var(--cg-surface2)"; }}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {scanningRepo ? "scanning repo..." : "Scan entire repo →"}
          </button>

          <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--cg-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            or select a file
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {filesLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 18, background: "var(--cg-surface2)", borderRadius: 3,
                  opacity: 0.3, marginBottom: 6, animation: "shimmer 1.5s infinite",
                }} />
              ))
            ) : filesError ? (
              <div style={{ fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-muted)" }}>
                {filesError}
              </div>
            ) : (
              files.map(f => (
                <div
                  key={f.path}
                  onClick={() => setSelectedFile(f)}
                  style={{
                    padding: "3px 4px", cursor: "pointer", borderRadius: 3,
                    fontSize: 12, fontFamily: "var(--font-code)", color: "var(--cg-text)",
                    background: selectedFile?.path === f.path ? "var(--cg-surface2)" : "transparent",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { if (selectedFile?.path !== f.path) e.currentTarget.style.background = "var(--cg-surface2)"; }}
                  onMouseLeave={e => { if (selectedFile?.path !== f.path) e.currentTarget.style.background = "transparent"; }}
                >
                  {f.path}
                </div>
              ))
            )}
          </div>
          {selectedFile && (
            <button
              onClick={handleScanFile}
              disabled={isBusy}
              style={{
                width: "100%", border: "1px solid var(--cg-border2)", background: "transparent",
                color: "var(--cg-text)", fontSize: 12, padding: 6, borderRadius: 4,
                cursor: isBusy ? "not-allowed" : "pointer", marginTop: 8,
                fontFamily: "var(--font-ui)", opacity: isBusy ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!isBusy) e.currentTarget.style.background = "var(--cg-surface2)"; }}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {fetchingFile ? "loading..." : "Scan file →"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

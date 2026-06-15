"use client";
import { useEffect, useState } from "react";
import { Finding } from "@/lib/types";

interface Props {
  findings?: Finding[];
  filenames?: string[];
}

interface Line { text: string; type: "file" | "hit" | "ok"; }

export default function ScanAnimation({ findings, filenames }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const built: Line[] = [];
    if (findings && findings.length > 0) {
      const byFile = new Map<string, Finding[]>();
      for (const f of findings) {
        const arr = byFile.get(f.file) || [];
        arr.push(f);
        byFile.set(f.file, arr);
      }
      for (const [file, ffs] of byFile) {
        built.push({ text: `scanning ${file}...`, type: "file" });
        for (const f of ffs) {
          const label = f.title.length > 28 ? f.title.slice(0, 28) + "..." : f.title;
          built.push({ text: `  \u2717 ${label}  (line ${f.line})`, type: "hit" });
        }
      }
    } else if (filenames && filenames.length > 0) {
      for (const fn of filenames) {
        built.push({ text: `scanning ${fn}...`, type: "file" });
      }
    } else {
      built.push({ text: "scanning...", type: "file" });
    }
    setLines(built);
    setIdx(0);
  }, [findings, filenames]);

  useEffect(() => {
    if (idx >= lines.length) return;
    const t = setTimeout(() => setIdx(i => i + 1), 60);
    return () => clearTimeout(t);
  }, [idx, lines.length]);

  return (
    <div className="scan-term">
      {lines.slice(0, idx).map((l, i) => (
        <div key={i} className={l.type === "hit" ? "sx" : l.type === "ok" ? "sok" : "sf"}>{l.text}</div>
      ))}
      {idx < lines.length && <span style={{ color: "var(--cg-dim)" }}>|</span>}
    </div>
  );
}

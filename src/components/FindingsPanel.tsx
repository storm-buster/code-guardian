"use client";
import { Finding } from "@/lib/types";

interface Props {
  findings: Finding[];
  selected: Finding | null;
  onSelect: (f: Finding) => void;
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export default function FindingsPanel({ findings, selected, onSelect }: Props) {
  const sorted = [...findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));

  if (findings.length === 0) {
    return <div className="empty-state">paste code above to begin</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {sorted.map((finding) => (
          <tr
            key={finding.id}
            className={`finding-row sev-${finding.severity} ${selected?.id === finding.id ? "selected" : ""}`}
            onClick={() => onSelect(finding)}
          >
            <td className="sev-indicator" />
            <td className="finding-title">
              {finding.title}
              {finding.cwe && <span className="finding-cwe">CWE-{finding.cwe}</span>}
            </td>
            <td className="finding-location">
              {finding.file}:{finding.line}
            </td>
            <td className="finding-sev-label sev-text">
              {finding.severity.toUpperCase()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

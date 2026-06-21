"use client";
import { useState, useEffect, useCallback } from "react";

interface Toast {
  id: string;
  type: "block" | "flag" | "approve" | "error";
  title: string;
  message: string;
  policyId?: string;
}

const COLORS: Record<string, string> = {
  block: "#FF2244",
  flag: "#FF8C00",
  approve: "#39FF14",
  error: "#DC2626",
};

const ICONS: Record<string, string> = {
  block: "⛔",
  flag: "⚑",
  approve: "✓",
  error: "✕",
};

let _addToast: ((t: Omit<Toast, "id">) => void) | null = null;

export function showToast(t: Omit<Toast, "id">) {
  _addToast?.(t);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 200,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map((t, i) => (
        <div
          key={t.id}
          style={{
            background: "rgba(8,11,16,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${COLORS[t.type]}40`,
            borderLeft: `3px solid ${COLORS[t.type]}`,
            borderRadius: 8,
            padding: "10px 16px",
            minWidth: 280,
            maxWidth: 380,
            pointerEvents: "auto",
            animation: "toast-slide-in 0.3s ease-out",
            boxShadow: `0 4px 24px ${COLORS[t.type]}15`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, color: COLORS[t.type] }}>{ICONS[t.type]}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.08em", color: COLORS[t.type],
              fontFamily: "var(--font-code)",
            }}>
              {t.type === "error" ? "ERROR" : t.type.toUpperCase() + "ED"}
            </span>
            {t.policyId && (
              <span style={{
                fontSize: 10, fontFamily: "var(--font-code)",
                color: "var(--cg-dim)", marginLeft: "auto",
              }}>
                {t.policyId}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12, color: "var(--cg-text)", lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {t.title}
          </div>
          {t.message && (
            <div style={{ fontSize: 11, color: "var(--cg-muted)", marginTop: 2 }}>
              {t.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

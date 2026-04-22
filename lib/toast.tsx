"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

const ToastContext = createContext<{ show: (message: string, type?: ToastType) => void }>({ show: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: "#ffffff", border: "#6b9b7e", text: "#6b9b7e", icon: "\u2713" },
    error: { bg: "#ffffff", border: "#c96b83", text: "#c96b83", icon: "\u2715" },
    info: { bg: "#ffffff", border: "#6b8ba8", text: "#6b8ba8", icon: "\u2139" },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted && createPortal(
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, fontFamily: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
          {toasts.map((t) => {
            const c = colors[t.type];
            return (
              <div key={t.id} style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, minWidth: 280, maxWidth: 400, boxShadow: "0 6px 24px rgba(43,43,43,0.08)", animation: "toastSlide 0.3s ease-out" }}>
                <span style={{ width: 22, height: 22, backgroundColor: c.text + "18", color: c.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0, border: `1px solid ${c.text}55` }}>{c.icon}</span>
                <span style={{ color: c.text, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em" }}>{t.message}</span>
                <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} style={{ marginLeft: "auto", color: c.text, opacity: 0.5, cursor: "pointer", background: "none", border: "none", fontSize: 16, padding: 0, fontFamily: "inherit" }}>&times;</button>
              </div>
            );
          })}
          <style>{`@keyframes toastSlide { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
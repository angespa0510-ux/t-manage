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
    success: { bg: "#0a2e1a", border: "#7ab88f44", text: "#7ab88f", icon: "\u2713" },
    error: { bg: "#2e0a0a", border: "#c4555544", text: "#c45555", icon: "\u2715" },
    info: { bg: "#0a1a2e", border: "#85a8c444", text: "#85a8c4", icon: "\u2139" },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted && createPortal(
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
          {toasts.map((t) => {
            const c = colors[t.type];
            return (
              <div key={t.id} style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 280, maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", animation: "toastSlide 0.3s ease-out" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: c.text + "22", color: c.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.icon}</span>
                <span style={{ color: c.text, fontSize: 13, fontWeight: 500 }}>{t.message}</span>
                <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} style={{ marginLeft: "auto", color: c.text, opacity: 0.5, cursor: "pointer", background: "none", border: "none", fontSize: 16, padding: 0 }}>&times;</button>
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
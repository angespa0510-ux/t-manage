"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ThemeContextType = {
  dark: boolean;
  toggle: () => void;
  T: typeof LIGHT;
};

const LIGHT = {
  bg: "#f8f6f3", card: "#ffffff", cardAlt: "#f8f6f3", border: "#e8e4df",
  text: "#2c2c2a", textSub: "#888780", textMuted: "#b4b2a9", textFaint: "#d3d1c7",
  accent: "#c3a782", accentBg: "rgba(195,167,130,0.05)",
};
const DARK = {
  bg: "#1a1a1e", card: "#25252b", cardAlt: "#1e1e24", border: "#3a3a42",
  text: "#e8e6e2", textSub: "#9a9890", textMuted: "#6a6860", textFaint: "#4a4a44",
  accent: "#c3a782", accentBg: "rgba(195,167,130,0.08)",
};

const ThemeContext = createContext<ThemeContextType>({
  dark: false, toggle: () => {}, T: LIGHT,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("t-manage-theme");
    if (saved === "dark") setDark(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("t-manage-theme", dark ? "dark" : "light");
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    }
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);
  const T = dark ? DARK : LIGHT;

  if (!mounted) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ dark, toggle, T }}>
      <div style={{ backgroundColor: T.bg, color: T.text, minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

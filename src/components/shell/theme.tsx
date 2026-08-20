"use client";
import { useEffect } from "react";
import { useTheme } from "@/stores";

export function ThemeApplier() {
  const { theme, mode } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      // Media-scoped <meta name="theme-color"> tags (see app/layout.tsx) only
      // cover first paint before this effect ever runs — this keeps it
      // correct afterward, including reacting to a manual in-app theme
      // toggle rather than only the OS-level media query.
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      const content = bg.split(" ").length === 3 ? `rgb(${bg})` : dark ? "#181818" : "#F7F7F7";
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", content));
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, mode]);
  return null;
}

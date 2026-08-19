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
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim().split(" ").length === 3
        ? `rgb(${getComputedStyle(root).getPropertyValue("--bg").trim()})` : "#F7F7F7");
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, mode]);
  return null;
}

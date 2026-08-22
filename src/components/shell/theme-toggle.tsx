"use client";
import { useEffect, useState } from "react";
import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "@/stores";
import { cn } from "@/lib/utils";

// A quick light/dark flip for the header — the full Light/Auto/Dark control
// (including "follow system") stays in Profile settings. Tapping this always
// resolves to an explicit light or dark choice, same as picking one of those
// two options there — it never sets mode back to "system".
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemDark);

  return (
    <button
      onClick={() => setMode(isDark ? "light" : "dark")}
      className={cn("pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card", className)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunMedium size={18} /> : <Moon size={18} />}
    </button>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function initials(name: string) {
  return name.replace(/^Dr\.?\s+/i, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const AVATAR_HUES = [156, 200, 32, 262, 8, 176, 98, 322];
export function hueFor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
export function todayAt(h: number, m = 0) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString();
}
export function dateAt(dayKey: string, h: number, m = 0) {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d, h, m, 0, 0);
  return date.toISOString();
}
// Local (not UTC) calendar-day key — avoids the date rolling over near
// midnight when converting through UTC for users east of Greenwich.
export function toDateKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
}
export function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
// Future-facing counterpart to relTime — for a due/reminder timestamp that
// hasn't happened yet. relTime always reports "now" for a future iso (its
// diff goes negative), so this isn't a shared codepath with it.
export function dueLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `in ${d}d`;
  return fmtDate(iso);
}
export function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }
export function uid(p = "id") { return `${p}_${Math.random().toString(36).slice(2, 9)}`; }

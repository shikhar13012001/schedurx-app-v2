"use client";

import { useEffect, useRef } from "react";

// Canvas-based Gemini/Siri-style reactive orb — replaces the old
// Framer-Motion div+blur ListeningOrb. A real per-frequency-band spectrum
// (fed by use-audio-level.ts's 7-band levels) drives a ring of glowing
// petals around a glassy core, so the "premium" look stays honest to actual
// mic input rather than a decorative sine wave.
//
// The render loop reads levels/active from refs, not props, and never
// restarts — only the one-time setup effect (mount, resize) touches
// useEffect deps. Feeding levels straight into a dependency array would
// tear down and rebuild the whole rAF loop on every audio frame (~60/sec),
// which is the exact mistake in the reference implementation this was
// modeled from.
const BAND_COUNT = 7;

function readThemeRgb(varName: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? (parts as [number, number, number]) : fallback;
}

export function AudioOrbVisualizer({ levels, active }: { levels: number[]; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelsRef = useRef(levels);
  const activeRef = useRef(active);

  useEffect(() => {
    levelsRef.current = levels;
  }, [levels]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = canvas?.parentElement;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [pr, pg, pb] = readThemeRgb("--primary", [244, 121, 53]);
    const VIOLET: [number, number, number] = [139, 123, 240];
    const PINK: [number, number, number] = [236, 107, 176];
    const PRIMARY: [number, number, number] = [pr, pg, pb];
    const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

    let width = 0;
    let height = 0;
    let unit = 0; // min(width, height) in CSS px — every radius is derived from this

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = rect.width;
      height = rect.height;
      unit = Math.min(width, height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    // Smoothed display values — eased toward the real targets each frame so
    // motion stays fluid even between analyser updates, without adding
    // input latency the way a longer smoothingTimeConstant upstream would.
    let displayAvg = 0;
    const displayBands = new Array(BAND_COUNT).fill(0);
    let rotation = 0;
    let t = 0;
    let animationId: number;

    const drawIdle = (cx: number, cy: number) => {
      t += 0.012;
      const breathe = reduceMotion ? 0 : Math.sin(t) * 0.5 + 0.5;

      const haloR = unit * (0.32 + breathe * 0.03);
      const halo = ctx.createRadialGradient(cx, cy, unit * 0.1, cx, cy, haloR);
      halo.addColorStop(0, rgba(VIOLET, 0.14 + breathe * 0.05));
      halo.addColorStop(1, rgba(VIOLET, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      const coreR = unit * 0.17;
      const core = ctx.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.3, coreR * 0.1, cx, cy, coreR);
      core.addColorStop(0, rgba([255, 255, 255], 0.35));
      core.addColorStop(0.55, rgba(PRIMARY, 0.4));
      core.addColorStop(1, rgba(VIOLET, 0.28));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // A quiet ring of dots standing in for the mic's presence while
      // paused — dim, unhurried, never competing with the "Listening"
      // label above it.
      const dotCount = 10;
      const ringR = unit * 0.27;
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * Math.PI * 2 + (reduceMotion ? 0 : t * 0.15);
        const phase = reduceMotion ? 0.5 : Math.sin(t * 1.3 + i) * 0.5 + 0.5;
        const x = cx + Math.cos(angle) * ringR;
        const y = cy + Math.sin(angle) * ringR;
        ctx.beginPath();
        ctx.arc(x, y, unit * 0.008, 0, Math.PI * 2);
        ctx.fillStyle = rgba(VIOLET, 0.12 + phase * 0.18);
        ctx.fill();
      }
    };

    const drawActive = (cx: number, cy: number) => {
      const bands = levelsRef.current.length === BAND_COUNT ? levelsRef.current : new Array(BAND_COUNT).fill(0);
      const targetAvg = bands.reduce((a, b) => a + b, 0) / bands.length;
      displayAvg += (targetAvg - displayAvg) * (reduceMotion ? 1 : 0.18);
      for (let i = 0; i < BAND_COUNT; i++) {
        displayBands[i] += (bands[i] - displayBands[i]) * (reduceMotion ? 1 : 0.22);
      }
      if (!reduceMotion) rotation += 0.006 + displayAvg * 0.02;

      // Outer bloom — soft blur where the canvas 2D filter is supported,
      // a wider/fainter gradient as a graceful fallback where it isn't.
      const haloR = unit * (0.3 + displayAvg * 0.16);
      const blurSupported = "filter" in ctx;
      if (blurSupported) ctx.filter = `blur(${Math.round(unit * 0.045)}px)`;
      const halo = ctx.createRadialGradient(cx, cy, unit * 0.08, cx, cy, haloR);
      halo.addColorStop(0, rgba(PRIMARY, 0.35 + displayAvg * 0.25));
      halo.addColorStop(0.55, rgba(VIOLET, 0.22 + displayAvg * 0.15));
      halo.addColorStop(1, rgba(PINK, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();
      if (blurSupported) ctx.filter = "none";

      // Frequency-reactive petal spectrum — one glowing bar per analyser
      // band, real levels, not a decorative sine wave.
      const innerR = unit * 0.2;
      const maxPetal = unit * 0.16;
      for (let i = 0; i < BAND_COUNT; i++) {
        const angle = (i / BAND_COUNT) * Math.PI * 2 + rotation;
        const len = innerR + Math.max(0.08, displayBands[i]) * maxPetal;
        const mix = i / (BAND_COUNT - 1);
        const color: [number, number, number] = mix < 0.5 ? lerpColor(VIOLET, PRIMARY, mix * 2) : lerpColor(PRIMARY, PINK, mix * 2 - 1);

        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * len;
        const y2 = cy + Math.sin(angle) * len;

        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineWidth = unit * 0.028;
        ctx.strokeStyle = rgba(color, 0.55 + displayBands[i] * 0.4);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Glassy core — bright off-center highlight so it reads as a sphere,
      // not a flat disc.
      const coreR = unit * (0.16 + displayAvg * 0.05);
      const core = ctx.createRadialGradient(cx - coreR * 0.35, cy - coreR * 0.35, coreR * 0.05, cx, cy, coreR);
      core.addColorStop(0, rgba([255, 255, 255], 0.9));
      core.addColorStop(0.35, rgba(PRIMARY, 0.85));
      core.addColorStop(1, rgba(VIOLET, 0.75));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Thin definition ring so the core stays crisp against the bloom.
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba([255, 255, 255], 0.25);
      ctx.stroke();
    };

    // The loop always keeps running — reduceMotion only strips out the
    // decorative bits (breathing, rotation, eased easing-toward-target) so
    // the orb still responds instantly to real mic input and state changes,
    // it just never moves on its own.
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      if (activeRef.current) drawActive(cx, cy);
      else drawIdle(cx, cy);
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      ro.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * c, a[1] + (b[1] - a[1]) * c, a[2] + (b[2] - a[2]) * c];
}

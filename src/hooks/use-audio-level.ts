"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 7;

// Taps a live MediaStream for a small array of 0-1 bar heights, driven by
// real mic input — used by the ambient-listening panel's waveform
// visualizer. Deliberately reads off the SAME stream use-ambient-session.ts
// already opened for Scribe + the saved recording (see that file's
// getSharedMicStream comment) rather than requesting a second one — a
// second concurrent getUserMedia call has already destabilized
// transcription on real mobile browsers once this session.
//
// Builds its own AudioContext + AnalyserNode rather than sharing Scribe's
// internal one (not part of its public API) — this is a read-only tap, it
// never touches playback or the stream's tracks, so a second AnalyserNode
// on the same stream is safe and standard Web Audio usage.
export function useAudioLevel(stream: MediaStream | null): number[] {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevels(Array(BAR_COUNT).fill(0));
      return;
    }

    let cancelled = false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const bucketSize = Math.max(1, Math.floor(data.length / BAR_COUNT));

    const tick = () => {
      if (cancelled) return;
      analyser.getByteFrequencyData(data);
      const next: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        const start = i * bucketSize;
        for (let j = start; j < start + bucketSize && j < data.length; j++) sum += data[j];
        next.push(Math.min(1, sum / bucketSize / 255));
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      // iOS Safari especially: an AudioContext left open after its stream
      // goes away is exactly the class of leak that makes the tab hang
      // after repeated start/stop cycles — always close it here, never
      // just let it get garbage-collected.
      void audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [stream]);

  return levels;
}

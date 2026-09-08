"use client";

import { useEffect, useRef } from "react";

// Real WebGL fluid-ink shader — replaces the earlier canvas-2D "petal
// spectrum" version, which read as a flat, toy-like radial bar chart
// rather than the organic Gemini Live / ChatGPT Voice style this feature
// is going for. Bass drives the blob's physical size, mids drive its edge
// distortion, and treble drives fine internal shimmer — a physically
// meaningful mapping, not one arbitrary scalar pushed through every knob.
//
// Renders with real alpha (not an opaque canvas) so the ink floats
// directly on the ambient panel's translucent srx-dark-glass surface
// instead of sitting in a visible dark rectangle.

const vertexShaderSource = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Colors are the same violet/orange/pink identity the ambient panel has
// used since this feature shipped (see ambient-listener-panel.tsx's own
// comment) — a deliberate "AI moment" palette, distinct from — but drawing
// on — the ScheduRx brand orange (#EC6B25).
const fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uState;

#define PI 3.14159265359

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

mat2 rotate2d(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

float blob(vec2 p, vec2 center, float radius, float distortion, float timeOffset) {
  vec2 q = p - center;
  float n1 = fbm(q * 2.8 + vec2(uTime * 0.10 + timeOffset, -uTime * 0.08));
  float n2 = fbm(q * 5.0 + vec2(-uTime * 0.07, uTime * 0.09 + timeOffset));
  float deformation = (n1 - 0.5) * distortion + (n2 - 0.5) * distortion * 0.35;
  return length(q) - radius - deformation;
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y);
  float time = uTime;

  float voiceExpansion = uEnergy * 0.16 + uBass * 0.12;
  float voiceMotion = 0.35 + uEnergy * 1.2 + uMid * 0.5;
  float stateMotion = 1.0 + uState * 0.3;
  float t = time * 0.30 * stateMotion;

  float flowNoise = fbm(uv * 1.2 + vec2(t * 0.23, -t * 0.17));
  float angle = flowNoise * PI * 1.8 + sin(t) * 0.2;
  vec2 p = rotate2d(angle * 0.12) * uv;
  p += vec2(cos(flowNoise * 5.0 + t), sin(flowNoise * 5.0 - t)) * (0.035 + uEnergy * 0.065);

  vec2 c1 = vec2(sin(t * 0.73) * 0.14, cos(t * 0.57) * 0.10);
  vec2 c2 = vec2(0.18 + sin(t * 0.51 + 1.0) * 0.13, -0.08 + cos(t * 0.81) * 0.12);
  vec2 c3 = vec2(-0.19 + cos(t * 0.61) * 0.12, 0.05 + sin(t * 0.49) * 0.15);
  vec2 c4 = vec2(sin(t * 0.43 + 4.0) * 0.15, -0.18 + cos(t * 0.54 + 2.0) * 0.10);

  float distortion = 0.09 + uMid * 0.09 + uTreble * 0.05;

  float d1 = blob(p, c1, 0.32 + voiceExpansion, distortion, 0.0);
  float d2 = blob(p, c2, 0.25 + uBass * 0.10, distortion, 2.3);
  float d3 = blob(p, c3, 0.27 + uMid * 0.09, distortion, 4.8);
  float d4 = blob(p, c4, 0.22 + uTreble * 0.08, distortion, 7.4);

  float d = smin(d1, d2, 0.23);
  d = smin(d, d3, 0.20);
  d = smin(d, d4, 0.19);

  float internalNoise = fbm(p * 3.0 + vec2(time * 0.11, -time * 0.13));
  float fineNoise = fbm(p * 7.0 - time * 0.07);

  // ScheduRx ambient-listening palette: violet, orange, pink.
  vec3 violet = vec3(0.545, 0.482, 0.941);
  vec3 orange = vec3(0.925, 0.420, 0.145);
  vec3 pink = vec3(0.925, 0.420, 0.690);

  float gradient = 0.5 + 0.5 * sin(atan(p.y, p.x) * 2.0 + internalNoise * 5.0 + time * 0.18);
  vec3 colorA = mix(violet, orange, gradient);
  vec3 colorB = mix(orange, pink, internalNoise);
  vec3 inkColor = mix(colorA, colorB, fineNoise);
  inkColor = mix(inkColor, pink, uTreble * internalNoise * 0.35);

  float body = 1.0 - smoothstep(-0.04, 0.08, d);
  float glow = exp(-6.5 * abs(d));
  float outerGlow = exp(-3.0 * max(d, 0.0));

  float highlight = pow(max(0.0, 1.0 - length(p - vec2(-0.12, 0.14))), 5.0);
  highlight *= 0.18 + uEnergy * 0.28;

  vec3 finalColor = inkColor * body;
  finalColor += inkColor * glow * (0.13 + uEnergy * 0.20);
  finalColor += inkColor * outerGlow * 0.035;
  finalColor += vec3(1.0, 0.97, 0.92) * highlight * body;
  finalColor *= 0.85 + voiceMotion * 0.12;

  // Real alpha instead of a painted background — this is what lets the
  // blob float on the ambient panel's own translucent glass rather than
  // sitting inside a visible rectangle.
  float alpha = clamp(body * 0.92 + glow * 0.55 + outerGlow * 0.22, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message ?? "Shader compilation failed");
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create WebGL program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "WebGL program linking failed");
  }
  return program;
}

// Real Hz-range frequency averaging (not equal-width FFT buckets) — bass
// 60-250Hz, mid 250-2000Hz, treble 2000-8000Hz roughly match where a human
// voice's fundamentals, formants, and sibilance actually live.
function averageFrequency(data: Uint8Array, sampleRate: number, lowHz: number, highHz: number) {
  const nyquist = sampleRate / 2;
  const startIndex = Math.max(0, Math.floor((lowHz / nyquist) * data.length));
  const endIndex = Math.min(data.length - 1, Math.ceil((highHz / nyquist) * data.length));
  let sum = 0;
  for (let i = startIndex; i <= endIndex; i++) sum += data[i];
  const count = Math.max(1, endIndex - startIndex + 1);
  return sum / count / 255;
}

export function AudioOrbVisualizer({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef(stream);
  const activeRef = useRef(active);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      time: gl.getUniformLocation(program, "uTime"),
      energy: gl.getUniformLocation(program, "uEnergy"),
      bass: gl.getUniformLocation(program, "uBass"),
      mid: gl.getUniformLocation(program, "uMid"),
      treble: gl.getUniformLocation(program, "uTreble"),
      state: gl.getUniformLocation(program, "uState"),
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Decorative wandering (flow rotation, blob drift) is what reduced
    // motion should strip out; real audio reactivity (bass/mid/treble) is
    // information, not decoration, and stays at full speed either way.
    const timeScale = reduceMotion ? 0.12 : 1.0;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let frequencyData: Uint8Array<ArrayBuffer> | null = null;
    let attachedStream: MediaStream | null = null;

    // The mic stream can arrive after mount (session.start() resolves
    // asynchronously) and can change across a stop/resume cycle — poll for
    // it rather than only wiring audio up once at effect-setup time.
    function ensureAudioWired() {
      const current = streamRef.current;
      if (current === attachedStream) return;
      source?.disconnect();
      source = null;
      attachedStream = current;
      if (!current) return;
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
      }
      source = audioCtx.createMediaStreamSource(current);
      source.connect(analyser);
    }

    let smoothBass = 0;
    let smoothMid = 0;
    let smoothTreble = 0;
    let smoothEnergy = 0;
    let virtualTime = 0;
    let lastNow = performance.now();
    let animationFrame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const animate = (now: number) => {
      resize();
      ensureAudioWired();

      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;
      virtualTime += dt * timeScale;

      let bass = 0;
      let mid = 0;
      let treble = 0;
      if (analyser && frequencyData && audioCtx) {
        analyser.getByteFrequencyData(frequencyData);
        bass = averageFrequency(frequencyData, audioCtx.sampleRate, 60, 250);
        mid = averageFrequency(frequencyData, audioCtx.sampleRate, 250, 2000);
        treble = averageFrequency(frequencyData, audioCtx.sampleRate, 2000, 8000);
      }

      // A tiny baseline so the blob never goes completely inert between words.
      const floor = activeRef.current ? 0.02 : 0.03;
      bass = Math.max(bass, floor);
      mid = Math.max(mid, floor);
      treble = Math.max(treble, floor);
      const energy = bass * 0.5 + mid * 0.35 + treble * 0.15;

      smoothBass += (bass - smoothBass) * 0.13;
      smoothMid += (mid - smoothMid) * 0.11;
      smoothTreble += (treble - smoothTreble) * 0.1;
      smoothEnergy += (energy - smoothEnergy) * 0.14;

      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, virtualTime);
      gl.uniform1f(uniforms.energy, Math.min(smoothEnergy * 2.0, 1));
      gl.uniform1f(uniforms.bass, Math.min(smoothBass * 2.0, 1));
      gl.uniform1f(uniforms.mid, Math.min(smoothMid * 2.0, 1));
      gl.uniform1f(uniforms.treble, Math.min(smoothTreble * 2.0, 1));
      gl.uniform1f(uniforms.state, activeRef.current ? 1.0 : 0.0);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      source?.disconnect();
      analyser?.disconnect();
      void audioCtx?.close().catch(() => {});
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}

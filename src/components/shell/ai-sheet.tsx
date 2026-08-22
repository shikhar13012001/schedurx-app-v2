"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarOff, ListTodo, Mic, Search, Sparkles, UserRoundSearch, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import { Sheet } from "@/components/ui/sheet";
import { AIControl } from "@/components/ui/ai-control";
import { useSession } from "@/stores";
import { useDoctors } from "@/hooks/use-team";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { getFirebaseAuth } from "@/lib/firebase";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Always relative — see src/lib/api-client.ts's BASE_URL comment. The SSE
// stream below goes through next.config.mjs's /api/v1/* rewrite too, same as
// every other browser call in this app.
const BASE_URL = "";

const TOOL_PROGRESS_LABEL: Record<string, string> = {
  block_time: "Blocking your calendar…",
  find_next_free_slot: "Checking availability…",
  find_patient_history: "Looking up patient…",
  add_task: "Adding task…",
  list_appointments: "Finding appointments…",
  reschedule_appointments: "Rescheduling…",
  cancel_appointments: "Cancelling…",
};

async function authHeaders(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Replies stream through this often enough (bold confirmations, "succeeded
// X, failed Y" lists for bulk actions per api-v1-assistant.js's system
// prompt) that plain text was reading as one flat run-on. Component
// overrides so markup lands as the bubble's existing typography rather than
// the browser's default (unstyled) block spacing/list markers.
const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-primary">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-white/10 px-1 py-0.5 text-[13px]">{children}</code>,
};

function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-white/70"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function AiSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const session = useSession((s) => s.session);
  const { data: doctors } = useDoctors();
  const [text, setText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Tracks whether the question that's about to be sent was asked by voice
  // (hold-to-speak), so the reply can be read back automatically the same
  // way — typed questions don't auto-play audio, just show a replay button.
  const askedByVoiceRef = useRef(false);
  const pendingSpokenReplyRef = useRef<string | null>(null);
  const spokenMessageIdsRef = useRef(new Set<string>());

  const doctorId = session?.doctorId ?? doctors?.[0]?.id;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${BASE_URL}/api/v1/assistant`,
        headers: authHeaders,
        body: { context: { doctorId } },
      }),
    [doctorId],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (err) => toast.error(err.message || "ScheduRx couldn't reach the assistant."),
  });
  const thinking = status === "submitted" || status === "streaming";
  const awaitingFirstChunk = status === "submitted";

  // Keeps the transcript pinned to the latest content as it streams in —
  // without this the user has to manually scroll down on every reply.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Stop any reply audio when the sheet closes — nothing should keep talking
  // after the user's dismissed it.
  useEffect(() => {
    if (!open) { audioRef.current?.pause(); setSpeakingId(null); }
  }, [open]);

  // iOS Safari only treats HTMLMediaElement.play() as user-initiated when
  // it's called synchronously inside the gesture handler itself — anything
  // after an `await` (the /speak fetch, or the reply-streaming that finishes
  // well after the mic gesture that started it) no longer counts, and
  // .play() rejects with NotAllowedError. Calling play() synchronously here,
  // even with nothing loaded yet, "unlocks" this specific <audio> element for
  // the rest of the session — later programmatic play() calls on the same
  // element (in speak(), including the auto-read-back after a voice
  // question) then succeed without needing their own fresh gesture.
  function primeAudioForIOS() {
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.play().catch(() => {});
  }

  // Was the browser's own SpeechRecognition (webkitSpeechRecognition) —
  // client-side only, no error path when the mic was blocked or Chrome's
  // recognizer lost its connection to Google's speech backend, which showed
  // up as "Listening…" forever with no transcript and no explanation.
  // Replaced with the same record-then-transcribe path Consults' voice-reply
  // mic already uses successfully: useVoiceRecorder() + POST
  // /api/v1/media/transcribe (real OpenAI Whisper, server-side).
  const startVoice = async () => {
    primeAudioForIOS();
    try {
      await recorder.start();
      askedByVoiceRef.current = true;
    } catch {
      toast.error("Couldn't access the microphone — check your browser permissions.");
    }
  };
  const stopVoice = async () => {
    if (!recorder.recording) return;
    setTranscribing(true);
    try {
      const clip = await recorder.stop();
      if (clip) {
        const { text: transcript } = await api.post<{ text: string }>("/api/v1/media/transcribe", { audioBase64: clip.base64, filename: clip.filename });
        setText(transcript);
      } else {
        // Too short/near-silent to send — useVoiceRecorder already rejected
        // it rather than risk Whisper hallucinating filler text ("you", etc.)
        // for a near-empty clip.
        toast.error("Didn't catch that — hold the button a little longer and try again.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't transcribe that — try typing instead.");
    } finally {
      setTranscribing(false);
    }
  };

  // ElevenLabs voice output — plays base64 MP3 from POST /api/v1/assistant/speak.
  // Silently no-ops if voice synthesis isn't configured for this deployment
  // (503) rather than showing an error for what's an optional enhancement.
  const speak = async (messageId: string, replyText: string) => {
    if (!replyText.trim()) return;
    // Priming again here (on top of startVoice's) covers replaying a
    // typed-question's reply, which never went through a mic gesture — this
    // call itself is still synchronous within the button's onClick.
    primeAudioForIOS();
    try {
      setSpeakingId(messageId);
      const { audioBase64 } = await api.post<{ audioBase64: string }>("/api/v1/assistant/speak", { text: replyText });
      // Reuse the already-primed element rather than a fresh `new Audio()` —
      // the iOS unlock is per-element, not global.
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.pause();
      audio.src = `data:audio/mpeg;base64,${audioBase64}`;
      audio.onended = () => setSpeakingId((id) => (id === messageId ? null : id));
      await audio.play();
    } catch (err) {
      setSpeakingId(null);
      if (!(err instanceof ApiError && err.status === 503)) toast.error("Couldn't play that reply aloud.");
    }
  };

  const submit = (value: string) => {
    if (!value.trim() || thinking) return;
    pendingSpokenReplyRef.current = askedByVoiceRef.current ? "pending" : null;
    askedByVoiceRef.current = false;
    void sendMessage({ text: value.trim() });
    setText("");
  };

  // Once a voice-initiated question's reply finishes streaming, read it back
  // automatically — the same "asked by voice, hear the answer" pairing a
  // spoken conversation would have. Typed questions only get the manual
  // replay button on the bubble, no surprise audio.
  useEffect(() => {
    if (status !== "ready" || !pendingSpokenReplyRef.current) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || spokenMessageIdsRef.current.has(last.id)) return;
    const replyText = last.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
    if (!replyText.trim()) return;
    spokenMessageIdsRef.current.add(last.id);
    pendingSpokenReplyRef.current = null;
    void speak(last.id, replyText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, messages]);

  const actions = useMemo(() => [
    { icon: CalendarOff, label: "Block my next 3 hours", cmd: "Block my next 3 hours" },
    { icon: Search, label: "When am I free next?", cmd: "When is my next free slot?" },
    { icon: UserRoundSearch, label: "Find a patient's last visit", cmd: "Find the last visit for" },
    { icon: ListTodo, label: "Add a task", cmd: "Remind me to call the lab about an echo" },
  ], []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Ask ScheduRx">
      <div className="pb-1 pt-2">
        <div className="flex items-center gap-5">
          <button
            onPointerDown={() => void startVoice()}
            onPointerUp={() => void stopVoice()}
            onPointerLeave={() => recorder.recording && void stopVoice()}
            className="pressable shrink-0"
            aria-label="Hold to speak"
          >
            <AIControl size={76} state={recorder.recording ? "live" : transcribing || thinking ? "thinking" : "idle"} />
          </button>
          <div>
            <p className="font-display text-[34px] font-light leading-[.98] tracking-[-0.055em]">What do you need?</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{recorder.recording ? "Listening…" : transcribing ? "Transcribing…" : thinking ? "Working on it…" : "Hold the warm control to speak, or use a quick action."}</p>
          </div>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="mt-7 overflow-hidden rounded-panel bg-surface-2/70">
          {actions.map((a, i) => (
            <button key={a.label} disabled={thinking} onClick={() => submit(a.cmd)} className="pressable flex min-h-[62px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-surface last:border-0 disabled:opacity-40" style={{ borderBottom: i === actions.length - 1 ? "none" : "1px solid rgb(var(--border) / .55)" }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted shadow-card"><a.icon size={17} /></span>
              <span className="flex-1 text-[14px]">{a.label}</span>
              <ArrowUpRight size={17} className="text-faint" />
            </button>
          ))}
        </div>
      ) : (
        <div ref={scrollRef} className="mt-7 max-h-[42vh] space-y-4 overflow-y-auto scroll-smooth pr-1" data-noswipe>
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;

            if (m.role === "user") {
              const text = m.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
              return <div key={m.id} className="ml-auto max-w-[84%] rounded-[22px] rounded-br-[8px] bg-surface-2 px-4 py-3 text-[14px] leading-relaxed text-muted">{text}</div>;
            }

            const runningTool = m.parts.find((p) => p.type === "dynamic-tool" && p.state !== "output-available" && p.state !== "approval-requested");
            const replyText = m.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
            const label = runningTool && runningTool.type === "dynamic-tool" ? (TOOL_PROGRESS_LABEL[runningTool.toolName] ?? "Working…") : "ScheduRx";
            const isStreamingThis = isLast && status === "streaming";
            if (!replyText && !runningTool) return null;

            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-panel bg-ink px-5 py-5 text-white shadow-float dark:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-primary"><Sparkles size={15} /><span className="text-[12px] font-medium">{label}</span></div>
                  {!isStreamingThis && replyText && (
                    <button
                      onClick={() => (speakingId === m.id ? audioRef.current?.pause() : speak(m.id, replyText))}
                      className={cn("pressable flex h-7 w-7 items-center justify-center rounded-full", speakingId === m.id ? "bg-primary text-charcoal" : "bg-white/10 text-white/70")}
                      aria-label={speakingId === m.id ? "Stop reading aloud" : "Read reply aloud"}
                    >
                      <Volume2 size={13} className={speakingId === m.id ? "animate-pulse" : ""} />
                    </button>
                  )}
                </div>
                <div className="mt-3 text-[15px] leading-relaxed text-white/[0.88]">
                  {replyText ? <ReactMarkdown components={MARKDOWN_COMPONENTS}>{replyText}</ReactMarkdown> : "…"}
                  {isStreamingThis && replyText && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-primary" aria-hidden />}
                </div>
              </motion.div>
            );
          })}

          {awaitingFirstChunk && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-panel bg-ink px-5 py-5 text-white shadow-float dark:bg-surface-2">
              <div className="flex items-center gap-2 text-primary"><Sparkles size={15} /><span className="text-[12px] font-medium">ScheduRx</span></div>
              <div className="mt-3"><TypingDots /></div>
            </motion.div>
          )}
        </div>
      )}

      <form className="mt-6 flex h-14 items-center gap-2 rounded-pill bg-surface-2 px-2 pl-5" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <input ref={inputRef} value={text} onChange={(e) => { askedByVoiceRef.current = false; setText(e.target.value); }} placeholder="Ask ScheduRx anything…" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        <button
          type={text.trim() ? "submit" : "button"}
          disabled={Boolean(text.trim()) && thinking}
          onPointerDown={() => { if (!text.trim()) void startVoice(); }}
          onPointerUp={() => { if (!text.trim()) void stopVoice(); }}
          onPointerLeave={() => { if (!text.trim() && recorder.recording) void stopVoice(); }}
          className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-primary text-charcoal disabled:opacity-40"
          aria-label={text.trim() ? "Send" : "Hold to speak"}
        >
          {text.trim() ? <ArrowUpRight size={18} /> : <Mic size={17} />}
        </button>
      </form>
    </Sheet>
  );
}

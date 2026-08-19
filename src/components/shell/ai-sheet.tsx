"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarOff, ListTodo, Mic, Search, Sparkles, UserRoundSearch, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sheet } from "@/components/ui/sheet";
import { AIControl } from "@/components/ui/ai-control";
import { useSession } from "@/stores";
import { useDoctors } from "@/hooks/use-team";
import { getFirebaseAuth } from "@/lib/firebase";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const TOOL_PROGRESS_LABEL: Record<string, string> = {
  block_time: "Blocking your calendar…",
  find_next_free_slot: "Checking availability…",
  find_patient_history: "Looking up patient…",
  add_task: "Adding task…",
};

// Minimal shim — the Web Speech API isn't in every TS lib.dom version, and it's
// only ever accessed behind a runtime feature check below.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

async function authHeaders(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

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
  const [live, setLive] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
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

  const startVoice = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice dictation isn't supported in this browser.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ");
      setText(transcript);
    };
    recognition.onend = () => setLive(false);
    recognitionRef.current = recognition;
    setLive(true);
    askedByVoiceRef.current = true;
    recognition.start();
  };
  const stopVoice = () => {
    recognitionRef.current?.stop();
    setLive(false);
  };

  // ElevenLabs voice output — plays base64 MP3 from POST /api/v1/assistant/speak.
  // Silently no-ops if voice synthesis isn't configured for this deployment
  // (503) rather than showing an error for what's an optional enhancement.
  const speak = async (messageId: string, replyText: string) => {
    if (!replyText.trim()) return;
    try {
      setSpeakingId(messageId);
      const { audioBase64 } = await api.post<{ audioBase64: string }>("/api/v1/assistant/speak", { text: replyText });
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      audioRef.current?.pause();
      audioRef.current = audio;
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
            onPointerDown={startVoice}
            onPointerUp={stopVoice}
            onPointerLeave={() => live && stopVoice()}
            className="pressable shrink-0"
            aria-label="Hold to speak"
          >
            <AIControl size={76} state={live ? "live" : thinking ? "thinking" : "idle"} />
          </button>
          <div>
            <p className="font-display text-[34px] font-light leading-[.98] tracking-[-0.055em]">What do you need?</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{live ? "Listening…" : thinking ? "Working on it…" : "Hold the warm control to speak, or use a quick action."}</p>
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
                <p className="mt-3 text-[15px] leading-relaxed text-white/[0.88]">
                  {replyText || "…"}
                  {isStreamingThis && replyText && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-primary" aria-hidden />}
                </p>
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
          onPointerDown={() => { if (!text.trim()) startVoice(); }}
          onPointerUp={() => { if (!text.trim()) stopVoice(); }}
          onPointerLeave={() => { if (!text.trim() && live) stopVoice(); }}
          className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-primary text-charcoal disabled:opacity-40"
          aria-label={text.trim() ? "Send" : "Hold to speak"}
        >
          {text.trim() ? <ArrowUpRight size={18} /> : <Mic size={17} />}
        </button>
      </form>
    </Sheet>
  );
}

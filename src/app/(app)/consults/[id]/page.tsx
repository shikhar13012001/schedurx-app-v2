"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowUp, ChevronLeft, FileText, Mic, ShieldAlert, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { useClinic, useSession } from "@/stores";
import { useThread } from "@/hooks/use-threads";
import { usePatients } from "@/hooks/use-patients";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { api, ApiError } from "@/lib/api-client";
import { cn, fmtTime, triageLabel } from "@/lib/utils";

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const { reply, markThreadRead, escalate } = useClinic();
  const { data: thread } = useThread(id);
  const { data: patients } = usePatients();
  const [text, setText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useVoiceRecorder();
  const endRef = useRef<HTMLDivElement>(null);
  const patient = thread ? patients?.find((item) => item.id === thread.patientId) : undefined;

  useEffect(() => {
    if (thread?.unread) void markThreadRead(thread.id);
  }, [thread?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  if (!thread || !patient || !session) return <p className="pt-12 text-center text-muted">This conversation isn&rsquo;t available.</p>;

  const send = () => {
    if (!text.trim()) return;
    void reply(thread.id, text.trim());
    setText("");
  };

  const onMicTap = async () => {
    if (recorder.recording) {
      setTranscribing(true);
      const clip = await recorder.stop();
      if (clip) {
        try {
          const { text: transcript } = await api.post<{ text: string }>("/api/v1/media/transcribe", { audioBase64: clip.base64, filename: clip.filename });
          setText(transcript);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Couldn't transcribe that — try typing instead.");
        }
      }
      setTranscribing(false);
      return;
    }
    try {
      await recorder.start();
    } catch {
      toast.error("Couldn't access the microphone — check your browser permissions.");
    }
  };

  return (
    <div className="mx-auto -mt-1 flex min-h-[calc(100dvh-64px)] w-full max-w-[900px] flex-col">
      <header className="sticky top-0 z-10 -mx-2 flex items-center gap-3 bg-bg/[0.88] px-2 pb-4 pt-1 backdrop-blur-xl">
        <button onClick={() => router.back()} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Back"><ChevronLeft size={18} /></button>
        <Link href={`/patients/${patient.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar id={patient.id} name={patient.name} size={42} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium tracking-[-0.025em]">{patient.name}</span>
            <span className="block text-[11.5px] text-muted">{patient.age} yrs · patient file{thread.paid ? " · Paid chat" : ""}{thread.scope === "booking" ? " · This booking" : ""}</span>
          </span>
        </Link>
        {session.role === "receptionist" && !thread.escalated && (
          <button
            onClick={() => { void escalate(thread.id); toast.success("Escalated to the doctor"); }}
            className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
            aria-label="Escalate conversation"
          ><ShieldAlert size={17} /></button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-5" data-noswipe>
        <section className="mb-7 rounded-panel bg-stone/[0.22] px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="ai-control flex h-10 w-10 shrink-0 items-center justify-center rounded-full"><Sparkles size={15} /></span>
            <div>
              <p className="text-[11.5px] text-muted">ScheduRx read</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink/[0.82]">{thread.aiSummary}</p>
              {thread.triage === "critical" && <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" />{triageLabel(thread.triage)} priority</p>}
            </div>
          </div>
        </section>

        <p className="mb-6 text-center text-[10.5px] text-faint">Today</p>
        <div className="space-y-1.5 px-1">
          {thread.messages.map((message, index) => {
            const mine = message.from === "doctor";
            const previous = thread.messages[index - 1];
            const grouped = previous && previous.from === message.from;
            return (
              <div key={message.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", !grouped && "mt-4")}> 
                {!mine && !grouped ? (
                  message.from === "ai" ? (
                    <span className="ai-control mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"><Sparkles size={11} /></span>
                  ) : (
                    <Avatar id={patient.id} name={patient.name} size={28} className="mb-0.5 shrink-0" />
                  )
                ) : !mine ? <span className="w-7 shrink-0" /> : null}
                <div className={cn("bubble", mine ? "bubble-out" : message.from === "ai" ? "bubble-ai" : "bubble-in")}> 
                  <p className="text-[14.5px] leading-relaxed">{message.text}</p>
                  <p className={cn("mt-1 text-right text-[9.5px] tabular-nums", mine ? "text-ink/[0.45]" : "text-faint")}>{fmtTime(message.at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {session.role === "doctor" ? (
        <form data-noswipe className="sticky bottom-[max(10px,env(safe-area-inset-bottom))] z-20 mt-3 flex h-16 items-center gap-2 rounded-pill bg-surface px-2.5 shadow-float md:bottom-4" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <button type="button" onClick={() => router.push(`/patients/${patient.id}`)} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft text-muted" aria-label="Open patient file"><FileText size={17} /></button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type a message…"
            className="h-full min-w-0 flex-1 bg-transparent px-1 text-[14px] outline-none placeholder:text-faint"
          />
          <button
            type={text.trim() ? "submit" : "button"}
            onClick={(event) => { if (!text.trim()) { event.preventDefault(); void onMicTap(); } }}
            disabled={transcribing}
            className={cn(
              "pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60",
              text.trim() ? "bg-primary text-charcoal" : recorder.recording ? "bg-danger text-white" : "bg-surface-soft text-ink"
            )}
            aria-label={text.trim() ? "Send" : recorder.recording ? "Stop recording" : "Voice message"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={text.trim() ? "send" : recorder.recording ? "stop" : "mic"} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                {text.trim() ? <ArrowUp size={18} /> : <Mic size={17} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </form>
      ) : (
        <div data-noswipe className="sticky bottom-[max(10px,env(safe-area-inset-bottom))] mt-3 rounded-pill bg-surface px-5 py-4 text-center text-[12px] text-muted shadow-float md:bottom-4">
          Front desk can read and escalate. Replies come from the doctor.
        </div>
      )}
    </div>
  );
}

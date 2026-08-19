"use client";

import { Bot, MessageCircle, Phone, PhoneCall, PhoneForwarded, PhoneIncoming } from "lucide-react";
import { useCallLogs, useWaLogs } from "@/hooks/use-history";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { relTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const OUTCOME: Record<string, string> = {
  booked: "Appointment booked",
  rescheduled: "Appointment rescheduled",
  reminder_confirmed: "Visit confirmed",
  recovered_missed: "Missed call recovered",
  info: "Query answered",
};

const WA_KIND: Record<string, string> = {
  booking: "Booking confirmation",
  reminder: "Reminder sent",
  follow_up: "Follow-up sent",
  review_link: "Review request",
  rx_sent: "Prescription delivered",
};

export default function HistoryPage() {
  const { data: callLogs = [] } = useCallLogs();
  const { data: waLogs = [] } = useWaLogs();

  return (
    <div className="stagger mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-[12px] text-muted">Automation history</p>
        <h1 className="mt-1 font-display text-[clamp(2.8rem,11vw,4.2rem)] font-light leading-[0.94] tracking-[-0.055em]">AI activity</h1>
        <p className="mt-4 max-w-[360px] text-[13px] leading-relaxed text-muted">A calm record of calls and messages ScheduRx handled while the clinic kept moving.</p>
      </header>

      <Tabs defaultValue="calls">
        <TabsList className="w-full"><TabsTrigger value="calls" className="flex-1"><PhoneCall className="mr-1.5 h-4 w-4" />Calls</TabsTrigger><TabsTrigger value="wa" className="flex-1"><MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp</TabsTrigger></TabsList>

        <TabsContent value="calls" className="mt-5">
          {callLogs.length === 0 && <Empty icon={Phone} title="No calls yet" body="Calls the AI voice agent handles will show up here." />}
          <div className="relative space-y-0 before:absolute before:bottom-3 before:left-[27px] before:top-3 before:w-px before:bg-border/70">
            {callLogs.map((call) => {
              const recovered = call.outcome === "recovered_missed";
              return (
                <article key={call.id} className="relative flex gap-4 py-5 first:pt-2">
                  <span className={cn("relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[6px] border-bg", recovered ? "bg-warning-soft text-warning" : "bg-surface text-primary shadow-card")}>{recovered ? <PhoneForwarded size={17} /> : <PhoneIncoming size={17} />}</span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex items-baseline gap-3"><p className="truncate text-[15px] font-medium">{call.name}</p><span className="ml-auto shrink-0 text-[10.5px] text-faint">{relTime(call.at)}</span></div>
                    <p className="mt-1 text-[12px] text-muted">{OUTCOME[call.outcome] ?? "Query answered"} · {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s · {call.lang}</p>
                    <div className="mt-3 flex items-start gap-2 rounded-[22px] bg-surface-soft px-3.5 py-3"><Bot size={13} className="mt-0.5 shrink-0 text-primary" /><p className="text-[12.5px] leading-relaxed text-muted">{call.summary}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="wa" className="mt-5">
          {waLogs.length === 0 && <Empty icon={MessageCircle} title="No WhatsApp activity yet" body="Bookings, reminders and replies the AI agent sends will show up here." />}
          <div className="overflow-hidden rounded-panel bg-surface px-2 shadow-card">
            {waLogs.map((item, index) => (
              <article key={item.id} className={cn("flex min-h-[94px] items-start gap-3 px-2 py-4", index !== waLogs.length - 1 && "border-b border-border/60")}>
                <Avatar id={item.phone} name={item.name} size={44} />
                <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><p className="truncate text-[14px] font-medium">{item.name}</p><span className="ml-auto shrink-0 text-[10.5px] text-faint">{relTime(item.at)}</span></div><p className="mt-1 text-[11.5px] text-muted">{WA_KIND[item.kind] ?? "Conversation"}</p><p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{item.preview}</p></div>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

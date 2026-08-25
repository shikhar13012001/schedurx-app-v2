"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Camera, ChevronLeft, FileText, MessageSquareText, Paperclip, Phone, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { BookingSheet } from "@/components/clinic/booking-sheet";
import { useClinic, useSession } from "@/stores";
import { usePatient } from "@/hooks/use-patients";
import { usePatientAppointments } from "@/hooks/use-appointments";
import { useDoctors } from "@/hooks/use-team";
import { useFindOrCreateThread } from "@/hooks/use-threads";
import { api, ApiError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import type { ApptStatus, VisitMode } from "@/lib/types";

const MODE_META: Record<VisitMode, { icon: React.ElementType; label: string }> = {
  clinic: { icon: Building2, label: "In clinic" },
  video: { icon: Video, label: "Video" },
  audio: { icon: Phone, label: "Audio" },
  text: { icon: MessageSquareText, label: "Text consult" },
};

const APPT_STATUS_META: Record<ApptStatus, { label: string; tone: React.ComponentProps<typeof Badge>["tone"] }> = {
  confirmed: { label: "Booked", tone: "primary" },
  tentative: { label: "Booked", tone: "primary" },
  waitlist: { label: "Waitlisted", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  no_show: { label: "No-show", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "warning" },
  blocked: { label: "Blocked", tone: "neutral" },
};

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useSession((s) => s.session?.role);
  const clinicId = useSession((s) => s.session?.clinicId);
  const clinicName = useSession((s) => s.session?.clinicName);
  const staffDoctorId = useSession((s) => s.session?.doctorId);
  const digitalRx = useClinic((s) => s.settings.digitalRx);
  const simple = useClinic((s) => s.settings.viewMode !== "advanced");
  const reply = useClinic((s) => s.reply);
  const [showAllVisits, setShowAllVisits] = useState(false);
  const { data: patient, isLoading } = usePatient(id);
  const { data: appointmentHistory = [] } = usePatientAppointments(id);
  const { data: doctors } = useDoctors();
  const findOrCreateThread = useFindOrCreateThread();
  const [rxOpen, setRxOpen] = useState(false);
  const [rxText, setRxText] = useState("");
  const [rxSending, setRxSending] = useState(false);
  const [booking, setBooking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachFor = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get("rx") === "1") setRxOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return null;
  if (!patient) return <p className="pt-12 text-center text-muted">Patient not found.</p>;

  const onAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const visitId = attachFor.current;
    event.target.value = "";
    if (!file || !visitId) return;
    try {
      const { path, uploadUrl } = await api.post<{ path: string; uploadUrl: string }>(`/api/v1/visits/${visitId}/upload-url`, {
        fileName: file.name, contentType: file.type,
      });
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      await api.post(`/api/v1/visits/${visitId}/attachments`, { path, type: "photo" });
      await queryClient.invalidateQueries({ queryKey: ["visits", clinicId, patient.id] });
      toast.success("Prescription attached", { description: "Saved to the visit and ready to share with the patient." });
    } catch {
      toast.error("Couldn't attach that file — try again.");
    }
  };

  const onMessage = async () => {
    try {
      const thread = await findOrCreateThread.mutateAsync(patient.id);
      router.push(`/consults/${thread.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't open a thread for this patient.");
    }
  };

  const latest = patient.visits[0];

  const onGenerateRx = async () => {
    if (!latest) {
      toast.error("This patient has no visit yet to attach a prescription to.");
      return;
    }
    setRxSending(true);
    try {
      // @react-pdf/renderer is a large (400kB+) layout engine — loaded only
      // when a doctor actually generates a prescription, not on every visit
      // to this page.
      const { renderPrescriptionPdf } = await import("@/components/clinic/prescription-pdf");
      const doctor = doctors?.find((d) => d.id === (latest.doctorId || staffDoctorId));
      const blob = await renderPrescriptionPdf({
        clinicName: clinicName ?? "ScheduRx Clinic",
        doctorName: doctor?.name ?? "Attending doctor",
        patientName: patient.name,
        patientAge: patient.age,
        patientGender: patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : undefined,
        date: fmtDate(new Date().toISOString()),
        rxText,
      });

      const { path, uploadUrl } = await api.post<{ path: string; uploadUrl: string }>(`/api/v1/visits/${latest.id}/upload-url`, {
        fileName: `prescription-${latest.id}.pdf`,
        contentType: "application/pdf",
      });
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: blob });
      await api.post(`/api/v1/visits/${latest.id}/attachments`, { path, type: "digital" });
      await queryClient.invalidateQueries({ queryKey: ["visits", clinicId, patient.id] });

      const { url } = await api.get<{ url: string }>(`/api/v1/visits/${latest.id}/attachments/read-url?path=${encodeURIComponent(path)}`);
      const thread = await findOrCreateThread.mutateAsync(patient.id);
      await reply(thread.id, `Hi ${patient.name.split(" ")[0]}, here's your prescription: ${url}`);

      setRxOpen(false);
      setRxText("");
      toast.success("Prescription PDF sent", { description: "Delivered on WhatsApp and pinned to the patient file." });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't generate or send that prescription.");
    } finally {
      setRxSending(false);
    }
  };
  const visitsToShow = simple && !showAllVisits ? patient.visits.slice(0, 1) : patient.visits;

  return (
    <div className="stagger mx-auto max-w-5xl space-y-8">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onAttach} />

      <header>
        <button onClick={() => router.back()} className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Back"><ChevronLeft size={18} /></button>
        <div className="mt-6 flex items-start gap-4">
          <Avatar id={patient.id} name={patient.name} size={62} />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-balance font-display text-[clamp(2.6rem,10vw,4rem)] font-light leading-[0.94] tracking-[-0.055em]">{patient.name}</h1>
            <p className="mt-2 text-[13px] text-muted">{patient.age} · {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "—"}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <a href={`tel:${patient.phone}`} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card" aria-label={`Call ${patient.name}`}><Phone size={18} /></a>
          <button onClick={onMessage} disabled={findOrCreateThread.isPending} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card disabled:opacity-50" aria-label={`Message ${patient.name}`}><MessageSquareText size={18} /></button>
          <button onClick={() => setBooking(true)} className="pressable ml-auto flex h-12 items-center gap-2 rounded-pill bg-primary px-5 text-[13px] text-charcoal shadow-card">Book <ArrowRight size={16} /></button>
        </div>
      </header>

      {latest ? (
        <section className="rounded-panel bg-stone/[0.22] px-5 py-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11.5px] text-muted">Last visit</p>
              <p className="mt-1 text-[14px] font-medium">{fmtDate(latest.date)}</p>
            </div>
            <span className="rounded-pill bg-white/70 px-3 py-2 text-[11px] text-muted">{MODE_META[latest.mode].label}</span>
          </div>
          <p className="mt-7 font-display text-[31px] font-light leading-[1.04] tracking-[-0.045em]">{latest.symptoms}</p>
          <div className="mt-5 flex items-start gap-3 border-t border-ink/[0.08] pt-5">
            <span className="ai-control flex h-9 w-9 shrink-0 items-center justify-center rounded-full"><Sparkles size={13} /></span>
            <p className="text-[13px] leading-relaxed text-ink/[0.76]">{latest.note}</p>
          </div>
        </section>
      ) : (
        <section className="rounded-panel bg-surface-soft px-6 py-10">
          <p className="font-display text-[32px] font-light tracking-[-0.045em]">A fresh clinical file.</p>
          <p className="mt-3 max-w-[330px] text-[13px] leading-relaxed text-muted">The first consultation or recap will begin this patient&rsquo;s story.</p>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] text-muted">Clinical timeline</p>
            <h2 className="mt-1 font-display text-[30px] font-light tracking-[-0.045em]">{patient.visits.length} visit{patient.visits.length === 1 ? "" : "s"}</h2>
          </div>
          {role === "doctor" && digitalRx && (
            <button onClick={() => setRxOpen(true)} className="pressable flex h-11 items-center gap-2 rounded-pill bg-charcoal px-4 text-[12px] text-white"><FileText size={14} /> Prescription</button>
          )}
        </div>

        <div className="overflow-hidden rounded-panel bg-surface px-1 shadow-card" data-noswipe>
          {visitsToShow.map((visit, index) => {
            const Meta = MODE_META[visit.mode];
            const doctor = doctors?.find((item) => item.id === visit.doctorId);
            const hasRx = visit.rxAttached || visit.rxDigital;
            return (
              <article key={visit.id} className={cn("px-4 py-5", index !== visitsToShow.length - 1 && "border-b border-border/60")}> 
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <span>{fmtDate(visit.date)}</span><span>·</span><span className="inline-flex items-center gap-1"><Meta.icon size={11} /> {Meta.label}</span>
                  <span className="ml-auto truncate text-faint">{doctor?.name.split(" ").slice(0, 2).join(" ")}</span>
                </div>
                <p className="mt-3 text-[16px] font-medium tracking-[-0.025em]">{visit.symptoms}</p>
                {visit.id !== latest?.id && <p className="mt-2 text-[13px] leading-relaxed text-muted">{visit.note}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                  {hasRx ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1.5 text-muted"><Paperclip size={11} /> Rx on file</span>
                  ) : (
                    <button onClick={() => { attachFor.current = visit.id; fileRef.current?.click(); }} className="inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1.5 text-muted"><Camera size={11} /> Attach Rx</button>
                  )}
                  {visit.followUpOn && <span className="rounded-pill bg-surface-soft px-3 py-1.5 text-muted">Follow-up {fmtDate(visit.followUpOn)}</span>}
                </div>
              </article>
            );
          })}
          {patient.visits.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-muted">No visits yet.</p>}
        </div>

        {simple && !showAllVisits && patient.visits.length > 1 && (
          <button onClick={() => setShowAllVisits(true)} className="pressable mt-3 flex h-12 w-full items-center justify-center rounded-pill bg-surface-soft text-[12px] text-muted">Show {patient.visits.length - 1} earlier visit{patient.visits.length > 2 ? "s" : ""}</button>
        )}
      </section>

      <section>
        <div className="mb-4">
          <p className="text-[12px] text-muted">Appointment history</p>
          <h2 className="mt-1 font-display text-[30px] font-light tracking-[-0.045em]">
            {appointmentHistory.length} appointment{appointmentHistory.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="overflow-hidden rounded-panel bg-surface px-1 shadow-card" data-noswipe>
          {[...appointmentHistory].reverse().map((appt, index, arr) => {
            const doctor = doctors?.find((item) => item.id === appt.doctorId);
            const meta = APPT_STATUS_META[appt.status];
            return (
              <div key={appt.id} className={cn("flex items-center gap-3 px-4 py-3.5", index !== arr.length - 1 && "border-b border-border/60")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium tracking-[-0.01em]">{fmtDate(appt.startsAt)} · {fmtTime(appt.startsAt)}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted">{doctor ? `Dr. ${doctor.name.split(" ").slice(0, 2).join(" ")}` : "—"}{appt.symptoms ? ` · ${appt.symptoms}` : ""}</p>
                </div>
                <Badge tone={meta.tone} className="shrink-0">{meta.label}</Badge>
              </div>
            );
          })}
          {appointmentHistory.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-muted">No appointments yet.</p>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 text-[12px] text-muted">
        <div className="rounded-panel bg-surface-soft px-4 py-4"><p className="text-faint">Phone</p><p className="mt-2 break-words text-[13px] text-ink">{patient.phone}</p></div>
        <div className="rounded-panel bg-surface-soft px-4 py-4"><p className="text-faint">Email</p><p className="mt-2 break-words text-[13px] text-ink">{patient.email ?? "Not added"}</p></div>
        <div className="rounded-panel bg-surface-soft px-4 py-4"><p className="text-faint">Tags</p><p className="mt-2 text-[13px] text-ink">{patient.tags.join(", ") || "None"}</p></div>
        <div className="rounded-panel bg-surface-soft px-4 py-4"><p className="text-faint">Review</p><p className="mt-2 text-[13px] text-ink">{patient.review === "given" ? "Google review received" : patient.review === "link_sent" ? "Review link sent" : "No review yet"}</p></div>
      </section>

      <Sheet open={rxOpen} onOpenChange={setRxOpen} title={`Prescription · ${patient.name.split(" ")[0]}`}>
        <div className="space-y-5">
          <div>
            <p className="font-display text-[30px] font-light tracking-[-0.045em]">A clear prescription.</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">A clinic-letterhead PDF will be sent on WhatsApp and pinned to the patient timeline.</p>
          </div>
          <Textarea rows={8} placeholder={"Tab Pantoprazole 40mg — 1 OD before breakfast × 5 days\nSyp Digene — 2 tsp after meals"} value={rxText} onChange={(event) => setRxText(event.target.value)} />
          <Button size="lg" className="w-full" disabled={rxText.trim().length < 4 || rxSending} onClick={onGenerateRx}><FileText size={16} /> {rxSending ? "Sending…" : "Generate & send"}</Button>
        </div>
      </Sheet>

      <BookingSheet open={booking} onOpenChange={setBooking} prefillPhone={patient.phone} />
    </div>
  );
}

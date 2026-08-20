"use client";

import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "@/stores";
import { useTeam, useCreateInvite } from "@/hooks/use-team";
import { useQueue, activeQueue } from "@/hooks/use-queue";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Field } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const inviteSchema = z.object({
  name: z.string().min(2, "Name please"),
  phone: z.string().refine((value) => {
    const digits = value.replace(/\D/g, "");
    const subscriber =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
          ? digits.slice(1)
          : digits;
    return /^[6-9]\d{9}$/.test(subscriber);
  }, "Enter a valid 10-digit Indian mobile number"),
  role: z.enum(["doctor", "receptionist"]),
});
type Invite = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const role = useSession((s) => s.session?.role);
  const { data: queue = [] } = useQueue();
  const { data: team } = useTeam();
  const [open, setOpen] = useState(false);
  const form = useForm<Invite>({ resolver: zodResolver(inviteSchema), defaultValues: { role: "doctor", name: "", phone: "" } });
  const createInvite = useCreateInvite();
  const DOCTORS = team?.doctors ?? [];
  const receptionists = (team?.staff ?? []).filter((staff) => staff.role === "receptionist");

  const people = [
    ...DOCTORS.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      meta: `${doctor.specialty} · ${doctor.todayHours}`,
      online: doctor.availableNow,
      status: doctor.availableNow ? `${activeQueue(queue).filter((item) => item.doctorId === doctor.id).length} in flow` : "Off now",
    })),
    ...receptionists.map((staff) => ({ id: staff.id, name: staff.name, meta: staff.email, online: staff.onlineNow, status: staff.onlineNow ? "On shift" : "Off shift" })),
  ];

  return (
    <div className="stagger mx-auto max-w-2xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div><p className="text-[12px] text-muted">Clinic people</p><h1 className="mt-1 font-display text-[clamp(3rem,12vw,4.4rem)] font-light leading-[0.94] tracking-[-0.055em]">Team</h1></div>
        {role === "doctor" && <button onClick={() => setOpen(true)} className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-primary text-charcoal shadow-card" aria-label="Invite team member"><Plus size={18} /></button>}
      </header>

      {role === "doctor" && (
        <button onClick={() => setOpen(true)} className="atmosphere atmosphere-subtle relative flex min-h-[152px] w-full items-end overflow-hidden rounded-hero bg-stone p-5 text-left text-charcoal shadow-card dark:text-white">
          <div className="relative z-10 flex w-full items-end justify-between gap-4">
            <div><p className="text-[12px] text-charcoal/[0.68] dark:text-white/[0.68]">Grow the clinic</p><p className="mt-2 max-w-[230px] font-display text-[30px] font-light leading-[1] tracking-[-0.045em]">Invite someone into the rhythm.</p></div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-charcoal"><ArrowRight size={18} /></span>
          </div>
        </button>
      )}

      <section>
        <p className="mb-3 px-1 text-[12px] text-muted">Everyone</p>
        <div className="overflow-hidden rounded-panel bg-surface px-2 shadow-card">
          {people.map((person, index) => (
            <div key={person.id} className={cn("flex min-h-[82px] items-center gap-3 px-2 py-3", index !== people.length - 1 && "border-b border-border/60")}> 
              <div className="relative shrink-0"><Avatar id={person.id} name={person.name} size={46} /><span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface", person.online ? "bg-success" : "bg-stone")} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium">{person.name}</p><p className="mt-1 truncate text-[11.5px] text-muted">{person.meta}</p></div>
              <p className="shrink-0 text-[11px] text-faint">{person.status}</p>
            </div>
          ))}
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen} title="Invite a team member">
        <form className="space-y-5 pt-1" onSubmit={form.handleSubmit(async (value: Invite) => {
            try {
              const result = await createInvite.mutateAsync({ name: value.name, phone: value.phone, role: value.role });
              setOpen(false);
              form.reset({ role: "doctor", name: "", phone: "" });
              const queued = result.delivery
                .filter((item) => !["failed", "undelivered"].includes(item.status))
                .map((item) => (item.channel === "whatsapp" ? "WhatsApp" : "SMS"));
              const failed = result.delivery
                .filter((item) => ["failed", "undelivered"].includes(item.status))
                .map((item) => (item.channel === "whatsapp" ? "WhatsApp" : "SMS"));
              toast.success(queued.length ? `Invite queued for ${queued.join(" and ")}.` : "Invite created.", {
                description: failed.length
                  ? `${failed.join(" and ")} could not be queued.`
                  : result.delivery.length === 0
                    ? "Messaging is not configured on the backend."
                    : undefined,
              });
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Couldn't send that invite.");
            }
        })}>
          <Field label="Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} placeholder="Dr. Sameer Rao" /></Field>
          <Field label="Phone" error={form.formState.errors.phone?.message}><Input {...form.register("phone")} inputMode="tel" placeholder="98765 43210" /></Field>
          <div><p className="mb-2 text-[13px] text-muted">Role</p><div className="grid grid-cols-2 gap-2">{(["doctor", "receptionist"] as const).map((item) => <label key={item} className={cn("cursor-pointer rounded-field px-3 py-3 text-center text-[13px] capitalize", form.watch("role") === item ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}><input type="radio" className="sr-only" value={item} {...form.register("role")} />{item}</label>)}</div></div>
          <Button type="submit" size="lg" className="w-full" disabled={createInvite.isPending}>{createInvite.isPending ? "Sending…" : "Send invite"}</Button>
        </form>
      </Sheet>
    </div>
  );
}

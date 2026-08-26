"use client";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { isValidPhoneNumber } from "react-phone-number-input";
import { IndianRupee, Video, Phone as PhoneIcon, Building2, MessageSquareText } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PhoneField } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { useClinic, useSession } from "@/stores";
import { useDoctors } from "@/hooks/use-team";
import { usePatients } from "@/hooks/use-patients";
import { useAvailableSlots } from "@/hooks/use-available-slots";
import { useClinicProfile } from "@/hooks/use-clinic-profile";
import { ApiError } from "@/lib/api-client";
import { cn, dateAt, toDateKey } from "@/lib/utils";
import type { Doctor, VisitMode } from "@/lib/types";

// Deny-list rather than an allow-list of letters — an allow-list needs the
// regex `u` flag's \p{L} Unicode property escape (any script, since Indian
// names aren't only ASCII), which this project's tsconfig target doesn't
// support. Plain string matching instead of a hand-escaped character-class
// regex, so there's no risk of a stray unescaped bracket silently changing
// what the class matches. Rejects digits and obvious symbol characters,
// while still letting through O'Brien, Anne-Marie, Dr. Rao, and names in
// any script.
const NAME_DISALLOWED_CHARS = "0123456789!@#$%^&*()_+=[]{}<>/\\|~`\";:";
function hasDisallowedNameChar(value: string): boolean {
  return value.split("").some((ch) => NAME_DISALLOWED_CHARS.includes(ch));
}

const schema = z.object({
  phone: z.string().min(8, "Enter the patient's phone").refine((v) => isValidPhoneNumber(v), "Enter a valid phone number"),
  name: z
    .string()
    .trim()
    .min(2, "Patient name is required")
    .refine((v) => !hasDisallowedNameChar(v), "Name can only contain letters, spaces, and - . '"),
  doctorId: z.string().min(1),
  mode: z.enum(["clinic", "video", "audio", "text"]),
  day: z.string().min(1),
  time: z.string().min(1, "Pick a time"),
  symptoms: z.string().optional(),
  token: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const MODES: { v: VisitMode; label: string; icon: React.ElementType }[] = [
  { v: "clinic", label: "In-clinic", icon: Building2 },
  { v: "video", label: "Video", icon: Video },
  { v: "audio", label: "Audio", icon: PhoneIcon },
  { v: "text", label: "Text", icon: MessageSquareText },
];

export function BookingSheet({ open, onOpenChange, walkIn = false, prefillPhone, prefillTime, prefillDay, prefillDoctorId }: {
  open: boolean; onOpenChange: (o: boolean) => void; walkIn?: boolean; prefillPhone?: string; prefillTime?: string; prefillDay?: string; prefillDoctorId?: string;
}) {
  const session = useSession((s) => s.session);
  const { addAppointment, addWalkIn } = useClinic();
  const { data: doctors } = useDoctors();
  const { data: patients } = usePatients();
  const { data: clinicProfile } = useClinicProfile();
  const DOCTORS = doctors ?? [];
  const PATIENTS = patients ?? [];
  const tokenConfigured = !!clinicProfile?.tokenMoneyEnabled && !!clinicProfile?.tokenAmountPaise;
  const tokenAmountRupees = clinicProfile?.tokenAmountPaise ? Math.round(clinicProfile.tokenAmountPaise / 100) : null;

  const defaultDay = prefillDay ?? toDateKey(new Date());
  const defaultDoctorId = prefillDoctorId ?? session?.doctorId ?? DOCTORS[0]?.id ?? "";

  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: prefillPhone ?? "", name: "", doctorId: defaultDoctorId,
      mode: "clinic", day: defaultDay, time: prefillTime ?? "", symptoms: "", token: false,
    },
  });

  useEffect(() => { if (open) reset({ phone: prefillPhone ?? "", name: "", doctorId: defaultDoctorId, mode: "clinic", day: defaultDay, time: prefillTime ?? "", symptoms: "", token: false }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const phone = watch("phone");
  const known = useMemo(() => PATIENTS.find((p) => phone && phone.length >= 10 && p.phone.replace(/\s/g, "").endsWith(phone.replace(/\D/g, "").slice(-10))), [phone, patients]); // eslint-disable-line react-hooks/exhaustive-deps -- PATIENTS is `patients ?? []`, a fresh reference every render; depend on the stable `patients` query result instead
  useEffect(() => { if (known) setValue("name", known.name); }, [known, setValue]);

  const mode = watch("mode");
  const doctorId = watch("doctorId");
  const day = watch("day");
  const time = watch("time");

  const selectedDoctor: Doctor | undefined = DOCTORS.find((d) => d.id === doctorId);
  // Real nettu-scheduler availability — excludes already-booked appointments
  // and blocked time, unlike the old buildSlotOptions (pure clinic-hours
  // math with no idea what was already taken, so an already-booked time
  // stayed selectable right up until the server rejected the finished
  // form). The slice(11,16) pulls "HH:MM" straight out of each slot's own
  // ISO string, already stamped in the clinic's local timezone server-side —
  // same technique whatsapp-agent-tools.js's find_reschedule_slots uses.
  const { data: availability, isLoading: slotsLoading } = useAvailableSlots({ doctorId, date: day || defaultDay });
  const slotOptions = useMemo(() => (availability?.slots ?? []).map((s) => s.start.slice(11, 16)), [availability]);
  // Keep the picked time valid as day/doctor change the available grid —
  // preserve a prefilled time if it's still on-grid, otherwise fall back to
  // the first open slot.
  useEffect(() => {
    if (!open || walkIn || slotsLoading) return;
    if (time && slotOptions.includes(time)) return;
    setValue("time", slotOptions[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotOptions, open, walkIn]);

  const onSubmit = async (v: FormValues) => {
    try {
      if (walkIn) {
        await addWalkIn({ patientId: known?.id, doctorId: v.doctorId, displayName: known ? undefined : v.name, phoneNumber: known ? undefined : v.phone });
        toast.success(`${v.name} added to the queue`, { description: known ? "Existing file pulled up for the doctor." : "New patient file starts from this visit." });
      } else {
        const [h, m] = v.time.split(":").map(Number);
        const result = await addAppointment({
          doctorId: v.doctorId, start: dateAt(v.day, h, m), reason: v.symptoms || undefined,
          mode: v.mode, tokenRequested: v.token,
          patient: { phone: v.phone, name: v.name },
        });
        if (v.token) {
          // Pay-first: nothing is actually booked yet — the slot is held
          // until the patient pays via the link. Report what really
          // happened, not an assumed success.
          if (result?.tokenLinkSent) {
            toast.success(`Payment link sent to ${v.name}`, { description: "Slot is held — it books automatically once they pay." });
          } else if (result?.checkoutUrl) {
            // WhatsApp blocks a free-form business-initiated message outside
            // an open 24h session window — true for almost every brand-new
            // booking, so this isn't rare. Put the real link directly in
            // staff's hands (clipboard) instead of telling them to "copy it"
            // with nothing on screen to copy.
            const checkoutUrl = result.checkoutUrl;
            navigator.clipboard?.writeText(checkoutUrl).catch(() => {});
            toast(`Slot held for ${v.name}`, {
              description: "Couldn't auto-send the WhatsApp link — payment link copied, share it yourself.",
              action: { label: "Copy again", onClick: () => navigator.clipboard?.writeText(checkoutUrl).catch(() => {}) },
              duration: 15000,
            });
          } else {
            toast(`Slot held for ${v.name}`, { description: "Couldn't confirm the payment link was sent — check with the patient." });
          }
        } else {
          toast.success(`Appointment booked · ${v.name}`, { description: "Confirmation sent on WhatsApp." });
        }
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't complete that booking.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={walkIn ? "Add walk-in" : "New appointment"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field label="Patient phone" error={errors.phone?.message} hint={known ? `Known patient — ${known.visits.length} visit${known.visits.length === 1 ? "" : "s"} on file` : undefined}>
          <Controller name="phone" control={control} render={({ field }) => <PhoneField value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Patient name" error={errors.name?.message}>
          <Input placeholder="Full name" {...register("name")} />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Doctor</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto" data-noswipe>
            {DOCTORS.map((d) => (
              <button type="button" key={d.id} onClick={() => setValue("doctorId", d.id)}
                className={cn("pressable h-11 shrink-0 rounded-pill px-4 text-[13px] transition-colors",
                  doctorId === d.id ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}>
                {d.name.replace("Krishnan", "").replace("Reddy", "").replace("Nair", "").trim()}
              </button>
            ))}
          </div>
        </div>

        {!walkIn && (
          <>
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">Consultation mode</p>
              <div className="grid grid-cols-4 gap-2">
                {MODES.map((m) => (
                  <button type="button" key={m.v} onClick={() => setValue("mode", m.v)}
                    className={cn("pressable flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[22px] py-3 text-[12px] transition-colors",
                      mode === m.v ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}>
                    <m.icon size={16} /> {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day">
                <Input type="date" min={toDateKey(new Date())} {...register("day")} />
              </Field>
              <Field label="Time" error={errors.time?.message} hint={selectedDoctor ? `${selectedDoctor.slotMinutes}-min slots` : undefined}>
                <select {...register("time")} disabled={slotsLoading} className="h-12 w-full rounded-field bg-surface-soft px-3.5 text-[14px] text-ink outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60">
                  {slotsLoading && <option value="">Loading times…</option>}
                  {!slotsLoading && slotOptions.length === 0 && <option value="">No slots left today</option>}
                  {slotOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        <Field label="Symptoms / reason (optional)">
          <Textarea rows={2} placeholder="e.g. Fever since last night, mild cough" {...register("symptoms")} />
        </Field>

        {!walkIn && (
          <label className={cn("flex items-center justify-between rounded-panel bg-surface-soft px-4 py-4", !tokenConfigured && "opacity-60")}>
            <span>
              <span className="flex items-center gap-1.5 text-[14px] font-medium"><IndianRupee size={14} className="text-primary" /> Lock slot with token</span>
              <span className="block text-[12px] text-muted">
                {tokenConfigured
                  ? `₹${tokenAmountRupees} payment link on WhatsApp — kills no-shows`
                  : "Set a token amount in Profile → Billing & invoices first"}
              </span>
            </span>
            <Controller name="token" control={control} render={({ field }) => <Switch checked={field.value} disabled={!tokenConfigured} onCheckedChange={field.onChange} />} />
          </label>
        )}

        <Button size="lg" type="submit" className="w-full" disabled={isSubmitting || (!walkIn && (slotsLoading || slotOptions.length === 0))}>
          {walkIn ? "Add to queue" : "Book appointment"}
        </Button>
      </form>
    </Sheet>
  );
}

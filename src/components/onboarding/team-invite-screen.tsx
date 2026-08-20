"use client";
import { useState } from "react";
import { Check, Copy, Share2, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PhoneField } from "@/components/ui/phone-input";
import { useCreateInvite } from "@/hooks/use-team";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

export function TeamInviteScreen({ clinicName, canInviteDoctor }: { clinicName: string; canInviteDoctor: boolean }) {
  const [role, setRole] = useState<Role>(canInviteDoctor ? "doctor" : "receptionist");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const createInvite = useCreateInvite();
  const [lastInvite, setLastInvite] = useState<{ token: string; shortCode: string; role: Role } | null>(null);

  const generate = async () => {
    if (!phone) return toast.error("Enter their phone number");
    try {
      const result = await createInvite.mutateAsync({ name: name.trim() || undefined, phone, role });
      setLastInvite({ token: result.invite.token, shortCode: result.invite.shortCode, role });
      const failed = result.delivery.every((d) => d.status === "failed");
      if (failed) toast.error("Invite created, but delivery failed — share the link directly.");
      else toast.success("Invite sent");
      setName("");
      setPhone(undefined);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't create that invite — try again.");
    }
  };

  const link = lastInvite ? `${window.location.origin}/invite/${lastInvite.token}` : null;
  const shareText = link ? `You've been invited to join ${clinicName} on ScheduRx. Use this link to set up your account: ${link}` : "";

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const share = () => {
    if (!link) return;
    if (navigator.share) void navigator.share({ text: shareText, url: link }).catch(() => {});
    else copy(shareText, "Invite");
  };

  return (
    <div className="space-y-6">
      {!lastInvite ? (
        <>
          <div>
            <p className="mb-2 text-[13px] font-normal text-muted">They join as</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { v: "doctor" as const, icon: Stethoscope, label: "Doctor", disabled: !canInviteDoctor },
                { v: "receptionist" as const, icon: UserRound, label: "Receptionist", disabled: false },
              ]).map((r) => (
                <button
                  key={r.v}
                  type="button"
                  disabled={r.disabled}
                  onClick={() => setRole(r.v)}
                  className={cn(
                    "pressable flex h-14 items-center justify-center gap-2 rounded-panel text-[14px] font-medium shadow-card transition-colors disabled:opacity-40",
                    role === r.v ? "bg-charcoal text-white" : "bg-surface hover:bg-surface-soft",
                  )}
                >
                  <r.icon size={16} /> {r.label}
                </button>
              ))}
            </div>
            {!canInviteDoctor && <p className="mt-2 text-xs text-faint">This is a solo practice — it already has a doctor.</p>}
          </div>

          <div className="space-y-3">
            <Input placeholder="Their name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <PhoneField value={phone} onChange={setPhone} />
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={createInvite.isPending || !phone}
            className="pressable h-14 w-full rounded-pill bg-primary text-[15px] font-medium text-primary-fg disabled:opacity-45"
          >
            {createInvite.isPending ? "Sending…" : "Generate invite"}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-panel bg-surface p-5 shadow-card">
            <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
              <Check size={16} className="text-primary" /> Invite ready
            </p>
            <p className="mt-3 truncate rounded-field bg-surface-2/70 px-4 py-3 font-mono text-[13px] text-muted">{link}</p>
            <p className="mt-2 text-center text-[22px] font-light tracking-[0.08em] text-ink">{lastInvite.shortCode}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={share} className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-charcoal text-[13px] font-medium text-white">
                <Share2 size={14} /> Share
              </button>
              <button type="button" onClick={() => link && copy(link, "Link")} className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-surface-2 text-[13px] text-muted">
                <Copy size={14} /> Copy link
              </button>
              <button type="button" onClick={() => copy(lastInvite.shortCode, "Code")} className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-surface-2 text-[13px] text-muted">
                <Copy size={14} /> Copy code
              </button>
            </div>
          </div>
          <button type="button" onClick={() => setLastInvite(null)} className="pressable h-12 w-full rounded-pill bg-surface-2 text-[13px] font-medium text-muted">
            Invite someone else
          </button>
        </div>
      )}
    </div>
  );
}

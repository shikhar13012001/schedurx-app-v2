"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, PhoneMissed, Search, Star, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import { BookingSheet } from "@/components/clinic/booking-sheet";
import { usePatients, useConfirmPatient } from "@/hooks/use-patients";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Patient } from "@/lib/types";
import type { ColumnDef } from "@tanstack/react-table";

function ConfirmButton({ patientId }: { patientId: string }) {
  const confirm = useConfirmPatient();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        confirm.mutate(patientId, { onSuccess: () => toast.success("Confirmed as a patient") });
      }}
      disabled={confirm.isPending}
      className="pressable flex h-9 items-center gap-1.5 rounded-pill bg-surface-soft px-3 text-[11.5px] font-medium text-muted hover:bg-primary-soft hover:text-primary-ink"
    >
      <Check size={12} /> Confirm
    </button>
  );
}

function columnsFor(): ColumnDef<Patient>[] {
  return [
    {
      accessorKey: "name",
      header: "Patient",
      cell: ({ row }) => (
        <span className="flex items-center gap-3">
          <Avatar id={row.original.id} name={row.original.name} size={34} />
          <span className="font-medium">{row.original.name}</span>
          {row.original.source === "missed_call" && (
            <span className="flex items-center gap-1 rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary-ink"><PhoneMissed size={9} /> Captured</span>
          )}
        </span>
      ),
    },
    { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="text-[13px] text-muted">{String(getValue())}</span> },
    { accessorKey: "age", header: "Age" },
    { id: "visits", header: "Visits", accessorFn: (row) => row.visitsCount },
    { id: "last", header: "Last visit", accessorFn: (row) => (row.lastVisitDate ? fmtDate(row.lastVisitDate) : "—") },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row }) => <span className="text-[12px] text-muted">{row.original.tags.slice(0, 2).join(" · ") || "—"}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (row.original.source === "missed_call" ? <ConfirmButton patientId={row.original.id} /> : null),
    },
  ];
}

export default function PatientsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [booking, setBooking] = useState(false);
  const [showCapturedOnly, setShowCapturedOnly] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const { data: allFiltered = [] } = usePatients(deferredQuery);
  const columns = useMemo(columnsFor, []);

  const capturedCount = allFiltered.filter((p) => p.source === "missed_call").length;
  const filtered = showCapturedOnly ? allFiltered.filter((p) => p.source === "missed_call") : allFiltered;

  return (
    <div className="stagger space-y-7">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] text-muted">Clinical directory</p>
          <h1 className="mt-1 font-display text-[clamp(3rem,12vw,4.4rem)] font-light leading-[0.94] tracking-[-0.055em]">Patients</h1>
        </div>
        <button onClick={() => setBooking(true)} className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-charcoal shadow-card" aria-label="New patient booking"><UserRoundPlus size={18} /></button>
      </header>

      <div className="relative" data-noswipe>
        <Search size={18} className="pointer-events-none absolute left-4 top-[19px] text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find patient or phone number…"
          className="h-14 w-full rounded-pill bg-surface-soft pl-12 pr-4 text-[14px] outline-none placeholder:text-faint focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {/* All ScheduRx patients live in one list — Captured just filters to
          auto-created leads from missed calls that haven't been confirmed
          yet, rather than being a separate directory/section. */}
      {capturedCount > 0 && (
        <div className="flex gap-2" data-noswipe>
          <button
            onClick={() => setShowCapturedOnly(false)}
            className={cn("pressable h-10 rounded-pill px-4 text-[12.5px] font-medium transition-colors", !showCapturedOnly ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}
          >
            All
          </button>
          <button
            onClick={() => setShowCapturedOnly(true)}
            className={cn("pressable flex h-10 items-center gap-1.5 rounded-pill px-4 text-[12.5px] font-medium transition-colors", showCapturedOnly ? "bg-charcoal text-white" : "bg-surface-soft text-muted")}
          >
            <PhoneMissed size={12} /> Captured ({capturedCount})
          </button>
        </div>
      )}

      <div className="md:hidden">
        <div className="overflow-hidden rounded-panel bg-surface p-1 shadow-card">
          {filtered.map((patient, index) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="group flex min-h-[82px] items-center gap-3 rounded-[26px] px-3 py-3 transition-colors hover:bg-surface-soft"
            >
              <Avatar id={patient.id} name={patient.name} size={46} />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 truncate text-[15px] font-medium tracking-[-0.025em]">
                  <span className="truncate">{patient.name}</span>
                  {patient.review === "given" && <Star size={11} className="shrink-0 text-primary" aria-label="Reviewed" />}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">{patient.age} · {patient.visits.length ? `last seen ${fmtDate(patient.visits[0].date)}` : "new patient"}</p>
                {patient.source === "missed_call" ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-primary-ink"><PhoneMissed size={10} /> Captured from missed call</p>
                ) : (
                  patient.tags[0] && <p className="mt-1 text-[11px] text-faint">{patient.tags[0]}</p>
                )}
              </div>
              {patient.source === "missed_call" && <ConfirmButton patientId={patient.id} />}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft transition-transform group-hover:translate-x-0.5"><ArrowRight size={17} /></span>
              {index !== filtered.length - 1 && <span className="pointer-events-none absolute" />}
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="font-display text-[29px] font-light tracking-[-0.045em]">No match yet.</p>
              <p className="mt-2 text-[13px] text-muted">Walk-ins create a patient file automatically.</p>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <DataTable columns={columns} data={filtered} showSearch={false} onRowClick={(patient) => router.push(`/patients/${patient.id}`)} />
      </div>

      <BookingSheet open={booking} onOpenChange={setBooking} />
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useQueue, activeQueue } from "@/hooks/use-queue";
import { useAppointments } from "@/hooks/use-appointments";
import { usePatients } from "@/hooks/use-patients";
import { toDateKey } from "@/lib/utils";

// Whoever's physically in the room for this doctor right now — the same
// derivation now-serving.tsx and the ambient-capture entry point on Home
// both need, pulled out so neither has to duplicate it or thread patient
// data through props just to know who a recording belongs to.
export function useCurrentPatient(doctorId: string) {
  const { data: queue = [] } = useQueue();
  const { data: appointments = [] } = useAppointments({ date: toDateKey(new Date()) });
  const { data: patients } = usePatients();

  const active = useMemo(() => activeQueue(queue).filter((q) => q.doctorId === doctorId), [queue, doctorId]);
  const current = active.find((q) => q.state === "in_room") ?? active[0];
  const patient = current ? patients?.find((p) => p.id === current.patientId) : undefined;
  const appt = current?.apptId ? appointments.find((a) => a.id === current.apptId) : undefined;
  const displayName = patient?.name ?? current?.displayName;

  return { active, current, patient, appt, displayName };
}

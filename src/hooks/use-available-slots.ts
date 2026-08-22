"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useSession } from "@/stores";

export interface ApiSlot {
  slotId: string;
  start: string;
  end: string;
  durationMinutes: number;
}

// Real nettu-scheduler availability — already excludes existing
// appointments and blocked time, unlike booking-sheet.tsx's old
// buildSlotOptions (pure clinic-hours/slot-length math with no idea what
// was already taken, so an already-booked time stayed selectable right up
// until the server rejected the completed form with a 409).
export function useAvailableSlots({ doctorId, date }: { doctorId?: string; date?: string }) {
  const clinicId = useSession((s) => s.session?.clinicId);
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);

  return useQuery({
    queryKey: ["available-slots", clinicId, doctorId, date ?? null],
    enabled: !!clinicId && !!doctorId,
    queryFn: async () => {
      const { slots, timezone } = await api.get<{ slots: ApiSlot[]; timezone: string }>(
        `/api/v1/appointments/slots?doctorId=${doctorId}${qs.toString() ? `&${qs}` : ""}`,
      );
      return { slots, timezone };
    },
  });
}

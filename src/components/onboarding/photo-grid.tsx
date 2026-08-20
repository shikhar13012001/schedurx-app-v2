"use client";
import { useRef, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type DoctorPhoto = { url: string; isPrimary?: boolean };

const MAX_PHOTOS = 5;

export function PhotoGrid({ photos, onChange }: { photos: DoctorPhoto[]; onChange: (photos: DoctorPhoto[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (photos.length >= MAX_PHOTOS) return toast.error(`Up to ${MAX_PHOTOS} photos`);
    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/api/v1/onboarding/doctor-photo-upload-url",
        { fileName: file.name, contentType: file.type },
      );
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const next = [...photos, { url: publicUrl, isPrimary: photos.length === 0 }];
      onChange(next);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't upload that photo — try again.");
    } finally {
      setUploading(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  };

  const remove = (idx: number) => {
    const removed = photos[idx];
    const next = photos.filter((_, i) => i !== idx);
    if (removed?.isPrimary && next.length) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  };

  const makePrimary = (idx: number) => {
    onChange(photos.map((p, i) => ({ ...p, isPrimary: i === idx })));
  };

  const primary = photos.find((p) => p.isPrimary) ?? photos[0];

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />

      {primary ? (
        <div className="relative h-44 w-full overflow-hidden rounded-panel bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={primary.url} alt="Primary profile photo" className="h-full w-full object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="pressable flex h-44 w-full flex-col items-center justify-center gap-2 rounded-panel bg-surface-2/70 text-muted hover:bg-surface-2"
        >
          <Plus size={20} />
          <span className="text-[13px]">{uploading ? "Uploading…" : "Add a photo"}</span>
        </button>
      )}

      <div className="mt-3 flex gap-2">
        {photos.map((p, i) => (
          <div key={p.url} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            {!p.isPrimary && (
              <button
                type="button"
                onClick={() => makePrimary(i)}
                aria-label="Make primary photo"
                className="pressable absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Star size={11} />
              </button>
            )}
            {p.isPrimary && (
              <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-fg">
                <Star size={11} fill="currentColor" />
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove photo"
              className="pressable absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {photos.length > 0 && photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Add another photo"
            className={cn("pressable flex h-16 w-16 shrink-0 items-center justify-center rounded-control bg-surface-2/70 text-muted hover:bg-surface-2")}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-faint">Optional — up to {MAX_PHOTOS} photos. Tap the star to set the one patients see first.</p>
    </div>
  );
}

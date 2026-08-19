import { cn, hueFor, initials } from "@/lib/utils";

export function Avatar({ id, name, size = 40, className, ring }: { id: string; name: string; size?: number; className?: string; ring?: boolean }) {
  const hue = hueFor(id);
  return (
    <div
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `radial-gradient(circle at 72% 24%, rgba(255,255,255,.72), transparent 30%), linear-gradient(145deg, hsl(${hue} 16% 90%), hsl(${hue} 14% 77%))`,
        color: `hsl(${hue} 14% 28%)`,
      }}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-medium tracking-[-0.02em] shadow-[inset_0_1px_0_rgba(255,255,255,.5)]",
        "dark:brightness-[0.78] dark:saturate-[0.7]",
        ring && "ring-2 ring-white/80 ring-offset-2 ring-offset-bg",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}

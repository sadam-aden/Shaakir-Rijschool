import { cn } from "@/lib/utils";

export function initialsOf(first: string, last?: string) {
  return `${first[0] ?? ""}${(last ?? first.split(" ")[1] ?? "")[0] ?? ""}`.toUpperCase();
}

const sizes = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" } as const;

export function Avatar({
  initials, solid, size = "md", className,
}: { initials: string; solid?: boolean; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        solid ? "bg-primary text-white" : "bg-primary-soft text-primary",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

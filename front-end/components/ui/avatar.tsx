import { cn } from "@/lib/utils";

export type AvatarSize = "lg" | "md" | "sm";

const sizeClasses: Record<AvatarSize, string> = {
  lg: "size-14 text-lg",
  md: "size-10 text-sm",
  sm: "size-7 text-xs",
};

export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white [background-image:var(--grad-marca)]",
        sizeClasses[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

const WHITE_LOGO =
  "https://digitaly.tech/wp-content/uploads/2026/06/logo_digitaly_branca-scaled.png";
const GRAY_LOGO =
  "https://digitaly.tech/wp-content/uploads/2026/06/logo_digitaly_cinza-scaled.png";

export interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={WHITE_LOGO}
        alt="Digitaly"
        width={2560}
        height={627}
        unoptimized
        priority
        className="logo-branca h-auto w-[132px]"
      />
      <Image
        src={GRAY_LOGO}
        alt="Digitaly"
        width={2560}
        height={627}
        unoptimized
        priority
        className="logo-cinza h-auto w-[132px]"
      />
    </span>
  );
}

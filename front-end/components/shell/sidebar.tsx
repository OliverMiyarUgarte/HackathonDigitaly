"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useMediaQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavItem } from "./nav-config";

export interface SidebarProps {
  items: readonly NavItem[];
  open: boolean;
  onClose: () => void;
  label: string;
}

export function Sidebar({ items, open, onClose, label }: SidebarProps) {
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const hidden = !open && !isDesktop;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        aria-hidden={open ? undefined : true}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label={label}
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-borda bg-bg-elev p-4 transition-transform duration-300 ease-brand lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="inline-flex size-10 items-center justify-center rounded-pill text-texto-2 transition-colors hover:bg-bg-elev-2 hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500 lg:hidden"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-pill px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500",
                  active
                    ? "bg-celeste-500 text-white"
                    : "text-texto-2 hover:bg-bg-elev-2 hover:text-texto",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

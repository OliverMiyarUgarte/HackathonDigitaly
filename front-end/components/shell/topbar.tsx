"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime/socket-context";
import type { RealtimeConnectionState } from "@/lib/realtime/types";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavItem } from "./nav-config";

export interface TopbarProps {
  items: readonly NavItem[];
  onOpenSidebar: () => void;
}

const CONNECTION_LABEL: Record<RealtimeConnectionState, string> = {
  idle: "Sem conexão em tempo real",
  connecting: "Conectando",
  connected: "Conectado",
  reconnecting: "Reconectando",
  failed: "Conexão em tempo real indisponível",
};

const CONNECTION_DOT: Record<RealtimeConnectionState, string> = {
  idle: "bg-texto-3",
  connecting: "bg-alerta motion-safe:animate-pulse",
  connected: "bg-sucesso",
  reconnecting: "bg-alerta motion-safe:animate-pulse",
  failed: "bg-erro",
};

function RealtimeStatus() {
  const { connectionState } = useRealtime();
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="realtime-status"
      data-state={connectionState}
      title={CONNECTION_LABEL[connectionState]}
      className="inline-flex items-center gap-1.5 rounded-pill border border-borda px-2.5 py-1 text-xs text-texto-2 max-sm:px-2"
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", CONNECTION_DOT[connectionState])}
      />
      <span className="max-sm:sr-only">{CONNECTION_LABEL[connectionState]}</span>
    </span>
  );
}

export function Topbar({ items, onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, homePath } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentItem = items.find((item) =>
    isNavItemActive(pathname, item.href),
  );
  const title = currentItem?.label ?? "Início";

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace("/entrar");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-vidro-borda bg-vidro backdrop-blur-[18px] lg:left-[280px]">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Abrir menu"
          className="inline-flex size-10 items-center justify-center rounded-pill text-texto-2 transition-colors hover:bg-bg-elev-2 hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500 lg:hidden"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>

        <Link href={homePath} className="lg:hidden">
          <Logo />
        </Link>

        <p className="hidden text-sm font-medium text-texto-2 sm:block">
          {title}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <RealtimeStatus />
          <ThemeToggle />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex min-h-10 items-center gap-2 rounded-pill p-1 pr-2 transition-colors hover:bg-bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste-500"
            >
              <Avatar name={user?.name ?? "Usuário"} size="sm" />
              <ChevronDown aria-hidden="true" className="size-4 text-texto-3" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-borda bg-bg-elev p-1 shadow-xl"
              >
                <div className="flex flex-col gap-0.5 px-3 py-2">
                  <p className="truncate text-sm font-medium text-texto">
                    {user?.name ?? "Usuário"}
                  </p>
                  <p className="truncate text-xs text-texto-3">
                    {user?.email ?? "Sessão ativa"}
                  </p>
                </div>
                <Link
                  href={homePath}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-texto-2 transition-colors hover:bg-bg-elev-2 hover:text-texto"
                >
                  <UserRound aria-hidden="true" className="size-4" />
                  Perfil
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-erro transition-colors hover:bg-erro/10"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/contracts";
import { NAV_ITEMS } from "./nav-config";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export interface AppShellProps {
  role: UserRole;
  children: ReactNode;
}

export function AppShell({ role, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const items = NAV_ITEMS[role];

  return (
    <div className="min-h-screen overflow-x-clip bg-bg text-texto">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-pill focus:bg-bg-elev focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-texto focus:ring-2 focus:ring-celeste-500"
      >
        Pular para o conteúdo
      </a>
      <Sidebar
        items={items}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        label="Navegação principal"
      />
      <div className="lg:pl-[280px]">
        <Topbar items={items} onOpenSidebar={() => setSidebarOpen(true)} />
        <main
          id="conteudo"
          className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

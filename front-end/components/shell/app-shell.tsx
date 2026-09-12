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
    <div className="min-h-screen bg-bg text-texto">
      <Sidebar
        items={items}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        label="Navegação principal"
      />
      <div className="lg:pl-[280px]">
        <Topbar items={items} onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

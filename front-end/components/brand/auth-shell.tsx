import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-bg">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-pill focus:bg-bg-elev focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-texto focus:ring-2 focus:ring-celeste-500"
      >
        Pular para o conteúdo
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-celeste-500/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[420px] translate-x-1/4 translate-y-1/4 rounded-full bg-celeste-700/20 blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Logo />
        <ThemeToggle />
      </header>

      <main
        id="conteudo"
        className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12"
      >
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col gap-1">
            <p className="text-sm font-medium text-accent">Teleatendimento</p>
            <p className="text-sm text-texto-2">Inteligência em Produção</p>
          </div>
          {children}
        </div>
      </main>

      <footer className="relative z-10 px-6 py-5 text-center text-xs text-texto-3">
        Digitaly · Engenharia de IA para Transformação de Negócios
      </footer>
    </div>
  );
}

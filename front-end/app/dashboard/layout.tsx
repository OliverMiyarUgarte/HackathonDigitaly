'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Agendar', href: '../dashboard/agendar' },
    { label: 'Calendário', href: '../dashboard/calendario' },
    { label: 'Histórico', href: '../dashboard/historico' },
    { label: 'Prontuário', href: '../dashboard/prontuario' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center p-4">
      {/* Container Centralizado para limitar a largura máxima */}
      <div className="w-full max-w-6xl flex flex-col gap-6">
        
        {/* Navbar Superior */}
        <header className="w-full bg-[#131926] border border-slate-800 rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg">
          {/* Logo */}
          <Link href="/agendar" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Heart className="w-4 h-4 text-sky-400 fill-sky-400" />
            </div>
            <span className="font-semibold text-sm text-white">Aline Telemed</span>
          </Link>

          {/* Links de Navegação */}
          <nav className="flex items-center gap-6 text-xs font-medium">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors relative py-1 ${
                    isActive
                      ? 'text-sky-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Perfil do Usuário */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 overflow-hidden">
              <img
                src="https://github.com/shadcn.png"
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* Conteúdo Dinâmico da Página */}
        <main className="w-full">{children}</main>
      </div>
    </div>
  );
}
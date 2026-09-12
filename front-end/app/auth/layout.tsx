export default function LoginLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="min-h-screen w-full bg-[#0b0f17] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Efeito sutil de iluminação no fundo (Glow radial azul) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Conteúdo centralizado */}
        <div className="w-full max-w-md z-10">
          {children}
        </div>
      </div>
    );
  }
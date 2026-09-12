'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Mic, 
  Camera, 
  Wifi, 
  Check, 
  Video, 
  Bell, 
  X,
  ArrowLeft
} from 'lucide-react';

export default function SalaEsperaPage() {
  const [showNotification, setShowNotification] = useState(true);

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-4 relative overflow-hidden">
      
      {/* Topo: Marca e Status de Conexão */}
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold">
            <Shield className="w-4 h-4 fill-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Aline Telemed</span>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Conectado em tempo real</span>
        </div>
      </div>

      {/* Pop-up de Notificação do Médico (Canto Superior Direito) */}
      {showNotification && (
        <div className="absolute top-12 right-0 sm:right-8 max-w-sm w-full bg-[#131926]/90 border border-sky-500/30 backdrop-blur-md rounded-xl p-3.5 shadow-2xl z-20 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-white">O médico entrou na sala</h4>
              <p className="text-[11px] text-slate-400">
                Dr. Marcos Vinícius está pronto para atendê-lo.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowNotification(false)}
            className="text-slate-500 hover:text-white transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Conteúdo Central */}
      <div className="w-full max-w-lg mx-auto text-center space-y-6 z-10 my-auto">
        
        {/* Avatar do Médico com Indicator Online */}
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-sky-500/20 rounded-full blur-xl animate-pulse" />
          <img
            src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&crop=faces"
            alt="Dr. Marcos Vinícius"
            className="w-24 h-24 rounded-full object-cover border-2 border-sky-500 relative z-10 mx-auto shadow-2xl"
          />
          <span className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400 z-20 flex items-center gap-1 shadow-md whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            MÉDICO NA SALA
          </span>
        </div>

        {/* Mensagem Principal */}
        <div className="space-y-1.5 pt-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dr. Marcos Vinícius já está pronto
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Sua consulta de Cardiologia está prestes a começar. Verifique seu áudio e vídeo antes de entrar.
          </p>
        </div>

        {/* Card Checklist de Dispositivos */}
        <div className="bg-[#131926] border border-slate-800 rounded-2xl p-4 space-y-3 text-left shadow-xl">
          
          {/* Microfone */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#182338]/50 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-3 text-slate-300">
              <Mic className="w-4 h-4 text-slate-400" />
              <span>Microfone</span>
            </div>
            <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
              <Check className="w-3.5 h-3.5" /> Funcionando
            </span>
          </div>

          {/* Câmera */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#182338]/50 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-3 text-slate-300">
              <Camera className="w-4 h-4 text-slate-400" />
              <span>Câmera</span>
            </div>
            <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
              <Check className="w-3.5 h-3.5" /> Funcionando
            </span>
          </div>

          {/* Conexão */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#182338]/50 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-3 text-slate-300">
              <Wifi className="w-4 h-4 text-slate-400" />
              <span>Conexão</span>
            </div>
            <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
              <Check className="w-3.5 h-3.5" /> Estável
            </span>
          </div>

        </div>

        {/* Botão de Entrar na Chamada */}
        <Link
          href="../dashboard/chamada"
          className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/25 group"
        >
          <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>Entrar na consulta agora</span>
        </Link>
      </div>

      {/* Rodapé da Sala de Espera */}
      <div className="text-center text-[10px] text-slate-600 z-10">
        A plataforma Aline Telemed usa Criptografia WebRTC de Ponta a Ponta (E2EE)
      </div>

    </div>
  );
}
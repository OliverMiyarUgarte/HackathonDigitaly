'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Sparkles, 
  FileText, 
  AlertTriangle, 
  Lightbulb, 
  MessageSquareText, 
  Pill, 
  Plus, 
  Activity,
  Maximize2
} from 'lucide-react';

export default function ChamadaPage() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-3 bg-[#0b0f17] text-white p-2 rounded-2xl overflow-hidden">
      
      {/* Topo da Chamada: Marca, Paciente/Assunto e Tempo */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#131926] border border-slate-800 rounded-xl text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold">
            <Shield className="w-4 h-4 text-sky-400 fill-sky-400/20" />
            <span className="text-white tracking-tight">Aline Telemed</span>
          </div>
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Ao Vivo
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <span className="font-semibold text-white">Ana Costa</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Acompanhamento cardíaco</span>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Conexão estável
          </span>
          <span className="font-mono text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700">
            00:04:42
          </span>
        </div>
      </div>

      {/* Conteúdo Principal: Vídeo (Esquerda) + Copiloto de IA (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        
        {/* Lado Esquerdo: Área de Vídeo */}
        <div className="lg:col-span-2 relative bg-[#131926] border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
          
          {/* Card Flutuante Superior: Anexo de Exame */}
          <div className="absolute top-4 right-4 z-20">
            <div className="bg-[#182338]/90 border border-slate-700/80 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs shadow-lg">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <div>
                <p className="text-[10px] text-slate-400">Anexo de consulta</p>
                <p className="text-xs font-medium text-white">ecocardiograma_dez24.pdf</p>
              </div>
            </div>
          </div>

          {/* Feed principal de Vídeo (Paciente) */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&h=800&fit=crop"
              alt="Paciente em vídeo"
              className="w-full h-full object-cover"
            />
            {/* Overlay com Nome */}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-medium border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Ana Costa <span className="text-slate-400 text-[10px]">(Paciente)</span>
            </div>
          </div>

          {/* Miniatura Picture-in-Picture (Médico) */}
          <div className="absolute bottom-4 right-4 z-10 w-44 h-32 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-900">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=200&fit=crop&crop=faces"
              alt="Dr. Marcos Vinícius"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1.5 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-medium text-slate-200">
              Dr. Marcos Vinícius
            </div>
          </div>

          {/* Barra Flutuante de Controles da Chamada */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#131926]/90 border border-slate-700/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-2xl">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-xl transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-2.5 rounded-xl transition-colors ${
                isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </button>

            <button className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors">
              <Activity className="w-4 h-4" />
            </button>

            <button className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>

            <Link
              href="/calendario"
              className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors ml-2"
              title="Encerrar consulta"
            >
              <PhoneOff className="w-4 h-4" />
            </Link>
          </div>

        </div>

        {/* Lado Direito: Painel Copiloto de IA */}
        <div className="bg-[#131926] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 overflow-y-auto">
          
          {/* Cabeçalho do Copiloto */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Copiloto de IA</h3>
                <p className="text-[10px] text-slate-400">Assistente médico em tempo real</p>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          </div>

          {/* Feed de Insights da IA */}
          <div className="space-y-3 flex-1 overflow-y-auto text-xs pr-1">
            
            {/* Card de Transcrição Atual */}
            <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                <MessageSquareText className="w-3 h-3 text-sky-400" />
                <span>TRANSCRICÃO AO VIVO</span>
              </div>
              <p className="text-slate-300 italic text-[11px]">
                "... e a dor aumenta quando subo os degraus da escada..."
              </p>
            </div>

            {/* Alerta Clínico */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ALERTA CLÍNICO</span>
              </div>
              <p className="text-slate-200 text-[11px]">
                Paciente informou dor no peito relacionada a esforço físico. Recomenda-se investigar histórico de doença coronariana.
              </p>
            </div>

            {/* Sugestão da IA */}
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-sky-400 font-bold uppercase tracking-wider">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>SUGESTÃO</span>
              </div>
              <p className="text-slate-200 text-[11px]">
                Sugerido perguntar como se comporta a frequência cardíaca nas crises e se há histórico familiar de angina/DCV.
              </p>
            </div>

            {/* Resumo Parcial */}
            <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-3 h-3 text-sky-400" />
                  RESUMO PARCIAL
                </span>
                <span>Há 2 min</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Paciente relata aperto no peito ao subir escadas há 10 dias, cansaço e palpitações ocasionais. Em uso de Losartana 50mg.
              </p>
            </div>

            {/* Interação Medicamentosa */}
            <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                <Pill className="w-3 h-3 text-emerald-400" />
                <span>INTERAÇÃO MEDICAMENTOSA</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Nenhuma interação relevante identificada entre Losartana e medicações mencionadas na consulta.
              </p>
            </div>

          </div>

          {/* Botões de Ação Rápida no Rodapé da IA */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">Ações Sugeridas</span>
            <div className="grid grid-cols-1 gap-2">
              <button className="w-full bg-[#182338] hover:bg-sky-500/20 border border-slate-800 hover:border-sky-500/40 text-slate-200 text-xs py-2 px-3 rounded-xl flex items-center justify-between transition-colors">
                <span>Solicitar eletrocardiograma</span>
                <Plus className="w-3.5 h-3.5 text-sky-400" />
              </button>
              <Link href={"../dashboard/resumo-atendimento"}>
                <button className="w-full bg-[#182338] hover:bg-sky-500/20 border border-slate-800 hover:border-sky-500/40 text-slate-200 text-xs py-2 px-3 rounded-xl flex items-center justify-between transition-colors">
                  <span>Gerar resumo da consulta</span>
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                </button>
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
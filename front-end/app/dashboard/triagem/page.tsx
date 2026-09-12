'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Sparkles
} from 'lucide-react';

export default function TriagemPage() {
  const [queixa, setQueixa] = useState('Sinto um leve aperto no peito após fazer caminhadas há uns 10 dias, e um cansaço maior para subir escadas.');

  // Progresso baseado no preenchimento da queixa
  const hasStep1 = queixa.trim().length > 0;
  const progress = hasStep1 ? 100 : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Botão de Voltar */}
      <Link href="/calendario" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para o calendário
      </Link>

      {/* Cabeçalho com Barra de Progresso */}
      <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Pré-Consulta e Triagem Clínica</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Preencha os dados da sua consulta. Isso ajuda o médico a se preparar com antecedência.
          </p>
        </div>

        {/* Indicador de Progresso */}
        <div className="w-full md:w-56 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Progresso</span>
            <span className="text-sky-400 font-bold">{progress}% concluído</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-sky-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Seção Única de Sintomas */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Seção 1: Queixas Principais e Motivo */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-colors ${
                hasStep1 ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500'
              }`}>
                1
              </span>
              <h2 className="text-sm font-semibold text-white">Queixa Principal e Motivo da Consulta</h2>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">Descreva o que está sentindo e o motivo do seu atendimento:</label>
              <textarea
                rows={6}
                value={queixa}
                onChange={(e) => setQueixa(e.target.value)}
                className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors resize-none placeholder-slate-500"
                placeholder="Descreva detalhadamente seus sintomas..."
              />
            </div>
          </div>

        </div>

        {/* Coluna Direita: Resumo e Ação */}
        <div className="space-y-4">
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-white">Detalhes do Agendamento</h3>

            {/* Card Médico */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <img
                src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces"
                alt="Dr. Marcos Vinícius"
                className="w-10 h-10 rounded-full object-cover border border-slate-700"
              />
              <div>
                <h4 className="text-xs font-semibold text-white">Dr. Marcos Vinícius</h4>
                <p className="text-[10px] text-slate-400">Cardiologia • CRM 123456-SP</p>
              </div>
            </div>

            {/* Informações da Data/Hora */}
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" /> Data
                </span>
                <span className="font-medium">28/03/2025</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5" /> Horário
                </span>
                <span className="font-medium">14:00</span>
              </div>
            </div>

            {/* Status Triagem */}
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-xs text-sky-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Análise de IA Prontidão</span>
              </div>
              <p className="text-[11px] text-sky-200/80">
                Seus sintomas foram pré-sintetizados para o Dr. Marcos Vinícius.
              </p>
            </div>

            {/* Botão Concluir / Salvar */}
            <Link href ={"../dashboard/calendario"}>
              <button className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-500/20">
                <CheckCircle2 className="w-4 h-4" />
                Salvar e Finalizar Triagem
              </button>
            </Link>

            <p className="text-[10px] text-center text-slate-500">
              🔒 Dados protegidos pela LGPD e Criptografia Ponta a Ponta.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Heart, 
  Activity, 
  ShieldCheck, 
  FileText, 
  Stethoscope, 
  AlertTriangle, 
  Check, 
  Edit3, 
  Lock, 
  ChevronRight,
  QrCode,
  Download,
  Share2,
  Printer,
  Sparkles
} from 'lucide-react';

export default function FechamentoProntuarioPage() {
  const [isFinalized, setIsFinalized] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Topo / Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link 
          href="/calendario" 
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para Prontuários
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Conexão Segura
          </span>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs font-semibold text-white">Dr. Roberto Mendes</span>
          <span className="text-[10px] text-slate-400">CRM-SP 142.510</span>
        </div>
      </div>

      {/* Cabeçalho do Prontuário */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131926] border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-medium mb-1">
            <span>Atendimento Médico</span>
            <span>•</span>
            <span>12 de Set de 2026 - 15:32</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Fechamento do Prontuário - Ana Maria Costa
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
            <span>54 anos</span>
            <span>•</span>
            <span>Convênio: Bradesco Saúde</span>
            <span>•</span>
            <span>Cartão SUS: 888 0010 5401 2291</span>
          </div>
        </div>

        {/* Resumo Vital Quick-Badge */}
        <div className="flex items-center gap-3 bg-[#182338]/80 border border-slate-800 rounded-xl px-4 py-3">
          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-medium block">PRESSÃO</span>
            <span className="text-sm font-bold text-white">128/82 <span className="text-[10px] font-normal text-slate-400">mmHg</span></span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-medium block">FC / REPUSO</span>
            <span className="text-sm font-bold text-white">76 <span className="text-[10px] font-normal text-slate-400">bpm</span></span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-medium block">SPO2</span>
            <span className="text-sm font-bold text-emerald-400">98%</span>
          </div>
        </div>
      </div>

      {/* Grid Principal: SOAP (Esquerda) + Emissões e Assinatura (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Coluna Esquerda (SOAP - 7 Colunas) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* S - Subjetivo */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                  S
                </div>
                <h2 className="text-sm font-bold text-white">Subjetivo</h2>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Histórico Relatado</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-[#182338]/40 border border-slate-800/60 rounded-xl p-3.5">
              Paciente relata quadro de aperto torácico retroesternal com início há cerca de 10 dias, 
              desencadeado tipicamente ao subir lances de escada ou rampas íngremes no condomínio. 
              Episódios com duração de 3 a 5 minutos que cedem com o repouso absoluto. 
              Refere cansaço moderado desproporcional ao esforço habitual nas últimas duas semanas. 
              Nega palpitações em repouso, ortopneia, dispneia paroxística noturna ou síncope. 
              Relata boa adesão ao tratamento com Losartana Potássica 50mg/dia pela manhã.
            </p>

            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-sky-200/90 italic">
                &ldquo;Doutor, quando chego no segundo andar sinto um aperto meio forte no peito...&rdquo; 
                <span className="text-slate-400 not-italic block mt-0.5 text-[10px]">— Transcrito via IA</span>
              </p>
            </div>
          </div>

          {/* O - Objetivo */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                  O
                </div>
                <h2 className="text-sm font-bold text-white">Objetivo</h2>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Exame Físico e Vitais</span>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-medium text-slate-400">Pressão Arterial</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-white">128 / 82</span>
                  <span className="text-[10px] text-slate-400">mmHg</span>
                </div>
                <span className="text-[10px] text-emerald-400 block font-medium">Estável</span>
              </div>

              <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-medium text-slate-400">Frequência Cardíaca & SpO2</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-white">76 bpm</span>
                  <span className="text-xs font-semibold text-emerald-400">98% SpO2</span>
                </div>
                <span className="text-[10px] text-slate-400 block">Ritmo regular</span>
              </div>
            </div>

            {/* Ectoscopia */}
            <div className="bg-[#182338]/40 border border-slate-800/60 rounded-xl p-3.5 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ectoscopia e Histórico Recente:</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Paciente LOTE, corada, acianótica, anictérica e eupnéica em ar ambiente. Sem sinais de desconforto respiratório durante a fala. Sem turgência jugular patológica a 45°.
              </p>
              <p className="text-slate-400 text-[10px] pt-1">
                Ecocardiograma Transtorácico (04/12/2024): FE 64%, cavidades preservadas, contratilidade segmentar em repouso sem alterações.
              </p>
            </div>
          </div>

          {/* A - Avaliação Diagnóstica */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <h2 className="text-sm font-bold text-white">Avaliação Diagnóstica</h2>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">CID-10</span>
            </div>

            <div className="space-y-2">
              <div className="bg-[#182338]/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs px-2.5 py-1 rounded-lg">
                    I20.9
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Angina pectoris, não especificada</h4>
                    <p className="text-[10px] text-slate-400">Diagnóstico Principal • Suspeita clínica (CCS II)</p>
                  </div>
                </div>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Em Investigação
                </span>
              </div>

              <div className="bg-[#182338]/40 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-800 text-slate-400 font-bold text-xs px-2.5 py-1 rounded-lg">
                    I10
                  </span>
                  <div>
                    <h4 className="text-xs font-medium text-slate-300">Hipertensão essencial (primária)</h4>
                    <p className="text-[10px] text-slate-500">Comorbidade Crônica • Controle adequado</p>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Controlado
                </span>
              </div>
            </div>
          </div>

          {/* P - Plano / Conduta */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                  P
                </div>
                <h2 className="text-sm font-bold text-white">Plano / Conduta</h2>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Plano Terapêutico</span>
            </div>

            <ul className="space-y-2 text-xs text-slate-300">
              <li className="bg-[#182338]/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                <span><strong>Investigação Cardíaca:</strong> Teste Ergométrico Computadorizado e ECG Basal de Repouso.</span>
              </li>
              <li className="bg-[#182338]/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                <span><strong>Manutenção:</strong> Manter Losartana Potássica 50mg/dia VO pela manhã.</span>
              </li>
              <li className="bg-[#182338]/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                <span><strong>Retorno:</strong> Agendado para reavaliação em 30 dias com o resultado dos exames.</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Coluna Direita (Documentos Emitidos & Assinatura - 5 Colunas) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Prescrição Digital */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                Prescrição Digital
              </h3>
              <span className="text-[10px] text-slate-500">Receita Simples</span>
            </div>

            <div className="bg-[#182338]/70 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Losartana Potássica 50mg</h4>
                  <p className="text-[10px] text-slate-400">30 comprimidos • Uso contínuo</p>
                </div>
                <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                  Qtd: 2 cx
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Tomar 1 comprimido por via oral 1x ao dia, pela manhã. Uso contínuo.
              </p>
              <div className="pt-2 flex items-center gap-2 text-[10px] text-slate-500 border-t border-slate-800/60">
                <QrCode className="w-3.5 h-3.5 text-slate-400" />
                <span>QR Code validado via Memed/ICP</span>
              </div>
            </div>
          </div>

          {/* Pedidos de Exames */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                Pedidos de Exames
              </h3>
              <span className="text-[10px] text-slate-500">2 exames</span>
            </div>

            <div className="space-y-2">
              <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Teste Ergométrico Computadorizado</h4>
                  <p className="text-[10px] text-slate-400">Avaliação de dor torácica aos esforços</p>
                </div>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>

              <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Eletrocardiograma de Repouso (ECG)</h4>
                  <p className="text-[10px] text-slate-400">Ritmo basal e repolarização ventricular</p>
                </div>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            </div>
          </div>

          {/* Orientações ao Paciente */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-sky-400" />
              Orientações ao Paciente
            </h3>

            <div className="space-y-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Sinais de Alerta:</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Procurar pronto atendimento se dor retroesternal em repouso, irradiação ou duração &gt; 10 min.
                </p>
              </div>

              <div className="bg-[#182338]/40 border border-slate-800/60 rounded-xl p-3">
                <p className="text-[11px] text-slate-300">
                  ⚡ <strong>Atividade Física:</strong> Evitar esforços vigorosos súbitos até realização do teste ergométrico.
                </p>
              </div>
            </div>
          </div>

          {/* Card de Assinatura Digital ICP-Brasil */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">Assinatura Digital ICP-Brasil</h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                CERTIFICADO A1 ATIVO
              </span>
            </div>

            <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Dr. Marcos Vinícius Ferreira</h4>
                <p className="text-[10px] text-slate-400">CRM-SP 125.409 • CPF: ***.942.018-**</p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Pin: ******</span>
            </div>

            {/* Ações Principais de Fechamento */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setIsFinalized(true)}
                className={`w-full font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isFinalized 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' 
                    : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20'
                }`}
              >
                {isFinalized ? (
                  <>
                    <Check className="w-4 h-4" />
                    Prontuário Assinado & Encerrado
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Assinar e Fechar Prontuário
                  </>
                )}
              </button>

              <button className="w-full bg-[#182338] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors">
                <Edit3 className="w-3.5 h-3.5" />
                Editar anotações
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
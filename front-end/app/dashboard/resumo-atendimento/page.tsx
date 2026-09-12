'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Printer, 
  Share2, 
  Clock, 
  ShieldCheck, 
  Calendar, 
  FileText, 
  Download, 
  MessageCircle, 
  Activity, 
  Stethoscope, 
  Utensils, 
  ClipboardList, 
  AlertTriangle, 
  Star, 
  Headphones, 
  PhoneCall, 
  Bot,
  ArrowLeft
} from 'lucide-react';

export default function ResumoAtendimentoPage() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* Botão de Voltar e Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/calendario" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o calendário
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Atendimento Concluído</span>
          <span>•</span>
          <span className="text-white font-medium">Ana Costa - Cardiologia</span>
        </div>
      </div>

      {/* Cabeçalho do Resumo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Resumo do Atendimento</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Consulta com Dr. Marcos Vinícius finalizada em 28 de Março de 2025 às 14:24
          </p>
        </div>

        {/* Botões de Ação Superior */}
        <div className="flex items-center gap-2">
          <button className="bg-[#182338]/80 hover:bg-[#182338] border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors">
            <Printer className="w-3.5 h-3.5" />
            Imprimir Dossiê
          </button>
          <button className="bg-sky-500 hover:bg-sky-400 text-white px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors shadow-lg shadow-sky-500/20">
            <Share2 className="w-3.5 h-3.5" />
            Compartilhar
          </button>
        </div>
      </div>

      {/* Banner de Validação ICP-Brasil */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">Documentos emitidos com assinatura ICP-Brasil</h2>
            <p className="text-[11px] text-emerald-300/80 mt-0.5">
              Sua receita digital e pedido de exames estão validados e prontos para uso em farmácias e laboratórios credenciados.
            </p>
          </div>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Certificado A1 Ativo
        </span>
      </div>

      {/* Indicadores Rápidos (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#131926] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">DURAÇÃO DA CONSULTA</p>
            <p className="text-lg font-bold text-white">24 <span className="text-xs font-normal text-slate-400">minutos</span></p>
          </div>
        </div>

        <div className="bg-[#131926] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">CERTIFICAÇÃO DIGITAL</p>
            <p className="text-xs font-bold text-white">Assinado digitalmente</p>
            <p className="text-[10px] text-slate-500">CRM-SP 123456 • 28/03/2025</p>
          </div>
        </div>

        <div className="bg-[#131926] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">RETORNO RECOMENDADO</p>
            <p className="text-xs font-bold text-white">Em 30 dias <span className="text-slate-400 font-normal">com exames</span></p>
          </div>
        </div>
      </div>

      {/* Grid Principal: Documentos Emitidos (Esquerda) + Retorno e Avaliação (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Receita, Exames e Orientações */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Receita Médica */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">RECEITUÁRIO SIMPLES</span>
                <h3 className="text-xs font-semibold text-white">Receita Médica #REC-98214</h3>
              </div>
              <span className="text-[10px] text-slate-500">Válido em todo território nacional</span>
            </div>

            {/* Item da Receita */}
            <div className="bg-[#182338]/60 border border-slate-800/80 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">Losartana Potássica 50mg</h4>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Uso contínuo</span>
                </div>
                <p className="text-xs text-slate-300">
                  Tomar 1 (um) comprimido por via oral uma vez ao dia pela manhã.
                </p>
                <div className="flex items-center gap-4 pt-1 text-[10px] text-slate-400">
                  <span>Qtd: 60 comprimidos (2 caixas)</span>
                  <span>•</span>
                  <span>Validade: 180 dias</span>
                </div>
              </div>
            </div>

            {/* Ações da Receita */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button className="bg-sky-500 hover:bg-sky-400 text-white text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Baixar receita (PDF)
              </button>
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" />
                Enviar por WhatsApp
              </button>
            </div>
          </div>

          {/* Exames Solicitados */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">EXAMES SOLICITADOS</span>
                <h3 className="text-xs font-semibold text-white">Solicitação de Teste Ergométrico e ECG</h3>
              </div>
              <span className="text-[10px] text-slate-500">Com QR Code de autenticidade</span>
            </div>

            {/* Lista de Exames */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#182338]/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
                <Activity className="w-4 h-4 text-sky-400" />
                <div>
                  <h4 className="text-xs font-semibold text-white">1. Eletrocardiograma de Repouso (ECG)</h4>
                  <p className="text-[10px] text-slate-400">Avaliação do ritmo sinusal e condução AV</p>
                </div>
              </div>

              <div className="bg-[#182338]/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
                <Stethoscope className="w-4 h-4 text-sky-400" />
                <div>
                  <h4 className="text-xs font-semibold text-white">2. Teste Ergométrico Computadorizado</h4>
                  <p className="text-[10px] text-slate-400">Protocolo de Ellestad / Resposta isquêmica</p>
                </div>
              </div>
            </div>

            {/* Indicação Clínica */}
            <div className="bg-[#182338]/40 border border-slate-800/60 rounded-xl p-3 text-xs space-y-1">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">INDICAÇÃO CLÍNICA:</span>
              <p className="text-slate-300 text-[11px]">
                Palpitações ocasionais aos esforços moderados. Investigação de insuficiência coronariana.
              </p>
            </div>

            <div className="flex justify-end">
              <button className="bg-[#182338] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Baixar guia de exames
              </button>
            </div>
          </div>

          {/* Orientações e Cuidados Pós-Consulta */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">RECOMENDAÇÕES CLÍNICAS</span>
                <h3 className="text-xs font-semibold text-white">Orientações e Cuidados Pós-Consulta</h3>
              </div>
              <span className="text-[10px] text-slate-500">Resumo gerado via IA e médico</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#182338]/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold">
                  <Utensils className="w-4 h-4" />
                  <span>Alimentação</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Reduzir consumo de sódio (&lt;2g/dia), evitar alimentos ultraprocessados e manter hidratação.
                </p>
              </div>

              <div className="bg-[#182338]/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold">
                  <ClipboardList className="w-4 h-4" />
                  <span>Diário de Sintomas</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Registrar aferições de pressão arterial duas vezes ao dia pelo app por 14 dias seguidos.
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Sinais de Alerta</span>
                </div>
                <p className="text-[11px] text-amber-200/90">
                  Procurar pronto atendimento caso sinta dor opressiva intensa no peito, falta de ar ou sudorese fria.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Coluna Direita: Agendamento de Retorno, Avaliação e Suporte */}
        <div className="space-y-6">
          
          {/* Agendamento de Retorno */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-semibold text-white">Retorno Recomendado</h3>
            </div>

            <p className="text-xs text-slate-400">
              Dr. Marcos Vinícius indicou o retorno para conferência dos exames laboratoriais e eletrocardiograma.
            </p>

            <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Data Sugerida</span>
                <span className="font-bold text-white">28 de Abril de 2025</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Modalidade</span>
                <span className="text-sky-400 font-medium">Teleconsulta</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Valor</span>
                <span className="text-emerald-400 font-bold">Incluso no plano/retorno</span>
              </div>
            </div>

            <button className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-500/20">
              <Calendar className="w-4 h-4" />
              Agendar consulta de retorno
            </button>

            <Link href="/calendario" className="block text-center text-xs text-slate-400 hover:text-white transition-colors">
              Voltar ao meu calendário
            </Link>
          </div>

          {/* Avaliação do Atendimento */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Como foi seu atendimento?</h3>
              <span className="text-[10px] text-slate-500">Avaliação anônima</span>
            </div>

            {/* Estrelas */}
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform focus:outline-none"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700 hover:text-slate-500'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Deixe um comentário citado (opcional)..."
              className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
            />

            <button className="w-full bg-[#182338] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs py-2 rounded-xl font-medium transition-colors">
              Enviar Avaliação
            </button>
          </div>

          {/* Atendimento e Suporte */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-2">
              <Headphones className="w-4 h-4 text-sky-400" />
              Atendimento e Suporte
            </h3>
            <p className="text-[11px] text-slate-400">
              Dúvidas sobre a receita ou exames? Fale com a equipe.
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <button className="w-full bg-[#182338]/60 hover:bg-[#182338] border border-slate-800 text-slate-300 py-2 px-3 rounded-xl flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-sky-400" />
                  Central 24h 0800
                </span>
                <span className="text-[10px] text-slate-500">0800 111 1734</span>
              </button>

              <button className="w-full bg-[#182338]/60 hover:bg-[#182338] border border-slate-800 text-slate-300 py-2 px-3 rounded-xl flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-sky-400" />
                  Falar com Enfermagem Aline
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">Online</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
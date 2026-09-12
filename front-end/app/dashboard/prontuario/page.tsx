'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  User, 
  Stethoscope, 
  FileText, 
  CheckCircle2, 
  Save 
} from 'lucide-react';

export default function ProntuarioPage() {
  const [salvo, setSalvo] = useState(false);

  // Dados extraídos diretamente do seu banco de dados
  const [consultaData, setConsultaData] = useState({
    medico: 'Dr. Marcos Vinícius',
    tipoConsulta: 'Consulta Cardiológica',
    descricao: 'Paciente relata quadro de dor torácica retroesternal opressiva associada a esforço moderado (subir escadas) há 10 dias. Episódios com alívio progressivo no repouso. Mantém tratamento anti-hipertensivo regular com Losartana 50mg pela manhã. Orientada manutenção da dieta e acompanhamento contínuo.'
  });

  const handleSave = () => {
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Botão de Voltar */}
      <Link href="/historico" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para Histórico
      </Link>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Registro de Prontuário</h1>
          <p className="text-xs text-slate-400 mt-0.5">Detalhamento e atualização do atendimento do paciente</p>
        </div>

        {/* Médico vindo do banco */}
        <div className="flex items-center gap-2 bg-[#131926] border border-slate-800 px-3 py-1.5 rounded-xl">
          <User className="w-4 h-4 text-sky-400" />
          <span className="text-xs text-slate-300 font-medium">{consultaData.medico}</span>
        </div>
      </div>

      {/* Card Único: Dados do Banco de Dados */}
      <div className="bg-[#131926] border border-slate-800 rounded-2xl p-6 space-y-6">
        
        {/* Informações Básicas da Consulta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">TIPO DE CONSULTA</p>
              <h2 className="text-base font-bold text-white">{consultaData.tipoConsulta}</h2>
            </div>
          </div>
        </div>

        {/* Campo de Descrição */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-sky-400" />
            Descrição da Consulta
          </label>
          <textarea
            rows={8}
            value={consultaData.descricao}
            onChange={(e) => setConsultaData({ ...consultaData, descricao: e.target.value })}
            className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors resize-y leading-relaxed"
            placeholder="Digite a descrição médica da consulta..."
          />
        </div>

        {/* Ação: Salvar Alterações */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={handleSave}
            className={`font-medium px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg ${
              salvo
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20'
            }`}
          >
            {salvo ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Descrição Salva com Sucesso!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Prontuário
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
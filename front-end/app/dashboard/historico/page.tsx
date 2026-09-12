'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  User, 
  Stethoscope, 
  FileText 
} from 'lucide-react';

export default function HistoricoPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Simulação dos dados retornados do seu banco de dados
  const consultas = [
    {
      id: 1,
      medico: 'Dr. Marcos Vinícius',
      tipoConsulta: 'Retorno Cardiologia',
      descricao: 'Paciente estável, pressão controlada com Losartana 50mg. Recomendado manter dieta hipossódica e caminhada 4x por semana. Prescrita renovação de medicação por 180 dias.'
    },
    {
      id: 2,
      medico: 'Dra. Fernanda Lima',
      tipoConsulta: 'Check-up Clínico',
      descricao: 'Paciente relata cansaço discreto aos esforços moderados. Solicitados Ecocardiograma Transtorácico e hemograma completo para investigação complementar.'
    },
    {
      id: 3,
      medico: 'Dr. Marcos Vinícius',
      tipoConsulta: 'Primeira Consulta Cardiologia',
      descricao: 'Confirmação diagnóstica de Hipertensão Arterial Estágio I. Introdução de Losartana 50mg/dia. Solicitado MAPA 24h e exames complementares de função renal.'
    }
  ];

  // Filtro simples por tipo de consulta ou médico
  const consultasFiltradas = consultas.filter((c) =>
    c.tipoConsulta.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.medico.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Histórico de Consultas</h1>
          <p className="text-xs text-slate-400 mt-1">
            Consulte os registros das suas consultas finalizadas.
          </p>
        </div>
        <Link
          href="../dashboard/agendar"
          className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          Nova consulta
        </Link>
      </div>

      {/* Barra de Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por tipo de consulta, médico ou descrição..."
          className="w-full bg-[#131926] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Lista de Registros do Banco de Dados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Atendimentos Registrados
          </h2>
          <span className="text-[11px] text-slate-500">
            {consultasFiltradas.length} registro(s)
          </span>
        </div>

        {consultasFiltradas.length > 0 ? (
          consultasFiltradas.map((item) => (
            <div 
              key={item.id} 
              className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3 transition-colors hover:border-slate-700"
            >
              {/* Topo do Card: Tipo de Consulta e Médico */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.tipoConsulta}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3 text-slate-500" />
                      {item.medico}
                    </p>
                  </div>
                </div>
              </div>

              {/* Corpo do Card: Descrição da Consulta */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <FileText className="w-3 h-3 text-sky-400" /> Descrição do Atendimento:
                </span>
                <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
                  {item.descricao}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
            Nenhuma consulta encontrada com os termos buscados.
          </div>
        )}
      </div>
    </div>
  );
}
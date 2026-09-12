'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Video, 
  Calendar as CalendarIcon, 
  Clock, 
  Hash, 
  ChevronLeft, 
  ChevronRight,
  Bell
} from 'lucide-react';

export default function CalendarioPage() {
  const [selectedDay, setSelectedDay] = useState(28);

  const upcomingConsultations = [
    {
      id: 1,
      doctor: 'Dr. Rafael Souza',
      specialty: 'Cardiologia',
      date: '27/03',
      time: '09:00',
      avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=faces',
    },
    {
      id: 2,
      doctor: 'Dra. Fernanda Lima',
      specialty: 'Cardiologia',
      date: '05/04',
      time: '11:30',
      avatar: 'https://images.unsplash.com/photo-1594824813566-888553768f9a?w=100&h=100&fit=crop&crop=faces',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meu calendário</h1>
          <p className="text-xs text-slate-400 mt-1">Acompanhe suas consultas agendadas.</p>
        </div>
        <Link
          href="/../dashboard/agendar"
          className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          Nova consulta
        </Link>
      </div>

      {/* Banner de Alerta: Consulta Agora (Ao Vivo) */}
      <div className="bg-[#131926] border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Consulta agora</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                HOJE • 14:00
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dr. Marcos Vinícius • Cardiologia • começa em 12 minutos
            </p>
          </div>
        </div>

        <Link href={"../dashboard/sala-de-espera"}>
          <button className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors shadow-lg shadow-sky-500/20">
            Entrar na sala de espera
          </button>
        </Link>
      </div>

      {/* Grid Principal: Calendário Expandido (Esquerda) + Detalhes (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Visão Mensal do Calendário */}
        <div className="lg:col-span-2 bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
          
          {/* Navegação do Mês */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Março 2025</h2>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid do Calendário */}
          <div className="grid grid-cols-7 gap-2">
            
            {/* Dias Anteriores/Normais */}
            {[24, 25, 26, 27, 28, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map((day, idx) => {
              const isMonthStart = idx < 5;
              const isSelected = day === 28;
              const hasConsultation = day === 28;
              const hasReturn = day === 27;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[70px] p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#182338] border-sky-500'
                      : 'bg-[#0f1420] border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <span className={`text-xs font-medium ${isMonthStart ? 'text-slate-600' : 'text-slate-300'}`}>
                    {day}
                  </span>

                  {/* Badge de Evento dentro do dia */}
                  {hasReturn && (
                    <div className="bg-sky-950/80 border border-sky-800 text-sky-400 text-[9px] p-1 rounded font-medium truncate">
                      RETORNO 09H
                    </div>
                  )}

                  {hasConsultation && (
                    <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[9px] p-1 rounded font-medium truncate flex items-center justify-between">
                      <span>CONSULTA 14H</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna Direita: Detalhes da Consulta & Próximos Compromissos */}
        <div className="space-y-4">
          
          {/* Card: Consulta do Momento */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Consulta do momento</h3>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                CONFIRMADA
              </span>
            </div>

            {/* Médico */}
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces"
                alt="Dr. Marcos Vinícius"
                className="w-10 h-10 rounded-full object-cover border border-slate-700"
              />
              <div>
                <h4 className="text-xs font-semibold text-white">Dr. Marcos Vinícius</h4>
                <p className="text-[11px] text-slate-400">Cardiologia • CRM 123456-SP</p>
              </div>
            </div>

            {/* Informações da Consulta */}
            <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 text-slate-400">
                  <CalendarIcon className="w-3.5 h-3.5" /> Data
                </span>
                <span className="font-medium">28/03/2025</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5" /> Horário
                </span>
                <span className="font-medium">14:00</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 text-slate-400">
                  <Hash className="w-3.5 h-3.5" /> Código
                </span>
                <span className="font-medium text-slate-400">#AGD-48291</span>
              </div>
            </div>

            <Link href={"../dashboard/sala-de-espera"}>
              <button className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-500/20">
                <Video className="w-4 h-4" />
                Ir para sala de espera
              </button>
            </Link>
          </div>

          {/* Card: Próximas Consultas */}
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-white">Próximas consultas</h3>

            <div className="space-y-2">
              {upcomingConsultations.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#182338]/50 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.avatar}
                      alt={item.doctor}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <h4 className="text-xs font-semibold text-white">{item.doctor}</h4>
                      <p className="text-[10px] text-slate-400">
                        {item.date} • {item.time}
                      </p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full border border-slate-600" />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
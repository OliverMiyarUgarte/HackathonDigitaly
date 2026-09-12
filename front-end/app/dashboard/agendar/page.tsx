'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Heart, 
  Brain, 
  Baby, 
  Stethoscope, 
  Star, 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  CreditCard, 
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function AgendarPage() {
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const specialties = [
    { id: 'cardiologia', name: 'Cardiologia', icon: Heart },
    { id: 'neurologia', name: 'Neurologia', icon: Brain },
    { id: 'pediatria', name: 'Pediatria', icon: Baby },
    { id: 'dermatologia', name: 'Dermatologia', icon: Stethoscope },
  ];

  const doctors = [
    {
      id: 1,
      name: 'Dr. Marcos Vinícius',
      specialty: 'Cardiologia',
      crm: 'CRM 123456-SP',
      rating: 4.9,
      reviews: 128,
      avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces',
    },
    {
      id: 2,
      name: 'Dra. Fernanda Lima',
      specialty: 'Cardiologia',
      crm: 'CRM 654321-SP',
      rating: 4.8,
      reviews: 94,
      avatar: 'https://images.unsplash.com/photo-1594824813566-888553768f9a?w=100&h=100&fit=crop&crop=faces',
    },
  ];

  const times = ['09:00', '10:30', '11:00', '14:30'];

  // Validação dos passos para mudar as cores do Stepper
  const isStep1Done = Boolean(specialty);
  const isStep2Done = Boolean(selectedDoctor);
  const isStep3Done = Boolean(selectedDate && selectedTime);
  const isStep4Done = isStep1Done && isStep2Done && isStep3Done;

  const currentDoctor = doctors.find((d) => d.id === selectedDoctor);

  return (
    <div className="space-y-6">
      {/* Título da Página */}
      <div>
        <h1 className="text-2xl font-bold text-white">Agendar consulta</h1>
        <p className="text-xs text-slate-400 mt-1">
          Escolha a especialidade, o médico e o melhor horário para você.
        </p>
      </div>

      {/* Stepper (Etapas com Cores Dinâmicas) */}
      <div className="flex items-center gap-6 border-b border-slate-800/80 pb-4 text-xs font-medium">
        
        {/* Passo 1: Especialidade */}
        <div className={`flex items-center gap-2 transition-colors ${isStep1Done ? 'text-sky-400' : 'text-slate-500'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            isStep1Done 
              ? 'bg-sky-500/20 border border-sky-400 text-sky-400' 
              : 'bg-slate-800 border border-slate-700 text-slate-500'
          }`}>
            1
          </span>
          <span>Especialidade</span>
        </div>

        {/* Passo 2: Médico */}
        <div className={`flex items-center gap-2 transition-colors ${isStep2Done ? 'text-sky-400' : 'text-slate-500'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            isStep2Done 
              ? 'bg-sky-500/20 border border-sky-400 text-sky-400' 
              : 'bg-slate-800 border border-slate-700 text-slate-500'
          }`}>
            2
          </span>
          <span>Médico</span>
        </div>

        {/* Passo 3: Horário */}
        <div className={`flex items-center gap-2 transition-colors ${isStep3Done ? 'text-sky-400' : 'text-slate-500'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            isStep3Done 
              ? 'bg-sky-500/20 border border-sky-400 text-sky-400' 
              : 'bg-slate-800 border border-slate-700 text-slate-500'
          }`}>
            3
          </span>
          <span>Horário</span>
        </div>

        {/* Passo 4: Confirmação */}
        <div className={`flex items-center gap-2 transition-colors ${isStep4Done ? 'text-sky-400' : 'text-slate-500'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            isStep4Done 
              ? 'bg-sky-500/20 border border-sky-400 text-sky-400' 
              : 'bg-slate-800 border border-slate-700 text-slate-500'
          }`}>
            4
          </span>
          <span>Confirmação</span>
        </div>

      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Form de Seleção */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Escolha a especialidade */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-slate-300">1. Escolha a especialidade</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {specialties.map((item) => {
                const Icon = item.icon;
                const isSelected = specialty === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSpecialty(item.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#182338] border-sky-500 text-sky-400'
                        : 'bg-[#131926] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-2" />
                    <span className="text-xs font-medium">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Escolha o médico */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-slate-300">2. Escolha o médico</h2>
            <div className="space-y-3">
              {doctors.map((doc) => {
                const isSelected = selectedDoctor === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc.id)}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#182338] border-sky-500'
                        : 'bg-[#131926] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={doc.avatar}
                        alt={doc.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <h3 className="text-xs font-semibold text-white">{doc.name}</h3>
                        <p className="text-[11px] text-slate-400">
                          {doc.specialty} • {doc.crm}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span className="font-medium">{doc.rating}</span>
                          <span className="text-slate-500">({doc.reviews} avaliações)</span>
                        </div>
                      </div>
                    </div>

                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-sky-400 bg-sky-500' : 'border-slate-600'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Escolha data e horário */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-slate-300">3. Escolha data e horário</h2>
            <div className="bg-[#131926] border border-slate-800 rounded-2xl p-4 space-y-4">
              
              <div className="flex items-center justify-between text-xs text-slate-300 px-2">
                <button type="button" className="p-1 hover:bg-slate-800 rounded">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold">Março 2025</span>
                <button type="button" className="p-1 hover:bg-slate-800 rounded">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 font-medium">
                <span>DOM</span>
                <span>SEG</span>
                <span>TER</span>
                <span>QUA</span>
                <span>QUI</span>
                <span>SEX</span>
                <span>SÁB</span>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {[24, 25, 26, 27, 28, 29, 31].map((day) => {
                  const isSelected = selectedDate === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`py-2 rounded-lg font-medium transition-all ${
                        isSelected
                          ? 'bg-sky-500 text-white shadow'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="text-[11px] text-slate-400 mb-2">
                  Horários disponíveis {selectedDate ? `— dia ${selectedDate} de março` : ''}:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {times.map((t) => {
                    const isSelected = selectedTime === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTime(t)}
                        className={`py-2 text-xs rounded-xl font-medium transition-all ${
                          isSelected
                            ? 'bg-sky-500 text-white shadow'
                            : 'bg-[#1a2333] border border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* Coluna Direita: Resumo */}
        <div className="space-y-4">
          <div className="bg-[#131926] border border-slate-800 rounded-2xl p-5 space-y-4 sticky top-4">
            <h2 className="text-xs font-semibold text-white">Resumo da consulta</h2>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <img
                src={currentDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces'}
                alt={currentDoctor?.name || 'Médico'}
                className="w-10 h-10 rounded-full object-cover border border-slate-700"
              />
              <div>
                <h3 className="text-xs font-semibold text-white">
                  {currentDoctor ? currentDoctor.name : 'Selecione um médico'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {specialty ? specialty.charAt(0).toUpperCase() + specialty.slice(1) : 'Selecione a especialidade'}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 text-slate-400">
                  <CalendarIcon className="w-3.5 h-3.5" /> Data
                </span>
                <span className="font-medium">
                  {selectedDate ? `${selectedDate}/03/2025` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5" /> Horário
                </span>
                <span className="font-medium">{selectedTime || '—'}</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 text-slate-400">
                  <Video className="w-3.5 h-3.5" /> Modalidade
                </span>
                <span className="font-medium text-sky-400">Teleconsulta</span>
              </div>

              <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-3.5 h-3.5" /> Valor
                </span>
                <span className="font-bold text-white text-sm">R$ 220,00</span>
              </div>
            </div>

            <div className="bg-[#182338] border border-sky-500/20 rounded-xl p-3 flex gap-2.5 text-[11px] text-sky-300">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p>
                Ao agendar, enviaremos um código de verificação para o seu e-mail para validar o agendamento.
              </p>
            </div>

            <Link href={"../dashboard/confirmar-agendamento"}>
              <button
                type="button"
                disabled={!isStep4Done}
                className={`w-full font-medium py-2.5 rounded-xl text-xs transition-all shadow-lg ${
                  isStep4Done 
                    ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                Solicitar código e confirmar &gt;
              </button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
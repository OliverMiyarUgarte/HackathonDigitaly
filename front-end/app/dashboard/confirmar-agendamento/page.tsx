'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Mail, Check, Shield, Clock, ArrowLeft } from 'lucide-react';

export default function ConfirmarAgendamentoPage() {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      {/* Botão de Voltar para a Dashboard */}
      <Link href="/calendario" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para o calendário
      </Link>

      {/* Card Principal de Confirmação */}
      <div className="bg-[#131926] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
        {/* Glow suave no fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Ícone Superior de E-mail */}
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mx-auto shadow-lg shadow-sky-500/10">
          <Mail className="w-6 h-6" />
        </div>

        {/* Título Principal */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-white">Confirme seu agendamento</h1>
          <p className="text-xs text-slate-400">
            Enviamos um código de 6 dígitos para <br />
            <span className="text-slate-200 font-medium">a.costa@gmail.com</span>
          </p>
        </div>

        {/* Resumo do Agendamento */}
        <div className="bg-[#182338]/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces"
              alt="Dr. Marcos Vinícius"
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
            />
            <div>
              <h3 className="text-xs font-semibold text-white">
                Dr. Marcos Vinícius <span className="text-slate-400 font-normal">• Cardiologia</span>
              </h3>
              <p className="text-[11px] text-slate-400">28/03/2025 às 14:00</p>
            </div>
          </div>
          <Clock className="w-4 h-4 text-amber-400" />
        </div>

        {/* Inputs do Código OTP (6 dígitos) */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {code.map((digit, idx) => (
              <div key={idx} className="flex items-center">
                <input
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-10 h-12 text-center text-base font-bold text-white bg-[#182338]/60 border rounded-xl focus:outline-none transition-all ${
                    digit 
                      ? 'border-sky-500 bg-[#182338]' 
                      : 'border-slate-800 focus:border-sky-500'
                  }`}
                />
                {/* Divisor no meio dos 6 dígitos */}
                {idx === 2 && <span className="mx-1 text-slate-600 font-bold">-</span>}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-center text-slate-400">
            Código expira em <span className="text-sky-400 font-semibold">04:32</span>
          </p>
        </div>

        {/* Botão de Validação */}
        <Link
          href="../dashboard/triagem"
          className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-500/20"
        >
          <span>Validar e confirmar consulta</span>
          <Check className="w-4 h-4" />
        </Link>

        {/* Reenviar Código */}
        <div className="text-center text-xs">
          <p className="text-slate-400">
            Não recebeu o código?{' '}
            <button className="text-sky-400 hover:underline font-medium">
              Reenviar
            </button>
          </p>
        </div>

        {/* Rodapé de Segurança */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-slate-500" />
          <span>Validação segura via NestJS • e-mail criptografado</span>
        </div>
      </div>
    </div>
  );
}
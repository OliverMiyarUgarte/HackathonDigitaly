'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function RecuperacaoAcessoPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [timer, setTimer] = useState(288); // 4 minutos e 48 segundos
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer de expiração do código
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Manipulação de entrada dos dígitos do código
  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1]; // aceita apenas último caractere
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus no próximo campo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Código enviado:', code.join(''), 'Nova senha:', newPassword);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background Glow sutil */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Ícone Superior de Cadeado */}
      <div className="flex flex-col items-center mb-5 z-10">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3 shadow-lg shadow-sky-500/10">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Recuperação de acesso
        </h1>
        <p className="text-xs text-slate-400 mt-1 text-center max-w-xs">
          Enviamos um código de segurança de 6 dígitos para o e-mail cadastrado <span className="text-slate-300 font-mono">a••••••@gmail.com</span>
        </p>
      </div>

      {/* Card Principal */}
      <div className="w-full max-w-md bg-[#131926]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl z-10 space-y-5">
        
        {/* Card do Usuário Identificado */}
        <div className="bg-[#182338]/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
              AC
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Ana Costa</h3>
              <p className="text-[10px] text-slate-400">Paciente • Telemedicina</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Identidade validada
          </span>
        </div>

        {/* Formulário de Código + Nova Senha */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Digitação do Código de 6 Dígitos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                CÓDIGO DE VERIFICAÇÃO
              </span>
              <button 
                type="button"
                onClick={() => setTimer(300)}
                className="text-[10px] text-sky-400 hover:underline font-medium"
              >
                Reenviar
              </button>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-full h-11 text-center text-base font-bold rounded-xl bg-[#182338]/80 border transition-all focus:outline-none ${
                    digit 
                      ? 'border-sky-500 text-white bg-sky-500/10 shadow-sm shadow-sky-500/20' 
                      : 'border-slate-800 text-slate-400 focus:border-sky-500'
                  }`}
                />
              ))}
            </div>

            {/* Contador Regressivo */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Código expira em <strong className="text-amber-400 font-mono">{formatTimer(timer)}</strong></span>
            </div>
          </div>

          {/* Nova Senha */}
          <div className="space-y-3 pt-1 border-t border-slate-800/80">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo de 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Confirmar nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Regras da Senha */}
            <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-0.5">
              <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-400' : ''}`}>
                <span className="w-1 h-1 rounded-full bg-current" />
                8+ caracteres
              </span>
              <span className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-emerald-400' : ''}`}>
                <span className="w-1 h-1 rounded-full bg-current" />
                Letras e números
              </span>
            </div>
          </div>

          {/* Botão de Validação e Submissão */}
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/20"
          >
            Validar código e redefinir senha
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Suporte */}
        <div className="text-center pt-2 border-t border-slate-800/60">
          <p className="text-[11px] text-slate-400">
            Não recebeu o código?{' '}
            <button type="button" className="text-sky-400 hover:underline font-medium">
              Reenviar via WhatsApp
            </button>
          </p>
        </div>

        {/* Voltar para o Login */}
        <div className="text-center pt-1">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o Login
          </Link>
        </div>

      </div>

      {/* Rodapé / Informações de Segurança */}
      <div className="text-center mt-6 text-[10px] text-slate-500 z-10 space-y-0.5">
        <p>© Digitaly projeto. A Aline para telemedicina • Validação com criptografia SSL 256-bit</p>
      </div>

    </div>
  );
}
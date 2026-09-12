'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck,
  Stethoscope,
  CheckCircle2
} from 'lucide-react';

export default function RegistroPage() {
  const [userType, setUserType] = useState<'paciente' | 'medico'>('paciente');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsappCpf: '',
    senha: '',
    termos: false,
  });

  // Cálculo simples de força da senha
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-700' };
    if (pass.length < 6) return { score: 1, label: 'Fraca', color: 'bg-red-500' };
    if (pass.length < 10) return { score: 2, label: 'Média', color: 'bg-amber-500' };
    return { score: 3, label: 'Forte', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(formData.senha);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica de cadastro
    console.log('Registro enviado:', { userType, ...formData });
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background Glow sutil */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Brand Logo */}
      <div className="flex flex-col items-center mb-6 z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">
            Aline <span className="text-sky-400">Telemed</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          Inteligência em saúde e triagem. O seu cuidado seguro.
        </p>
      </div>

      {/* Card do Formulário */}
      <div className="w-full max-w-md bg-[#131926]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl z-10 space-y-5">
        
        {/* Título */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Criar nova conta
          </h1>
          <p className="text-xs text-slate-400">
            Preencha seus dados para acessar consultas e telemedicina com Copiloto IA.
          </p>
        </div>

        {/* Seleção de Perfil (Paciente / Médico) */}
        <div className="bg-[#182338]/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setUserType('paciente')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              userType === 'paciente'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Paciente
          </button>
          
          <button
            type="button"
            onClick={() => setUserType('medico')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              userType === 'medico'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            Médico
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Nome completo */}
          <div className="space-y-1">
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Nome completo"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full bg-[#182338]/60 border border-slate-800/90 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* E-mail */}
          <div className="space-y-1">
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="ana.costa@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#182338]/60 border border-slate-800/90 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* WhatsApp ou CPF */}
          <div className="space-y-1">
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="WhatsApp ou CPF"
                value={formData.whatsappCpf}
                onChange={(e) => setFormData({ ...formData, whatsappCpf: e.target.value })}
                className="w-full bg-[#182338]/60 border border-slate-800/90 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                className="w-full bg-[#182338]/60 border border-slate-800/90 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Força da Senha */}
            {formData.senha && (
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Força da senha:</span>
                  <span className="font-semibold text-slate-300">{passwordStrength.label}</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'}`} />
                  <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'}`} />
                  <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Checkbox Termos */}
          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="termos"
              required
              checked={formData.termos}
              onChange={(e) => setFormData({ ...formData, termos: e.target.checked })}
              className="mt-0.5 rounded border-slate-700 bg-[#182338] text-sky-500 focus:ring-sky-500/20"
            />
            <label htmlFor="termos" className="text-[11px] text-slate-400 leading-tight">
              Li e concordo com os{' '}
              <a href="#" className="text-sky-400 hover:underline">Termos de Uso</a> e{' '}
              <a href="#" className="text-sky-400 hover:underline">Política de Privacidade</a> da Digitaly.
            </label>
          </div>

          {/* Botão de Envio */}
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/20"
          >
            Criar minha conta
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Divisor "OU CONTINUAR COM" */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-[#131926] px-2 text-slate-500 font-medium">
              OU CONTINUAR COM
            </span>
          </div>
        </div>

        {/* Login Social (Google / Apple) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="bg-[#182338]/60 hover:bg-[#182338] border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
            </svg>
            Google
          </button>

          <button
            type="button"
            className="bg-[#182338]/60 hover:bg-[#182338] border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.13-1.96.99-3.12-1 .04-2.18.67-2.88 1.48-.62.72-1.17 1.88-1.02 3 1.12.09 2.24-.54 2.91-1.36z"/>
            </svg>
            Apple
          </button>
        </div>

        {/* Link para Login */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">
            Já possui uma conta?{' '}
            <Link href="/login" className="text-sky-400 hover:underline font-semibold">
              Entrar
            </Link>
          </p>
        </div>

      </div>

      {/* Footer Footer Copyright */}
      <div className="text-center mt-6 text-[10px] text-slate-500 z-10">
        <p>© Digitaly projeto. A Aline para telemedicina CFM V1.0.210</p>
      </div>

    </div>
  );
}
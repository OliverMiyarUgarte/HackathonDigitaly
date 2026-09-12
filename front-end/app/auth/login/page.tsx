'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [profileType, setProfileType] = useState<'paciente' | 'medico'>('paciente');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos de Brilho de Fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Logotipo da Marca */}
      <div className="flex flex-col items-center gap-2 mb-6 z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-sky-500/30">
            <Shield className="w-5 h-5 fill-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Aline Telemed</span>
        </div>
        <p className="text-xs text-slate-400">Plataforma segura de atendimento médico</p>
      </div>

      {/* Card Principal de Autenticação */}
      <div className="w-full max-w-md bg-[#131926] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 z-10 shadow-2xl backdrop-blur-sm">
        
        <div>
          <h1 className="text-xl font-bold text-white text-center">Bem-vindo de volta</h1>
          <p className="text-xs text-slate-400 text-center mt-1">Entre para continuar sua consulta</p>
        </div>

        {/* Selector de Perfil: Paciente / Médico */}
        <div className="bg-[#182338]/70 p-1 rounded-xl flex items-center border border-slate-800">
          <button
            type="button"
            onClick={() => setProfileType('paciente')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              profileType === 'paciente'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Paciente
          </button>
          <button
            type="button"
            onClick={() => setProfileType('medico')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              profileType === 'medico'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Médico
          </button>
        </div>

        {/* Formulário de Login */}
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          
          {/* Campo de E-mail */}
          <div className="space-y-1">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                defaultValue="ana.costa@gmail.com"
                placeholder="Seu e-mail"
                className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Campo de Senha */}
          <div className="space-y-1">
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                defaultValue="secret1234"
                placeholder="Sua senha"
                className="w-full bg-[#182338]/60 border border-slate-800 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Manter conectado / Esqueci minha senha */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-[#182338] border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Manter conectado</span>
            </label>

            <Link href="/recuperar-senha" className="text-sky-400 hover:underline">
              Esqueci minha senha
            </Link>
          </div>

          {/* Botão Entrar */}
          <Link
            href="/calendario"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-500/20"
          >
            <span>Entrar</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </form>

        {/* Divisor */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#131926] px-3 text-[10px] text-slate-500 uppercase tracking-wider absolute">ou</span>
        </div>

        {/* Login Social (Google / Apple) */}
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 bg-[#182338]/60 hover:bg-[#182338] border border-slate-800 text-slate-300 py-2 rounded-xl text-xs transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button className="flex items-center justify-center gap-2 bg-[#182338]/60 hover:bg-[#182338] border border-slate-800 text-slate-300 py-2 rounded-xl text-xs transition-colors">
            <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.6c.64-.78 1.08-1.85.96-2.92-.93.04-2.07.62-2.74 1.4-.59.68-1.11 1.77-.97 2.83 1.05.08 2.11-.53 2.75-1.31z" />
            </svg>
            <span>Apple</span>
          </button>
        </div>

      </div>

      {/* Footer do Login */}
      <div className="mt-6 text-center text-xs space-y-2 z-10">
        <p className="text-slate-400">
          Não tem conta?{' '}
          <Link href="/cadastro" className="text-sky-400 hover:underline font-medium">
            Cadastre-se
          </Link>
        </p>
        <p className="text-[10px] text-slate-600">
          Ao entrar, você concorda com nossos <a href="#" className="underline">Termos de Uso</a> e <a href="#" className="underline">Política de Privacidade</a>.
        </p>
      </div>
    </div>
  );
}
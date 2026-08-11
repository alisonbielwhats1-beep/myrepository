"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão de mostrar/ocultar.
 *
 * Pedido do cliente (11/08/2026), e não é só conforto: a recepção digita em
 * balcão, muitas vezes no celular e com o teclado corrigindo sozinho. Sem ver
 * o que digitou, o erro só aparece como "E-mail ou senha inválidos" — e cada
 * tentativa errada ainda alimenta o contador de bloqueio por IP, que é
 * compartilhado por toda a academia.
 *
 * Começa SEMPRE oculto: a tela fica visível para quem estiver do outro lado do
 * balcão, e mostrar é uma escolha consciente de quem digita, nunca o padrão.
 *
 * O ícone de olho tem `tabIndex={-1}` de propósito — quem navega por Tab vai
 * do campo direto para o botão de enviar, sem esbarrar num controle que não
 * faz parte do preenchimento.
 */
export default function CampoSenha({
  name,
  placeholder,
  autoComplete,
  minLength,
  required,
  className,
}: {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        name={name}
        type={visivel ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        placeholder={placeholder}
        // Nunca deixar o navegador "ajudar" num campo de senha visível.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("inp pl-9 pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        tabIndex={-1}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        title={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-ink-700 hover:text-slate-300"
      >
        {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

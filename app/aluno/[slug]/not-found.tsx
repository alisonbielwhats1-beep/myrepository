import { Link2Off } from "lucide-react";

/**
 * Página genérica para qualquer link inválido da área do aluno — academia
 * inexistente, aluno inexistente ou aluno que não pertence a esta academia.
 * Nunca diz qual dos três foi o motivo: isso evitaria vazar a existência de
 * um aluno/academia para quem está adivinhando URLs.
 */
export default function AlunoNaoEncontrado() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-ink-700 text-slate-400">
        <Link2Off className="h-7 w-7" />
      </span>
      <h1 className="text-lg font-bold text-white">Link inválido</h1>
      <p className="max-w-xs text-sm text-slate-400">
        Este link de acesso não é válido ou expirou. Peça à recepção da sua
        academia um novo link pessoal.
      </p>
    </div>
  );
}

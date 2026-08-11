import { UserRound } from "lucide-react";
import { requireSessao } from "@/lib/auth";
import { PAPEIS } from "@/lib/types";
import AlterarSenhaForm from "@/components/painel/AlterarSenhaForm";

export const dynamic = "force-dynamic";

/**
 * "Minha conta" — dados do próprio login e troca de senha.
 *
 * Só `requireSessao` (sem gate de seção): TODO papel tem um login e precisa
 * poder trocar a própria senha. É a peça que faltava para o convite de acesso
 * funcionar de ponta a ponta — a pessoa entra com a senha provisória e define
 * a definitiva aqui, sem depender de o e-mail de recuperação chegar.
 */
export default async function ContaPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const papelLabel =
    PAPEIS.find((p) => p.value === sessao.papel)?.label ?? sessao.papel;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Minha conta</h1>
        <p className="text-sm text-slate-400">Seu acesso ao painel da academia.</p>
      </div>

      <div className="surface flex flex-wrap items-center gap-4 rounded-2xl p-5">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-ink-700 text-slate-300">
          <UserRound className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-white">{sessao.nome}</p>
          <p className="truncate text-sm text-slate-400">{sessao.email}</p>
          <span className="mt-1 inline-block text-xs text-slate-500">
            Perfil: {papelLabel} · {sessao.academia.nome_fantasia}
          </span>
        </div>
      </div>

      <div className="max-w-xl">
        <AlterarSenhaForm />
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { requireSecao } from "@/lib/auth";
import { listarAcessoAlunos } from "@/lib/acesso-alunos";
import { auditarMigracaoAcesso } from "@/lib/actions/convites";
import GestaoConvites from "@/components/painel/GestaoConvites";

export const dynamic = "force-dynamic";

/**
 * Acesso & Convites — a academia transforma o cadastro do aluno em um convite
 * de primeiro acesso (Google/Apple/e-mail). Gera individual ou em lote, copia
 * o link, mostra o QR, envia pelo WhatsApp e revoga. Só cria convites — nunca
 * contas nem senhas.
 */
export default async function AcessoConvitesPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "alunos");
  const [alunos, resumo] = await Promise.all([
    listarAcessoAlunos(),
    auditarMigracaoAcesso(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href={`/painel/${params.slug}/alunos`}
          className="inline-flex items-center gap-1 hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Alunos
        </Link>
        <span>/</span>
        <span className="text-slate-300">Acesso & Convites</span>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <KeyRound className="h-5 w-5 text-volt-300" /> Acesso &amp; Convites
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Convide os alunos a ativar o próprio acesso. Cada convite é pessoal,
          expira e pode ser revogado — nenhuma conta ou senha é criada aqui.
        </p>
      </div>

      <GestaoConvites
        slug={params.slug}
        academiaNome={sessao.academia.nome_fantasia}
        isDemo={Boolean(sessao.academia.is_demo)}
        alunos={alunos}
        resumo={resumo}
      />
    </div>
  );
}

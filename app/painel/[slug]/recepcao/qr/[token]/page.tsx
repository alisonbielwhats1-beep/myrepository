import { Link2Off } from "lucide-react";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import ConfirmarAcessoQr from "@/components/painel/ConfirmarAcessoQr";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tokenTemFormatoValido } from "@/lib/aluno-classificacao";
import { decidirAcesso } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Rota de confirmação de entrada por QR (Bloco 1) — a URL que o QR do aluno
 * codifica. Só um membro autenticado da academia com acesso à seção
 * "recepcao" chega aqui (middleware.ts + requireSecao); nunca é pública.
 *
 * Só resolve o aluno pelo `token_qr_acesso`, restrito à academia da sessão —
 * nunca por um aluno_id vindo da URL. O carregamento (GET) desta página NUNCA
 * registra a entrada sozinho: apenas mostra uma prévia da decisão. A
 * gravação em `acessos_catraca` só acontece quando a recepção confirma
 * explicitamente (ConfirmarAcessoQr → confirmarAcessoQr).
 */
export default async function RecepcaoQrPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const sessao = await requireSecao(params.slug, "recepcao");
  const supabase = createClient();

  const { data: aluno } = tokenTemFormatoValido(params.token)
    ? await supabase
        .from("alunos")
        .select("id, nome, foto_perfil_url, status_matricula, matricula_codigo")
        .eq("token_qr_acesso", params.token)
        .eq("academia_id", sessao.academia.id)
        .maybeSingle()
    : { data: null };

  if (!aluno) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          slug={params.slug}
          items={[
            { label: "Recepção / Catraca", href: `/painel/${params.slug}/recepcao` },
            { label: "QR de acesso" },
          ]}
        />
        <div className="surface flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ink-700 text-slate-400">
            <Link2Off className="h-7 w-7" />
          </span>
          <h1 className="text-lg font-bold text-white">QR inválido</h1>
          <p className="max-w-xs text-sm text-slate-400">
            Este QR não corresponde a nenhum aluno desta academia, ou já foi
            regenerado. Peça para o aluno abrir o app de novo.
          </p>
        </div>
      </div>
    );
  }

  const { data: mensalidades } = await supabase
    .from("receitas")
    .select("id, competencia, data, valor, status")
    .eq("academia_id", sessao.academia.id)
    .eq("aluno_id", aluno.id)
    .eq("tipo", "mensalidade")
    .eq("status", "pendente");

  const decisaoPreview = decidirAcesso(
    aluno.status_matricula,
    sessao.academia.politica_inadimplencia ?? "liberar",
    mensalidades ?? []
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        slug={params.slug}
        items={[
          { label: "Recepção / Catraca", href: `/painel/${params.slug}/recepcao` },
          { label: "QR de acesso" },
        ]}
      />
      <ConfirmarAcessoQr
        slug={params.slug}
        token={params.token}
        aluno={aluno}
        decisaoPreview={decisaoPreview}
      />
    </div>
  );
}

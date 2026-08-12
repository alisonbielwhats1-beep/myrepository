import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hashTokenConvite, tokenTemFormatoValido } from "@/lib/convites";
import { COOKIE_CONVITE } from "@/lib/ativacao-cookie";
import { finalizarAtivacao } from "@/lib/actions/ativacao";
import AtivacaoMetodos from "@/components/auth/AtivacaoMetodos";

export const dynamic = "force-dynamic";

type PreviewConvite = {
  academia_nome: string;
  academia_slug: string;
  aluno_nome_mascarado: string;
} | null;

/**
 * Tela de escolha do método de acesso do convite. O token vem do cookie seguro
 * (gravado por /ativar/[token]) — nunca da URL. Faz o preview no servidor
 * (dados mínimos e mascarados) e:
 *   - convite inválido/expirado -> tela de erro genérica (sem revelar motivo);
 *   - visitante JÁ autenticado -> finaliza o vínculo direto (idempotente);
 *   - visitante anônimo -> mostra Google/Apple/e-mail e senha.
 */
export default async function AtivarPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const tokenBruto = cookies().get(COOKIE_CONVITE)?.value;

  if (searchParams.erro === "invalido" || !tokenBruto || !tokenTemFormatoValido(tokenBruto)) {
    return <TelaInvalida />;
  }

  const supabase = createClient();
  const hash = hashTokenConvite(tokenBruto);
  const { data } = await supabase.rpc("preview_convite_acesso", {
    p_token_hash: hash,
  });
  const preview = (data ?? null) as PreviewConvite;

  if (!preview) {
    return <TelaInvalida />;
  }

  // Já autenticado? Finaliza o vínculo agora (cobre o retorno da confirmação de
  // e-mail no mesmo navegador e o reabrir do link já conectado).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const r = await finalizarAtivacao();
    if (r.ok) return <TelaSucesso slug={r.slug} />;
    return <TelaConflito mensagem={r.erro} />;
  }

  return (
    <>
      <p className="label-muted">Ativar acesso</p>
      <h1 className="mt-1 text-xl font-bold text-white">Bem-vindo(a) ao GestAcad</h1>
      <p className="mt-1 mb-5 text-sm text-slate-400">
        Ative seu acesso à academia com o método que preferir.
      </p>
      <AtivacaoMetodos
        academiaNome={preview.academia_nome}
        alunoNomeMascarado={preview.aluno_nome_mascarado}
      />
    </>
  );
}

function TelaInvalida() {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-300">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold text-white">Convite indisponível</h1>
      <p className="text-sm text-slate-400">
        Este convite é inválido, expirou ou já foi utilizado. Peça um novo link à
        sua academia.
      </p>
      <Link href="/login" className="inline-block text-sm text-volt-300 hover:underline">
        Ir para o login
      </Link>
    </div>
  );
}

function TelaSucesso({ slug }: { slug: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-volt-500/15 text-volt-300">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold text-white">Acesso ativado!</h1>
      <p className="text-sm text-slate-400">
        Sua conta foi vinculada com segurança ao seu cadastro. Nos próximos
        acessos, entre pelo mesmo método que você escolheu.
      </p>
      {slug && (
        <Link
          href={`/aluno/${slug}`}
          className="inline-block text-sm text-volt-300 hover:underline"
        >
          Ir para a sua academia
        </Link>
      )}
    </div>
  );
}

function TelaConflito({ mensagem }: { mensagem: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-300">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold text-white">Precisa de revisão</h1>
      <p className="text-sm text-slate-400">{mensagem}</p>
      <Link href="/login" className="inline-block text-sm text-volt-300 hover:underline">
        Ir para o login
      </Link>
    </div>
  );
}

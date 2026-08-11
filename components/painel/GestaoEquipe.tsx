"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { linkWhats, mensagemConviteEquipe } from "@/lib/whats";
import { origemPublica } from "@/lib/site-url";
import { LIMITE_MEMBROS_EQUIPE } from "@/lib/permissoes";
import { PAPEIS, Papel, PerfilEquipe } from "@/lib/types";
import { cn } from "@/lib/utils";
import ConfirmButton from "@/components/ui/ConfirmButton";
import FormActions from "@/components/ui/FormActions";
import CampoSenha from "@/components/ui/CampoSenha";
import {
  alterarPapel,
  criarMembroEquipe,
  removerMembroEquipe,
} from "@/app/painel/[slug]/equipe/actions";

export default function GestaoEquipe({
  slug,
  perfis,
  meuId,
  souDono,
  academia,
  isDemo,
}: {
  slug: string;
  perfis: PerfilEquipe[];
  meuId: string;
  souDono: boolean;
  /** Nome fantasia — entra na mensagem de convite. */
  academia: string;
  /** Na academia de demonstração nada é enviado para número real. */
  isDemo: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const noLimite = perfis.length >= LIMITE_MEMBROS_EQUIPE;

  return (
    <div className="space-y-4">
      {souDono && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-400">
            {perfis.length}/{LIMITE_MEMBROS_EQUIPE} pessoas na equipe
          </p>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            disabled={!mostrarForm && noLimite}
            className={cn(mostrarForm ? "btn-ghost" : "btn-volt", "disabled:opacity-50")}
            title={noLimite && !mostrarForm ? "Limite de 5 pessoas atingido" : undefined}
          >
            <Plus className="h-4 w-4" />
            {mostrarForm ? "Fechar" : "Adicionar pessoa"}
          </button>
        </div>
      )}

      {mostrarForm && (
        <FormularioMembro slug={slug} onSalvo={() => setMostrarForm(false)} />
      )}

      <ul className="space-y-3">
        {perfis.map((p) => (
          <LinhaMembro
            key={p.id}
            slug={slug}
            perfil={p}
            euMesmo={p.id === meuId}
            souDono={souDono}
            academia={academia}
            isDemo={isDemo}
          />
        ))}
      </ul>
    </div>
  );
}

function FormularioMembro({
  slug,
  onSalvo,
}: {
  slug: string;
  onSalvo: () => void;
}) {
  const acao = criarMembroEquipe.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h3 className="flex items-center gap-2 font-semibold text-white">
        <UserPlus className="h-4 w-4 text-volt-300" /> Nova pessoa na equipe
      </h3>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Nome</span>
          <input name="nome" placeholder="Ex: Maria Silva" className="inp" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">E-mail</span>
          <input
            name="email"
            type="email"
            placeholder="maria@academia.com"
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Telefone</span>
          <input
            name="telefone"
            type="tel"
            placeholder="(11) 98765-4321"
            className="inp"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Opcional — habilita o botão de enviar o acesso por WhatsApp.
          </span>
        </label>
        {/* minLength era 6 e a Server Action exige 8: o formulário aceitava, o
            servidor recusava, e a pessoa levava a culpa por um limite que a
            própria tela dizia ser outro. */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Senha provisória</span>
          <CampoSenha
            name="senha"
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
            minLength={8}
            required
          />
          <span className="mt-1 block text-xs text-slate-500">
            A pessoa define a definitiva no primeiro acesso.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Papel</span>
          <select name="papel" defaultValue="recepcao" className="inp">
            {PAPEIS.filter((p) => p.value !== "dono").map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FormActions salvarLabel="Criar acesso" className="mt-4" />
    </form>
  );
}

/**
 * Envia à pessoa o endereço do painel e a orientação de definir a própria
 * senha. Existe porque cadastrar alguém na equipe cria o login e NÃO avisa
 * ninguém — sem e-mail, sem link, sem mensagem. Foi assim que três
 * funcionários ficaram com conta criada e sem acesso em 11/08/2026: nada
 * estava quebrado, só não havia como saberem que a conta existia.
 *
 * O convite NUNCA carrega senha. A pessoa define a dela pelo "Esqueci minha
 * senha", e é isso que mantém o log de auditoria confiável — cada ação
 * registrada pertence de fato a quem estava logado.
 *
 * Sem telefone (todo mundo cadastrado antes da migration 064), cai no botão de
 * copiar: o texto vai para a área de transferência e a dona cola onde quiser.
 */
function ConviteAcesso({
  perfil,
  academia,
  isDemo,
}: {
  perfil: PerfilEquipe;
  academia: string;
  isDemo: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const papelLabel =
    PAPEIS.find((p) => p.value === perfil.papel)?.label ?? perfil.papel;

  const texto = mensagemConviteEquipe({
    nome: perfil.nome,
    academia,
    papel: papelLabel,
    // origemPublica() prefere o domínio fixo de produção: um link de deploy
    // efêmero da Vercel morre e o convite deixaria de funcionar.
    url: `${origemPublica()}/login`,
  });

  // isDemo devolve null e a tela cai no botão de copiar: a academia de
  // demonstração nunca dispara mensagem para número real.
  const link = linkWhats(perfil.telefone, texto, { isDemo });

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        title={`Enviar o acesso para ${perfil.nome} por WhatsApp`}
        className="btn-ghost !px-3 !py-2 text-xs text-emerald-300 hover:border-emerald-400"
      >
        <MessageCircle className="h-4 w-4" />
        Enviar acesso
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      title="Copiar o convite para enviar por onde preferir"
      className="btn-ghost !px-3 !py-2 text-xs"
    >
      {copiado ? <Check className="h-4 w-4 text-volt-300" /> : <Copy className="h-4 w-4" />}
      {copiado ? "Copiado" : "Copiar convite"}
    </button>
  );
}

function LinhaMembro({
  slug,
  perfil,
  euMesmo,
  souDono,
  academia,
  isDemo,
}: {
  slug: string;
  perfil: PerfilEquipe;
  euMesmo: boolean;
  souDono: boolean;
  academia: string;
  isDemo: boolean;
}) {
  const [papel, setPapel] = useState<Papel>(perfil.papel);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (novo: Papel) => {
    setErro(null);
    setPapel(novo);
    iniciar(async () => {
      const r = await alterarPapel(slug, perfil.id, novo);
      if (r.erro) {
        setErro(r.erro);
        setPapel(perfil.papel);
      }
    });
  };

  const podeEditar = souDono && !euMesmo;

  return (
    <li className="surface flex flex-wrap items-center gap-3 rounded-2xl p-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink-700 text-slate-300">
        <UserRound className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">
          {perfil.nome}
          {euMesmo && <span className="ml-2 text-xs text-slate-500">(você)</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{perfil.email}</p>
      </div>

      {souDono && !euMesmo && (
        <ConviteAcesso perfil={perfil} academia={academia} isDemo={isDemo} />
      )}

      {podeEditar ? (
        <div className="flex items-center gap-2">
          <select
            value={papel}
            onChange={(e) => mudar(e.target.value as Papel)}
            disabled={pendente}
            className="inp !w-auto !py-2 text-sm"
          >
            {PAPEIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {pendente && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <ConfirmButton
            action={async () => {
              const r = await removerMembroEquipe(slug, perfil.id);
              if (r.erro) setErro(r.erro);
            }}
            confirmText={`Remover "${perfil.nome}" da equipe? O login dessa pessoa deixa de funcionar.`}
            label="Remover da equipe"
          />
        </div>
      ) : (
        <span
          className={cn(
            "chip",
            perfil.papel === "dono"
              ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
              : "border-ink-600 bg-ink-700/60 text-slate-300"
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          {PAPEIS.find((x) => x.value === perfil.papel)?.label}
        </span>
      )}

      {erro && <p className="w-full text-xs text-red-400">{erro}</p>}
    </li>
  );
}

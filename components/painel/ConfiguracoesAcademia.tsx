"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import {
  ExternalLink,
  Globe,
  HeartPulse,
  MessageCircle,
  Share2,
  ShieldAlert,
} from "lucide-react";
import {
  Academia,
  POLITICAS_INADIMPLENCIA,
  PoliticaInadimplencia,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import { atualizarAcademia } from "@/app/painel/[slug]/configuracoes/actions";

export default function ConfiguracoesAcademia({
  slug,
  academia,
  meuNome,
  meuEmail,
}: {
  slug: string;
  academia: Academia;
  /** Nome de exibição de quem está logado (perfis_admin.nome). */
  meuNome: string;
  /** Só para mostrar: o e-mail é a credencial de login e não é editável aqui. */
  meuEmail: string;
}) {
  const acao = atualizarAcademia.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [politica, setPolitica] = useState<PoliticaInadimplencia>(
    academia.politica_inadimplencia ?? "liberar"
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form action={formAction} className="surface space-y-4 rounded-2xl p-5">
        <h2 className="font-semibold text-white">Dados da academia</h2>

        {estado.erro && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {estado.erro}
          </p>
        )}
        {estado.ok && (
          <p className="rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-300">
            Salvo com sucesso.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da academia">
            <input
              name="nome_fantasia"
              defaultValue={academia.nome_fantasia}
              className="inp"
              required
            />
          </Field>
          <Field label="Seu nome (aparece no painel)">
            <input
              name="meu_nome"
              defaultValue={meuNome}
              className="inp"
              placeholder="Ex: Maria Silva"
            />
            <span className="mt-1 block text-xs text-slate-500">
              É o nome exibido no painel e no histórico de ações. O e-mail de
              login continua o mesmo: {meuEmail}
            </span>
          </Field>
          <Field label="Cor de destaque">
            <input
              name="cor_primaria"
              type="color"
              defaultValue={academia.cor_primaria ?? "#adff42"}
              className="inp h-[42px] p-1"
            />
          </Field>
          <Field label="Endereço">
            <input
              name="endereco"
              defaultValue={academia.endereco ?? ""}
              placeholder="Av. Paulista, 1000 - São Paulo/SP"
              className="inp"
            />
          </Field>
          <Field label="Telefone">
            <input
              name="telefone"
              defaultValue={academia.telefone ?? ""}
              placeholder="(11) 3333-4444"
              className="inp"
            />
          </Field>
          <Field label="WhatsApp (com DDI e DDD, só números)">
            <div className="relative">
              <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                name="whatsapp"
                defaultValue={academia.whatsapp ?? ""}
                placeholder="5511999999999"
                className="inp pl-9"
              />
            </div>
          </Field>
          <Field label="URL do logo (opcional)">
            <input
              name="logo_url"
              type="url"
              defaultValue={academia.logo_url ?? ""}
              placeholder="https://..."
              className="inp"
            />
          </Field>
          <Field label="Meta de faturamento mensal (R$)">
            <input
              name="meta_faturamento_mensal"
              inputMode="decimal"
              defaultValue={
                academia.meta_faturamento_mensal
                  ? String(academia.meta_faturamento_mensal)
                  : ""
              }
              placeholder="Ex: 15000"
              className="inp"
            />
          </Field>
        </div>
        <p className="-mt-1 text-xs text-slate-500">
          A meta aparece no Dashboard como barra de progresso (recebido no mês vs. meta).
        </p>

        <div className="border-t border-ink-700 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Share2 className="h-3.5 w-3.5 text-magenta-400" /> Redes sociais
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Aparecem no bloco da academia dentro da <b>Comunidade</b> do app do aluno.
            Aceita @usuário ou link completo. Deixe em branco para não exibir.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Instagram">
              <input
                name="instagram"
                defaultValue={academia.instagram ?? ""}
                placeholder="@suaacademia"
                className="inp"
              />
            </Field>
            <Field label="Site">
              <input
                name="site"
                defaultValue={academia.site ?? ""}
                placeholder="https://suaacademia.com.br"
                className="inp"
              />
            </Field>
            <Field label="Facebook">
              <input
                name="facebook"
                defaultValue={academia.facebook ?? ""}
                placeholder="@suaacademia ou link"
                className="inp"
              />
            </Field>
            <Field label="TikTok">
              <input
                name="tiktok"
                defaultValue={academia.tiktok ?? ""}
                placeholder="@suaacademia"
                className="inp"
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-ink-700 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Acesso de aluno inadimplente
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Vale para mensalidade <b>vencida</b>. Cobrança futura, paga ou cancelada
            nunca entra nessa conta. Matrícula trancada, cancelada ou inativa continua
            sendo barrada pela regra de cadastro, independente da opção abaixo.
          </p>
          <div className="mt-3 space-y-2">
            {POLITICAS_INADIMPLENCIA.map((p) => (
              <label
                key={p.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition",
                  politica === p.value
                    ? "border-volt-500/50 bg-volt-500/5"
                    : "border-ink-600 bg-ink-800/40 hover:border-ink-500"
                )}
              >
                <input
                  type="radio"
                  name="politica_inadimplencia"
                  value={p.value}
                  checked={politica === p.value}
                  onChange={() => setPolitica(p.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-volt-400"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{p.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{p.descricao}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-ink-700 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <HeartPulse className="h-3.5 w-3.5 text-magenta-400" /> Retenção — dias sem acesso
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Define quando um aluno <b>ativo</b> aparece como atenção, em risco ou
            sumido, no Dashboard e na tela de Retenção. Os valores precisam ser
            crescentes.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Atenção a partir de (dias)">
              <input
                name="dias_atencao_sem_acesso"
                type="number"
                min={1}
                max={365}
                defaultValue={academia.dias_atencao_sem_acesso ?? 7}
                className="inp"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Primeiro sinal de afastamento.
              </span>
            </Field>
            <Field label="Em risco a partir de (dias)">
              <input
                name="dias_risco_sem_acesso"
                type="number"
                min={1}
                max={365}
                defaultValue={academia.dias_risco_sem_acesso ?? 10}
                className="inp"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Vale um contato ativo da equipe.
              </span>
            </Field>
            <Field label="Sumido a partir de (dias)">
              <input
                name="dias_sumido_sem_acesso"
                type="number"
                min={1}
                max={365}
                defaultValue={academia.dias_sumido_sem_acesso ?? 14}
                className="inp"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Alimenta o card &quot;Alunos sumidos&quot; do painel.
              </span>
            </Field>
            <Field label="Tolerância do aluno novo (dias)">
              <input
                name="tolerancia_novo_aluno_dias"
                type="number"
                min={1}
                max={365}
                defaultValue={academia.tolerancia_novo_aluno_dias ?? 7}
                className="inp"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Recém-matriculado que ainda não veio não entra em risco nesse prazo.
              </span>
            </Field>
          </div>
        </div>

        <FormActions salvarLabel="Salvar dados" />
      </form>

      <div className="surface rounded-2xl p-5">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Globe className="h-4 w-4 text-volt-300" /> Mini-site público
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Sua academia já tem uma página pública com seus planos e um botão de
          WhatsApp para captar novos alunos — preencha o WhatsApp acima para
          ativar o botão.
        </p>
        <a
          href={`/aluno/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost mt-4 w-full"
        >
          Ver mini-site <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

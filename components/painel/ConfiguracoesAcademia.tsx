"use client";

import { useFormState } from "react-dom";
import { ExternalLink, Globe, MessageCircle } from "lucide-react";
import { Academia } from "@/lib/types";
import FormActions from "@/components/ui/FormActions";
import { atualizarAcademia } from "@/app/painel/[slug]/configuracoes/actions";

export default function ConfiguracoesAcademia({
  slug,
  academia,
}: {
  slug: string;
  academia: Academia;
}) {
  const acao = atualizarAcademia.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

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

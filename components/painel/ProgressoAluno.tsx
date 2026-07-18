"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import Image from "next/image";
import { LineChart, Plus, Ruler, Scale } from "lucide-react";
import { ProgressoAluno as TipoProgresso } from "@/lib/types";
import { GraficoProgressoPeso } from "@/components/painel/DashboardCharts";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ImageUpload from "@/components/ui/ImageUpload";
import {
  excluirProgresso,
  registrarProgresso,
} from "@/app/painel/[slug]/alunos/actions";

export default function ProgressoAluno({
  slug,
  alunoId,
  alunoNome,
  registros,
}: {
  slug: string;
  alunoId: string;
  alunoNome: string;
  registros: TipoProgresso[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);

  const ordenados = [...registros].sort((a, b) => a.data.localeCompare(b.data));
  const dadosPeso = ordenados
    .filter((r) => r.peso_kg != null)
    .map((r) => ({
      data: new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      peso: Number(r.peso_kg),
    }));

  const ultimo = registros[0];
  const primeiro = registros[registros.length - 1];
  const variacaoPeso =
    ultimo?.peso_kg != null && primeiro?.peso_kg != null && registros.length > 1
      ? Number(ultimo.peso_kg) - Number(primeiro.peso_kg)
      : null;

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <LineChart className="h-4 w-4 text-volt-300" /> Progresso de{" "}
          {alunoNome.split(" ")[0]}
        </h3>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className={mostrarForm ? "btn-ghost" : "btn-volt"}
        >
          <Plus className="h-4 w-4" />
          {mostrarForm ? "Fechar" : "Novo registro"}
        </button>
      </div>

      {ultimo && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
          {ultimo.peso_kg != null && (
            <span className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-volt-300" />
              {ultimo.peso_kg} kg
              {variacaoPeso != null && (
                <span
                  className={
                    variacaoPeso <= 0 ? "text-volt-300" : "text-amber-300"
                  }
                >
                  ({variacaoPeso > 0 ? "+" : ""}
                  {variacaoPeso.toFixed(1)} kg)
                </span>
              )}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 text-cyanx-400" />
            última medição em{" "}
            {new Date(ultimo.data + "T00:00:00").toLocaleDateString("pt-BR")}
          </span>
        </div>
      )}

      {mostrarForm && (
        <FormularioProgresso
          slug={slug}
          alunoId={alunoId}
          onSalvo={() => setMostrarForm(false)}
        />
      )}

      {dadosPeso.length >= 2 && (
        <div className="mt-4">
          <GraficoProgressoPeso dados={dadosPeso} />
        </div>
      )}

      {registros.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Nenhum registro de progresso ainda.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {registros.slice(0, 6).map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/40 p-3"
            >
              {r.foto_url ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink-600">
                  <Image
                    src={r.foto_url}
                    alt="Foto do progresso"
                    fill
                    sizes="40px"
                    className="media-native object-cover"
                  />
                </div>
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-700 text-slate-500">
                  <Scale className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-white">
                  {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  {r.peso_kg != null && (
                    <span className="ml-2 text-slate-300">{r.peso_kg} kg</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[
                    r.peito_cm && `peito ${r.peito_cm}cm`,
                    r.cintura_cm && `cintura ${r.cintura_cm}cm`,
                    r.braco_cm && `braço ${r.braco_cm}cm`,
                    r.coxa_cm && `coxa ${r.coxa_cm}cm`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "sem medidas"}
                </p>
              </div>
              <ConfirmButton
                action={() => excluirProgresso(slug, r.id)}
                confirmText="Excluir este registro de progresso?"
                label="Excluir registro"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormularioProgresso({
  slug,
  alunoId,
  onSalvo,
}: {
  slug: string;
  alunoId: string;
  onSalvo: () => void;
}) {
  const acao = registrarProgresso.bind(null, slug, alunoId);
  const [estado, formAction] = useFormState(acao, {});
  const [foto, setFoto] = useState("");

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="mt-4 rounded-xl border border-ink-600 bg-ink-900/40 p-4"
    >
      {estado.erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Data">
          <input name="data" type="date" defaultValue={hoje} className="inp" required />
        </Campo>
        <Campo label="Peso (kg)">
          <input name="peso_kg" type="number" step="0.1" min={0} className="inp" />
        </Campo>
        <Campo label="% Gordura">
          <input
            name="percentual_gordura"
            type="number"
            step="0.1"
            min={0}
            className="inp"
          />
        </Campo>
        <Campo label="Peito (cm)">
          <input name="peito_cm" type="number" step="0.1" min={0} className="inp" />
        </Campo>
        <Campo label="Cintura (cm)">
          <input name="cintura_cm" type="number" step="0.1" min={0} className="inp" />
        </Campo>
        <Campo label="Quadril (cm)">
          <input name="quadril_cm" type="number" step="0.1" min={0} className="inp" />
        </Campo>
        <Campo label="Braço (cm)">
          <input name="braco_cm" type="number" step="0.1" min={0} className="inp" />
        </Campo>
        <Campo label="Coxa (cm)">
          <input name="coxa_cm" type="number" step="0.1" min={0} className="inp" />
        </Campo>
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Foto (opcional)
        </span>
        <input type="hidden" name="foto_url" value={foto} />
        <ImageUpload
          value={foto}
          onChange={setFoto}
          aspect="aspect-[4/3]"
          hint="Foto de progresso"
        />
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Observações (nota interna, não aparece para o aluno)
        </span>
        <textarea name="observacoes" rows={2} className="inp" />
      </label>

      <FormActions salvarLabel="Salvar registro" className="mt-3" />
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

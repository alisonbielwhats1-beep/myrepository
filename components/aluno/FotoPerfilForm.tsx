"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import AvatarAluno from "./AvatarAluno";

type EstadoFoto = { erro?: string; ok?: boolean; savedAt?: number };

export default function FotoPerfilForm({
  nome,
  fotoAtual,
  atualizar,
}: {
  nome: string;
  fotoAtual: string | null;
  atualizar: (
    estado: EstadoFoto,
    formData: FormData
  ) => Promise<EstadoFoto>;
}) {
  const [estado, formAction] = useFormState(atualizar, {});
  const [aberto, setAberto] = useState(false);
  const [preview, setPreview] = useState(fotoAtual);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-ghost w-full"
      >
        <ImagePlus className="h-4 w-4" /> Alterar foto de perfil
      </button>
    );
  }

  return (
    <form action={formAction} className="surface space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <AvatarAluno nome={nome} fotoUrl={preview} size={56} />
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Link da foto (https://)
          </span>
          <input
            type="url"
            name="foto_perfil_url"
            placeholder="https://exemplo.com/minha-foto.jpg"
            defaultValue={fotoAtual ?? ""}
            onChange={(e) => setPreview(e.target.value.trim() || null)}
            className="inp"
          />
        </label>
      </div>

      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="flex items-center gap-1.5 rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Foto atualizada.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="btn-ghost flex-1"
        >
          Cancelar
        </button>
        <BotaoSalvar />
      </div>
    </form>
  );
}

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt flex-1">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      Salvar
    </button>
  );
}

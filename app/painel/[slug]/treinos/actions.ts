"use server";

import {
  GRUPOS_MUSCULARES,
  type EstadoAcao,
  type GrupoMuscular,
} from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import {
  lerExerciciosDoFormulario,
  montarLinhasExercicio,
} from "@/lib/exercicios-treino";
import {
  enviarMidiaExercicio,
  validarArquivoMidiaExercicio,
} from "@/lib/midia-exercicios";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros-servidor";

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cria um treino da biblioteca (modelo, sem aluno), com seus exercícios. */
export async function criarTreinoBiblioteca(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (!nomeTreino) return { erro: "Informe o nome do treino." };

  const lidos = lerExerciciosDoFormulario(formData.get("exercicios_json"));
  if ("erro" in lidos) return lidos;
  const exercicios = lidos.exercicios;

  // Visibilidade: novo treino nasce privado do instrutor por padrão. Só
  // 'academia' e 'instrutor' são escolhíveis aqui; 'plataforma' é do GestAcad.
  const visibilidade =
    String(formData.get("visibilidade") ?? "") === "academia"
      ? "academia"
      : "instrutor";

  const { count } = await supabase
    .from("treinos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null);

  const { data: treino, error: erroTreino } = await supabase
    .from("treinos")
    .insert({
      academia_id: sessao.academia.id,
      aluno_id: null,
      nome_treino: nomeTreino,
      objetivo: String(formData.get("objetivo") ?? "").trim() || null,
      modalidade: String(formData.get("modalidade") ?? "").trim() || null,
      nivel: String(formData.get("nivel") ?? "").trim() || null,
      publico_alvo: String(formData.get("publico_alvo") ?? "").trim() || null,
      criado_por: sessao.userId,
      profissional_nome: sessao.nome,
      origem: "manual",
      visibilidade,
      ordem: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (erroTreino || !treino) {
    return { erro: await erroAmigavel(erroTreino, "criar o treino") };
  }

  const { error: erroExercicios } = await supabase
    .from("exercicios_treino")
    .insert(montarLinhasExercicio(treino.id, exercicios));

  if (erroExercicios) {
    await supabase.from("treinos").delete().eq("id", treino.id);
    return { erro: await erroAmigavel(erroExercicios, "salvar os exercícios") };
  }

  revalidatePath(`/painel/${slug}/treinos`);
  return { ok: true, savedAt: Date.now() };
}

/** Salva um exercício reutilizável somente no catálogo da academia da sessão. */
export async function criarExercicioCatalogo(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const grupo = String(formData.get("grupo_muscular") ?? "") as GrupoMuscular;
  const gruposValidos = new Set(GRUPOS_MUSCULARES.map((item) => item.value));

  if (!nome) return { erro: "Informe o nome do exercício." };
  if (!gruposValidos.has(grupo)) {
    return { erro: "Selecione um grupo muscular válido." };
  }

  const series = Math.max(
    1,
    Math.min(20, Number(formData.get("series_padrao")) || 3)
  );
  const repeticoes =
    String(formData.get("repeticoes_padrao") ?? "12").trim() || "12";

  const { error } = await supabase.from("catalogo_exercicios").insert({
    academia_id: sessao.academia.id,
    criado_por: sessao.userId,
    visibilidade: "academia",
    grupo_muscular: grupo,
    nome,
    series_padrao: series,
    repeticoes_padrao: repeticoes,
    aliases: [],
    metadados: { profissional: sessao.nome, origem: "manual" },
  });

  if (error) {
    const duplicado = error.code === "23505";
    return {
      erro: duplicado
        ? "Esse exercício já existe no catálogo da academia."
        : await erroAmigavel(error, "salvar o exercício no catálogo"),
    };
  }

  revalidatePath(`/painel/${slug}/treinos`);
  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Cria uma ficha independente para o aluno a partir de um modelo da biblioteca.
 * A cópia atômica e as verificações de tenant/papel acontecem na RPC 067.
 */
export async function atribuirTreinoBiblioteca(
  slug: string,
  treinoModeloId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "treinos");
  if (sessao.papel === "recepcao") {
    return { erro: "Seu perfil não pode atribuir treinos." };
  }

  const alunoId = String(formData.get("aluno_id") ?? "").trim();
  if (!FORMATO_UUID.test(treinoModeloId) || !FORMATO_UUID.test(alunoId)) {
    return { erro: "Selecione um aluno válido." };
  }

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (nomeTreino.length > 120) {
    return { erro: "O nome do treino deve ter no máximo 120 caracteres." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("atribuir_modelo_treino", {
    p_treino_modelo_id: treinoModeloId,
    p_aluno_id: alunoId,
    p_nome_treino: nomeTreino || null,
  });

  if (error || !data) {
    return {
      erro: await erroAmigavel(error, "atribuir o treino ao aluno"),
    };
  }

  revalidatePath(`/painel/${slug}/treinos`);
  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now(), id: String(data) };
}

/**
 * Upload do clipe de demonstração (vídeo curto ou GIF) de um exercício.
 * Chamada diretamente pelo client (components/ui/VideoUpload.tsx) enquanto o
 * professor monta o treino — antes de o formulário do treino em si ser
 * enviado, por isso não recebe `treinoId`: o resultado é só a URL pública,
 * guardada no estado do ExercicioBuilder até o treino ser salvo.
 */
export async function enviarClipeExercicio(
  slug: string,
  formData: FormData
): Promise<{ url: string } | { erro: string }> {
  const sessao = await requireSecao(slug, "treinos");

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return { erro: "Selecione um vídeo ou GIF." };
  }
  const validacao = validarArquivoMidiaExercicio(arquivo);
  if ("erro" in validacao) return validacao;

  return enviarMidiaExercicio(sessao.academia.id, arquivo, validacao.extensao);
}

export async function excluirTreinoBiblioteca(
  slug: string,
  treinoId: string
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .delete()
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: await erroAmigavel(error, "excluir o treino") };
  revalidatePath(`/painel/${slug}/treinos`);
}

/**
 * Alterna a visibilidade de um treino-modelo entre 'instrutor' (privado) e
 * 'academia' (compartilhado com a equipe). O RLS (migration 068) garante que
 * só o dono do treino ou dono/gerente consigam efetivar a mudança.
 */
export async function definirVisibilidadeTreino(
  slug: string,
  treinoId: string,
  visibilidade: "academia" | "instrutor"
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "treinos");
  if (sessao.papel === "recepcao") {
    return { erro: "Seu perfil não pode alterar treinos." };
  }
  if (!FORMATO_UUID.test(treinoId)) {
    return { erro: "Treino inválido." };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .update({ visibilidade })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null);
  if (error) {
    return { erro: await erroAmigavel(error, "alterar a visibilidade do treino") };
  }
  revalidatePath(`/painel/${slug}/treinos`);
}

/** Liga/desliga o compartilhamento público (QR) de um treino. */
export async function definirPublicoTreino(
  slug: string,
  treinoId: string,
  publico: boolean
): Promise<void> {
  const sessao = await requireSecao(slug, "treinos");
  const supabase = createClient();
  const { error } = await supabase
    .from("treinos")
    .update({ publico })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id);
  if (error) throw new Error(await erroAmigavel(error, "atualizar treino"));
  revalidatePath(`/painel/${slug}/treinos`);
}

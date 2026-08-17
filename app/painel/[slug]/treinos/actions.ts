"use server";

import {
  GRUPOS_MUSCULARES,
  type EstadoAcao,
  type GrupoMuscular,
} from "@/lib/types";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { podeGerenciarTreinos } from "@/lib/permissoes";
import {
  lerExerciciosDoFormulario,
  montarLinhasExercicio,
} from "@/lib/exercicios-treino";
import {
  analisarLinhasTreino,
  linhasDoArquivo,
} from "@/lib/importar-treinos";
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

  // Visibilidade (migration 077): privado (padrão) / equipe / academia. A
  // origem é sempre 'instrutor' (autoria) — mudar quem vê não muda a autoria.
  const visRaw = String(formData.get("visibilidade") ?? "");
  const visibilidade =
    visRaw === "academia" ? "academia" : visRaw === "equipe" ? "equipe" : "privado";
  const origemTipo = "instrutor";

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
      origem_tipo: origemTipo,
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
  if (!podeGerenciarTreinos(sessao.papel)) {
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

  // Notifica o aluno no app dele. Secundário: se falhar, a atribuição já valeu
  // (não derruba o fluxo). O aluno vê o aviso ao abrir a área dele.
  await supabase.from("notificacoes_aluno").insert({
    academia_id: sessao.academia.id,
    aluno_id: alunoId,
    tipo: "treino",
    titulo: "Novo treino liberado 🎉",
    mensagem: `${sessao.nome} preparou o treino "${
      nomeTreino || "novo"
    }" para você. Toque para ver os exercícios com a demonstração.`,
    link: "treinos",
  });

  revalidatePath(`/painel/${slug}/treinos`);
  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true, savedAt: Date.now(), id: String(data) };
}

/**
 * Remove uma atribuição: apaga a CÓPIA do treino na ficha do aluno. O modelo
 * original (biblioteca) não é tocado. Usado na lista "já atribuído a" para o
 * professor/dono desfazer uma atribuição.
 */
export async function removerAtribuicaoTreino(
  slug: string,
  treinoAtribuidoId: string
): Promise<{ erro: string } | { ok: true }> {
  const sessao = await requireSecao(slug, "treinos");
  if (!podeGerenciarTreinos(sessao.papel)) {
    return { erro: "Seu perfil não pode remover treinos." };
  }
  if (!FORMATO_UUID.test(treinoAtribuidoId)) {
    return { erro: "Atribuição inválida." };
  }
  const supabase = createClient();
  // Só apaga se for de fato uma cópia atribuída (modelo_origem_id não nulo) e
  // da própria academia — nunca um modelo da biblioteca.
  const { error } = await supabase
    .from("treinos")
    .delete()
    .eq("id", treinoAtribuidoId)
    .eq("academia_id", sessao.academia.id)
    .not("aluno_id", "is", null)
    .not("modelo_origem_id", "is", null);
  if (error) {
    return { erro: await erroAmigavel(error, "remover a atribuição") };
  }
  revalidatePath(`/painel/${slug}/treinos`);
  revalidatePath(`/painel/${slug}/alunos`);
  return { ok: true };
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
 * Define a visibilidade de um treino-modelo entre os três níveis (migration
 * 077): 'privado' (só o criador), 'equipe' (equipe técnica) ou 'academia'
 * (todo o tenant). O RLS (068/077) garante que só o dono do treino ou
 * dono/gerente consigam efetivar a mudança.
 */
export async function definirVisibilidadeTreino(
  slug: string,
  treinoId: string,
  visibilidade: "privado" | "equipe" | "academia"
): Promise<{ erro: string } | void> {
  const sessao = await requireSecao(slug, "treinos");
  if (!podeGerenciarTreinos(sessao.papel)) {
    return { erro: "Seu perfil não pode alterar treinos." };
  }
  if (!FORMATO_UUID.test(treinoId)) {
    return { erro: "Treino inválido." };
  }
  if (!["privado", "equipe", "academia"].includes(visibilidade)) {
    return { erro: "Visibilidade inválida." };
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

/**
 * Liga/desliga o compartilhamento público (QR) de um TREINO-MODELO da academia.
 *
 * Restrições de segurança (defesa em profundidade além do RLS):
 *   • recepção não publica treinos (mesma regra de atribuir/visibilidade);
 *   • só treino-modelo (aluno_id IS NULL): a ficha individual de um aluno NUNCA
 *     é exposta num link sem login — o nome da ficha costuma conter o nome do
 *     aluno, e a UI só oferece o QR para modelos da biblioteca;
 *   • `.eq(academia_id)` já barra o modelo de plataforma (academia_id NULL).
 * Devolve { erro } em vez de lançar, para o cliente reverter o toggle sem
 * deixar a UI dessincronizada do banco (nada de estado público silencioso).
 */
export async function definirPublicoTreino(
  slug: string,
  treinoId: string,
  publico: boolean
): Promise<{ erro: string } | { ok: true }> {
  const sessao = await requireSecao(slug, "treinos");
  if (!podeGerenciarTreinos(sessao.papel)) {
    return { erro: "Seu perfil não pode compartilhar treinos." };
  }
  if (!FORMATO_UUID.test(treinoId)) {
    return { erro: "Treino inválido." };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos")
    .update({ publico })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null)
    .select("id");
  if (error) return { erro: await erroAmigavel(error, "atualizar treino") };
  if (!data || data.length === 0) {
    return { erro: "Treino não encontrado ou não pode ser compartilhado." };
  }
  revalidatePath(`/painel/${slug}/treinos`);
  return { ok: true };
}

/**
 * Edita um TREINO-MODELO da biblioteca (nome, objetivo, modalidade, nível,
 * público-alvo e a lista inteira de exercícios). Só modelos da própria
 * academia — nunca fichas de aluno (aluno_id != null) e nunca o modelo padrão
 * da plataforma (academia_id null), que deve permanecer intacto.
 *
 * O `share_token` é preservado (o UPDATE não o toca), então o QR/link público
 * já divulgado continua válido. Editar um modelo NÃO altera fichas já
 * atribuídas — elas são cópias independentes (comportamento de snapshot).
 *
 * A permissão fina (autor OU dono/gerente) é garantida pelo RLS (068): se o
 * usuário não puder editar, o UPDATE não afeta nenhuma linha e devolvemos erro
 * em vez de um "ok" silencioso.
 */
export async function editarTreinoBiblioteca(
  slug: string,
  treinoId: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "treinos");
  if (!podeGerenciarTreinos(sessao.papel)) {
    return { erro: "Seu perfil não pode editar treinos." };
  }
  if (!FORMATO_UUID.test(treinoId)) return { erro: "Treino inválido." };

  const nomeTreino = String(formData.get("nome_treino") ?? "").trim();
  if (!nomeTreino) return { erro: "Informe o nome do treino." };

  const lidos = lerExerciciosDoFormulario(formData.get("exercicios_json"));
  if ("erro" in lidos) return lidos;

  const supabase = createClient();
  const { data: atualizado, error: erroTreino } = await supabase
    .from("treinos")
    .update({
      nome_treino: nomeTreino,
      objetivo: String(formData.get("objetivo") ?? "").trim() || null,
      modalidade: String(formData.get("modalidade") ?? "").trim() || null,
      nivel: String(formData.get("nivel") ?? "").trim() || null,
      publico_alvo: String(formData.get("publico_alvo") ?? "").trim() || null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", treinoId)
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null)
    .select("id");

  if (erroTreino) {
    return { erro: await erroAmigavel(erroTreino, "atualizar o treino") };
  }
  if (!atualizado || atualizado.length === 0) {
    return { erro: "Treino não encontrado ou sem permissão para editar." };
  }

  // Substitui os exercícios (delete + insert). Guarda os antigos para restaurar
  // se o insert novo falhar — sem transação no cliente, é o que evita ficha vazia.
  const { data: anteriores } = await supabase
    .from("exercicios_treino")
    .select(
      "nome_exercicio, series, repeticoes, carga_kg, descanso_segundos, observacoes, imagem_demonstracao_url, video_demonstracao_url, ordem"
    )
    .eq("treino_id", treinoId)
    .order("ordem", { ascending: true });

  const { error: erroRemocao } = await supabase
    .from("exercicios_treino")
    .delete()
    .eq("treino_id", treinoId);
  if (erroRemocao) {
    return { erro: await erroAmigavel(erroRemocao, "atualizar os exercícios") };
  }

  const { error: erroInsercao } = await supabase
    .from("exercicios_treino")
    .insert(montarLinhasExercicio(treinoId, lidos.exercicios));
  if (erroInsercao) {
    if (anteriores && anteriores.length > 0) {
      await supabase
        .from("exercicios_treino")
        .insert(anteriores.map((a) => ({ ...a, treino_id: treinoId })));
    }
    return { erro: await erroAmigavel(erroInsercao, "salvar os exercícios") };
  }

  revalidatePath(`/painel/${slug}/treinos`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Duplica um treino-modelo criando uma CÓPIA independente na biblioteca da
 * academia da sessão. Serve tanto para clonar um modelo próprio quanto para
 * PERSONALIZAR um modelo padrão da plataforma (GestAcad): a cópia nasce na
 * academia e o original nunca é tocado.
 *
 * A cópia nasce como modelo do instrutor (origem_tipo='instrutor'), PRIVADA e
 * com link público desligado — o dono decide depois se compartilha. Ganha um
 * `share_token` próprio (default do banco). Os exercícios são copiados junto.
 */
export async function duplicarTreino(
  slug: string,
  treinoId: string
): Promise<{ erro: string } | { ok: true; id: string }> {
  const sessao = await requireSecao(slug, "treinos");
  if (!podeGerenciarTreinos(sessao.papel)) {
    return { erro: "Seu perfil não pode duplicar treinos." };
  }
  if (!FORMATO_UUID.test(treinoId)) return { erro: "Treino inválido." };

  const supabase = createClient();
  // Lê o modelo de origem. O RLS deixa ver os modelos da própria academia
  // (respeitando a visibilidade) e os de plataforma — exatamente o conjunto
  // duplicável. Ficha de aluno (aluno_id != null) nunca é duplicável aqui.
  const { data: origem, error: erroLeitura } = await supabase
    .from("treinos")
    .select(
      "nome_treino, objetivo, modalidade, nivel, publico_alvo, exercicios:exercicios_treino(nome_exercicio, series, repeticoes, carga_kg, descanso_segundos, observacoes, imagem_demonstracao_url, video_demonstracao_url, ordem)"
    )
    .eq("id", treinoId)
    .is("aluno_id", null)
    .maybeSingle();

  if (erroLeitura) {
    return { erro: await erroAmigavel(erroLeitura, "duplicar o treino") };
  }
  if (!origem) return { erro: "Treino não encontrado." };

  const { count } = await supabase
    .from("treinos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null);

  const nomeCopia = `${origem.nome_treino} (cópia)`.slice(0, 120);
  const { data: novo, error: erroInsert } = await supabase
    .from("treinos")
    .insert({
      academia_id: sessao.academia.id,
      aluno_id: null,
      nome_treino: nomeCopia,
      objetivo: origem.objetivo,
      modalidade: origem.modalidade,
      nivel: origem.nivel,
      publico_alvo: origem.publico_alvo,
      criado_por: sessao.userId,
      profissional_nome: sessao.nome,
      origem: "manual",
      origem_tipo: "instrutor",
      visibilidade: "privado",
      publico: false,
      ordem: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (erroInsert || !novo) {
    return { erro: await erroAmigavel(erroInsert, "duplicar o treino") };
  }

  type LinhaOrigem = {
    nome_exercicio: string;
    series: number;
    repeticoes: string;
    carga_kg: number | null;
    descanso_segundos: number | null;
    observacoes: string | null;
    imagem_demonstracao_url: string | null;
    video_demonstracao_url: string | null;
    ordem: number;
  };
  const exercicios = ((origem.exercicios ?? []) as LinhaOrigem[])
    .slice()
    .sort((a, b) => a.ordem - b.ordem);

  if (exercicios.length > 0) {
    const linhas = exercicios.map((ex, i) => ({
      treino_id: novo.id,
      nome_exercicio: ex.nome_exercicio,
      series: ex.series,
      repeticoes: ex.repeticoes,
      carga_kg: ex.carga_kg,
      descanso_segundos: ex.descanso_segundos,
      observacoes: ex.observacoes,
      imagem_demonstracao_url: ex.imagem_demonstracao_url,
      video_demonstracao_url: ex.video_demonstracao_url,
      ordem: i + 1,
    }));
    const { error: erroEx } = await supabase
      .from("exercicios_treino")
      .insert(linhas);
    if (erroEx) {
      // Desfaz a cópia para não deixar modelo vazio.
      await supabase.from("treinos").delete().eq("id", novo.id);
      return { erro: await erroAmigavel(erroEx, "copiar os exercícios") };
    }
  }

  revalidatePath(`/painel/${slug}/treinos`);
  return { ok: true, id: novo.id };
}

/** Resultado da importação de treinos por planilha (para a UI). */
export type ResultadoImportacaoTreino = {
  erro?: string;
  criados?: number;
  errosLinha?: { linha: number; motivo: string }[];
  avisos?: { linha: number; motivo: string }[];
  savedAt?: number;
};

/**
 * Importa treinos-modelo em massa de uma planilha (.xlsx/.csv): uma linha por
 * exercício, agrupada por nome de treino. Cada treino nasce PRIVADO do
 * importador (origem_tipo='instrutor') — o dono compartilha depois. Reusa a
 * mesma leitura/validação da pré-visualização (lib/importar-treinos) e o mesmo
 * montador de exercícios do formulário manual.
 */
export async function importarTreinosBiblioteca(
  slug: string,
  _estado: ResultadoImportacaoTreino,
  formData: FormData
): Promise<ResultadoImportacaoTreino> {
  const sessao = await requireSecao(slug, "treinos");
  if (!podeGerenciarTreinos(sessao.papel)) {
    return { erro: "Seu perfil não pode importar treinos." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo Excel (.xlsx) ou CSV." };
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    return { erro: "Arquivo muito grande — máximo 5 MB." };
  }

  let grade: string[][];
  try {
    grade = await linhasDoArquivo(arquivo);
  } catch {
    return { erro: "Não consegui ler o arquivo. Use o modelo em Excel (.xlsx) ou um CSV." };
  }

  const analise = analisarLinhasTreino(grade);
  if (analise.treinos.length === 0) {
    return {
      erro: analise.erros[0]?.motivo ?? "Nenhum treino válido na planilha.",
      errosLinha: analise.erros,
      avisos: analise.avisos,
    };
  }

  const supabase = createClient();
  const { count } = await supabase
    .from("treinos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id)
    .is("aluno_id", null);
  let ordem = count ?? 0;

  let criados = 0;
  const errosLinha = [...analise.erros];

  for (const t of analise.treinos) {
    ordem += 1;
    const { data: treino, error } = await supabase
      .from("treinos")
      .insert({
        academia_id: sessao.academia.id,
        aluno_id: null,
        nome_treino: t.nome_treino,
        objetivo: t.objetivo,
        modalidade: t.modalidade,
        nivel: t.nivel,
        publico_alvo: t.publico_alvo,
        criado_por: sessao.userId,
        profissional_nome: sessao.nome,
        origem: "importacao",
        origem_tipo: "instrutor",
        visibilidade: "privado",
        ordem,
      })
      .select("id")
      .single();

    if (error || !treino) {
      errosLinha.push({
        linha: t.linha,
        motivo: await erroAmigavel(error, `importar o treino "${t.nome_treino}"`),
      });
      continue;
    }

    const linhas = montarLinhasExercicio(
      treino.id,
      t.exercicios.map((e) => ({
        nome_exercicio: e.nome_exercicio,
        series: e.series,
        repeticoes: e.repeticoes,
        carga_kg: e.carga_kg,
        descanso_segundos: e.descanso_segundos ?? 0,
        observacoes: e.observacoes ?? "",
        imagem_demonstracao_url: "",
        video_demonstracao_url: "",
      }))
    );
    const { error: erroEx } = await supabase.from("exercicios_treino").insert(linhas);
    if (erroEx) {
      // Desfaz o treino para não deixar modelo vazio.
      await supabase.from("treinos").delete().eq("id", treino.id);
      errosLinha.push({
        linha: t.linha,
        motivo: await erroAmigavel(erroEx, `salvar os exercícios de "${t.nome_treino}"`),
      });
      continue;
    }
    criados += 1;
  }

  if (criados > 0) revalidatePath(`/painel/${slug}/treinos`);
  return { criados, errosLinha, avisos: analise.avisos, savedAt: Date.now() };
}

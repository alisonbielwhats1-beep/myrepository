import { NextRequest, NextResponse } from "next/server";
import type { DecisaoAcesso, StatusMatricula } from "@/lib/types";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { decidirAcesso, statusLiberacaoDe } from "@/lib/utils";

function normalizarCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/** Código de cartão / matrícula: apenas trim, preservando zeros à esquerda. */
function normalizarCodigo(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function primeiraString(
  body: Record<string, unknown>,
  chaves: string[]
): string | null {
  for (const k of chaves) {
    const v = body[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

/**
 * Webhook da CATRACA FÍSICA (torniquete Henry + leitor Control iD linha EVO).
 *
 * Decisão em tempo real: a cada identificação (rosto ou cartão), o equipamento
 * — ou o middleware do integrador — chama esta rota. O app decide LIBERAR ou
 * BLOQUEAR usando a MESMA regra central `decidirAcesso` da recepção (status da
 * matrícula + política de inadimplência da academia) e registra a passagem em
 * `acessos_catraca` com origem 'Catraca'. Nenhuma regra de acesso paralela.
 *
 * Autenticação: header  Authorization: Bearer <catraca_webhook_secret>
 *
 * Corpo (JSON) — aceita cartão/matrícula OU CPF (o que o leitor enviar):
 * {
 *   "matricula": "0231",          // código do cartão / matrícula (recomendado)
 *   "cpf": "00000000000",         // alternativa ao cartão
 *   "evento_id": "abc-123"        // opcional: idempotência / anti-duplicidade
 * }
 * Também são aceitos, como sinônimos: cartao/card/codigo/matricula_codigo (cartão);
 * documento/user_cpf (CPF); event_id/checkin_id/access_id/log_id (evento).
 *
 * Resposta (o integrador mapeia para o comando de abertura do equipamento):
 * {
 *   "ok": true,
 *   "liberado": true,                 // abrir a catraca? (alerta também libera)
 *   "status": "liberado",             // liberado | alerta | negado
 *   "aluno": { "id": "...", "nome": "..." } | null,
 *   "motivo": "..." | null
 * }
 *
 * A URL cadastrada no equipamento/integrador (Exacta Cards):
 *   https://gestacad.com.br/api/webhook/catraca/<slug-da-academia>
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = createServiceRoleClient();

  // 1. Buscar academia pelo slug
  const { data: academia } = await supabase
    .from("academias")
    .select("id, catraca_webhook_secret, politica_inadimplencia")
    .eq("slug_url", params.slug)
    .maybeSingle();

  if (!academia) {
    return NextResponse.json({ erro: "Academia não encontrada." }, { status: 404 });
  }

  // 2. Validar segredo via Bearer token (string vazia = inseguro, rejeita)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!academia.catraca_webhook_secret || token !== academia.catraca_webhook_secret) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  // 3. Parsear corpo
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  // 4. Extrair identificadores. A catraca física costuma mandar o código do
  //    cartão/matrícula; alguns cadastros usam CPF. Aceitamos os dois e
  //    tentamos casar primeiro por matrícula, depois por CPF.
  const codigo = normalizarCodigo(
    primeiraString(body, ["matricula", "matricula_codigo", "cartao", "card", "codigo", "cartao_codigo"])
  );
  const cpf = normalizarCpf(
    primeiraString(body, ["cpf", "documento", "user_cpf", "document"])
  );

  // 4b. Id do evento (idempotência / anti-replay). Evitamos a chave `id` crua,
  //     que em leitores faciais costuma ser o id do usuário, não do evento.
  const eventoId = primeiraString(body, [
    "evento_id",
    "event_id",
    "checkin_id",
    "check_in_id",
    "access_id",
    "log_id",
  ]);

  if (!codigo && !cpf) {
    return NextResponse.json(
      { erro: "Informe 'matricula' (cartão) ou 'cpf' no corpo." },
      { status: 400 }
    );
  }

  // 5. Localizar o aluno pelo identificador recebido
  let aluno: { id: string; nome: string; status_matricula: StatusMatricula } | null = null;

  if (codigo) {
    const { data } = await supabase
      .from("alunos")
      .select("id, nome, status_matricula")
      .eq("academia_id", academia.id)
      .eq("matricula_codigo", codigo)
      .limit(1);
    aluno = data?.[0] ?? null;
  }
  if (!aluno && cpf) {
    const { data } = await supabase
      .from("alunos")
      .select("id, nome, status_matricula")
      .eq("academia_id", academia.id)
      .eq("cpf", cpf)
      .maybeSingle();
    aluno = data ?? null;
  }

  // 6. Decidir o acesso — mesma regra central da recepção
  let alunoId: string | null = null;
  let observacao: string | null = null;
  let decisao: DecisaoAcesso | null = null;

  if (aluno) {
    alunoId = aluno.id;

    const { data: mensalidades } = await supabase
      .from("receitas")
      .select("id, competencia, data, valor, status")
      .eq("academia_id", academia.id)
      .eq("aluno_id", aluno.id)
      .eq("tipo", "mensalidade")
      .eq("status", "pendente");

    decisao = decidirAcesso(
      aluno.status_matricula,
      academia.politica_inadimplencia ?? "liberar",
      mensalidades ?? []
    );
    observacao = decisao.motivo;
  } else {
    // Identificador desconhecido numa catraca física: por segurança, NÃO libera
    // — só a recepção pode registrar quem não está no cadastro.
    observacao = codigo
      ? `Cartão/matrícula não encontrado no cadastro (${codigo})`
      : "CPF não encontrado no cadastro";
  }

  // "alerta" (mensalidade vencida, mas política manda liberar) abre a catraca;
  // só "bloqueado" — e o identificador desconhecido — barram a passagem.
  const liberado = decisao ? decisao.resultado !== "bloqueado" : false;
  const status = decisao ? statusLiberacaoDe(decisao.resultado) : "negado";

  // 7. Registrar a passagem. Catraca própria não tem repasse de parceiro → 0.
  const { error } = await supabase.from("acessos_catraca").insert({
    academia_id: academia.id,
    aluno_id: alunoId,
    origem: "Catraca",
    valor_repasse: 0,
    status_liberacao: status,
    evento_externo_id: eventoId,
    observacao,
    politica_aplicada: decisao?.politicaAplicada ?? null,
    mensalidade_id: decisao?.mensalidadeId ?? null,
    dias_atraso: decisao?.diasAtraso ?? null,
  });

  if (error) {
    // 23505 = reenvio do mesmo evento. Idempotente: não duplica o registro, mas
    // ainda devolve a decisão para o equipamento agir na passagem atual.
    if (error.code === "23505") {
      return NextResponse.json(
        {
          ok: true,
          duplicado: true,
          liberado,
          status,
          aluno: aluno ? { id: aluno.id, nome: aluno.nome } : null,
          motivo: observacao,
        },
        { status: 200 }
      );
    }
    console.error("[webhook/catraca] erro ao inserir acesso:", error.message);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      liberado,
      status,
      aluno: aluno ? { id: aluno.id, nome: aluno.nome } : null,
      motivo: observacao,
    },
    { status: 200 }
  );
}

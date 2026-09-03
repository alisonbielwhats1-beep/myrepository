"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Camera,
  Check,
  HeartPulse,
  ImagePlus,
  Loader2,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  Aluno,
  FORMAS_PAGAMENTO,
  ORIGENS_ACESSO_ALUNO,
  OrigemAcessoAluno,
  Plano,
} from "@/lib/types";
import {
  calcularIdade,
  cn,
  diaDoMesSaoPaulo,
  formatBRL,
  formatDataISO,
  hojeSaoPaulo,
  origemExigePlanoDaAcademia,
  rotuloRecorrencia,
} from "@/lib/utils";
import { prepararFotoParaEnvio } from "@/lib/imagem-cliente";
import CapturaWebcam from "@/components/ui/CapturaWebcam";
import FormActions from "@/components/ui/FormActions";
import {
  atualizarAluno,
  atualizarFotoAlunoAdmin,
  criarAluno,
} from "@/app/painel/[slug]/alunos/actions";
import {
  rotuloDiaVencimento,
  DIA_VENCIMENTO_MIN,
  DIA_VENCIMENTO_MAX,
} from "@/lib/vencimento";
import Field from "./Field";

// ---------------------------------------------------------------------------
// Formulário de cadastro/edição de aluno
// ---------------------------------------------------------------------------
export default function FormularioAluno({
  slug,
  planos,
  alunoExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  planos: Plano[];
  alunoExistente?: Aluno;
  onCancelar?: () => void;
  onSalvo: (id: string) => void;
}) {
  const router = useRouter();
  const acao = alunoExistente
    ? atualizarAluno.bind(null, slug, alunoExistente.id)
    : criarAluno.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  // Uma chave por abertura do formulário de cadastro — evita duplo
  // clique/reenvio criar dois alunos quando não há CPF (edição não precisa:
  // é sempre a mesma linha, por id).
  const [chaveIdempotencia] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // ORIGEM DO ACESSO (migration 096) — de onde vem o direito de entrar. É um
  // eixo separado da periodicidade: só "Plano da academia" tem mensal,
  // trimestral, semestral. Antes as duas coisas dividiam o mesmo select, e a
  // academia precisava criar um plano-fantasma "Wellhub" para o aluno de
  // parceiro não ficar preso em "pendente".
  const [origemAcesso, setOrigemAcesso] = useState<OrigemAcessoAluno>(
    alunoExistente?.origem_acesso ?? "plano_academia"
  );
  const [parceiroExterno, setParceiroExterno] = useState(
    alunoExistente?.parceiro_externo ?? ""
  );
  const exigePlano = origemExigePlanoDaAcademia(origemAcesso);
  const ajudaOrigem =
    ORIGENS_ACESSO_ALUNO.find((o) => o.value === origemAcesso)?.ajuda ?? "";

  // Controle do plano selecionado (para exibir info de ciclo e pagamento).
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState(
    alunoExistente?.plano_id ?? ""
  );
  const planoSelecionado = planos.find((p) => p.id === planoSelecionadoId) ?? null;
  const exibirPagamento =
    !alunoExistente &&
    exigePlano &&
    !!planoSelecionado &&
    planoSelecionado.cobranca_recorrente &&
    planoSelecionado.valor_mensal > 0;

  // Aluno de parceiro que ainda carrega o plano-fantasma criado antes desta
  // mudança. O vínculo é PRESERVADO por padrão (a migração não apagou nada) e
  // só sai daqui se o dono marcar a caixa de desvincular — decisão dele.
  const [desvincularPlano, setDesvincularPlano] = useState(false);
  const planoLegado =
    !exigePlano && alunoExistente?.plano_id
      ? planos.find((p) => p.id === alunoExistente.plano_id) ?? null
      : null;

  // Data de nascimento controlada só para derivar a idade ao vivo — o valor
  // vai pro servidor pelo próprio `name="data_nascimento"` do input.
  const [dataNascimento, setDataNascimento] = useState(
    alunoExistente?.data_nascimento?.slice(0, 10) ?? ""
  );
  const idade = calcularIdade(dataNascimento);

  const [pagamentoInicial, setPagamentoInicial] = useState<"a_pagar" | "pago_agora">("a_pagar");
  const [diaVencimento, setDiaVencimento] = useState(
    alunoExistente?.dia_vencimento ?? diaDoMesSaoPaulo()
  );
  const hoje = hojeSaoPaulo();
  const [dataPagamento, setDataPagamento] = useState(hoje);

  // Foto de perfil capturada no próprio formulário (câmera ou arquivo). O envio
  // real depende do id do aluno, que só existe DEPOIS de salvar — então a foto
  // fica retida aqui e sobe no efeito de sucesso, logo abaixo.
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  const [mostrarWebcam, setMostrarWebcam] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const fotoExibida = fotoPreview ?? alunoExistente?.foto_perfil_url ?? null;

  /**
   * Recorta/comprime e guarda a foto. Devolve a mensagem de erro (ou null) em
   * vez de só gravar no estado: é esse retorno que a janela da câmera usa para
   * mostrar a falha nela mesma, sem fechar e sem mandar o usuário procurar o
   * aviso atrás do modal.
   */
  const processarFoto = async (file: File): Promise<string | null> => {
    const resultado = await prepararFotoParaEnvio(file);
    if ("erro" in resultado) return resultado.erro;
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoBlob(resultado.blob);
    setFotoPreview(resultado.previewUrl);
    setFotoErro(null);
    return null;
  };

  // Caminho do "Enviar arquivo": sem modal, o erro aparece no próprio cartão.
  const escolherFoto = async (file: File | undefined) => {
    if (!file) return;
    setFotoErro(null);
    const erro = await processarFoto(file);
    if (erro) setFotoErro(erro);
  };

  const descartarFoto = () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoBlob(null);
    setFotoPreview(null);
    setFotoErro(null);
  };

  useEffect(() => {
    if (!estado.ok) return;
    const id = estado.id ?? alunoExistente?.id ?? "";
    const finalizar = () => {
      router.refresh();
      onSalvo(id);
    };
    // Foto opcional: sobe agora que o aluno já tem id. Uma falha aqui NÃO
    // desfaz o cadastro — o aluno já existe e a foto pode ser refeita na ficha.
    if (fotoBlob && id) {
      setEnviandoFoto(true);
      (async () => {
        const fd = new FormData();
        fd.append("foto", fotoBlob, "foto.jpg");
        const r = await atualizarFotoAlunoAdmin(slug, id, {}, fd);
        setEnviandoFoto(false);
        if (r.erro) setFotoErro(r.erro);
        finalizar();
      })();
      return;
    }
    finalizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  // Próxima renovação (exibição — cálculo aproximado no cliente).
  function proximaRenovacao(meses: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + meses, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <UserPlus className="h-4 w-4 text-volt-300" />
        {alunoExistente ? "Editar aluno" : "Cadastrar aluno"}
      </h2>

      {!alunoExistente && (
        <input type="hidden" name="chave_idempotencia" value={chaveIdempotencia} />
      )}

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      {/* Foto de perfil: câmera (webcam/celular) ou arquivo, direto no cadastro/
          edição. O upload em si acontece após salvar (depende do id). */}
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-ink-600 bg-ink-800/50 p-3">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full ring-1 ring-ink-600">
          {fotoExibida ? (
            <Image
              src={fotoExibida}
              alt="Foto do aluno"
              fill
              sizes="64px"
              className="media-native object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
              <UserRound className="h-7 w-7" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium text-slate-300">
            Foto de perfil{" "}
            <span className="font-normal text-slate-500">(opcional)</span>
          </p>
          {fotoErro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
              {fotoErro}
            </p>
          )}
          {/* Estado explícito depois de confirmar a foto na janela da câmera:
              aqui o envio ainda não aconteceu (depende do id do aluno), e sem
              essa linha o usuário fica sem saber se a foto "pegou". */}
          {fotoBlob && !fotoErro && (
            <p className="flex items-center gap-1.5 text-xs text-volt-300">
              <Check className="h-3.5 w-3.5 flex-none" />
              Foto pronta — será salva ao concluir o cadastro.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMostrarWebcam(true)}
              className="btn-ghost min-h-11 text-xs"
            >
              <Camera className="h-3.5 w-3.5" /> Tirar foto
            </button>
            <button
              type="button"
              onClick={() => galeriaRef.current?.click()}
              className="btn-ghost min-h-11 text-xs"
            >
              <ImagePlus className="h-3.5 w-3.5" /> Enviar arquivo
            </button>
            {fotoBlob && (
              <button
                type="button"
                onClick={descartarFoto}
                className="btn-ghost min-h-11 text-xs text-slate-400"
              >
                Descartar
              </button>
            )}
          </div>
          <input
            ref={galeriaRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => escolherFoto(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Nome completo">
          <input
            name="nome"
            defaultValue={alunoExistente?.nome}
            placeholder="Ex: João da Silva"
            className="inp"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF (opcional)">
            <input
              name="cpf"
              defaultValue={alunoExistente?.cpf ?? ""}
              placeholder="000.000.000-00"
              className="inp"
            />
            <p className="mt-1 text-xs text-slate-500">
              Opcional — pode deixar em branco. Preencha se for usar Gympass/TotalPass.
            </p>
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={alunoExistente?.status_matricula ?? "ativa"}
              className="inp"
            >
              <option value="ativa">Ativa</option>
              <option value="pendente">Pendente</option>
              <option value="trancada">Trancada</option>
              <option value="inativa">Inativa</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de nascimento">
            <input
              name="data_nascimento"
              type="date"
              value={dataNascimento}
              max={hoje}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Idade">
            {/* Preenchida automaticamente a partir da data de nascimento —
                somente leitura, atualiza ao vivo enquanto o campo ao lado muda. */}
            <input
              value={idade != null ? `${idade} anos` : ""}
              placeholder="Preenchida pela data"
              className="inp cursor-not-allowed text-slate-400"
              readOnly
              tabIndex={-1}
              aria-label="Idade calculada a partir da data de nascimento"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              defaultValue={alunoExistente?.email ?? ""}
              placeholder="aluno@email.com"
              className="inp"
            />
          </Field>
          <Field label="Telefone">
            <input
              name="telefone"
              defaultValue={alunoExistente?.telefone ?? ""}
              placeholder="(11) 90000-0000"
              className="inp"
            />
          </Field>
        </div>
        {/* ORIGEM DO ACESSO — sempre visível, e é ela que decide se a
            periodicidade (o plano) faz sentido para este aluno. */}
        <Field label="Origem do acesso">
          <select
            name="origem_acesso"
            value={origemAcesso}
            onChange={(e) => {
              setOrigemAcesso(e.target.value as OrigemAcessoAluno);
              setPagamentoInicial("a_pagar");
              setDesvincularPlano(false);
            }}
            className="inp"
          >
            {ORIGENS_ACESSO_ALUNO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {ajudaOrigem && (
            <p className="mt-1 text-xs text-slate-400">{ajudaOrigem}</p>
          )}
        </Field>

        {origemAcesso === "outro_convenio" && (
          <Field label="Nome do convênio">
            <input
              name="parceiro_externo"
              value={parceiroExterno}
              onChange={(e) => setParceiroExterno(e.target.value)}
              placeholder="Ex: Sesc, convênio da empresa X"
              maxLength={80}
              className="inp"
            />
          </Field>
        )}

        {/* Plano-fantasma herdado: o vínculo continua gravado, agora à vista.
            Sem este input oculto o campo não iria no envio e o servidor
            manteria o valor atual — o oculto existe para o "desvincular"
            conseguir enviar vazio de propósito. */}
        {!exigePlano && (
          <input
            type="hidden"
            name="plano_id"
            value={desvincularPlano ? "" : alunoExistente?.plano_id ?? ""}
          />
        )}
        {planoLegado && (
          <div className="rounded-xl border border-ink-600 bg-ink-800/60 px-3 py-2.5 text-xs">
            <p className="text-slate-300">
              Este aluno ainda está vinculado ao plano{" "}
              <strong className="text-white">{planoLegado.nome}</strong> (
              {rotuloRecorrencia(planoLegado.recorrencia_meses)}), criado quando
              não havia campo de origem. O vínculo foi <strong>preservado</strong>{" "}
              e não atrapalha o acesso pelo parceiro.
            </p>
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-slate-400">
              <input
                type="checkbox"
                checked={desvincularPlano}
                onChange={(e) => setDesvincularPlano(e.target.checked)}
                className="h-4 w-4 flex-none accent-volt-300"
              />
              Desvincular deste plano ao salvar (opcional — não apaga o plano
              nem o histórico).
            </label>
          </div>
        )}

        {/* Plano + vencimento só existem para quem paga plano da academia.
            Aluno de parceiro não tem mensalidade, então um "dia de
            vencimento" ali seria campo morto. Escondido não é apagado: o
            servidor mantém o dia que o aluno já tinha. */}
        {exigePlano && (
        <div className="grid grid-cols-2 gap-3">
            <Field label="Plano e periodicidade">
              <select
                name="plano_id"
                value={planoSelecionadoId}
                onChange={(e) => {
                  setPlanoSelecionadoId(e.target.value);
                  setPagamentoInicial("a_pagar");
                }}
                className="inp"
              >
                <option value="">Nenhum</option>
                {/* Nome + periodicidade + valor. A academia mantém versões de
                    preço com o MESMO nome (três "Mensal", dois "Trimestral"),
                    então só o nome não distingue uma opção da outra — e a
                    periodicidade sozinha também não. */}
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {rotuloRecorrencia(p.recorrencia_meses)} ·{" "}
                    {formatBRL(p.valor_mensal)}
                  </option>
                ))}
              </select>
            </Field>
          <Field label="Dia de vencimento">
            <input
              name="dia_vencimento"
              type="number"
              min={DIA_VENCIMENTO_MIN}
              max={DIA_VENCIMENTO_MAX}
              value={diaVencimento}
              onChange={(e) =>
                setDiaVencimento(
                  Math.min(
                    DIA_VENCIMENTO_MAX,
                    Math.max(DIA_VENCIMENTO_MIN, parseInt(e.target.value) || DIA_VENCIMENTO_MIN)
                  )
                )
              }
              className="inp"
            />
            {/* Duas mensagens, nunca as duas ao mesmo tempo:
                - a fixa ensina que existe a opção de "último dia do mês", que
                  ninguém descobre sozinho olhando um campo numérico;
                - a de aviso só aparece depois de escolher 29, 30 ou 31, e
                  responde na hora a dúvida de "e fevereiro?" — a mesma que o
                  dono levantou quando pediu o dia 31. */}
            {diaVencimento > 28 ? (
              <p className="mt-1 text-xs text-amber-300/80">
                Nos meses que não têm dia {diaVencimento}, a cobrança cai no último
                dia do mês — em fevereiro, dia 28 (29 em ano bissexto).
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                De 1 a 31. Use 31 para cobrar sempre no último dia do mês.
              </p>
            )}
          </Field>
        </div>
        )}

        {/* Trava suave: ao CRIAR (não ao editar) um aluno sem plano, avisa a
            consequência em vez de deixar virar "pendente" silenciosamente. O
            "Nenhum" continua disponível — é escape consciente, não bloqueio. */}
        {!alunoExistente && exigePlano && planoSelecionadoId === "" && planos.length > 0 && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <strong>Sem plano</strong>, a matrícula é criada como{" "}
            <strong>pendente</strong>: o aluno <strong>não libera na catraca</strong>{" "}
            até você definir um plano. Você já pode montar e atribuir treinos, mas
            o ideal é escolher o plano agora.
          </p>
        )}

        {/* Painel de ciclo e pagamento inicial — somente ao cadastrar com plano recorrente */}
        {exibirPagamento && planoSelecionado && (
          <div className="rounded-xl border border-ink-600 bg-ink-800/60 p-4 space-y-4">
            {/* Info do ciclo */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div>
                <p className="label-muted">Valor do plano</p>
                <p className="mt-0.5 font-semibold text-white">
                  {planoSelecionado.valor_mensal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
              <div>
                <p className="label-muted">Dia de vencimento</p>
                <p className="mt-0.5 font-semibold text-white">Dia {diaVencimento}</p>
              </div>
              <div>
                <p className="label-muted">Início do ciclo</p>
                <p className="mt-0.5 font-semibold text-white">
                  {formatDataISO(hojeSaoPaulo())}
                </p>
              </div>
              <div>
                <p className="label-muted">Próxima renovação</p>
                <p className="mt-0.5 font-semibold text-white">
                  {proximaRenovacao(planoSelecionado.recorrencia_meses)}
                </p>
              </div>
            </div>

            {/* Pagamento inicial */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Pagamento inicial</p>
              <input type="hidden" name="pagamento_inicial" value={pagamentoInicial} />
              <div className="flex gap-3">
                {(["a_pagar", "pago_agora"] as const).map((op) => (
                  <label
                    key={op}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition",
                      pagamentoInicial === op
                        ? op === "pago_agora"
                          ? "border-volt-500/50 bg-volt-500/10 text-volt-300"
                          : "border-amber-500/50 bg-amber-500/10 text-amber-300"
                        : "border-ink-600 bg-ink-800 text-slate-400 hover:border-ink-500"
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={pagamentoInicial === op}
                      onChange={() => setPagamentoInicial(op)}
                    />
                    {op === "pago_agora" ? "✓ Pago agora" : "⏳ A pagar"}
                  </label>
                ))}
              </div>

              {pagamentoInicial === "pago_agora" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Forma de pagamento">
                    <select name="forma_pagamento" className="inp" required>
                      <option value="">Selecione…</option>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <option key={f.value} value={f.label}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Data do pagamento">
                    <input
                      name="data_pagamento"
                      type="date"
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                      max={hoje}
                      className="inp"
                      required
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <div className="mt-5 border-t border-ink-700 pt-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <HeartPulse className="h-3.5 w-3.5 text-magenta-400" /> Saúde e anamnese
          <span className="normal-case text-slate-500">
            — só a equipe vê, nunca aparece pro aluno
          </span>
        </p>
        <div className="mt-3 space-y-3">
          <Field label="Objetivo">
            <input
              name="objetivo"
              defaultValue={alunoExistente?.objetivo ?? ""}
              placeholder="Ex: Emagrecimento, hipertrofia, condicionamento..."
              className="inp"
            />
          </Field>
          <Field label="Condições médicas / restrições / lesões">
            <textarea
              name="condicoes_medicas"
              defaultValue={alunoExistente?.condicoes_medicas ?? ""}
              placeholder="Ex: Hérnia de disco L4-L5, evitar carga axial. Hipertensão controlada."
              rows={3}
              className="inp"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contato de emergência">
              <input
                name="contato_emergencia_nome"
                defaultValue={alunoExistente?.contato_emergencia_nome ?? ""}
                placeholder="Nome"
                className="inp"
              />
            </Field>
            <Field label="Telefone de emergência">
              <input
                name="contato_emergencia_telefone"
                defaultValue={alunoExistente?.contato_emergencia_telefone ?? ""}
                placeholder="(11) 90000-0000"
                className="inp"
              />
            </Field>
          </div>
        </div>
      </div>

      {enviandoFoto && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando a foto…
        </p>
      )}

      <FormActions
        onCancelar={onCancelar}
        salvarLabel={alunoExistente ? "Salvar alterações" : "Adicionar aluno"}
        className="mt-4"
      />

      {mostrarWebcam && (
        <CapturaWebcam
          titulo="Foto do aluno"
          onCapturar={processarFoto}
          onFechar={() => setMostrarWebcam(false)}
        />
      )}
    </form>
  );
}

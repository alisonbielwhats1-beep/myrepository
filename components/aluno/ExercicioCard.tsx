"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Ban,
  Check,
  Dumbbell,
  History,
  Lightbulb,
  Loader2,
  PlayCircle,
  RotateCcw,
  Target,
  Timer,
  Weight,
} from "lucide-react";
import { EsforcoTreino, ExercicioTreino, ProgressoExercicio } from "@/lib/types";
import { guiaDoExercicio } from "@/lib/guia-exercicios";
import { cn } from "@/lib/utils";
import CronometroDescanso from "./CronometroDescanso";

const PROGRESSO_VAZIO: Omit<ProgressoExercicio, "exercicio_id"> = {
  concluido: false,
  carga_realizada_kg: 0,
  repeticoes_realizadas: "",
  esforco: null,
  nao_fez: false,
};

const OPCOES_ESFORCO: { valor: EsforcoTreino; rotulo: string }[] = [
  { valor: "leve", rotulo: "Leve" },
  { valor: "medio", rotulo: "Médio" },
  { valor: "pesado", rotulo: "Pesado" },
];

// GIF não é formato de vídeo — a tag <video> não reproduz .gif. Um GIF já
// anima sozinho, então é exibido como imagem e dispensa player.
function ehGif(url: string) {
  return /\.gif($|\?)/i.test(url);
}

/**
 * Mídia do exercício.
 *
 * POR QUE ESTE COMPONENTE EXISTE (bug do treino do Raimundo)
 *   A versão anterior renderizava `<video autoPlay muted loop playsInline>`
 *   com `poster={imagem_demonstracao_url}` e SEM `controls`. Quando o
 *   navegador bloqueia o autoplay — iPhone em Modo de Baixo Consumo bloqueia
 *   até vídeo mudo, Android com Economia de dados também — o resultado era:
 *     1. o navegador desenhava o `poster`, que é exatamente a FOTO;
 *     2. não havia `controls`, logo nenhum botão de play;
 *     3. o selo "Demonstração" por cima era `pointer-events-none`.
 *   Ou seja: aparecia só a foto, e tocar nela não fazia nada. Era esse o
 *   relato "adicionei imagem e vídeo, mas no app só a imagem apareceu".
 *
 * COMO FUNCIONA AGORA
 *   A imagem é a capa. Havendo vídeo, aparece um botão "Ver demonstração"
 *   que troca para o player com `controls` (play, pause e tela cheia). O
 *   vídeo só é baixado quando o aluno pede — economiza dados no celular e
 *   elimina a dependência de autoplay. Falha de rede ou formato não
 *   suportado cai numa mensagem clara com opção de voltar para a foto, em
 *   vez de um retângulo parado indistinguível de sucesso.
 *
 *   Imagem e vídeo coexistem: a presença de uma nunca esconde o outro.
 */
function MidiaExercicio({ ex }: { ex: ExercicioTreino }) {
  const [modo, setModo] = useState<"capa" | "video">("capa");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  const temVideo = Boolean(ex.video_demonstracao_url);
  const videoEhGif = temVideo && ehGif(ex.video_demonstracao_url!);

  // GIF: anima sozinho, não precisa de player nem de interação.
  if (videoEhGif) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ex.video_demonstracao_url!}
          alt={`Demonstração de ${ex.nome_exercicio}`}
          className="media-native h-full w-full object-cover"
        />
        <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink-950/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur-sm">
          <PlayCircle className="h-3 w-3 text-volt-300" /> Demonstração
        </span>
      </>
    );
  }

  // Player, depois que o aluno pediu para ver.
  if (modo === "video" && temVideo && !erro) {
    return (
      <>
        <video
          src={ex.video_demonstracao_url!}
          controls
          autoPlay
          playsInline
          preload="auto"
          onLoadStart={() => setCarregando(true)}
          onCanPlay={() => setCarregando(false)}
          onError={() => {
            setCarregando(false);
            setErro(true);
          }}
          className="media-native h-full w-full bg-ink-950 object-contain"
        />
        {carregando && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink-950/40">
            <Loader2 className="h-7 w-7 animate-spin text-volt-300" />
          </div>
        )}
      </>
    );
  }

  // Falha ao carregar o vídeo — mensagem clara, com volta para a foto.
  if (erro) {
    return (
      <div className="grid h-full w-full place-items-center bg-ink-900 px-4 text-center">
        <div>
          <AlertCircle className="mx-auto h-7 w-7 text-amber-400" />
          <p className="mt-2 text-xs text-slate-300">
            Não foi possível carregar o vídeo.
          </p>
          <button
            type="button"
            onClick={() => {
              setErro(false);
              setModo("capa");
            }}
            className="mt-2 text-xs font-semibold text-volt-300 underline"
          >
            {ex.imagem_demonstracao_url ? "Ver a foto" : "Voltar"}
          </button>
        </div>
      </div>
    );
  }

  // Capa: foto (ou ícone) + botão de demonstração quando existe vídeo.
  return (
    <>
      {ex.imagem_demonstracao_url ? (
        <Image
          src={ex.imagem_demonstracao_url}
          alt={ex.nome_exercicio}
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          className="media-native object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center text-slate-600">
          <Dumbbell className="h-10 w-10" />
        </div>
      )}

      {temVideo && (
        <button
          type="button"
          onClick={() => setModo("video")}
          aria-label={`Ver demonstração de ${ex.nome_exercicio}`}
          className="absolute inset-0 grid place-items-center bg-ink-950/35 transition hover:bg-ink-950/50 active:bg-ink-950/60"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-volt-300 px-4 py-2 text-xs font-bold text-ink-950 shadow-glow">
            <PlayCircle className="h-4 w-4" />
            Ver demonstração
          </span>
        </button>
      )}
    </>
  );
}

/**
 * Card de exercício. Dentro de uma sessão de treino ativa (Bloco 1),
 * "concluído", carga e repetições realizadas vêm de `progresso` (persistido
 * em sessoes_treino) e nunca de estado local — ao contrário da versão
 * anterior, que usava só `useState` e perdia tudo ao atualizar a página.
 *
 * `onAlterar` ausente = modo somente leitura (usado pela ficha compartilhada
 * pública em app/treino/[token], que só demonstra a prescrição e não tem
 * sessão nenhuma) — não mostra os campos de realizado nem o botão de concluir.
 */
export default function ExercicioCard({
  ex,
  progresso,
  recorde,
  ultimaCarga,
  onAlterar,
}: {
  ex: ExercicioTreino;
  progresso?: ProgressoExercicio;
  /** Maior carga já registrada neste exercício (kg). null/0 = ainda sem recorde. */
  recorde?: number | null;
  /** Carga (kg) da última vez que fez este exercício. null/0 = sem histórico. */
  ultimaCarga?: number | null;
  onAlterar?: (patch: Partial<Omit<ProgressoExercicio, "exercicio_id">>) => void;
}) {
  const realizado = progresso ?? { exercicio_id: ex.id, ...PROGRESSO_VAZIO };
  const temRecorde = recorde != null && recorde > 0;
  const novoRecorde = temRecorde && realizado.carga_realizada_kg > recorde;
  const naoFez = realizado.nao_fez ?? false;
  const temUltima = ultimaCarga != null && ultimaCarga > 0;
  // Guia (músculo + dica) resolvido pelo nome — apoio ao iniciante. Vale
  // também na ficha pública read-only (não depende de onAlterar).
  const guia = guiaDoExercicio(ex.nome_exercicio);

  // Ref do campo de carga: permite preencher a última carga com um toque sem
  // tornar o input controlado (o padrão da tela é uncontrolled + onBlur).
  const cargaRef = useRef<HTMLInputElement>(null);
  // Sinal que dispara o cronômetro de descanso ao concluir a série.
  const [sinalDescanso, setSinalDescanso] = useState(0);

  const usarUltimaCarga = () => {
    if (!temUltima || !onAlterar) return;
    if (cargaRef.current) cargaRef.current.value = String(ultimaCarga);
    onAlterar({ carga_realizada_kg: ultimaCarga! });
  };

  const alternarConcluido = () => {
    if (!onAlterar) return;
    const vai = !realizado.concluido;
    // Concluir e "não consegui" são mutuamente exclusivos.
    onAlterar(vai ? { concluido: true, nao_fez: false } : { concluido: false });
    if (vai) setSinalDescanso((s) => s + 1); // auto-inicia o descanso
  };

  const alternarNaoFez = () => {
    if (!onAlterar) return;
    const vai = !naoFez;
    onAlterar(vai ? { nao_fez: true, concluido: false } : { nao_fez: false });
  };

  const definirEsforco = (valor: EsforcoTreino) => {
    if (!onAlterar) return;
    onAlterar({ esforco: realizado.esforco === valor ? null : valor });
  };

  return (
    <div
      className={cn(
        "surface overflow-hidden rounded-2xl transition",
        realizado.concluido && "border-volt-500/40 bg-volt-500/[0.06]",
        naoFez && "border-amber-500/30 bg-amber-500/[0.04] opacity-90"
      )}
    >
      {/* Mídia nativa do movimento — sem retângulo de fundo poluindo a mídia */}
      <div className="relative aspect-[16/10] w-full bg-ink-900">
        <MidiaExercicio ex={ex} />
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold text-white">
          {ex.nome_exercicio}
        </h3>

        {guia && (
          <div className="mt-2 flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-cyanx-500/30 bg-cyanx-400/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-cyanx-400">
              <Target className="h-3 w-3" />
              {guia.grupo}
            </span>
            <p className="flex items-start gap-1.5 text-xs leading-snug text-slate-400">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300/80" />
              <span>{guia.dica}</span>
            </p>
          </div>
        )}

        <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Prescrito pelo professor
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
            <RotateCcw className="h-3.5 w-3.5 text-volt-300" />
            {ex.series} séries
          </span>
          <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
            <Dumbbell className="h-3.5 w-3.5 text-cyanx-400" />
            {ex.repeticoes} reps
          </span>
          {ex.carga_kg != null && ex.carga_kg > 0 && (
            <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
              <Weight className="h-3.5 w-3.5 text-magenta-400" />
              {ex.carga_kg} kg
            </span>
          )}
          {ex.descanso_segundos != null && (
            <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
              <Timer className="h-3.5 w-3.5 text-slate-400" />
              {ex.descanso_segundos}s
            </span>
          )}
        </div>

        {ex.observacoes && (
          <p className="mt-3 text-sm text-slate-400">{ex.observacoes}</p>
        )}

        {onAlterar && (
          <>
            {/* Realizado pelo aluno — nunca altera a prescrição acima. */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink-600/60 pt-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Carga realizada (kg)
                </span>
                <input
                  ref={cargaRef}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={999}
                  defaultValue={realizado.carga_realizada_kg || ""}
                  onBlur={(e) =>
                    onAlterar({ carga_realizada_kg: Number(e.target.value) || 0 })
                  }
                  placeholder={temUltima ? String(ultimaCarga) : "0"}
                  className="inp !py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Repetições realizadas
                </span>
                <input
                  type="text"
                  defaultValue={realizado.repeticoes_realizadas}
                  onBlur={(e) =>
                    onAlterar({ repeticoes_realizadas: e.target.value.slice(0, 50) })
                  }
                  placeholder="Ex: 12, 10, 8"
                  className="inp !py-1.5 text-sm"
                />
              </label>
            </div>

            {/* Última carga (migration 093): tira do aluno o trabalho de
                lembrar. Um toque preenche o campo. Some quando não há histórico. */}
            {temUltima && (
              <button
                type="button"
                onClick={usarUltimaCarga}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cyanx-400 transition hover:opacity-80"
              >
                <History className="h-3.5 w-3.5" />
                Última vez: {ultimaCarga} kg — usar
              </button>
            )}

            {/* Recorde de carga (migration 059). Antes dela, `recorde` chega
                sempre null e nada é mostrado — a tela não depende do recurso. */}
            {temRecorde && (
              <p
                className={cn(
                  "mt-2 text-xs font-semibold",
                  novoRecorde ? "text-volt-300" : "text-amber-300/90"
                )}
              >
                {novoRecorde
                  ? `🎉 Novo recorde! Você superou ${recorde} kg`
                  : `🏆 Seu recorde: ${recorde} kg`}
              </p>
            )}

            {/* Percepção de esforço (RPE de 1 toque, migration 093). */}
            <div className="mt-3">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Como foi o esforço?
              </span>
              <div className="grid grid-cols-3 gap-2">
                {OPCOES_ESFORCO.map((op) => {
                  const ativo = realizado.esforco === op.valor;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => definirEsforco(op.valor)}
                      aria-pressed={ativo}
                      className={cn(
                        "rounded-xl border px-2 py-1.5 text-xs font-semibold transition active:scale-[0.98]",
                        ativo
                          ? "border-volt-500/50 bg-volt-500/15 text-volt-300"
                          : "border-ink-600 bg-ink-700/60 text-slate-300 hover:bg-ink-700"
                      )}
                    >
                      {op.rotulo}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cronômetro de descanso — puramente client-side, usa o descanso
                prescrito como padrão. Auto-inicia ao concluir a série (sinal).
                Só aparece no modo sessão, nunca na ficha pública read-only. */}
            <CronometroDescanso
              segundosPadrao={ex.descanso_segundos ?? 0}
              dispararSinal={sinalDescanso}
            />

            <button
              onClick={alternarConcluido}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
                realizado.concluido
                  ? "border border-ink-600 bg-ink-700 text-slate-300 hover:bg-ink-600"
                  : "bg-volt-300 text-ink-950 shadow-glow hover:bg-volt-200"
              )}
            >
              <Check className="h-4 w-4" />
              {realizado.concluido ? "Desfazer" : "Marcar como concluído"}
            </button>

            {/* Estado "não consegui / substituí": evita o tudo-ou-nada que
                desanima o iniciante quando faltou o aparelho ou a disposição. */}
            <button
              type="button"
              onClick={alternarNaoFez}
              aria-pressed={naoFez}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition active:scale-[0.98]",
                naoFez
                  ? "border border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Ban className="h-3.5 w-3.5" />
              {naoFez ? "Marquei: não consegui hoje" : "Não consegui fazer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

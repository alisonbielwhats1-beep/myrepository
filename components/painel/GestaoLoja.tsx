"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Star,
} from "lucide-react";
import { CATEGORIAS_PRODUTO, CategoriaProduto, Produto } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ImageUpload from "@/components/ui/ImageUpload";
import ProdutoImagem from "@/components/loja/ProdutoImagem";
import {
  alternarAtivoProduto,
  atualizarProduto,
  criarProduto,
  excluirProduto,
  registrarVendaProduto,
} from "@/app/painel/[slug]/loja/actions";

const ESTOQUE_BAIXO = 5;

function rotuloCategoria(c: CategoriaProduto): string {
  return CATEGORIAS_PRODUTO.find((x) => x.value === c)?.label ?? c;
}

export default function GestaoLoja({
  slug,
  produtosIniciais,
}: {
  slug: string;
  produtosIniciais: Produto[];
}) {
  const produtos = produtosIniciais;
  const [mostrarNovo, setMostrarNovo] = useState(produtos.length === 0);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<CategoriaProduto | "todos">("todos");

  const filtrados = useMemo(
    () => (filtro === "todos" ? produtos : produtos.filter((p) => p.categoria === filtro)),
    [produtos, filtro]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FiltroChip ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>
            Todos
          </FiltroChip>
          {CATEGORIAS_PRODUTO.map((c) => (
            <FiltroChip
              key={c.value}
              ativo={filtro === c.value}
              onClick={() => setFiltro(c.value)}
            >
              {c.label}
            </FiltroChip>
          ))}
        </div>
        <button
          onClick={() => setMostrarNovo((v) => !v)}
          className={mostrarNovo ? "btn-ghost" : "btn-volt"}
        >
          <Plus className="h-4 w-4" />
          {mostrarNovo ? "Fechar" : "Novo produto"}
        </button>
      </div>

      {mostrarNovo && (
        <FormularioProduto
          slug={slug}
          onCancelar={produtos.length > 0 ? () => setMostrarNovo(false) : undefined}
          onSalvo={() => setMostrarNovo(false)}
        />
      )}

      {filtrados.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          <Package className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          {produtos.length === 0
            ? "Nenhum produto na loja ainda. Cadastre o primeiro."
            : "Nenhum produto nessa categoria."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((p) =>
            editandoId === p.id ? (
              <div key={p.id} className="sm:col-span-2 lg:col-span-3">
                <FormularioProduto
                  slug={slug}
                  produtoExistente={p}
                  onCancelar={() => setEditandoId(null)}
                  onSalvo={() => setEditandoId(null)}
                />
              </div>
            ) : (
              <div
                key={p.id}
                className={cn(
                  "surface flex flex-col overflow-hidden rounded-2xl",
                  !p.ativo && "opacity-60"
                )}
              >
                <div className="relative">
                  <ProdutoImagem
                    nome={p.nome}
                    imagemUrl={p.imagem_url}
                    categoria={p.categoria}
                    className="h-40 w-full"
                  />
                  {p.destaque && (
                    <span className="chip absolute left-2 top-2 border-volt-500/40 bg-ink-950/80 text-volt-300">
                      <Star className="h-3 w-3" /> Destaque
                    </span>
                  )}
                  {!p.ativo && (
                    <span className="chip absolute right-2 top-2 border-ink-500 bg-ink-950/80 text-slate-300">
                      Oculto
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">{p.nome}</h3>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {rotuloCategoria(p.categoria)}
                        {p.estoque != null && (
                          <>
                            <span>·</span>
                            <span
                              className={cn(
                                p.estoque === 0
                                  ? "font-medium text-magenta-400"
                                  : p.estoque <= ESTOQUE_BAIXO
                                    ? "font-medium text-amber-300"
                                    : ""
                              )}
                            >
                              {p.estoque === 0
                                ? "sem estoque"
                                : `${p.estoque} em estoque`}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <span className="flex-none font-bold text-volt-300">
                      {formatBRL(p.preco)}
                    </span>
                  </div>
                  {p.descricao && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                      {p.descricao}
                    </p>
                  )}

                  <div className="mt-3">
                    <VenderProduto slug={slug} produto={p} />
                  </div>

                  <div className="mt-3 flex items-center gap-1 border-t border-ink-700 pt-3">
                    <button
                      type="button"
                      onClick={() => alternarAtivoProduto(slug, p.id, !p.ativo)}
                      title={p.ativo ? "Ocultar da loja" : "Mostrar na loja"}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
                    >
                      {p.ativo ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoId(p.id)}
                      title="Editar produto"
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <div className="ml-auto">
                      <ConfirmButton
                        action={() => excluirProduto(slug, p.id)}
                        confirmText={`Excluir o produto "${p.nome}"?`}
                        label="Excluir produto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        ativo
          ? "border-volt-500/40 bg-volt-500/10 text-volt-300"
          : "border-ink-600 text-slate-400 hover:bg-ink-700 hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}

function FormularioProduto({
  slug,
  produtoExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  produtoExistente?: Produto;
  onCancelar?: () => void;
  onSalvo: () => void;
}) {
  const acao = produtoExistente
    ? atualizarProduto.bind(null, slug, produtoExistente.id)
    : criarProduto.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [imagem, setImagem] = useState(produtoExistente?.imagem_url ?? "");

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <Package className="h-4 w-4 text-volt-300" />
        {produtoExistente ? "Editar produto" : "Novo produto"}
      </h2>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[150px_1fr]">
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Foto do produto
          </span>
          <input type="hidden" name="imagem_url" value={imagem} />
          <ImageUpload
            value={imagem}
            onChange={setImagem}
            aspect="aspect-square"
            hint="Foto do produto"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input
              name="nome"
              defaultValue={produtoExistente?.nome}
              placeholder="Ex: Whey Protein 900g"
              className="inp"
              required
            />
          </Field>
          <Field label="Categoria">
            <select
              name="categoria"
              defaultValue={produtoExistente?.categoria ?? "suplemento"}
              className="inp"
            >
              {CATEGORIAS_PRODUTO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preço (R$)">
            <input
              name="preco"
              type="number"
              min={0}
              step="0.01"
              defaultValue={produtoExistente?.preco ?? ""}
              className="inp"
              required
            />
          </Field>
          <Field label="Estoque (opcional)">
            <input
              name="estoque"
              type="number"
              min={0}
              defaultValue={produtoExistente?.estoque ?? ""}
              placeholder="deixe vazio se não controla"
              className="inp"
            />
          </Field>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              Descrição
            </span>
            <textarea
              name="descricao"
              defaultValue={produtoExistente?.descricao ?? ""}
              rows={2}
              placeholder="Detalhes, sabor, tamanho..."
              className="inp"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="destaque"
              defaultChecked={produtoExistente?.destaque ?? false}
              className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-volt-400"
            />
            Produto em destaque
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="ativo"
              value="on"
              defaultChecked={produtoExistente?.ativo ?? true}
              className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-volt-400"
            />
            Visível na loja
          </label>
        </div>
      </div>

      <FormActions
        onCancelar={onCancelar}
        salvarLabel={produtoExistente ? "Salvar alterações" : "Adicionar produto"}
        className="mt-4"
      />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

/** Baixa rápida de estoque + lançamento da venda como receita. */
function VenderProduto({ slug, produto }: { slug: string; produto: Produto }) {
  const [qtd, setQtd] = useState(1);
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; texto: string } | null>(null);

  const semEstoque = produto.estoque != null && produto.estoque <= 0;
  const maxQtd = produto.estoque ?? 999;

  const vender = () => {
    setMsg(null);
    iniciar(async () => {
      const r = await registrarVendaProduto(slug, produto.id, qtd);
      if (r.erro) setMsg({ texto: r.erro });
      else {
        setMsg({ ok: true, texto: `Venda registrada (${formatBRL(produto.preco * qtd)}).` });
        setQtd(1);
      }
    });
  };

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-ink-600">
          <button
            type="button"
            onClick={() => setQtd((q) => Math.max(1, q - 1))}
            className="grid h-8 w-8 place-items-center text-slate-400 hover:text-white"
            aria-label="Diminuir"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-white">{qtd}</span>
          <button
            type="button"
            onClick={() => setQtd((q) => Math.min(maxQtd, q + 1))}
            className="grid h-8 w-8 place-items-center text-slate-400 hover:text-white"
            aria-label="Aumentar"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={vender}
          disabled={pendente || semEstoque}
          className="btn-volt flex-1 !py-2 text-xs disabled:opacity-50"
        >
          {pendente ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {semEstoque ? "Sem estoque" : "Dar baixa (vender)"}
        </button>
      </div>
      {msg && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px]",
            msg.ok ? "text-volt-300" : "text-red-400"
          )}
        >
          {msg.ok && <Check className="h-3 w-3" />}
          {msg.texto}
        </p>
      )}
    </div>
  );
}

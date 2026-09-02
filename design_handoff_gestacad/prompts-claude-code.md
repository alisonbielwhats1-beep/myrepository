# Prompts para o Claude Code

Um PR por prompt, na ordem. Cole o prompt inteiro; ele já assume que `README.md` e `AUDITORIA.md` deste pacote estão na raiz do repo (ou passe o caminho). Sempre comece a sessão com:

> Leia `design_handoff_gestacad/README.md` e `AUDITORIA.md`. Os arquivos `.dc.html` são referência visual, não código para copiar: reimplemente em Next.js App Router com os tokens `ink`/`volt` do `tailwind.config.ts` e as classes de `app/globals.css` (`.surface`, `.chip`, `.inp`, `.btn-ghost`). Não introduza cores, fontes ou bibliotecas novas.

---

## PR 1 — Skeletons de carregamento

Crie `loading.tsx` para as rotas `app/aluno/[slug]/[token]/`, `app/aluno/[slug]/[token]/treinos/`, `app/painel/[slug]/`, `app/painel/[slug]/recepcao/` e `app/painel/[slug]/alunos/`, seguindo o padrão que já existe em `app/painel/[slug]/financeiro/loading.tsx`.

Requisitos:
- Cada skeleton deve ter a **mesma forma e altura** dos blocos reais da rota (ver seção "1a" do README para as medidas do Início: 120×11 e 172×24 no header, 132px no card de hoje, dois de 78px, um de 88px).
- Shimmer: `linear-gradient(90deg,#12141d,#1e2230 45%,#12141d)`, `background-size: 320px 100%`, keyframe linear de 1.15s infinito. Declare o keyframe uma vez em `globals.css` como utilitário (ex.: `.skeleton`), não inline.
- No Início do aluno, legenda "carregando seu treino de hoje…" em `text-[11.5px] text-slate-500`.
- Nenhum salto de layout entre skeleton e conteúdo real: confira as alturas medindo no navegador.
- Adicione `@keyframes up` (fade + translateY 10px) como utilitário `.anim-up` e aplique nos blocos que aparecem após o carregamento.

## PR 2 — Início do aluno: estado vazio com saída

Refatore `app/aluno/[slug]/[token]/page.tsx` e os componentes de `components/aluno/` conforme a seção "1a" do README.

- Card "treino de hoje" na superfície de destaque (gradiente volt + borda) — é o **único** destaque da tela.
- Progresso do treino (`4 de 7`), linha "Parou em: {exercício} · série {n}", CTA "Retomar de onde parei". Se não houver sessão aberta, CTA "Começar Treino A".
- Estado sem treino: card neutro, título "Dia de descanso — e está tudo certo.", texto com quantos dias treinou na semana e qual é o próximo treino, botões "Adiantar o {próximo treino}" e "Ver a semana". Remova a frase "Sem treino programado para hoje" do código.
- Dois tiles (sequência em semanas, treinos no mês) e o card de situação (financeira + catraca) com chips.
- Mova o `InstallPWA` para o rodapé do Perfil e exiba só a partir do 3º acesso, no máximo 1×/semana (persistir contador em `localStorage`).

## PR 3 — Aba Treinos como trilha da semana

Reescreva `components/aluno/TreinosDia.tsx` e `CardTreino.tsx` conforme a seção "1b".

- Régua de 7 chips (SEG–DOM) com rótulo **e ponto de status**: feito / hoje / planejado / descanso, cores no README. Legenda abaixo.
- Card do dia selecionado: superfície verde só quando é hoje; rótulo dinâmico; lista de até 4 exercícios com checkbox de conclusão e séries à direita; "+ N exercícios"; botão com label por estado ("Retomar no {exercício}" / "Ver resumo da sessão" / "Adiantar este treino").
- Seção "RESTO DO PLANO" com as demais fichas em linhas compactas.
- Garanta que **um só** plano apareça como "em andamento": derive do estado da sessão, não do campo do modelo.

## PR 4 — Sessão de treino série a série (feature nova)

Crie a rota `app/aluno/[slug]/[token]/treinos/[treinoId]/sessao/page.tsx` + Server Actions, conforme a seção "2b".

- Reuse as tabelas de `supabase/migrations/045_sessao_treino.sql`; se faltar coluna, crie uma migration nova (não edite a existente) e o teste RLS correspondente em `supabase/ci/`.
- Uma sessão por (aluno, treino, dia). Cada série concluída é um insert com `exercicio_id`, `serie`, `carga_kg`, `reps`, `concluida_em`. Sessão inativa por 4h fecha sozinha.
- UI: card do exercício com dica de execução, META (reps) e CARGA com stepper (passo 2 kg, mínimo 2); lista de séries com os três estados; cronômetro de descanso (90s composto / 60s isolador) com barra `transition: width 1s linear` e "Pular descanso"; botão principal com os três labels.
- Carga sugerida = última carga registrada naquele exercício.
- O "Parou em" do Início e o "Retomar" dos Treinos devem ler a última série da sessão aberta.
- Testes: e2e cobrindo concluir série → descanso → próxima série → próximo exercício, e recarregar a página no meio sem perder progresso.

## PR 5 — Dashboard: ação antes de indicador

Refatore `app/painel/[slug]/page.tsx`, `components/painel/AlertasPainel.tsx` e `DashboardCharts.tsx` conforme a seção "1c".

- Faixa "PRECISA DE VOCÊ HOJE" acima de tudo, com 3 cards acionáveis (inadimplentes / sumidos / vencem hoje), número grande na cor da severidade e botão que dispara a ação existente (`BotaoCobrancaWhats`, `BotaoReativacaoWhats`).
- Indicadores viram contexto: tiles menores, sem competir com os cards de ação.
- Gráfico "Movimento por hora" com barra de pico em `volt-300` e as outras em `volt-300/32`, mais **uma linha de insight em texto** derivada dos dados (ex.: "Das 18h às 20h entram 26 dos 47 check-ins do dia").
- Todos os números e o insight reagem ao `DashboardRangeFilter`.
- Repasses de parceiros deixam de ser card e viram uma linha no card Financeiro.

## PR 6 — Recepção: liberar sem sair do log

Refatore `app/painel/[slug]/recepcao/page.tsx` e `components/painel/CatracaLog.tsx` conforme a seção "2a".

- Grid `1fr 1.35fr`: busca/liberação à esquerda, log à direita. Mantenha os 4 `StatTile`.
- Preview do aluno buscado com chip de situação, valor em aberto e CTA que muda ("Liberar entrada" / "Liberar com alerta").
- Acima de 30 dias de atraso: aviso explícito e liberação exigindo senha do gestor (checar papel em `lib/permissoes.ts`).
- Check-in feito na busca entra no topo do log de forma otimista, com revert em erro. Mantenha a idempotência de `migrations/033_recepcao_idempotencia_e_ultimo_dono.sql`.

## PR 7 — Financeiro: caixa × competência em abas

Refatore `app/painel/[slug]/financeiro/page.tsx`, `FinanceiroTabs.tsx` e `DREResumo.tsx` conforme a seção "2c".

- Duas abas: "Caixa · dinheiro real" e "Competência · DRE", com um único card de resultado por aba (linhas descritas no README, incluindo os recuos de "— já recebida" / "— ainda a receber").
- Faixa de insight verde ligando as duas visões com número (substitui parte do texto do tooltip `Ajuda`).
- Total com cor por sinal e `tabular-nums`.
- Não altere o cálculo de `lib/financeiro.ts` — só a apresentação. Os testes de `e2e/financeiro-acesso.spec.ts` devem continuar passando.

## PR 8 — Perfil, Alunos, Comunidade, Loja, Acesso

Pode ser um PR por tela; ordem sugerida abaixo. Seções 3a, 3b, 2d e 2e do README.

- **Perfil:** colapsar o card centralizado + `FotoPerfilForm` num header compacto; subir "Sua evolução" para o topo do conteúdo com gráfico de peso e grid de 6 medidas com variação; links secundários em lista compacta no fim.
- **Alunos:** quebrar `GestaoAlunos.tsx` (81 KB) em `ListaAlunos`, `FichaAluno` (com as 4 abas Dados/Plano/Treinos/Financeiro e barra de ações por aba) e `NovoAlunoDrawer` (3 passos, só o nome obrigatório).
- **Comunidade:** chip do treino que gerou o post, clicável; composer com o treino do dia anexado.
- **Loja:** feedback local no botão ("Interesse enviado") antes de abrir o WhatsApp.
- **Acesso:** status de liberação como primeira coisa da tela, QR 212px, código em mono com `tracking`, linha de renovação e fallback pela matrícula.

---

## Regras que valem para todos os PRs

- **Um único destaque visual por tela** (a superfície verde). O resto é `.surface` neutra.
- Nenhum estado vazio sem ação. Nenhuma frase negativa como último elemento.
- Números sempre `tabular-nums`; horas e códigos em mono.
- Alvo de toque mínimo de 44px no app do aluno.
- Ações que escrevem no banco: otimistas na UI, com revert em erro (padrão de `PostCard.tsx`).
- Toda migration nova vem com teste RLS em `supabase/ci/`.
- Rode `npm run lint` e a suíte `e2e/` antes de abrir o PR.

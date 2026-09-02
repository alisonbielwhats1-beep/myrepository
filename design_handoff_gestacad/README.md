# Handoff: GestAcad — redesenho do app do aluno e do painel

## Overview
Redesenho de 12 telas do GestAcad (SaaS de gestão de academias, Next.js App Router + Tailwind + Supabase), atacando quatro dores relatadas: tela branca no carregamento, dashboard sem ação, aba de treinos sem noção de rotina, e aparência genérica de template.

O protótipo está em `GestAcad Redesenho.dc.html` (abre em qualquer navegador; `support.js` precisa estar na mesma pasta). Ele tem 3 turnos empilhados: turno 3 (Perfil, painel de Alunos), turno 2 (Recepção, execução de treino, Financeiro, Comunidade, Loja, Acesso), turno 1 (Início do aluno, Treinos, Dashboard, auditoria de UX).

## About the Design Files
Os arquivos deste pacote são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. Todo o estilo está em `style=""` inline porque o protótipo precisa pintar sozinho, sem build.

A tarefa é **recriar essas telas no ambiente que já existe no repositório**: Next.js 14 App Router, React Server Components, Tailwind com os tokens `ink`/`volt`/`magenta` de `tailwind.config.ts`, classes utilitárias já definidas em `app/globals.css` (`.surface`, `.chip`, `.inp`, `.btn-ghost`, `.shadow-card`), ícones `lucide-react`, gráficos via `components/painel/DashboardCharts.tsx`, dados via `lib/data.ts` e Server Actions por rota.

**Não introduzir novas cores, fontes ou biblioteca de UI.** Onde o protótipo mostra um hex, use o token Tailwind equivalente (tabela em *Design Tokens*).

## Fidelity
**Alta fidelidade.** Cores, tipografia, espaçamento, raios e estados vêm dos tokens reais do repositório e devem ser reproduzidos fielmente. As exceções conscientes:
- Fotos, QR code e imagens de produto aparecem como placeholders cinzas — no app real vêm de `ProdutoImagem`, `AvatarAluno`, `ConfirmarAcessoQr`.
- Números, nomes e valores são fictícios; a fonte de verdade continua sendo o Supabase.
- O protótipo é desktop-first no painel e 390×790 no app do aluno; o responsivo do repo (breakpoints Tailwind) prevalece.

## Ordem de implementação recomendada
Do maior impacto por esforço para o menor. Cada item é um PR independente.

1. **Skeletons de carregamento** (`loading.tsx` por rota) — 1 dia, zero risco.
2. **Dashboard: ação antes de indicador** — reordenar seções existentes.
3. **Aba Treinos como trilha da semana** — mudança de layout, mesmos dados.
4. **Execução de treino série a série** — a única feature realmente nova.
5. **Recepção: liberar sem sair do log** — mudança de layout em `CatracaLog`.
6. **Financeiro: caixa × competência em abas** — reorganiza cards existentes.
7. **Perfil, Alunos, Comunidade, Loja, Acesso** — refinos.

---

## Screens / Views

### 1a — Início do aluno (`app/aluno/[slug]/[token]/page.tsx`)
**Purpose:** o aluno abre o app na porta da academia e precisa saber, em um olhar, o que treinar hoje e se está liberado.

**Layout:** coluna única, `padding: 18px 16px`, `gap: 14px`, tab bar fixa no rodapé (`left/right: 12px; bottom: 12px`).

**Componentes, de cima para baixo:**
1. **Header** — linha flex, `justify-content: space-between`. Esquerda: nome da academia em `text-[12px] font-medium text-volt-300`; abaixo, saudação `font-extrabold text-[24px] tracking-[-0.02em] text-white` ("Bom treino, {primeiro nome}."). Direita: avatar 44×44 circular, `bg-ink-800 border border-ink-600`.
2. **Card "treino de hoje"** — a única superfície com tinta da marca: `border-radius: 22px; padding: 18px;` fundo `linear-gradient(160deg, rgba(138,182,84,.16), rgba(138,182,84,.04))`, borda `1px solid rgba(120,160,72,.45)`. Dentro: rótulo `TREINO DE HOJE · SEG` (`font-bold text-[10.5px] tracking-[.09em] text-volt-300`) + pílula de progresso (`4 de 7`, `bg-volt-300 text-ink-950`); título do treino `font-extrabold text-[21px]`; meta em `text-slate-400 text-[13px]`; barra de progresso 6px (`bg-white/10`, preenchimento `bg-volt-300`, `transition: width .35s ease`); linha "Parou em: {exercício} · série {n}"; botão full-width `bg-volt-300 text-ink-950 font-bold text-[14px] py-[13px] rounded-[14px]` — **"Retomar de onde parei"**, não "Iniciar treino".
3. **Estado sem treino** (substitui o card acima) — mesma caixa em `.surface` neutra, título "Dia de descanso — e está tudo certo.", corpo com quantos dias treinou na semana e qual é o próximo treino, e dois botões: `Adiantar o Treino B` (primário neutro) e `Ver a semana` (ghost). Nunca terminar em "Sem treino programado para hoje." sem saída.
4. **Dois tiles** — grid 1fr 1fr, `.surface rounded-[18px] p-[14px_16px]`: SEQUÊNCIA (`3 semanas`) e ESTE MÊS (`11 treinos`). Rótulo `text-[10.5px] tracking-[.07em] text-slate-500`, valor `font-extrabold text-[26px] text-white`.
5. **Card de situação** — duas linhas separadas por `1px solid` ink-600: "Situação financeira" → chip `Em dia`; "Acesso à catraca" → chip `Liberado`. Chips: `text-volt-300 bg-volt-300/[.14] border border-volt-600/40 rounded-full px-[10px] py-[3px] text-[11px] font-semibold`. Quando devedor, o chip vira âmbar e ganha o valor em aberto.

**Estado de carregamento (o principal ganho):** skeletons com a **forma exata** dos blocos acima — 120×11 e 172×24 no header, 132px no card de hoje, dois 78px, um 88px — com shimmer `linear-gradient(90deg,#12141d,#1e2230 45%,#12141d)`, `background-size: 320px 100%`, animação linear de 1.15s, e a legenda "carregando seu treino de hoje…" em `text-[11.5px] text-slate-500`. Nenhum salto de layout ao trocar para o conteúdo real; a entrada usa `animation: up .28s ease both` (`translateY(10px)` → 0).

### 1b — Treinos do aluno (`app/aluno/[slug]/[token]/treinos/page.tsx`)
**Purpose:** entender a rotina da semana e retomar no exercício exato — hoje a tela é uma pilha de cards de ficha, com dois planos "Em andamento" ao mesmo tempo.

**Layout:** header ("Sua semana", subtítulo com o nome do plano) → régua de 7 chips → legenda → card do dia selecionado → lista "RESTO DO PLANO".

**Chips de dia:** 7 botões flex-1, `rounded-[12px] py-[9px]`, com **rótulo + ponto de status**. Selecionado: `bg-volt-300`, texto `ink-950`. Não selecionado: `.surface`, texto `slate-300` (ou `slate-500` em dia de descanso). Ponto 6px: feito → `slate-300`; hoje → `volt-300`; planejado → `#333849`; descanso → `ink-600`. Legenda abaixo em 10.5px: `● feito` / `● hoje` (verde) / `○ planejado`.

**Card do dia:** mesma superfície verde do 1a quando é hoje, `.surface` neutra nos outros dias. Rótulo dinâmico (`HOJE · SEG`, `PLANEJADO · TER`, `CONCLUÍDO · SÁB`, `DESCANSO · QUI`), nome do treino, meta (`Hipertrofia · 7 exercícios · ≈ 43 min`), lista de até 4 exercícios com checkbox 18×18 (feito: `bg-volt-300` + `✓` em `ink-950`; pendente: borda `#333849`), séries à direita em `text-slate-500 tabular-nums`, linha "+ N exercícios", e botão cujo label muda por estado: `Retomar no {próximo exercício}` / `Ver resumo da sessão` / `Adiantar este treino`.

**Resto do plano:** linhas `.surface rounded-[15px] p-[12px_14px]` com dia (26px de largura), nome truncado, e meta à direita.

### 1c — Dashboard do painel (`app/painel/[slug]/page.tsx`)
**Purpose:** responder "o que eu faço agora?" antes de "como vai a academia?".

**Layout:** header (data + subtítulo com contagem do dia) e filtro de período à direita → faixa **PRECISA DE VOCÊ HOJE** → grid `1.5fr 1fr` com gráfico à esquerda e Financeiro + Retenção à direita.

**Filtro de período:** grupo segmentado `.surface rounded-[12px] p-[4px]`, ativo `bg-volt-300 text-ink-950`, inativo transparente `text-slate-400`. Hoje / Semana / Mês / 6 meses — **todos os números da tela reagem**, inclusive o texto de insight.

**Cards de ação (3 colunas):** `.surface` com borda tingida pela severidade. Número `font-extrabold text-[30px]` na cor da severidade + rótulo em `text-slate-200`; sublinha explicativa `text-[12.5px] text-slate-400`; botão outline na mesma cor. Conteúdo: `11 inadimplentes / R$ 1.098 vencidos · 6 sem nenhuma cobrança enviada / Cobrar os 6 no WhatsApp` (vermelho), `18 alunos sumidos / Sem acesso há 14+ dias · 4 passaram de 30 dias / Reativar em lote` (âmbar), `4 vencem hoje / aviso automático desligado / Avisar antes de vencer` (volt). Reaproveitar `BotaoCobrancaWhats` e `BotaoReativacaoWhats`, que já existem.

**Gráfico "Movimento por hora":** barras verticais, altura relativa ao máximo, `border-radius: 5px 5px 2px 2px`, `transition: height .4s cubic-bezier(.2,.7,.2,1)`; a barra de pico em `volt-300`, as outras em `rgba(138,182,84,.32)`. Abaixo, uma linha de insight em texto — a leitura que o gestor faria sozinha ("Das 18h às 20h entram 26 dos 47 check-ins do dia").

**Coluna direita:** card Financeiro com 3 linhas (Receita / Despesa / Resultado, valores `tabular-nums`, verde / vermelho / branco) e card Retenção com número `font-extrabold text-[34px] text-volt-300`, subtítulo "13 de 19 alunos" e barra de 8px.

**Nota:** os repasses de parceiros (R$ 10 / R$ 25) saem de card e viram **uma linha** dentro do Financeiro; voltam a card só se passarem de ~10% da receita.

### 2a — Recepção & Catraca (`app/painel/[slug]/recepcao/page.tsx`, `components/painel/CatracaLog.tsx`)
**Purpose:** liberar uma entrada vendo a situação financeira, sem perder o log de vista.

**Layout:** header → 4 stat tiles (mantém `StatTile`) → grid `1fr 1.35fr`: painel "Liberar entrada" à esquerda, "Log da catraca" à direita.

**Liberar entrada:** input `.inp` ("Buscar aluno…", busca por nome, matrícula ou CPF). Ao achar, um card aparece com `animation: up .2s ease both`: nome (`font-bold text-[15px]`), plano + último acesso, chip de situação (verde/âmbar/vermelho), linha do valor em aberto na cor da situação, e botão cujo label muda: **"Liberar entrada"** (em dia) ou **"Liberar com alerta"** (atrasado). Acima de 30 dias, o botão é acompanhado de um aviso: liberação exige senha do gestor — a recepção não decide sozinha. Sem resultado: dica com nomes de exemplo, nunca uma lista vazia muda.

**Log:** linhas com hora em `font-mono text-[12px] text-slate-500`, nome, sublinha `{plano} · {motivo}` e chip de resultado (Liberado / Alerta / Negado). Cabeçalho com "● ao vivo" em volt. Um check-in feito na busca entra no topo do log imediatamente (otimista, como já é feito em `PostCard`).

### 2b — Execução do treino (nova rota: `app/aluno/[slug]/[token]/treinos/[treinoId]/sessao/page.tsx`)
**Purpose:** conduzir o treino série a série, registrando carga e descanso. **Única feature nova** — as tabelas já existem em `supabase/migrations/045_sessao_treino.sql`.

**Layout:** header (nome do treino em volt + "Exercício 1 de 4" + pílula de progresso %) → card verde do exercício atual → lista de séries → card de descanso (condicional) → botão fixo no fim.

**Card do exercício:** nome `font-extrabold text-[20px]`, dica de execução em `text-slate-400 text-[12.5px]`, e duas caixas `bg-ink-950/45 rounded-[14px]`: META (reps) e CARGA com stepper − / + (botões 26×26, passo de 2 kg, mínimo 2). O valor da carga persiste como sugestão da próxima sessão.

**Séries:** uma linha por série. Concluída: `bg-volt-300` no rótulo, texto "42 kg × 8". Atual: fundo `rgba(138,182,84,.12)`, borda `rgba(120,160,72,.5)`, texto volt. Futura: `.surface`, texto `slate-500`, valor "—".

**Descanso:** aparece ao concluir uma série, com o tempo do exercício (90s nos compostos, 60s nos isoladores). Cronômetro `font-extrabold text-[24px] font-mono tabular-nums`, barra de 5px com `transition: width 1s linear`, botão ghost "Pular descanso". Enquanto corre, o botão principal muda para "Iniciar série N agora".

**Botão principal:** `Concluir série N` (verde) → durante o descanso `Iniciar série N agora` (neutro) → ao fim do exercício `Próximo exercício` (verde). Rodapé: "A seguir: {próximo exercício}" ou "Último exercício do treino".

**Backend:** uma sessão por (aluno, treino, data); cada série concluída é um insert (`exercicio_id`, `serie`, `carga_kg`, `reps`, `concluida_em`). O "Parou em" do 1a e o "Retomar" do 1b leem a última série da sessão aberta. Sessão sem atividade por 4h fecha automaticamente.

### 2c — Financeiro (`app/painel/[slug]/financeiro/page.tsx`, `components/painel/financeiro/DREResumo.tsx`)
**Purpose:** separar duas perguntas que hoje convivem na mesma tela e se confundem.

**Layout:** header → abas segmentadas **"Caixa · dinheiro real"** e **"Competência · DRE"** → um único card de resultado → faixa de insight verde.

**Aba Caixa:** "Dinheiro que passou pelo caixa". Linhas: Mensalidades recebidas, Vendas da loja, Repasses de parceiros (todas verdes), Despesas pagas (vermelho). Total: "Saldo do mês". Rodapé: saldo registrado hoje em conta.

**Aba Competência:** "Resultado gerado no período (DRE)". Linhas: Receita gerada (branco), "— já recebida" (verde, recuo de 14px), "— ainda a receber" (âmbar, recuo), Despesa gerada (vermelho). Total: "Lucro · margem 16%".

**Faixa de insight:** `bg-volt-300/[.07] border border-volt-600/30 rounded-[13px]`, texto volt 12.5px, ligando as duas visões: "11 mensalidades a receber são a diferença entre o caixa no zero e o lucro real". É o que o `Ajuda` tooltip atual tenta explicar em texto longo — vira número.

**Total:** `font-extrabold text-[26px] tabular-nums`, verde se ≥ 0, vermelho se < 0.

### 2d — Comunidade (`components/aluno/comunidade/`)
Mantém a mecânica atual (curtida otimista, comentários, denúncia, compartilhar). Mudanças:
- **Composer** com o treino do dia já anexado: avatar 34px + "Compartilhe o treino de hoje…" + chip `Treino A ✓` em `bg-volt-300 text-ink-950`.
- **Post carrega o treino que o gerou**: chip `Treino C · Pernas` no canto do header do post, clicável — abre a ficha e permite adiantar o mesmo treino. É o que transforma o feed em gancho de retenção em vez de vaidade.
- Curtida em `magenta-400` (já é o token do coração), contadores `tabular-nums`, comentários em bolhas `bg-ink-950/55 rounded-[14px]`.

### 2e — Loja e Acesso
**Loja** (`app/aluno/[slug]/[token]/loja/page.tsx`): grid 2 colunas, cards `.surface rounded-[17px]`, imagem 96px (`ProdutoImagem`), nome 12.5px, categoria 10.5px `slate-500`, preço `font-bold text-[14px] text-volt-300`, botão `Tenho interesse` → após clique, `Interesse enviado` com fundo `volt-300/15` e texto volt (feedback local antes de abrir o WhatsApp). Rodapé conta quantos produtos foram marcados.

**Acesso** (`app/aluno/[slug]/[token]/acesso/page.tsx`): a tela mais curta e a mais usada. Status **LIBERADO** com bolinha verde no topo do card verde, QR 212×212 em fundo branco, código `AC-2481-93` em `font-mono text-[15px] tracking-[.14em]`, e a linha "Código renova em 4 min · sem internet? use a matrícula". Abaixo, card neutro com Plano / Última entrada / Entradas no mês.

### 3a — Perfil (`app/aluno/[slug]/[token]/perfil/page.tsx`)
**Purpose:** ver evolução. Hoje a evolução é o último de seis cards empilhados.

**Layout:** header compacto (avatar 56px + nome + chip de matrícula + "desde fev 2023" + botão "Trocar foto") — o card centralizado de 96px e o `FotoPerfilForm` separado colapsam **em um só bloco**. Depois: card "Sua evolução" com gráfico de peso (7 pontos, barra final em volt, `-3,8 kg em 3 meses` no canto) → grid 3 colunas com as 6 medidas (valor + variação; queda em volt, alta em slate) → lista compacta de links secundários (Loja, Fale com a academia, Feedback, Termos, Privacidade) → nota de 10.5px sobre o que a academia controla.

### 3b — Painel · Alunos (`app/painel/[slug]/alunos/page.tsx`, `components/painel/GestaoAlunos.tsx`)
**Purpose:** trabalhar a base sem trocar de página, e cadastrar sem formulário único gigante.

**Layout:** header com "Importar CSV" (ghost) + "Novo aluno" (volt) → grid `1fr 1.5fr`: lista à esquerda, ficha à direita.

**Lista:** `.surface p-[8px]`, linhas `rounded-[14px] p-[12px_13px]` com ponto 8px de situação financeira, nome, e sublinha `{plano} · {atividade}`. Selecionada: `bg-volt-300/[.09]` + borda `volt-600/45`.

**Ficha:** header (avatar de iniciais 44px, nome 17px, `{plano} · matrícula {status}`, chip de situação) → abas segmentadas **Dados / Plano / Treinos / Financeiro** → grid 2 colunas de 6 campos (rótulo uppercase 10.5px `slate-500`, valor 13.5px `slate-200`) → barra de ações **que muda por aba**: Financeiro → `Cobrar no WhatsApp` + `Marcar como pago`; Treinos → `Atribuir modelo` + `Montar ficha do zero`; Plano → `Trocar plano` + `Ver histórico`; Dados → `Editar cadastro` + `Gerar QR de acesso`. Isso quebra o componente de 81 KB em quatro painéis pequenos.

**Novo aluno:** drawer de 440px à direita (overlay `rgba(3,4,8,.68)`), 3 passos — Identificação / Plano e vencimento / Treino inicial — com barra de progresso de 3px por passo e uma nota verde por passo explicando o que é opcional. **Só o nome é obrigatório.** O passo 2 explica que o dia de vencimento gera as mensalidades automaticamente; o passo 3 deixa claro que o aluno pode entrar sem treino atribuído. CTA final: "Cadastrar e gerar acesso".

---

## Interactions & Behavior
- **Carregamento:** `loading.tsx` por rota com skeleton isomórfico ao conteúdo (o repo já faz isso em `app/painel/[slug]/financeiro/loading.tsx` — replicar o padrão em `aluno/[slug]/[token]/`, `treinos/`, `painel/[slug]/`, `recepcao/`, `alunos/`). Shimmer 1.15s linear infinito.
- **Entrada de conteúdo:** `@keyframes up { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform:none } }`, 0.18–0.28s ease, apenas em blocos que aparecem depois (resultado de busca, drawer, comentários).
- **Ações otimistas:** curtir, comentar, liberar entrada, marcar interesse — atualizam a UI antes da resposta e revertem em erro (padrão já implementado em `PostCard.tsx`).
- **Barras e cronômetros:** progresso `transition: width .35s ease`; gráfico `height .4s cubic-bezier(.2,.7,.2,1)`; descanso `width 1s linear` com tick de 1s.
- **Estados vazios:** sempre contexto + ação. Nenhuma tela termina em frase negativa sem botão.
- **Banner PWA (`InstallPWA`):** sai da dobra. Exibir a partir do 3º acesso, no máximo 1×/semana, no rodapé do Perfil.
- **Hover (desktop):** linhas de lista e log ganham `bg-ink-700/40`; botões ghost passam a `bg-ink-700`.
- **Responsivo:** painel colapsa `1fr 1.5fr` → coluna única abaixo de `lg`; grids de 3–4 colunas viram 2 em `sm`. Alvos de toque nunca abaixo de 44px no app do aluno.

## State Management
Server Components carregam dados; os blocos interativos são Client Components pequenos.

| Estado | Onde | Gatilhos |
| --- | --- | --- |
| `estado` (carregando/pronto/vazio) | Início do aluno | resolução do fetch; ausência de treino no dia |
| `diaSelecionado` | Treinos | clique no chip; default = hoje |
| `exercicioIdx`, `serie`, `carga`, `descanso` | Sessão de treino | concluir série, stepper, tick de 1s |
| `periodo` | Dashboard | filtro segmentado (já existe em `DashboardRangeFilter`) |
| `busca`, `log` | Recepção | digitação; liberação (prepend otimista) |
| `abaFinanceiro` | Financeiro | abas Caixa/Competência |
| `alunoSel`, `abaFicha`, `novoAberto`, `novoPasso` | Painel · Alunos | seleção na lista, abas, drawer |
| `curtido`, `curtidas`, `comentarios` | Comunidade | ações otimistas (já implementado) |

Fetching: nada novo além da sessão de treino. O restante reusa `lib/data.ts` (`getAcessosRecentes`, `getAlunosPaginado`, `getMensalidadesPendentes`, `getProgressoDosAlunos`, `getTreinosDosAlunos`) e `lib/financeiro.ts` (`DRE`).

## Design Tokens
Use **sempre o nome do token**, não o hex. Hex listado só para conferência visual.

| Uso | Token | Hex |
| --- | --- | --- |
| Fundo da página | `ink-950` | `#07080d` |
| Superfície de card (`.surface`) | `ink-800/900` | `#12141d` |
| Superfície elevada / botão neutro | `ink-700` | `#1a1d29` |
| Borda padrão | `ink-600` | `#242838` |
| Borda de input / stepper | — | `#333849` |
| Texto principal | `white` / `slate-200` | `#fff` / `#e2e8f0` |
| Texto secundário | `slate-300/400` | `#cbd5e1` / `#94a3b8` |
| Texto terciário | `slate-500` | `#64748b` |
| Marca / sucesso | `volt-300` | `#8ab654` |
| Marca escura (barras, preenchimento) | `volt-600` | `#78a048` |
| Atenção | `amber-300` | `#fbbf24` |
| Erro / negado | `red-400` | `#f87171` |
| Curtida | `magenta-400` | `#e879a8` |

**Superfície de destaque (só 1 por tela):** fundo `linear-gradient(160deg, rgba(138,182,84,.16), rgba(138,182,84,.04))` + borda `1px solid rgba(120,160,72,.45)`.

**Espaçamento:** 4 / 6 / 8 / 11 / 14 / 18 / 22 / 26 px. Gap padrão de coluna no mobile: 14px; no painel: 14–18px.

**Raios:** 8–9 (botão pequeno / chip quadrado) · 11–14 (botão, input, tile) · 15–18 (card) · 20–22 (card de destaque, painel) · 999 (chip/pílula).

**Tipografia** (Inter, já no repo): 24–26px extrabold `tracking-[-.02em]` (título de tela) · 20–21px extrabold (título de card de destaque) · 17px bold (nome em ficha) · 14px bold (título de card) · 13–13.5px medium/semibold (corpo, linhas de lista) · 12–12.5px (secundário) · 10.5–11.5px (rótulos, chips, uppercase `tracking-[.07em]`). Números sempre `tabular-nums`; horas e códigos em mono.

**Sombra:** apenas nos contêineres de moldura do protótipo — no app, manter `shadow-card` existente.

## Assets
Nenhum asset novo. Placeholders do protótipo mapeiam para o que já existe: `AvatarAluno`, `ProdutoImagem`, `ConfirmarAcessoQr`, `GraficoProgressoPeso` / `DashboardCharts`, ícones `lucide-react` (`DoorOpen`, `ShieldAlert`, `UserCheck`, `Clock3`, `Dumbbell`, `Target`, `CreditCard`, `Ruler`, `Heart`, `MessageCircle`).

## Files
- `GestAcad Redesenho.dc.html` — protótipo completo (3 turnos, 12 telas, interativo).
- `support.js` — runtime necessário para abrir o HTML.
- `prompts-claude-code.md` — prompts prontos para colar no Claude Code, um por PR, na ordem recomendada.
- `AUDITORIA.md` — os 8 problemas de UX priorizados que motivaram cada tela.

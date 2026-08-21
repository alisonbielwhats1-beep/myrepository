# Relatório de auditoria de responsividade

**Projeto:** GestAcad / `gestacad-saas`  
**Data:** 21/08/2026  
**Escopo:** aplicativo do dono, aplicativo do aluno/cliente e experiência mobile  
**Método:** leitura estática do código e conferência da cobertura E2E existente. Nenhum arquivo do aplicativo foi alterado durante a auditoria.

## Situação do repositório

- Repositório: `C:\Users\Alison.Silva02\my repository\myrepository`
- Branch analisada: `feat/app-aluno-comunidade-treinos`
- Último commit analisado: `97a2ea3 feat(treinos): atribuir vários modelos a um aluno de uma vez`
- Árvore de trabalho: limpa no início e no encerramento da auditoria.

> A branch analisada não é `claude/saas-academia-nextjs-supabase-wxzc33`. Este relatório descreve o código efetivamente presente na branch acima.

## Resumo executivo

Os problemas mais relevantes estão concentrados em:

1. QR Code e navegação inferior do aplicativo do aluno em telas estreitas;
2. compositor da comunidade do aluno;
3. linha da listagem e composição da aba **Alunos** do painel do dono;
4. tabelas financeiras que exigem rolagem horizontal no celular;
5. ausência de cobertura visual automatizada para as telas mais críticas.

O layout estrutural principal do painel já possui `flex-col` no mobile e `min-w-0` no conteúdo principal. Portanto, o problema não é um único erro global: é a combinação de componentes com largura mínima, controles densos e conteúdo que só muda de layout a partir do breakpoint `lg`.

## Classificação utilizada

- **Estrutural:** evidenciado diretamente por classes e dimensões no código.
- **Risco forte:** a estrutura indica quebra ou compressão provável, mas requer confirmação em navegador.
- **Densidade/UX:** não necessariamente causa overflow, mas fica fora do padrão mobile e dificulta a operação.

## Problemas prioritários — aplicativo do aluno

### 1. QR Code com tamanho fixo em telas de 320 px — estrutural / alta prioridade

O QR utiliza `220px` fixos. Somando os `padding` do card, do container interno e da área de acesso, a largura útil pode ficar menor que o QR em 320 px. O card também usa `overflow-hidden`, o que pode cortar o conteúdo em vez de permitir uma adaptação segura.

Evidência: `components/aluno/QRCodeCard.tsx`, especialmente as linhas 34–67.

### 2. Barra inferior sem safe area — estrutural / alta prioridade

`AlunoTabBar` é fixa em `bottom-0`, mas não utiliza `env(safe-area-inset-bottom)`. Em aparelhos com barra de gestos ou notch inferior, a navegação pode ficar muito próxima da borda, reduzir a área de toque e encobrir parte do conteúdo.

Evidência: `components/aluno/AlunoTabBar.tsx`, linhas 28–40. O layout adiciona `pb-28`, mas não há compensação específica para a safe area.

### 3. Texto longo do botão do QR — risco forte / alta prioridade

O texto `Mostrar meu QR atual (usado hoje na recepção)` está em uma linha flex sem `min-w-0` ou estratégia explícita de quebra. Em 320 px pode ficar espremido junto ao ícone de expansão.

Evidência: `components/aluno/AcessoView.tsx`, linhas 75–84.

### 4. Compositor de nova publicação — risco forte / alta prioridade

A linha de ações contém `Adicionar foto` ou `Trocar foto`, contador e `Publicar`, sem `flex-wrap`. A soma dos botões pode ultrapassar a largura disponível no card em 320 px.

Evidência: `components/aluno/comunidade/NovaPublicacao.tsx`, linhas 122–163.

### 5. Campo de comentário — risco forte / alta prioridade

O campo de comentário está em uma linha flex com avatar e botão de envio. Ele utiliza `w-full`, mas não possui a combinação adequada de `min-w-0` e `flex-1`, podendo forçar largura maior que a disponível.

Evidência: `components/aluno/comunidade/PostCard.tsx`, linhas 268–295.

### 6. Área do aluno estreita em desktop — densidade/UX

A experiência do aluno utiliza `max-w-md`. Isso é coerente com uma experiência mobile-first, mas, quando aberta em 1024 px ou 1440 px, permanece como uma coluna estreita centralizada, com grande espaço vazio lateral. Se o objetivo incluir uso em desktop, falta uma composição própria para telas maiores.

Evidência: `app/aluno/[slug]/layout.tsx`, linha 12.

### 7. Cabeçalho da execução do treino — risco forte / média prioridade

O nome do treino fica ao lado dos controles sem uma proteção explícita para nomes longos. Treinos personalizados com títulos extensos podem comprimir ou deslocar os controles.

Evidência: `components/aluno/ExecucaoTreino.tsx`, linhas 175–187.

### 8. Cards de mensalidade — risco forte / média prioridade

O bloco que apresenta competência, vencimento, valor e status não protege explicitamente o conteúdo principal com `min-w-0`. Textos longos e valores podem ficar apertados em 320 px.

Evidência: `app/aluno/[slug]/[token]/mensalidades/page.tsx`, linhas 83–114.

## Problemas prioritários — aplicativo do dono

### 1. Aba Alunos empilhada até 1024 px — estrutural / alta prioridade

O layout só usa duas colunas a partir de `lg`. Em celulares e tablets, a lista de alunos aparece antes do detalhe completo do aluno. Isso produz uma página muito longa e exige rolagem pela lista, detalhe, treino e informações financeiras em sequência.

Evidência: `components/painel/GestaoAlunos.tsx`, linha 251.

### 2. Linha da listagem de alunos excessivamente carregada — risco forte / alta prioridade

Cada linha combina avatar, nome, status cadastral, situação financeira, valor em aberto e vários comandos. Em 320 px e 360 px, os controles ficam comprimidos e a hierarquia visual se perde.

Evidência: `components/painel/GestaoAlunos.tsx`, linhas 675–778.

### 3. Rolagem interna da lista — densidade/UX / alta prioridade

A lista possui `max-h-[560px] overflow-auto`. No celular, isso cria uma segunda área de rolagem dentro da rolagem da página. A combinação explica parte da sensação de tela comprida e pouco previsível.

Evidência: `components/painel/GestaoAlunos.tsx`, linha 376.

### 4. Formulários da aba Alunos em duas colunas no celular — risco forte / média prioridade

Vários grupos continuam em `grid-cols-2` mesmo em 320 px, incluindo CPF/situação, e-mail/telefone, plano/status e valores. Embora muitos campos ainda caibam, os rótulos e controles ficam densos e com quebras ruins.

Evidências: `components/painel/GestaoAlunos.tsx`, linhas 1168, 1191, 1210, 1338 e 1398.

### 5. Histórico financeiro do aluno com largura mínima — estrutural / média prioridade

A tabela usa `min-w-[480px]` dentro de `overflow-x-auto`. Isso evita que a página inteira estoure, mas transfere o problema para uma rolagem horizontal interna no detalhe do aluno.

Evidência: `components/painel/GestaoAlunos.tsx`, linhas 1011–1012.

## Financeiro e dashboard do dono

### 1. Tabela de receitas — estrutural / média prioridade

A tabela possui `min-w-[720px]`. Em celulares, a visualização depende de rolagem horizontal interna e não se transforma em uma apresentação mobile.

Evidência: `components/painel/financeiro/ReceitasView.tsx`, linhas 366–367.

### 2. Tabela de despesas — estrutural / média prioridade

A tabela possui `min-w-[760px]`, com o mesmo comportamento de rolagem horizontal em telas estreitas.

Evidência: `components/painel/financeiro/DespesasView.tsx`, linhas 185–186.

### 3. Indicadores em duas colunas — densidade/UX

Dashboard e financeiro usam duas colunas já no mobile. Os componentes têm `min-w-0` e proteção contra estouro, portanto não há evidência de quebra global, mas os cards ficam compactos em 320 px.

Evidências:

- `app/painel/[slug]/page.tsx`, linha 309;
- `app/painel/[slug]/dashboard/page.tsx`, linha 146;
- `app/painel/[slug]/financeiro/page.tsx`, linha 109.

### 4. Abas financeiras com rolagem horizontal — densidade/UX

As abas usam `overflow-x-auto` e texto sem quebra. A solução é funcional, mas exige arrastar horizontalmente em telas estreitas.

Evidência: `components/painel/financeiro/FinanceiroTabs.tsx`, linhas 19–28.

## Recepção

### 1. Cabeçalho sem quebra — risco forte / média prioridade

O título e o botão `Registrar entrada` ficam em uma linha flex sem `flex-wrap`. Em telas estreitas podem ficar comprimidos.

Evidência: `components/painel/CatracaLog.tsx`, linhas 45–62.

### 2. Painel de decisão com mensagem longa — risco forte / média prioridade

Mensagens como `Acesso permitido — aluno com mensalidade vencida` ficam em uma linha flex sem proteção suficiente para quebras longas.

Evidência: `components/painel/CatracaLog.tsx`, linhas 337–380.

## Menu do dono e notificações

### 1. Drawer mobile rígido — densidade/UX

O menu lateral mobile tem `w-72`, ou 288 px. Em um viewport de 320 px ocupa quase toda a largura disponível.

Evidência: `components/painel/Sidebar.tsx`, linha 197.

### 2. Cabeçalho do sino — risco forte / baixa prioridade

O botão de marcar todas como lidas e o botão de fechar ficam lado a lado sem quebra explícita. Em telas muito estreitas podem ficar apertados.

Evidência: `components/painel/NotificationBell.tsx`, linhas 220–240.

## Pontos que já estão adequados

Não foram identificados problemas estruturais atuais nestes pontos:

- o layout principal do painel usa `flex-col` no mobile;
- o conteúdo principal usa `min-w-0`;
- os gráficos usam largura responsiva;
- os modais principais têm altura máxima e rolagem vertical;
- filtros de treinos se reorganizam em coluna no mobile;
- cards de treino usam `min-w-0`;
- chips dos dias de treino usam flexibilidade de largura;
- ações do card de acesso do aluno possuem `flex-wrap`.

Evidências: `app/painel/[slug]/layout.tsx`, `components/painel/GestaoTreinos.tsx` e `components/painel/DashboardCharts.tsx`.

## Problemas por viewport

### 320 px

Maior risco de quebra no QR Code, compositor da comunidade, campo de comentários, linha da listagem de alunos, cabeçalho da recepção e textos longos.

### 360 px

Os mesmos pontos permanecem, mas com menor probabilidade de corte. A aba Alunos continua muito densa.

### 390–412 px

A maioria dos elementos deve caber, porém tabelas financeiras ainda exigem rolagem horizontal e o QR continua dependente das folgas internas do card.

### 768 px

O painel ainda fica em uma coluna porque o segundo painel só aparece a partir de `lg`. A aba Alunos continua longa em tablet.

### 1024 px

O layout de Alunos passa a usar duas colunas, mas tabelas e controles ainda podem permanecer densos.

### 1440 px

O painel do dono tende a funcionar bem. A área do aluno, por permanecer em `max-w-md`, continua com aparência de aplicativo mobile centralizado.

## Lacuna de testes

A cobertura existente não valida adequadamente as telas mais problemáticas:

- a suíte de responsividade cobre principalmente `/`, `/login`, `/privacidade` e `/termos`;
- há um teste autenticado de modal de treinos;
- há um teste de alguns indicadores do financeiro;
- não há suíte visual completa para Alunos, detalhe do aluno, recepção, notificações, comunidade ou mensalidades do aluno.

Não foram executados testes de navegador nesta auditoria. Os pontos classificados como estruturais foram encontrados por leitura do CSS/JSX; a confirmação visual deve ser feita em 320, 360, 390, 412, 768, 1024 e 1440 px.

## Ordem recomendada para correção

### Bloco 1 — maior impacto

- QR Code do aluno;
- safe area da barra inferior;
- compositor e comentários da comunidade;
- linha e composição da aba Alunos.

### Bloco 2 — operação do dono

- tabelas financeiras;
- formulários da aba Alunos;
- cabeçalho e painel de decisão da recepção;
- densidade dos indicadores e notificações.

### Bloco 3 — validação

- testes reais nos viewports definidos;
- validação com dados longos;
- teste de teclado, zoom, orientação e barra de gestos;
- atualização da cobertura E2E para as rotas críticas.

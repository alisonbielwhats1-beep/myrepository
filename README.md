# GymFlow — SaaS Multi-tenant para Academias

Plataforma completa de gestão de academias com **Next.js (App Router)**,
**Tailwind CSS** e **Supabase**. Login por academia, isolamento total de
dados entre tenants, app do aluno (PWA mobile), controle de catraca, gestão
de treinos, financeiro, funcionários e um dashboard de indicadores.

Design "app de treino premium": dark mode nativo, acentos vibrantes e imagens
de alta qualidade exibidas em seu **estado original** (sem filtros).

Este é um SaaS real: **não há dados fictícios nem modo de demonstração**.
Toda informação é persistida no Supabase e cada academia só enxerga os
próprios dados.

---

## ✨ Funcionalidades

### Autenticação e multi-tenant
- Login por e-mail e senha (Supabase Auth), sessão via cookie, logout.
- Cada administrador está vinculado a **uma** academia (`perfis_admin`).
- **Isolamento total por Row Level Security**: toda consulta ao banco é
  filtrada automaticamente pela academia do usuário logado — uma academia
  nunca vê alunos, funcionários, financeiro ou relatórios de outra.

### App do Aluno (`/aluno/[slug]/[alunoId]`)
Ainda sem login (item futuro) — cada aluno acessa por um **link pessoal**
(gerado no painel, botão de copiar ao lado do nome do aluno).
- **Acesso rápido** — QR Code grande, centralizado e com token dinâmico.
- **Treinos** — fichas com **vídeo de demonstração em loop (≤ 10s)** por
  exercício (fallback para foto), séries, repetições, carga e botão
  **Concluído**.
- **Perfil** — plano atual e status de matrícula (sem dados de contato —
  o link é público e não expõe CPF/e-mail/telefone).

### Painel da Academia (`/painel/[slug]`) — menu lateral
1. **Dashboard** — alunos, ativos, inadimplentes, funcionários, receita e
   despesa do mês, lucro, próximos vencimentos, evolução de alunos.
2. **Recepção / Catraca** — log de acessos com foto do aluno, origem
   (Direto/Gympass/TotalPass) e registro manual de entrada.
3. **Alunos & Treinos** — cadastrar/editar/excluir alunos e montar fichas de
   treino com imagens e vídeos reais.
4. **Funcionários** — cadastrar/editar/excluir/pesquisar (nome, cargo,
   contato, CPF, admissão, salário, status).
5. **Financeiro** — receitas (mensalidade, matrícula, produto, outra) e
   despesas por categoria (energia, água, internet, aluguel, salários,
   manutenção, equipamentos, impostos, limpeza, outros), status pago/pendente,
   lucro, fluxo de caixa e gráfico mensal.
6. **Relatórios / BI** — acessos por origem, horários de pico e faturamento
   cruzado.

Toda tela tem **Voltar, Cancelar, Salvar, Editar e Excluir** consistentes,
breadcrumbs e confirmação antes de qualquer exclusão — nenhuma tela deixa o
usuário sem saída.

---

## 🚀 Como rodar

```bash
npm install
cp .env.local.example .env.local   # preencha com as chaves do seu Supabase
npm run dev
```

O app **exige** um projeto Supabase configurado — sem `.env.local`
preenchido, ele não inicia (ver seção abaixo).

---

## 🐘 Configurar o Supabase (obrigatório)

1. Crie um projeto em <https://supabase.com>.
2. No **SQL Editor**, cole e execute todo o conteúdo de
   [`supabase/schema.sql`](./supabase/schema.sql). Ele cria:
   - Tabelas: `academias`, `perfis_admin`, `alunos`, `planos`, `treinos`,
     `exercicios_treino`, `acessos_catraca`, `funcionarios`, `receitas`,
     `despesas`.
   - A função `academia_id_atual()` e as políticas de **RLS multi-tenant**
     em todas as tabelas.
   - As RPCs públicas `obter_ficha_aluno` e `obter_academia_publica`,
     usadas pela tela do aluno (sem login).
   - **Nenhum dado de demonstração** é inserido.
3. Em *Project Settings → API*, copie a `URL`, a chave `anon` e a chave
   `service_role` para o seu `.env.local`.

### Criar a primeira academia + administrador

```bash
npm run criar-academia -- \
  --nome "IronPulse Academia" \
  --slug ironpulse \
  --email admin@ironpulse.com \
  --senha "umaSenhaForte123" \
  --admin-nome "Fulano de Tal" \
  --endereco "Av. Paulista, 1000 - São Paulo/SP" \
  --telefone "(11) 99999-0000"
```

Isso cria a academia, o login do administrador (Supabase Auth) e o vínculo
entre os dois (`perfis_admin`). Rode esse comando de novo para cada nova
academia/cliente do seu SaaS — cada um recebe seu próprio login e seus
próprios dados, totalmente isolados.

Depois, acesse `/login` com o e-mail e senha criados.

### Modelo de dados (resumo)

| Tabela                | Descrição                                                        |
|-----------------------|------------------------------------------------------------------|
| `academias`           | Tenant raiz (multi-tenant por `slug_url`).                       |
| `perfis_admin`        | Login de admin vinculado à academia + papel de acesso.           |
| `alunos`              | Alunos com plano, status, anamnese e contato de emergência.      |
| `planos`              | Planos de assinatura (valor, recorrência, cobrança automática).  |
| `treinos`             | Fichas de treino por aluno (ou biblioteca de modelos).           |
| `exercicios_treino`   | Exercícios (séries, reps, carga, foto e vídeo).                 |
| `catalogo_exercicios` | Banco global de exercícios com grupo muscular padrão.            |
| `progresso_aluno`     | Medidas corporais e fotos ao longo do tempo.                     |
| `historico_planos`    | Cada troca ou renovação de plano do aluno.                       |
| `acessos_catraca`     | Log de entradas (origem, repasse, liberação).                    |
| `funcionarios`        | Equipe da academia com salário e dia de pagamento.               |
| `receitas`            | Mensalidades, matrículas, vendas e outras receitas.              |
| `despesas`            | Despesas por categoria, com competência e status.                |
| `produtos`            | Catálogo da loja (suplementos, acessórios, estoque).             |
| `feedbacks`           | Avaliações dos alunos (nota 1–5, categoria, comentário).         |

### Papéis de acesso (controle de equipe)

Cada membro da equipe (`perfis_admin.papel`) enxerga apenas as seções designadas:

| Papel       | Seções acessíveis                                               |
|-------------|------------------------------------------------------------------|
| `dono`      | Tudo, incluindo **Financeiro** e **Configurações**               |
| `gerente`   | Dashboard, Recepção, Alunos, Treinos, Funcionários, Loja, Retenção, Relatórios, Feedback |
| `recepcao`  | Dashboard, Recepção, Alunos, Treinos, Loja                       |
| `instrutor` | Dashboard, Recepção, Alunos, Treinos                             |

> **Financeiro** (receitas, despesas, DRE, projeção) é exclusivo do `dono`.  
> Para criar membros de equipe, acesse **Configurações → Equipe** (limite: 5 membros).  
> O controle é duplo: o menu lateral esconde as seções proibidas **e** as Server Actions rejeitam chamadas diretas de papéis sem permissão.

### Mídia dos exercícios
Cada exercício tem `imagem_demonstracao_url` e `video_demonstracao_url`
(clipe curto ≤ 10s, tocado em **loop** e mudo). O card do aluno usa o vídeo
quando disponível, com fallback para a imagem e, por fim, um ícone. Envie os
arquivos para o **Supabase Storage** e cole a URL pública ao montar a ficha.

---

## ☁️ Deploy (versão pública na web)

Deploy em **um clique** na Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Falisonbielwhats1-beep%2Fmyrepository&project-name=gymflow&repository-name=gymflow)

1. Acesse <https://vercel.com/new> e faça login com o GitHub (ou use o botão
   acima).
2. Importe o repositório `alisonbielwhats1-beep/myrepository`.
3. Em *Environment Variables*, adicione `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (necessárias
   — o build falha sem elas, de propósito, para nunca subir sem um banco
   real por trás).
4. **Deploy** — a URL pública é gerada em segundos. Rode
   `npm run criar-academia` (localmente, apontando para o mesmo projeto
   Supabase) para provisionar o primeiro login.

---

## 🧱 Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **Tailwind CSS** (design system em `tailwind.config.ts`)
- **Supabase** — Postgres + Auth + RLS (`@supabase/ssr` + `@supabase/supabase-js`)
- **Recharts** (gráficos financeiros e de BI)
- **qrcode.react** (QR Code de acesso)
- **lucide-react** (ícones)
- **PWA** (`manifest.json` + service worker em `public/sw.js`)

---

## 🗂 Estrutura do projeto

```
app/
  layout.tsx                     # shell do PWA
  page.tsx                       # landing page
  login/                         # login do administrador
  aluno/[slug]/                  # app do aluno sem login
    page.tsx                     #   aviso "link inválido"
    [alunoId]/                   #   link pessoal do aluno
      page.tsx / treinos / perfil
  painel/
    page.tsx                     # resolve a academia do usuário logado
    [slug]/
      layout.tsx                 #   sidebar + guard de sessão (requireSessao)
      page.tsx                   #   Dashboard (KPIs reais)
      recepcao/                  #   Catraca
      alunos/                    #   Alunos & Treinos
      funcionarios/              #   Funcionários
      financeiro/                #   Receitas & Despesas
      dashboard/                 #   Relatórios / BI
components/
  auth/ aluno/ painel/ ui/       # UI por área
lib/
  auth.ts                        # sessão (getSessao/requireSessao, cache por request)
  data.ts                        # camada de acesso a dados (100% real, sem mock)
  financeiro.ts                  # agregações financeiras puras
  supabase/                      # clientes browser/server/middleware
  actions/auth.ts                # entrar/sair (Server Actions)
middleware.ts                    # refresh de sessão + guard de rota
scripts/criar-academia.mjs       # provisiona tenant + admin
supabase/schema.sql              # esquema completo + RLS multi-tenant
```

---

## 📌 Notas de segurança

- RLS é a linha de defesa real: toda tabela de tenant exige
  `academia_id = academia_id_atual()`, resolvido a partir do usuário
  autenticado — nunca de um valor vindo do cliente.
- A tela do aluno usa RPCs `SECURITY DEFINER` (`obter_ficha_aluno`,
  `obter_academia_publica`) que devolvem só os campos necessários (sem
  CPF/e-mail/telefone), em vez de abrir as tabelas para leitura pública.
- `SUPABASE_SERVICE_ROLE_KEY` é usada **apenas** pelo script
  `scripts/criar-academia.mjs` (roda no seu terminal) — nunca no client nem
  no runtime do app.
- As imagens são renderizadas com a classe `.media-native`, que **remove
  qualquer filtro** e preserva o estado original das fotos.

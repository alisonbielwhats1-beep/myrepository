# GymFlow — SaaS Multi-tenant (PWA) para Academias

Plataforma completa de gestão de academias com **Next.js (App Router)**,
**Tailwind CSS** e **Supabase**. Inclui app do aluno (PWA mobile), controle de
catraca, gestão de treinos e um dashboard de inteligência de negócio (BI).

Design "app de treino premium": dark mode nativo, acentos vibrantes e imagens
de alta qualidade exibidas em seu **estado original** (sem filtros).

---

## 🔗 Prévia online (para compartilhar)

Versão navegável no navegador — ideal para apresentar ao dono da academia, sem
instalar nada, no celular ou no computador:

**https://claude.ai/code/artifact/4190349d-7412-4b6c-b031-fcfbbd3f3bc1**

> Adicione `#dashboard` à URL para abrir direto no Dashboard de BI
> (também `#recepcao`, `#alunos`, `#financeiro`, `#aluno`).

---

## ✨ Funcionalidades

### App do Aluno (`/aluno/[slug]`)
- **Acesso rápido** — QR Code grande, centralizado e com token dinâmico que
  rotaciona a cada 30s para liberar a catraca.
- **Treinos** — fichas (Treino A/B/C) com **vídeo de demonstração em loop
  (≤ 10s)** do movimento (fallback para foto nativa), séries, repetições,
  carga e botão **Concluído** por exercício.
- **Perfil** — plano atual, status de matrícula e dados de contato.

### Painel da Academia (`/painel/[slug]`) — navegação por abas
1. **Recepção / Catraca** — log de acessos ao vivo com foto do aluno,
   origem (Direto/Gympass/TotalPass) e liberação.
2. **Alunos & Treinos** — cadastro de alunos e montagem de fichas de treino
   com upload de imagens reais dos equipamentos.
3. **Financeiro** — assinaturas, status de pagamento, planos e repasses.
4. **Dashboard de BI** — acessos por origem, horários de pico e faturamento
   cruzado (mensalidades × parcerias).

> **Deep-link de abas:** cada aba é uma rota própria
> (`/painel/[slug]/dashboard`, etc.), então um link direto abre exatamente a
> aba correspondente — o Dashboard de BI (Aba 4) abre no Dashboard, nunca na
> primeira tela.

---

## 🗂 Estrutura do projeto

```
app/
  layout.tsx                     # shell do PWA (fontes, manifest, SW)
  page.tsx                       # landing page
  aluno/[slug]/                  # app mobile do aluno
    page.tsx                     #   Acesso (QR Code)
    treinos/page.tsx             #   Treinos
    perfil/page.tsx              #   Perfil
  painel/[slug]/                 # painel administrativo (abas)
    page.tsx                     #   redireciona -> recepcao
    recepcao/page.tsx            #   Aba 1
    alunos/page.tsx              #   Aba 2
    financeiro/page.tsx          #   Aba 3
    dashboard/page.tsx           #   Aba 4 (BI)
components/                      # UI (aluno/ e painel/)
lib/                             # tipos, utils, clients Supabase, dados
supabase/schema.sql             # esquema completo + seed
public/                         # manifest, service worker, ícones
```

---

## 🚀 Como rodar

```bash
npm install
cp .env.local.example .env.local   # opcional (roda em modo demo sem isso)
npm run dev
```

Abra <http://localhost:3000>.

- **App do aluno:** <http://localhost:3000/aluno/ironpulse>
- **Painel:** <http://localhost:3000/painel/ironpulse>
- **Dashboard (Aba 4) direto:** <http://localhost:3000/painel/ironpulse/dashboard>

### Modo de demonstração
Sem variáveis do Supabase configuradas (ou com `NEXT_PUBLIC_USE_MOCK=true`),
o app usa dados fictícios de `lib/mock-data.ts` e funciona por completo.

---

## 🐘 Banco de dados (Supabase)

1. Crie um projeto em <https://supabase.com>.
2. No **SQL Editor**, cole e execute todo o conteúdo de
   [`supabase/schema.sql`](./supabase/schema.sql). Ele cria:
   - Tipos (`status_matricula`, `origem_acesso`, `status_liberacao`).
   - Tabelas: `academias`, `alunos`, `planos`, `treinos`, `exercicios_treino`,
     `acessos_catraca` — com FKs, índices, triggers e RLS.
   - Dados de exemplo (seed) da academia **IronPulse**.
3. Preencha `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, e defina `NEXT_PUBLIC_USE_MOCK=false`.

### Modelo de dados (resumo)

| Tabela              | Descrição                                             |
|---------------------|-------------------------------------------------------|
| `academias`         | Tenant raiz (multi-tenant por `slug_url`).            |
| `alunos`            | Alunos vinculados a uma academia.                     |
| `planos`            | Planos de assinatura.                                 |
| `treinos`           | Fichas de treino (A/B/C) de cada aluno.               |
| `exercicios_treino` | Exercícios (séries, reps, carga, foto **e vídeo**).   |
| `acessos_catraca`   | Log de entradas (origem, repasse, liberação).         |

### Mídia dos exercícios
Cada exercício tem `imagem_demonstracao_url` e `video_demonstracao_url`
(clipe curto ≤ 10s, tocado em **loop** e mudo). O card do aluno usa o vídeo
quando disponível, com fallback para a imagem e, por fim, um ícone. Os `.webm`
em `public/videos/` são placeholders prontos — substitua pelos vídeos reais
(mesmos nomes) ou aponte `video_demonstracao_url` para o **Supabase Storage**.

---

## ☁️ Deploy (versão pública na web)

Deploy em **um clique** na Vercel — gera uma URL pública (ex.: `gymflow.vercel.app`)
para compartilhar. O `vercel.json` já vem configurado e, sem variáveis do
Supabase, o app sobe em **modo demonstração** (com os vídeos incluídos).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Falisonbielwhats1-beep%2Fmyrepository&project-name=gymflow&repository-name=gymflow)

Passo a passo manual (alternativa):

1. Acesse <https://vercel.com/new> e faça login com o GitHub.
2. Importe o repositório `alisonbielwhats1-beep/myrepository`.
3. (Opcional) Em *Environment Variables*, adicione
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
   `NEXT_PUBLIC_USE_MOCK=false` para usar dados reais.
4. **Deploy** — a URL pública é gerada em segundos.

---

## 🧱 Stack

- **Next.js 14** (App Router, Server Components)
- **Tailwind CSS** (design system em `tailwind.config.ts`)
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`)
- **Recharts** (gráficos do BI)
- **qrcode.react** (QR Code de acesso)
- **lucide-react** (ícones)
- **PWA** (`manifest.json` + service worker em `public/sw.js`)

---

## 📌 Notas de produção

- As políticas de RLS incluídas liberam **leitura pública** para a vitrine de
  demonstração. Em produção, restrinja por `auth.uid()` e claims de tenant.
- O upload de imagens no painel usa data URL no modo demo; conecte ao
  **Supabase Storage** para persistência real.
- As imagens são renderizadas com a classe `.media-native`, que **remove
  qualquer filtro** e preserva o estado original das fotos.

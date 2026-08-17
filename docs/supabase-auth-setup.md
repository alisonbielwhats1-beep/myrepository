# Configuração do Supabase Auth — GestAcad

O que **precisa ser feito no painel do Supabase e na Vercel** para o login, a
recuperação de senha e os e-mails funcionarem. O código já está pronto; estes
itens dependem de configuração e não podem ser feitos por migration.

> Contexto: em 11/08/2026 o link de "Esqueci minha senha" caía na página
> inicial em vez da tela de nova senha, porque o **Site URL** estava em
> `http://localhost:3000` e a allow-list não cobria o destino. Esta lista existe
> para isso não se repetir.
>
> **Atualização de 17/08/2026 — o app não depende mais desta configuração.**
> O problema voltou a acontecer, então a correção deixou de ser só de painel: o
> `GateRecuperacaoSenha` (montado no layout raiz) reconhece o retorno de
> recuperação em **qualquer** página — inclusive na home, quando o Supabase
> ignora o `redirect_to` e cai no Site URL — e leva o usuário para a tela de
> nova senha por conta própria. A configuração abaixo continua sendo o caminho
> ideal (um redirecionamento a menos, e a URL nunca exibe o token), mas se ela
> divergir o fluxo **continua funcionando**. Ver `lib/recuperacao-senha.ts` e
> `tests/recuperacao-senha.test.mjs`.

O projeto **não tem autocadastro**: as contas (dono e equipe) são criadas de
dentro do painel, já com o e-mail confirmado. Portanto **não é preciso**
configurar confirmação de e-mail para cadastro — só a recuperação de senha e o
convite de equipe usam e-mail/WhatsApp.

---

## 1. Site URL e Redirect URLs

**Onde:** Supabase → Authentication → URL Configuration.

| Campo | Valor |
|---|---|
| **Site URL** | `https://SEU-DOMINIO` (ex.: `https://myrepository-five-chi.vercel.app`) — nunca `localhost` em produção |
| **Redirect URLs** | as quatro entradas abaixo |

```
https://SEU-DOMINIO/auth/recuperar
https://SEU-DOMINIO/auth/callback
http://localhost:3000/auth/recuperar
http://localhost:3000/auth/callback
```

Se o link ainda cair no Site URL em vez da tela certa, adicione também as
versões com curinga de query (o Supabase às vezes anexa `?code=`):

```
https://SEU-DOMINIO/auth/recuperar?*
http://localhost:3000/auth/recuperar?*
```

**Como testar:** clique em "Esqueci minha senha", peça o link, abra o e-mail. O
link deve conter `.../auth/recuperar?code=...`. Ao clicar, você cai na tela
**"Criar nova senha"** já autenticado. Link velho/reusado leva a
`/recuperar-senha?aviso=...`, que mostra o motivo e o formulário de novo.

Se o link cair na **home** (allow-list divergente), o app se recupera sozinho:
o gate detecta o token na URL, estabelece a sessão e redireciona para
`/redefinir-senha`. Você percebe pelo redirecionamento extra — vale corrigir a
allow-list, mas o cliente não fica travado.

### Opcional: link que funciona em outro celular/navegador

O fluxo padrão (PKCE, `?code=`) exige abrir o link **no mesmo navegador** em que
a recuperação foi pedida, porque o verificador fica guardado ali. É comum pedir
no computador e abrir o e-mail no celular — nesse caso o app mostra o aviso
"abra no mesmo navegador… ou peça um novo".

Para permitir qualquer dispositivo, troque o template de e-mail
(Authentication → Emails → Reset password) para usar o token no lugar da
`ConfirmationURL`:

```html
<a href="{{ .SiteURL }}/auth/recuperar?token_hash={{ .TokenHash }}&type=recovery">
  Redefinir senha
</a>
```

O código já aceita esse formato (`token_hash` + `type=recovery`, via
`verifyOtp`), tanto na rota `/auth/recuperar` quanto no gate. Aproveite para
traduzir o e-mail — o template padrão do Supabase é em inglês.

## 2. Variáveis de ambiente (Vercel e `.env.local`)

**Onde:** Vercel → Settings → Environment Variables (marque Production, Preview e
Development). Localmente, em `.env.local` (modelo em `.env.local.example`).

| Variável | Valor | Exposta ao browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | sim (é público) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` | sim (é a chave pública, protegida por RLS) |
| `NEXT_PUBLIC_SITE_URL` | `https://SEU-DOMINIO` | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` | **NÃO — nunca com prefixo `NEXT_PUBLIC_`** |
| `ADMIN_EMAILS` | e-mails do superadmin, separados por vírgula | não |

`NEXT_PUBLIC_SITE_URL` é o que fixa o domínio dos links de e-mail e do QR do
aluno; sem ela, um deploy de preview geraria um link efêmero que morre em dias.
**Depois de alterar qualquer variável, refaça o deploy** — variável só entra no
build seguinte.

**Como testar:** `SUPABASE_SERVICE_ROLE_KEY` **não** pode aparecer no bundle do
navegador. Confirme que ela não tem prefixo `NEXT_PUBLIC_` e que nenhuma tela
`"use client"` importa `createServiceRoleClient` (só Server Components/Actions).

## 3. SMTP e remetente (envio de e-mail)

**Onde:** Supabase → Authentication → Emails / SMTP Settings.

- **O que configurar:** um SMTP próprio (Resend, SendGrid, Brevo, Amazon SES).
- **Por quê:** o serviço de e-mail embutido do Supabase é limitado a poucos
  envios por hora e destinado a desenvolvimento. Sem SMTP próprio, se vários
  funcionários pedirem recuperação na mesma tarde, parte não recebe — e a tela
  sempre responde "enviamos" (de propósito, para não revelar quais e-mails têm
  conta), então a falha passa despercebida.
- **Remetente:** um endereço do seu domínio (ex.: `nao-responda@seudominio`),
  não um Gmail pessoal, para não cair em spam.

**Como testar:** peça recuperação com um e-mail real e confirme a chegada,
inclusive no spam. Se demorar/faltar, o SMTP é a causa.

## 4. Templates de e-mail

**Onde:** Supabase → Authentication → Email Templates.

- **Reset Password:** o link precisa apontar para o fluxo PKCE
  (`{{ .ConfirmationURL }}`), que o Supabase resolve para a Redirect URL
  configurada no item 1. O template padrão já funciona; se personalizar,
  mantenha `{{ .ConfirmationURL }}`.
- Traduza o texto para português se quiser — não afeta o funcionamento.

## 5. Expiração dos links

**Onde:** Supabase → Authentication → (Email/Providers) → OTP / link expiry.

- **Valor sugerido:** 1 hora (3600 s) para o link de recuperação. Curto o
  bastante para segurança, longo o bastante para a pessoa abrir o e-mail com
  calma.
- **Como testar:** o app já trata link expirado — a tela `/redefinir-senha`
  recusa quando não há sessão de recuperação, e `/auth/recuperar` redireciona
  para `/recuperar-senha?erro=expirado`. Para ver, espere o link expirar (ou
  use um já consumido) e clique nele.

---

## Checklist rápido

- [ ] Site URL = domínio de produção (não localhost)
- [ ] 4 Redirect URLs (recuperar + callback, prod + local)
- [ ] `NEXT_PUBLIC_SITE_URL` na Vercel + redeploy
- [ ] `SUPABASE_SERVICE_ROLE_KEY` sem `NEXT_PUBLIC_`
- [ ] SMTP próprio configurado, remetente do domínio
- [ ] Recuperação de senha testada de ponta a ponta (e-mail → nova senha → login)

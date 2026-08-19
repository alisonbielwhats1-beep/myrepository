# Integração — Catraca física (Henry + leitor Control iD EVO)

Registra a passagem na catraca da própria academia e, no **modo online**, decide
em tempo real se a pessoa entra — usando a **mesma regra da recepção**
(`decidirAcesso`: status da matrícula + política de inadimplência da academia).
Nenhuma regra de acesso paralela é criada.

## Equipamento

- **Torniquete:** Henry (`henry.com.br`) — instalação/assistência Exacta Cards.
- **Leitor:** Control iD, linha **EVO** (identificação por rosto ou cartão). É ele
  que identifica a pessoa e comanda a catraca.

## Endpoint

```
POST https://gestacad.com.br/api/webhook/catraca/<slug-da-academia>
Authorization: Bearer <catraca_webhook_secret>
Content-Type: application/json
```

O `slug` e o **segredo** ficam em **Painel → Integrações → Catraca física**. O
segredo pode ser rotacionado a qualquer momento ("Gerar novo segredo") — ao
rotacionar, atualize-o também no equipamento/integrador.

## Corpo da requisição

Envie o identificador que o leitor tiver — **cartão/matrícula** (recomendado em
catraca física) **ou CPF**:

```json
{
  "matricula": "0231",
  "cpf": "00000000000",
  "evento_id": "abc-123"
}
```

| Campo         | Sinônimos aceitos                                             | Obrigatório |
| ------------- | ------------------------------------------------------------ | ----------- |
| `matricula`   | `matricula_codigo`, `cartao`, `card`, `codigo`, `cartao_codigo` | um dos dois¹ |
| `cpf`         | `documento`, `user_cpf`, `document`                          | um dos dois¹ |
| `evento_id`   | `event_id`, `checkin_id`, `check_in_id`, `access_id`, `log_id` | não (recomendado)² |

¹ É preciso enviar **cartão/matrícula ou CPF**. O app casa primeiro por
`matricula_codigo`, depois por `cpf` (ambos por academia).
² Se enviado, garante **idempotência**: reenviar o mesmo `evento_id` não duplica
o registro (mas a decisão é devolvida de novo para o equipamento agir).

## Resposta

```json
{
  "ok": true,
  "liberado": true,
  "status": "liberado",
  "aluno": { "id": "…", "nome": "…" },
  "motivo": null
}
```

| Campo      | Significado                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| `liberado` | **Abrir a catraca?** `true` para `liberado` e `alerta`; `false` para bloqueio e identificador desconhecido. O integrador mapeia este booleano para o comando de abertura. |
| `status`   | `liberado` \| `alerta` (entrou, mas com mensalidade vencida) \| `negado`.  |
| `aluno`    | Aluno vinculado, ou `null` se o identificador não foi encontrado.          |
| `motivo`   | Texto do motivo (ex.: bloqueio por inadimplência, cartão não cadastrado).  |

### Códigos HTTP

| Código | Quando                                                             |
| ------ | ----------------------------------------------------------------- |
| 200    | Passagem processada (inclui `liberado: false` e reenvio duplicado). |
| 400    | Corpo inválido ou sem `matricula`/`cpf`.                          |
| 401    | `Authorization: Bearer` ausente/incorreto.                        |
| 404    | Slug de academia inexistente.                                     |
| 500    | Falha interna ao registrar.                                       |

## Regras de decisão

- **Liberado / alerta:** entrada permitida (`liberado: true`). `alerta` é entrada
  com mensalidade vencida, mantida conforme a política da academia.
- **Bloqueado:** política de inadimplência barra a entrada (`liberado: false`),
  mas a tentativa **fica registrada** no histórico.
- **Identificador desconhecido:** por segurança **não libera** (`liberado: false`,
  `status: negado`) — só a recepção registra quem não está no cadastro.

A passagem é gravada em `acessos_catraca` com `origem = 'Catraca'` e aparece em
**Recepção → Histórico de acessos** e no dashboard, filtrável por origem.

## Configuração do equipamento (Control iD)

No leitor Control iD (linha EVO), configure o **modo online / servidor** apontando
para a URL acima, com o cabeçalho `Authorization: Bearer <segredo>` em cada
requisição de identificação. O detalhe de mapeamento do booleano `liberado` para
o acionamento do torniquete Henry fica a cargo do integrador (Exacta Cards),
conforme o firmware do equipamento.

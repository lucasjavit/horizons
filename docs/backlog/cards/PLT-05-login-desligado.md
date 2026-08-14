# PLT-05 · Login desligado por enquanto

**Estado:** feito (14/08/2026)
**Tamanho:** P
**Decisão do stakeholder (14/08/2026):** "desabilita o login por enquanto",
com a opção **guard desligado por completo** escolhida entre as duas
apresentadas.

## O que faz

`AUTH_DISABLED=true` no compose. Com isso:

- **nenhuma rota exige token** — o *fail closed* do PLT-02 fica inativo
- todo mundo é a conta de `DEFAULT_USER_EMAIL` (`eu@horizons.local`), resolvida
  **do banco**, não inventada: os serviços gravam com `userId`, e um id que não
  existe quebraria a chave estrangeira na primeira anotação salva
- o app entra direto, sem tela de login
- não há botão "Sair" — sairia para uma tela que o servidor não aceita
- a engrenagem aparece sem exigir papel, senão a Configurações ficaria
  inacessível justamente para quem desligou o login para mexer nela

## O risco, escrito por extenso

É o comportamento anterior ao PLT-02, e tem o mesmo risco: **quem alcançar a
porta 3333 lê `/api/settings/tokens`**, onde vivem as chaves de IA cifradas.
Cifradas contra vazamento do banco — não contra uma requisição autorizada.

Só vale enquanto a aplicação roda em rede local. **Não pode ir para o servidor
assim.**

Por isso a API **avisa no boot, toda vez**:

```
WARN [AuthService] AUTH_DISABLED=true — NENHUMA rota exige token. As chaves de
IA em /api/settings/tokens ficam acessiveis a quem alcancar esta porta. So use
em rede local; remova a variavel para religar o login.
```

Toda vez, e não uma só: subir sem autenticação é uma decisão, não um detalhe.
Aviso que aparece uma vez vira paisagem.

## Como religar

`AUTH_DISABLED=false` (ou apague a linha) e `GOOGLE_CLIENT_ID` preenchido.
**Nada mais precisa mudar** — o código do login continua inteiro no lugar.
Verificado nos dois sentidos, não só na ida.

## Critério de aceite

- [x] O app entra direto, sem tela de login, nos dois temas
- [x] Nenhum token no `localStorage` — não é sessão automática disfarçada
- [x] A conta resolvida é a que já tem o progresso das trilhas (mesmo `id`)
- [x] Configurações continua acessível
- [x] A API avisa no boot, toda vez
- [x] Religar devolve o 401 em todas as rotas protegidas
- [x] O `qa-rapido.py` segue o servidor em vez de reprovar

## Verificado (14/08/2026)

| O que | Resultado |
| --- | --- |
| Aviso no boot | presente nos logs da API |
| `/auth/config` | `{"authDisabled":true}` |
| `/tracks`, `/auth/me`, `/settings/tokens` sem token | **200** nos três (esperado neste modo) |
| `/auth/me` sem token | devolve `eu@horizons.local`, **mesmo `id`** de quem tem o progresso |
| Navegador, claro e escuro | entra direto, sem login, **zero erro de console** |
| `localStorage` | vazio — não há token escondido |
| Botão "Sair" | ausente |
| Engrenagem e Configurações | presentes e funcionando |
| `AUTH_DISABLED=false` | as três rotas voltam a **401** |
| `x-user-email` com o login religado | **401** — a porta velha segue fechada |
| Tela com o login religado | volta a pedir login |

## Efeito colateral tratado

O `qa-rapido.py` exigia 401 e passaria a reprovar. Agora **lê
`/auth/config` e segue o servidor**: espera 401 com o login ligado, 200 com ele
desligado, e imprime um aviso no modo desligado. Um teste que sempre falha para
de ser lido — seria pior que não ter teste.

## Quando reverter

Antes de publicar, sem exceção. O PLT-02 está pronto e verificado; falta só um
`GOOGLE_CLIENT_ID` real.

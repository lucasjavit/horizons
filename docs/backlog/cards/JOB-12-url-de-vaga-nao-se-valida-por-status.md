# JOB-12 · URL de vaga não se valida por status HTTP

**Estado:** aberto, e ainda não morde (25/08/2026)
**Tamanho:** P

## Por quê

Medido em 18/08, com `curl -L -o /dev/null -w "%{http_code} %{url_effective}"`:

| URL | status | destino final |
| --- | --- | --- |
| `job-boards.greenhouse.io/anthropic/jobs/0000000` (id **inventado**) | **200** | `.../anthropic?error=true` |
| `job-boards.greenhouse.io/pinterest/jobs/4902175` (vaga **real**) | **403** | `pinterestcareers.com/jobs/?gh_jid=4902175` |

**As duas leituras ingênuas erram, e erram invertido.** Quem validar por
`status == 200` aprova a vaga inventada e reprova a real.

O ID falso não dá 404: o Greenhouse redireciona em silêncio para o quadro da
empresa e responde 200 com "The job you are looking for is no longer open".
E vaga real de empresa grande devolve 403 para `curl` (proteção de bot), mesmo
estando aberta e acessível no navegador.

## Onde isso morde

Ainda não morde — é por isso que o card existe agora.

`applicationUrl` está no schema de extração (`busca.service.ts`) e **não é
exibido nem validado** hoje; está listado como pendência no
[JOB-08](JOB-08-prompt-de-busca.md). No dia em que virar link na tela, a
tentação óbvia é "checar se a URL responde antes de mostrar" — e essa
checagem, do jeito óbvio, faz o contrário do que promete.

## O critério que funciona

Não é o status. É o **destino**:

- URL final **igual** à pedida → provavelmente vaga
- redirect para o quadro da empresa, ou query `?error=true` → vaga morta
- corpo com título e descrição de vaga → confirmação

Em ATS, `?error=true` no destino final é sinal forte de ID inexistente.

## Critérios de aceite

- [x] Nenhum ponto do código trata `200` como "vaga existe" — conferido em 25/08/2026: a regra ruim nunca chegou a ser escrita
- [ ] Se `applicationUrl` for exibido, a validação usa destino final + corpo
- [ ] O controle negativo (`/jobs/0000000`) é reprovado pela regra escolhida
- [ ] Uma vaga real que responde 403 a `curl` **não** é descartada

## De onde veio

Achado por um agente que tentava medir alucinação de IA sem web, como efeito
colateral: ele precisou de um controle negativo e descobriu que o controle
negativo passava. O teste original não produziu número — três instâncias se
recusaram a inventar vagas —, mas este subproduto vale mais que o teste.


## Conferido em 25/08/2026: continua preventivo

Varredura no `backend/src/jobs/`: nenhum ponto valida vaga por status HTTP, e
`applicationUrl` continua sem ser exibido. O card **não virou dívida** — ele é
um aviso deixado no caminho de quem for implementar a exibição.

Segue aberto de propósito. Fechar seria apagar o aviso justamente antes da hora
em que ele serve.

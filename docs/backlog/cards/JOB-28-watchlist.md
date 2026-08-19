# JOB-28 · Medir a watchlist antes de decidir

**Estado:** esperando medição
**Tamanho:** P (a medição) — ? (o resto)

## Por quê

`backend/data/ats/fontes.yaml` tem ~90 startups sem API: Cursor, Baseten,
Cognition, Dub, Distyl. Página de carreira própria, sem board consultável.

**É o único lugar onde o Firecrawl ainda faz sentido** — e a hipótese de ser
o "nível power" do [JOB-27](JOB-27-tres-niveis.md).

## O problema

**A watchlist nunca foi executada.** Se render 3 vagas, não é um nível de
produto — é uma linha do nível 2.

## O que fazer primeiro

Rodar o Firecrawl em ~10 dessas páginas e contar: quantas vagas, quantas de
engenharia, quantas remotas, quantas com elegibilidade legível.

Só depois decidir se vira feature.

## Cuidado

O Firecrawl custa 5 créditos por página e tem rate limit de 14 req/min — que já
derrubou uma busca inteira em 17/08.

#!/usr/bin/env python3
"""Filtra `empresas.yaml` pelos paises/regioes que interessam ao Horizons.

**NAO ESTA EM USO desde 18/08/2026.** O escopo do produto mudou: o alvo deixou
de ser "dev brasileiro" e passou a ser "dev em pais emergente" — India tem 324
empresas no catalogo contra 118 do Brasil, e o filtro anterior as removia.

O arquivo `empresas.yaml` esta com as 1.953 empresas originais, sem filtro.
Este script fica aqui porque a lista `ALVO` documenta as regioes e pode voltar
a servir se o produto reduzir escopo de novo. Rodar hoje ENCOLHE o catalogo
para 866 — nao rode sem querer isso.

Regiao nao existe no arquivo: `hiring_countries` so tem pais individual (139
valores distintos). "Latam" e "Europe" viram a lista de paises correspondente,
senao nao filtrariam nada.

O criterio e UNIAO: fica a empresa que contrata em ao menos um dos alvos. Uma
que so contrata nos EUA continua servindo — a pessoa pode se candidatar de
qualquer forma, e e o `elegivelBrasil` da vaga que decide, nao este arquivo.

Lembrete que vale repetir: `hiring_countries` e da EMPRESA, nao da vaga.
Medido em 18/08: 10 empresas com "Brazil" declarado deram 771 vagas, 279 de
engenharia, e so 4 com local BR/LATAM.
"""
import sys, yaml
from pathlib import Path

LATAM = [
    'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Uruguay',
    'Costa Rica', 'Panama', 'Ecuador', 'Guatemala', 'Dominican Republic',
    'Bolivia', 'Paraguay', 'Venezuela', 'El Salvador', 'Honduras', 'Nicaragua',
]
EUROPA = [
    'United Kingdom', 'Germany', 'France', 'Spain', 'Netherlands', 'Poland',
    'Ireland', 'Sweden', 'Italy', 'Belgium', 'Romania', 'Portugal',
    'Switzerland', 'Austria', 'Denmark', 'Norway', 'Finland', 'Czechia',
    'Czech Republic', 'Greece', 'Hungary', 'Bulgaria', 'Croatia', 'Slovakia',
    'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Ukraine', 'Serbia',
    'Luxembourg', 'Cyprus', 'Malta', 'Iceland',
]

ALVO = {'United States', 'Australia', 'Canada', 'United Arab Emirates'}
ALVO.update(LATAM)
ALVO.update(EUROPA)

RAIZ = Path(__file__).resolve().parent.parent / 'backend' / 'data' / 'ats'


def main() -> int:
    origem = RAIZ / 'empresas.yaml'
    d = yaml.safe_load(origem.read_text())
    todas = d['companies']

    # Duas etapas, e a segunda e o que o stakeholder pediu em 18/08: nao
    # basta escolher QUAIS empresas ficam, a lista DENTRO de cada uma tambem
    # e podada. Sem isso a Deel entrava por causa do Brasil e trazia China,
    # India e Japao junto — paises que nao interessam a quem procura daqui.
    mantidas = []
    for e in todas:
        paises = e.get('hiring_countries') or []
        dentro = sorted(ALVO.intersection(paises))
        if not dentro:
            continue
        podada = dict(e)
        podada['hiring_countries'] = dentro
        mantidas.append(podada)

    saida = RAIZ / 'empresas.yaml'
    saida.write_text(
        '# Empresas com contratacao em: United States, Australia, Brazil,\n'
        '# LATAM, Europa, Canada e United Arab Emirates.\n'
        '#\n'
        '# Filtrado de look4job/companies.yaml por scripts/filtrar-empresas.py.\n'
        '# `hiring_countries` e da EMPRESA, nao da vaga — ver LEIA-ME.md.\n'
        + yaml.safe_dump({'companies': mantidas}, allow_unicode=True, sort_keys=False)
    )

    fora = len(todas) - len(mantidas)
    antes = sum(len(e.get('hiring_countries') or []) for e in todas)
    depois = sum(len(e['hiring_countries']) for e in mantidas)
    print(f'{len(todas)} empresas -> {len(mantidas)} mantidas ({fora} fora)')
    print(f'paises listados: {antes} -> {depois}')
    ats = {}
    for e in mantidas:
        ats[e.get('ats', '?')] = ats.get(e.get('ats', '?'), 0) + 1
    for k, v in sorted(ats.items(), key=lambda x: -x[1]):
        print(f'  {v:5}  {k}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

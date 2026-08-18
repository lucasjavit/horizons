#!/usr/bin/env python3
"""Filtra `empresas.yaml` pelos paises/regioes que interessam ao Horizons.

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

    mantidas = [
        e for e in todas
        if ALVO.intersection(e.get('hiring_countries') or [])
    ]

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
    print(f'{len(todas)} empresas -> {len(mantidas)} mantidas ({fora} fora)')
    ats = {}
    for e in mantidas:
        ats[e.get('ats', '?')] = ats.get(e.get('ats', '?'), 0) + 1
    for k, v in sorted(ats.items(), key=lambda x: -x[1]):
        print(f'  {v:5}  {k}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Filtra `empresas.yaml`: fica quem paga em moeda forte.

**A tese do produto: vaga remota para ganhar em moeda forte.** O usuario mora
num pais emergente — Brasil, India, Mexico, Polonia — e quer receber em dolar
ou euro, nao na moeda dele. Entao o que importa nao e onde ele mora, e sim
onde a empresa esta ancorada.

Isso corrige um erro de 18/08: o filtro anterior tratava a lista de paises
fortes como "de onde vem o candidato" e removia India, Indonesia e Filipinas
do arquivo. Errado nos dois sentidos — India e onde o usuario MORA (324
empresas contratam la, mais que qualquer outro emergente), e o pais forte e
onde a empresa PAGA.

O criterio, entao:

- **fica** a empresa com ao menos um pais de moeda forte em `hiring_countries`
- **sai** a que so contrata em emergente — e a empresa local pagando em moeda
  fraca, que e exatamente o que o produto quer evitar
- os paises emergentes **permanecem** na lista de cada empresa: e por eles que
  se descobre se a vaga aceita alguem que mora ali

Medido em 18/08 sobre as 1.953: 415 pagam forte E contratam em emergente (o
alvo), 416 so pagam forte sem contratar em emergente, 85 so contratam em
emergente (saem).
"""
import sys
import yaml
from pathlib import Path

# Onde a empresa paga bem. Nao e "de onde vem o candidato".
MOEDA_FORTE = {
    'United States', 'Canada', 'United Kingdom', 'Germany', 'Netherlands',
    'Australia', 'Switzerland', 'Sweden', 'Ireland', 'United Arab Emirates',
    'Norway', 'Denmark', 'France', 'Austria', 'Belgium', 'Finland',
    'Luxembourg', 'Singapore', 'Japan', 'New Zealand', 'Iceland', 'Israel',
    'Hong Kong', 'South Korea', 'Qatar', 'Saudi Arabia', 'Kuwait',
}

# Onde o usuario mora. Serve para marcar a empresa como "contrata em
# emergente" — nunca para remove-la.
EMERGENTES = {
    'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Uruguay',
    'Costa Rica', 'Panama', 'Ecuador', 'Guatemala', 'Dominican Republic',
    'Bolivia', 'Paraguay', 'Venezuela', 'El Salvador', 'Honduras',
    'Nicaragua', 'India', 'Indonesia', 'Philippines', 'Vietnam', 'Thailand',
    'Malaysia', 'Poland', 'Romania', 'Ukraine', 'Turkey', 'Türkiye',
    'Nigeria', 'Kenya', 'South Africa', 'Egypt', 'Pakistan', 'Bangladesh',
    'Sri Lanka', 'Serbia', 'Bulgaria', 'Morocco', 'Tunisia', 'Ghana',
    'Czechia', 'Czech Republic', 'Hungary', 'Croatia', 'Slovakia', 'Lithuania',
    'Latvia', 'Estonia', 'Greece', 'Portugal', 'Spain', 'Italy', 'Slovenia',
}

RAIZ = Path(__file__).resolve().parent.parent / 'backend' / 'data' / 'ats'


def main() -> int:
    origem = RAIZ / 'empresas.yaml'
    todas = yaml.safe_load(origem.read_text())['companies']

    mantidas = []
    com_emergente = 0
    for e in todas:
        paises = set(e.get('hiring_countries') or [])
        if not MOEDA_FORTE & paises:
            continue
        nova = dict(e)
        # Marca quais emergentes essa empresa alcanca. E o que responde "ela
        # contrata alguem que mora onde eu moro?" sem reler a lista inteira.
        emerg = sorted(EMERGENTES & paises)
        if emerg:
            nova['contrata_em'] = emerg
            com_emergente += 1
        mantidas.append(nova)

    (RAIZ / 'empresas.yaml').write_text(
        '# Empresas que pagam em MOEDA FORTE — a tese do produto.\n'
        '#\n'
        '# Fica quem tem ao menos um pais de moeda forte em `hiring_countries`.\n'
        '# Sai quem so contrata em pais emergente: e a empresa local pagando na\n'
        '# moeda fraca, que e o que o usuario quer evitar.\n'
        '#\n'
        '# `contrata_em` lista os emergentes que a empresa alcanca — e por ele\n'
        '# que se sabe se ela contrata quem mora no pais do usuario.\n'
        '#\n'
        '# Gerado por scripts/filtrar-empresas.py. Ver LEIA-ME.md.\n'
        + yaml.safe_dump({'companies': mantidas}, allow_unicode=True, sort_keys=False)
    )

    print(f'{len(todas)} -> {len(mantidas)} empresas pagam em moeda forte')
    print(f'  destas, {com_emergente} contratam em pais emergente')
    print(f'  removidas: {len(todas) - len(mantidas)} (so moeda fraca)')
    ats = {}
    for e in mantidas:
        ats[e.get('ats', '?')] = ats.get(e.get('ats', '?'), 0) + 1
    for k, v in sorted(ats.items(), key=lambda x: -x[1]):
        print(f'  {v:5}  {k}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

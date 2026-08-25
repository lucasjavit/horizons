#!/usr/bin/env python3
"""
Promove descobertas confirmadas para o catalogo de ATS (JOB-37, tempo 3).

**Promover e decisao humana, e por isso isto e um script rodado a mao.** O cron
das 3h verifica e CLASSIFICA; nada nele grava em `backend/data/ats/`. Gravar
automatico deixaria dado curado e versionado a merce de uma extracao ruim.

E preciso porque o catalogo e versionado em git: uma descoberta que so existe
no banco morre no proximo banco novo.

Uso:
    python3 scripts/exportar-descobertas.py            # so mostra o que entraria
    python3 scripts/exportar-descobertas.py --aplicar  # escreve em empresas.json

Sem `--aplicar` ele nao toca em arquivo nenhum: o padrao e o ensaio, porque o
que ele edita e um arquivo de 926 empresas que alguem curou a mao.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "backend/data/ats/empresas.json"

# O mesmo servico de banco do compose. Sem `docker compose exec` o script
# exigiria psql instalado na maquina de quem roda.
SQL = """
SELECT host, ats, COALESCE("slugTestado", slug) AS slug, empresa, vagas
FROM ats_discoveries
WHERE estado = 'confirmada'
  AND COALESCE("slugTestado", slug) <> ''
  AND vagas > 0
ORDER BY vagas DESC;
"""


def do_banco() -> list[dict]:
    """As descobertas confirmadas, direto do banco do compose."""
    r = subprocess.run(
        ["docker", "compose", "exec", "-T", "db",
         "psql", "-U", "horizons", "-d", "horizons", "-t", "-A", "-F", "\t", "-c", SQL],
        cwd=RAIZ, capture_output=True, text=True,
    )
    if r.returncode != 0:
        sys.exit(f"nao consegui ler o banco: {r.stderr.strip()[:300]}")
    linhas = []
    for l in r.stdout.strip().splitlines():
        if not l.strip():
            continue
        host, ats, slug, empresa, vagas = l.split("\t")
        linhas.append({"host": host, "ats": ats, "slug": slug,
                       "empresa": empresa, "vagas": int(vagas or 0)})
    return linhas


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--aplicar", action="store_true",
                   help="escreve em empresas.json (sem isto, so mostra)")
    args = p.parse_args()

    catalogo = json.loads(CATALOGO.read_text())
    # A chave e o par (ats, slug), e nao o NOME da empresa. Foi exatamente o
    # engano da medicao original do JOB-37: casando por nome, Duolingo, Udemy e
    # Epic Games pareciam estar fora do catalogo, e as tres ja estavam la.
    conhecidos = {(e["ats"], e["slug"].lower()) for e in catalogo}

    novos = []
    for d in do_banco():
        if (d["ats"], d["slug"].lower()) in conhecidos:
            continue
        conhecidos.add((d["ats"], d["slug"].lower()))
        novos.append(d)

    if not novos:
        print("nada a promover — nenhuma descoberta confirmada fora do catalogo")
        return

    print(f"{len(novos)} para promover:\n")
    for d in novos:
        print(f"  {d['vagas']:5d} vagas  {d['ats']:11s} {d['slug']:24s} {d['empresa'][:40]}")

    if not args.aplicar:
        print("\n(ensaio — rode com --aplicar para escrever)")
        return

    # O formato e o mesmo do arquivo, uma linha por campo:
    # {"nome":"Canonical","ats":"greenhouse","slug":"canonical","contrataEm":[],"porte":"grande"}
    #
    # `contrataEm` vazio e `porte` ausente de proposito: sao curadoria, e o
    # script nao tem como saber. Quem promover preenche se souber.
    for d in novos:
        catalogo.append({"nome": d["empresa"], "ats": d["ats"],
                         "slug": d["slug"], "contrataEm": []})
    CATALOGO.write_text(json.dumps(catalogo, ensure_ascii=False, indent=0) + "\n")
    print(f"\n{len(novos)} adicionadas a {CATALOGO.relative_to(RAIZ)}")
    print("confira o diff antes de commitar — este arquivo e curadoria.")


if __name__ == "__main__":
    main()

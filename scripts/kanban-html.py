#!/usr/bin/env python3
"""
Gera o quadro em HTML a partir dos cards markdown.

O markdown continua sendo a verdade — este script so o apresenta. Rodar de
novo depois de mexer num card mantem os dois em sincronia; um HTML escrito a
mao envelheceria em silencio.

Uso:  python3 scripts/kanban-html.py
Saida: docs/backlog/index.html
"""
import html
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CARDS = RAIZ / "docs/backlog/cards"
SPRINTS = RAIZ / "docs/backlog/sprints"
SAIDA = RAIZ / "docs/backlog/index.html"

# Ordem das colunas e como cada estado do card cai numa delas.
COLUNAS = [
    ("backlog", "Backlog"),
    ("pronto", "Pronto para fazer"),
    ("fazendo", "Fazendo"),
    ("feito", "Feito"),
]


def coluna_de(estado: str) -> str:
    e = estado.lower()
    if e.startswith("feito"):
        return "feito"
    if "fazendo" in e:
        return "fazendo"
    if "pronto" in e or "parcial" in e:
        return "pronto"
    return "backlog"


def campo(texto: str, nome: str) -> str:
    m = re.search(rf"\*\*{nome}:\*\*\s*(.+?)(?=\n\*\*|\n\n)", texto, re.S)
    return " ".join(m.group(1).split()) if m else ""


def secao(texto: str, titulo: str) -> str:
    """Devolve o corpo de uma secao `## Titulo` ate a proxima."""
    m = re.search(rf"^## {re.escape(titulo)}\s*\n(.*?)(?=^## |\Z)", texto, re.S | re.M)
    return m.group(1).strip() if m else ""


def criterios(texto: str) -> tuple[int, int]:
    """(marcados, total) das caixas de criterio de aceite."""
    bloco = secao(texto, "Critério de aceite")
    if not bloco:
        return (0, 0)
    itens = re.findall(r"^\s*- \[([ x])\]", bloco, re.M)
    return (sum(1 for i in itens if i == "x"), len(itens))


def primeiro_paragrafo(texto: str, titulo: str) -> str:
    bloco = secao(texto, titulo)
    if not bloco:
        return ""
    for p in bloco.split("\n\n"):
        limpo = " ".join(p.split())
        if limpo and not limpo.startswith(("-", "|", "```", "#")):
            return limpo
    return ""


def ler_cards() -> list[dict]:
    cards = []
    for arquivo in sorted(CARDS.glob("*.md")):
        t = arquivo.read_text(encoding="utf-8")
        titulo_linha = t.splitlines()[0].lstrip("# ").strip()
        ident, _, titulo = titulo_linha.partition(" · ")
        estado = campo(t, "Estado")
        feitos, total = criterios(t)
        cards.append({
            "id": ident.strip(),
            "titulo": titulo.strip() or ident.strip(),
            "estado": estado,
            "coluna": coluna_de(estado),
            "tamanho": campo(t, "Tamanho").split("—")[0].strip() or "?",
            "decisao": campo(t, "Decisão do stakeholder (12/08/2026)"),
            "porque": primeiro_paragrafo(t, "Por quê"),
            "criterios": (feitos, total),
            "arquivo": f"cards/{arquivo.name}",
            "bloqueio": secao(t, "Depende de").strip(),
        })
    return cards


def ler_sprint() -> dict | None:
    arquivos = sorted(SPRINTS.glob("*.md"))
    if not arquivos:
        return None
    t = arquivos[-1].read_text(encoding="utf-8")
    return {
        "titulo": t.splitlines()[0].lstrip("# ").strip(),
        "objetivo": campo(t, "Objetivo"),
        "periodo": f'{campo(t, "De")}'.replace(" · **Até:** ", " até "),
        "arquivo": f"sprints/{arquivos[-1].name}",
    }


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def limpar_markdown(s: str) -> str:
    """Tira a marcacao inline: o cartao mostra texto, nao markdown cru."""
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"`(.+?)`", r"\1", s)
    return s


def cartao(c: dict) -> str:
    feitos, total = c["criterios"]
    barra = ""
    # Card feito com criterios desmarcados mostraria "0/5" e pareceria parado.
    # A coluna ja diz que esta feito; a barra so ajuda no que esta em curso.
    if total and not (c["coluna"] == "feito" and feitos == 0):
        pct = round(feitos / total * 100)
        barra = f"""
        <div class="progresso" role="img"
             aria-label="{feitos} de {total} critérios atendidos">
          <div class="barra"><span style="width:{pct}%"></span></div>
          <span class="conta">{feitos}/{total}</span>
        </div>"""

    extra = ""
    if c["decisao"]:
        extra = f'<p class="decisao"><strong>Decisão:</strong> {esc(limpar_markdown(c["decisao"]))}</p>'
    elif c["bloqueio"]:
        primeira = c["bloqueio"].split("\n")[0].lstrip("- ").strip()
        extra = f'<p class="bloqueio">Depende de: {esc(limpar_markdown(primeira))}</p>'

    parcial = ' <span class="tag-parcial">parcial</span>' if "parcial" in c["estado"].lower() else ""

    return f"""      <li class="cartao">
        <a href="{esc(c["arquivo"])}">
          <div class="cabeca">
            <span class="ident">{esc(c["id"])}</span>
            <span class="tam" title="Tamanho">{esc(c["tamanho"])}</span>
          </div>
          <h3>{esc(c["titulo"])}{parcial}</h3>
          <p class="porque">{esc(limpar_markdown(c["porque"])[:170])}</p>
          {extra}{barra}
        </a>
      </li>"""


def montar() -> str:
    cards = ler_cards()
    sprint = ler_sprint()
    por_coluna = {chave: [c for c in cards if c["coluna"] == chave] for chave, _ in COLUNAS}

    colunas_html = ""
    for chave, rotulo in COLUNAS:
        lista = por_coluna[chave]
        itens = "\n".join(cartao(c) for c in lista) or '      <li class="vazio">Nada aqui.</li>'
        colunas_html += f"""
    <section class="coluna col-{chave}" aria-labelledby="col-{chave}">
      <h2 id="col-{chave}">{rotulo} <span class="n">{len(lista)}</span></h2>
      <ul>
{itens}
      </ul>
    </section>"""

    sprint_html = ""
    if sprint:
        sprint_html = f"""
  <aside class="sprint">
    <p class="rotulo">Sprint atual</p>
    <h2><a href="{esc(sprint["arquivo"])}">{esc(sprint["titulo"])}</a></h2>
    <p class="objetivo">{esc(sprint["objetivo"])}</p>
  </aside>"""

    feitos = len(por_coluna["feito"])
    return f"""<title>Quadro do Horizons</title>
<style>
:root {{
  --surface: #ffffff;
  --surface-raised: #ffffff;
  --surface-sunken: #f6f8f7;
  --border: #d5ded9;
  --text: #0f1411;
  --text-muted: #566860;
  --brand: #00704a;
  --accent-ink: #7a5c0c;
  --feito: #00704a;
  --atencao: #a34a17;
  --sombra: 0 1px 2px rgb(15 20 17 / .06);
}}
:root:not([data-theme="light"]) {{
  @media (prefers-color-scheme: dark) {{
    --surface: #0f1411;
    --surface-raised: #1a211d;
    --surface-sunken: #0a0d0b;
    --border: #2b352f;
    --text: #f6f8f7;
    --text-muted: #7d9188;
    --brand: #2f9a72;
    --accent-ink: #e5be4f;
    --feito: #2f9a72;
    --atencao: #e08b5a;
    --sombra: none;
  }}
}}
:root[data-theme="dark"] {{
  --surface: #0f1411;
  --surface-raised: #1a211d;
  --surface-sunken: #0a0d0b;
  --border: #2b352f;
  --text: #f6f8f7;
  --text-muted: #7d9188;
  --brand: #2f9a72;
  --accent-ink: #e5be4f;
  --feito: #2f9a72;
  --atencao: #e08b5a;
  --sombra: none;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  padding: 2rem 1.5rem 4rem;
  background: var(--surface);
  color: var(--text);
  font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}}
.topo {{ max-width: 78rem; margin: 0 auto 2rem; }}
.topo h1 {{
  margin: 0;
  font-size: 1.75rem;
  letter-spacing: -.02em;
}}
.topo h1 span {{ color: var(--brand); }}
.topo .resumo {{ margin: .35rem 0 0; color: var(--text-muted); font-size: .9rem; }}
.sprint {{
  max-width: 78rem;
  margin: 0 auto 2rem;
  padding: 1rem 1.25rem;
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  border-left: 3px solid var(--brand);
  border-radius: .5rem;
}}
.sprint .rotulo {{
  margin: 0; font-size: .7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted);
}}
.sprint h2 {{ margin: .2rem 0 .3rem; font-size: 1.05rem; }}
.sprint a {{ color: var(--text); text-decoration: none; }}
.sprint a:hover {{ text-decoration: underline; }}
.sprint .objetivo {{ margin: 0; color: var(--text-muted); font-size: .9rem; }}
.quadro {{
  max-width: 78rem; margin: 0 auto;
  display: grid; gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  align-items: start;
}}
.coluna h2 {{
  display: flex; align-items: center; gap: .5rem;
  margin: 0 0 .75rem;
  font-size: .78rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--text-muted);
}}
.coluna h2 .n {{
  min-width: 1.35rem; padding: 0 .3rem;
  background: var(--surface-sunken); border: 1px solid var(--border);
  border-radius: 999px;
  font-size: .72rem; text-align: center; letter-spacing: 0;
}}
.col-feito h2 {{ color: var(--feito); }}
.coluna ul {{ margin: 0; padding: 0; list-style: none; display: grid; gap: .6rem; }}
.cartao a {{
  display: block; padding: .8rem .9rem;
  background: var(--surface-raised);
  border: 1px solid var(--border); border-radius: .55rem;
  box-shadow: var(--sombra);
  color: inherit; text-decoration: none;
  transition: border-color .15s;
}}
.cartao a:hover {{ border-color: var(--brand); }}
.cartao a:focus-visible {{ outline: 2px solid var(--accent-ink); outline-offset: 2px; }}
.col-feito .cartao a {{ border-left: 3px solid var(--feito); }}
.cabeca {{ display: flex; justify-content: space-between; align-items: center; gap: .5rem; }}
.ident {{
  font: 700 .68rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .04em; color: var(--text-muted);
}}
.tam {{
  min-width: 1.1rem; padding: .1rem .3rem;
  border: 1px solid var(--border); border-radius: .25rem;
  font: 700 .62rem/1.3 ui-monospace, monospace; text-align: center;
  color: var(--text-muted);
}}
.cartao h3 {{ margin: .45rem 0 .3rem; font-size: .92rem; line-height: 1.3; letter-spacing: -.01em; }}
.tag-parcial {{
  display: inline-block; margin-left: .3rem; padding: .05rem .35rem;
  background: var(--surface-sunken); border: 1px solid var(--atencao);
  border-radius: .25rem;
  font-size: .62rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .04em; color: var(--atencao); vertical-align: middle;
}}
.porque {{ margin: 0; font-size: .8rem; line-height: 1.45; color: var(--text-muted); }}
.decisao, .bloqueio {{
  margin: .5rem 0 0; padding-top: .5rem;
  border-top: 1px solid var(--border);
  font-size: .75rem; color: var(--text-muted);
}}
.decisao strong {{ color: var(--text); }}
.bloqueio {{ color: var(--atencao); }}
.progresso {{ display: flex; align-items: center; gap: .5rem; margin-top: .6rem; }}
.barra {{ flex: 1; height: .3rem; background: var(--surface-sunken);
  border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }}
.barra span {{ display: block; height: 100%; background: var(--feito); }}
.conta {{ font: .68rem/1 ui-monospace, monospace; color: var(--text-muted); }}
.vazio {{
  padding: .9rem; border: 1px dashed var(--border); border-radius: .55rem;
  font-size: .8rem; color: var(--text-muted); text-align: center;
}}
.rodape {{
  max-width: 78rem; margin: 2.5rem auto 0; padding-top: 1.25rem;
  border-top: 1px solid var(--border);
  font-size: .78rem; color: var(--text-muted);
}}
.rodape code {{ font-family: ui-monospace, monospace; }}
</style>

<header class="topo">
  <h1><span>Horizons</span> · quadro</h1>
  <p class="resumo">{len(cards)} cards · {feitos} feitos</p>
</header>
{sprint_html}
<main class="quadro">{colunas_html}
</main>

<footer class="rodape">
  Gerado dos arquivos em <code>docs/backlog/cards/</code> —
  o markdown é a verdade. Para atualizar:
  <code>python3 scripts/kanban-html.py</code>
</footer>
"""


if __name__ == "__main__":
    SAIDA.write_text(montar(), encoding="utf-8")
    print(f"{SAIDA.relative_to(RAIZ)} gerado")

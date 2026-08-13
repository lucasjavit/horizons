#!/usr/bin/env python3
"""
QA rapido — o que roda a cada commit.

Nao e a bateria adversarial completa (essa leva minutos e vive em
scripts/qa-completo.py). Aqui so entra o que e barato e pega regressao
grosseira: a pagina abre, nao explode no console, o dinheiro soma certo.

Sai com codigo 1 se achar problema, e o hook de pre-commit barra o commit.
"""
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:5173"
falhas: list[str] = []


def ok(cond: bool, msg: str) -> bool:
    print(f"  {'ok  ' if cond else 'FALHA'}  {msg}")
    if not cond:
        falhas.append(msg)
    return cond


def containers_no_ar() -> bool:
    try:
        r = subprocess.run(
            ["docker", "compose", "ps", "--status=running", "--format", "{{.Name}}"],
            capture_output=True, text=True, timeout=20,
        )
        return "horizons-web" in r.stdout
    except Exception:
        return False


print("QA rapido")
print()

# 1. O build e o portao mais barato: tsc estrito pega tipo errado, import
#    nao usado e enum de TS antes de qualquer coisa subir.
print("build")
r = subprocess.run(
    ["npm", "run", "build"], cwd="frontend",
    capture_output=True, text=True, timeout=300,
)
if not ok(r.returncode == 0, "frontend compila"):
    print(r.stdout[-1500:])
    print(r.stderr[-1500:])

# 2. O jsPDF precisa continuar fora do bundle principal. Desde o INV-05 ele
#    vive em public/vendor/ e entra por <script> classico, entao a regressao
#    a vigiar e alguem voltar a importa-lo no codigo.
if r.returncode == 0:
    from pathlib import Path
    assets = Path("frontend/dist/assets")
    principal = [f for f in assets.glob("index-*.js")]
    if principal:
        conteudo = principal[0].read_text(errors="ignore")
        # Procura por assinatura da BIBLIOTECA, nao pelo nome: o codigo que
        # carrega o script referencia `window.jspdf.jsPDF` legitimamente.
        # "AcroForm" e "getTextDimensions" so existem dentro do jsPDF.
        embutido = "AcroForm" in conteudo or "getTextDimensions" in conteudo
        ok(not embutido, "jspdf fora do bundle principal")
        tamanho = principal[0].stat().st_size
        ok(tamanho < 450_000, f"bundle principal em {tamanho // 1024} KB (limite 440)")
    vendor = Path("frontend/public/vendor/jspdf.umd.min.js")
    ok(vendor.exists(), "jspdf.umd.min.js presente em public/vendor")

# 3. Se os containers estiverem no ar, confere o comportamento. Se nao
#    estiverem, pula sem reprovar: nem todo commit acontece com tudo rodando.
print()
if not containers_no_ar():
    print("containers")
    print("  pulado  horizons-web nao esta no ar; so o build foi verificado")
else:
    print("rotas")
    for rota in ["/", "/invoice", "/t/system-design"]:
        try:
            with urllib.request.urlopen(BASE + rota, timeout=10) as resp:
                ok(resp.status == 200, f"{rota} responde 200")
        except (urllib.error.URLError, TimeoutError) as e:
            ok(False, f"{rota} responde 200 ({e})")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print()
        print("navegador")
        print("  pulado  playwright ausente")
    else:
        print()
        print("navegador")
        with sync_playwright() as p:
            nav = p.chromium.launch()
            pg = nav.new_context().new_page()
            erros: list[str] = []
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.on(
                "console",
                lambda m: erros.append(m.text) if m.type == "error" else None,
            )

            pg.goto(f"{BASE}/invoice", wait_until="networkidle")
            ok(pg.locator("main#conteudo").count() == 1,
               "invoice tem main#conteudo (contrato do skip link)")

            # A soma tem de bater com a soma das linhas impressas. Este e o
            # teste que protege o dinheiro: 3 x 33.33 = 99.99, e 0.1 dez vezes
            # nao pode virar 0.9999999999999999.
            # aria-controls e nao o nome: o icone de ajuda ao lado tambem
            # tem "Items" no rotulo, e o get_by_role acharia os dois.
            pg.locator('button[aria-controls="bloco-3"]').click()
            pg.wait_for_timeout(300)
            li = pg.locator("#bloco-3 ul li").first
            li.locator("input").nth(0).fill("Servico")
            li.locator("input").nth(1).fill("3")
            li.locator("input").nth(2).fill("33.33")
            pg.wait_for_timeout(400)
            linha = li.locator("output").inner_text()
            ok(linha == "$99.99", f"3 x 33.33 = $99.99 (obtido {linha})")

            li.locator("input").nth(1).fill("1")
            li.locator("input").nth(2).fill("1.005")
            pg.wait_for_timeout(400)
            linha = li.locator("output").inner_text()
            ok(linha == "$1.01", f"1.005 arredonda para $1.01 (obtido {linha})")

            # INV-11: virgula decimal. Antes disso, `26,50` virava $2.650 —
            # cem vezes mais — e nada na tela denunciava. E o tipo de erro
            # que faz alguem cobrar errado de um cliente de verdade.
            li.locator("input").nth(1).fill("44")
            li.locator("input").nth(2).fill("26,50")
            pg.wait_for_timeout(500)
            linha = li.locator("output").inner_text()
            ok(linha == "$1,166.00", f"44 x 26,50 = $1,166.00 (obtido {linha})")

            # A previa e o PDF leem do mesmo modulo, mas sao dois desenhos
            # do mesmo documento. Este teste e o que impede de divergirem em
            # silencio — foi a mitigacao combinada no INV-09.
            li.locator("input").nth(1).fill("3")
            li.locator("input").nth(2).fill("33.33")
            pg.wait_for_timeout(500)
            previa = pg.locator('[aria-labelledby="preview-heading"]').inner_text()
            ok("$99.99" in previa, "previa mostra o mesmo valor da linha")

            # As trilhas nao podem quebrar por causa de mexida na invoice.
            pg.goto(f"{BASE}/", wait_until="networkidle")
            ok("trilha" in pg.locator("main").inner_text().lower(),
               "pagina de trilhas continua carregando")

            reais = [e for e in erros if "favicon" not in e.lower()]
            ok(len(reais) == 0, f"sem erro de console ({reais[:1]})")

            nav.close()

print()
if falhas:
    print(f"{len(falhas)} falha(s):")
    for f in falhas:
        print(f"  - {f}")
    print()
    print("Para commitar assim mesmo: git commit --no-verify")
    sys.exit(1)

print("tudo certo")
sys.exit(0)

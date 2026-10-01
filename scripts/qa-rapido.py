#!/usr/bin/env python3
"""
QA rapido — o que roda a cada commit.

Nao e a bateria adversarial completa (essa leva minutos e vive em
scripts/qa-completo.py). Aqui so entra o que e barato e pega regressao
grosseira: a pagina abre, nao explode no console, o dinheiro soma certo.

Sai com codigo 1 se achar problema, e o hook de pre-commit barra o commit.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:5173"
API = "http://localhost:3333/api"
falhas: list[str] = []


def ok(cond: bool, msg: str) -> bool:
    print(f"  {'ok  ' if cond else 'FALHA'}  {msg}")
    if not cond:
        falhas.append(msg)
    return cond


def token_de_papel(papel: str) -> str | None:
    """
    Assina um token para um usuario com o papel pedido.

    Os papeis sao 'COMMON_USER', 'MANAGER' e 'ADMIN' (PLT-09). ⚠️ Era 'USER'
    ate 31/08; a migration `20260831210000_papeis_e_desativacao` renomeou. O
    nome antigo aqui nao dava erro — nao achava usuario nenhum e o bloco de
    papeis se PULAVA em silencio, que e a forma mais cara de um teste morrer.

    Diferente de `token_de_teste()`, que pega o primeiro usuario que aparecer:
    aqui o papel E o objeto do teste, entao pegar qualquer um mediria outra
    coisa. Devolve `None` se nao houver usuario daquele papel no banco — o
    teste se pula em vez de reprovar, porque um banco sem usuario comum e um
    banco incompleto, e nao um bug do codigo.
    """
    sql = f"select id, email, role from users where role = '{papel}' limit 1;"
    try:
        r = subprocess.run(
            ["docker", "compose", "exec", "-T", "db", "psql", "-U", "horizons",
             "-d", "horizons", "-tAF,", "-c", sql],
            capture_output=True, text=True, timeout=20,
        )
        linhas = [l for l in r.stdout.strip().splitlines() if l.strip()]
        if not linhas:
            return None
        linha = linhas[0].split(",")
        if len(linha) < 3:
            return None
        js = (
            "const jwt=require('jsonwebtoken');"
            f"console.log(jwt.sign({{sub:'{linha[0]}',email:'{linha[1]}',"
            f"role:'{linha[2]}'}},process.env.JWT_SECRET,{{expiresIn:'1h'}}))"
        )
        r = subprocess.run(
            ["docker", "compose", "exec", "-T", "api", "node", "-e", js],
            capture_output=True, text=True, timeout=20,
        )
        tok = r.stdout.strip()
        return tok if tok.count(".") == 2 else None
    except (subprocess.SubprocessError, IndexError, OSError):
        return None


def token_de_teste() -> str | None:
    """
    Assina um token com o segredo do proprio container.

    Depois do PLT-02 nao ha mais tela sem sessao: sem isto, o QA abriria a
    pagina de login e reprovaria tudo. Assinar de dentro do container e o
    unico jeito de o script continuar autonomo — ele nao conhece o segredo,
    e nem deveria.
    """
    sql = "select id, email, role from users limit 1;"
    try:
        r = subprocess.run(
            ["docker", "compose", "exec", "-T", "db", "psql", "-U", "horizons",
             "-d", "horizons", "-tAF,", "-c", sql],
            capture_output=True, text=True, timeout=20,
        )
        linha = r.stdout.strip().splitlines()[0].split(",")
        if len(linha) < 3:
            return None
        js = (
            "const jwt=require('jsonwebtoken');"
            f"console.log(jwt.sign({{sub:'{linha[0]}',email:'{linha[1]}',"
            f"role:'{linha[2]}'}},process.env.JWT_SECRET,{{expiresIn:'1h'}}))"
        )
        r = subprocess.run(
            ["docker", "compose", "exec", "-T", "api", "node", "-e", js],
            capture_output=True, text=True, timeout=20,
        )
        tok = r.stdout.strip()
        return tok if tok.count(".") == 2 else None
    except (subprocess.SubprocessError, IndexError, OSError):
        return None


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
    # `/` e a busca de vagas desde o PLT-13 (01/10); `/t/system-design` saiu
    # com as trilhas. `/vagas` entra na lista porque o atalho continua valendo
    # e um 404 ali quebraria os links antigos sem ninguem notar.
    for rota in ["/", "/vagas", "/invoice"]:
        try:
            with urllib.request.urlopen(BASE + rota, timeout=10) as resp:
                ok(resp.status == 200, f"{rota} responde 200")
        except (urllib.error.URLError, TimeoutError) as e:
            ok(False, f"{rota} responde 200 ({e})")

    # PLT-02: rota protegida sem token responde 401. E o comportamento que
    # o guard global garante, e o mais caro de perder sem perceber — uma
    # regressao aqui nao aparece na tela, so no vazamento.
    #
    # Com AUTH_DISABLED o esperado se inverte: as rotas respondem 200 de
    # proposito. O teste segue o servidor em vez de exigir um valor fixo,
    # senao viraria falha permanente enquanto o login estiver desligado — e
    # falha que sempre falha para de ser lida.
    print()
    print("sessao")
    cfg = {}
    try:
        with urllib.request.urlopen(API + "/auth/config", timeout=10) as resp:
            cfg = json.load(resp)
        ok("googleClientId" in cfg, "/auth/config e publico")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        ok(False, f"/auth/config e publico ({e})")

    sem_login = cfg.get("authDisabled") is True
    if sem_login:
        print("  aviso   AUTH_DISABLED=true — o fail closed esta DESLIGADO")
    esperado = 200 if sem_login else 401

    def status_sem_token(rota: str):
        try:
            with urllib.request.urlopen(API + rota, timeout=10) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            return e.code
        except (urllib.error.URLError, TimeoutError) as e:
            return str(e)

    # Estas continuam exigindo sessao. Sao as que guardam dado de alguem: a
    # identidade e as chaves de IA.
    for rota in ["/auth/me", "/settings/tokens"]:
        obtido = status_sem_token(rota)
        ok(obtido == esperado,
           f"{rota} sem token responde {esperado} (deu {obtido})")

    # As rotas de trilha sairam no PLT-13 (01/10), e com elas tres checagens
    # que mediam o progresso: a leitura publica de `/tracks`, o isolamento
    # ("anonimo ve zero concluidas") e o token invalido contra `/tracks`.
    #
    # **A ultima nao se perdeu, mudou de rota.** `POST /jobs/facets` e a unica
    # `@SessaoOpcional()` que sobrou, e e nela que a regra vale agora: token
    # podre em rota opcional da 401 em vez de virar anonimo em silencio. O
    # `fail-closed.e2e.spec.ts` cobre o mesmo por metadado; aqui e pela porta.
    req = urllib.request.Request(
        API + "/jobs/facets",
        data=b"{}",
        headers={"Authorization": "Bearer abc.def.ghi",
                 "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            obtido = resp.status
    except urllib.error.HTTPError as e:
        obtido = e.code
    except (urllib.error.URLError, TimeoutError) as e:
        obtido = str(e)
    ok(obtido == 401 or sem_login,
       f"token invalido em rota opcional responde 401 (deu {obtido})")

    # ------------------------------------------------------------------
    # JOB-47 — a busca funciona sem login, e o anonimo nao alcanca o pago.
    #
    # Pela PORTA, e nao por metadado: o `busca-anonima.e2e.spec.ts` prova a
    # mesma coisa com a aplicacao montada em teste, e aqui se confere o
    # servidor que esta NO AR — que e onde um decorador revertido num deploy
    # apareceria.
    # ------------------------------------------------------------------
    def post_json(rota: str, corpo: dict, tok: str | None = None):
        """Faz o POST e devolve (status, texto). Texto vazio se nao houver."""
        cabecalhos = {"Content-Type": "application/json"}
        if tok:
            cabecalhos["Authorization"] = f"Bearer {tok}"
        req = urllib.request.Request(
            API + rota,
            data=json.dumps(corpo).encode(),
            headers=cabecalhos,
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError) as e:
            return str(e), ""

    # 1. Sem token nenhum, a busca ATENDE. 401 aqui e o card desfeito.
    status, corpo = post_json("/jobs/search", {"job_titles": ["Backend Engineer"]})
    ok(status == 201,
       f"busca anonima responde 201 (deu {status})")

    # 2. E o que ela devolve nao tem vaga com menos de 14 dias.
    #
    # Le o stream SSE ja completo (o urlopen esperou o fim) e olha o
    # `postedAt` de cada vaga. **Vaga sem data conta como violacao**: o
    # servidor nao deve entregar ao anonimo o que nao sabe datar.
    if status == 201:
        import datetime as _dt
        agora = _dt.datetime.now(_dt.timezone.utc)
        novas, total_vagas, sem_data = [], 0, 0
        for bloco in corpo.split("\n\n"):
            linha = bloco.strip()
            if not linha.startswith("data: "):
                continue
            try:
                ev = json.loads(linha[6:])
            except json.JSONDecodeError:
                continue
            if ev.get("tipo") != "vaga":
                continue
            total_vagas += 1
            posted = (ev.get("vaga") or {}).get("postedAt")
            if not posted:
                sem_data += 1
                continue
            try:
                quando = _dt.datetime.fromisoformat(posted.replace("Z", "+00:00"))
            except ValueError:
                sem_data += 1
                continue
            if (agora - quando).days < 14:
                novas.append(posted)

        if total_vagas == 0:
            # Nao e falha: o filtro pode nao ter casado nada na faixa
            # envelhecida, e o freehire e servico de terceiro. Mas precisa
            # APARECER — uma checagem que se pula em silencio e o defeito que
            # o QA-03 documenta.
            print("  aviso   busca anonima devolveu 0 vagas "
                  "(filtro apertado ou freehire fora do ar) — corte nao medido")
        else:
            ok(not novas,
               f"anonimo recebe so vaga com 14+ dias "
               f"({len(novas)} de {total_vagas} violaram: {novas[:2]})")
            ok(sem_data == 0,
               f"toda vaga do anonimo tem data ({sem_data} de {total_vagas} sem)")

    # 3. Token invalido na BUSCA continua dando 401 — a armadilha do card.
    #    Com `@Public()` isto responderia 201, e sessao expirada passaria a
    #    parecer busca com metade do acervo.
    status_podre, _ = post_json(
        "/jobs/search", {"job_titles": ["Backend"]}, tok="abc.def.ghi")
    ok(status_podre == 401 or sem_login,
       f"token invalido na busca responde 401 (deu {status_podre})")

    # 4. Salvar continua exigindo sessao.
    status_salvar, _ = post_json("/jobs/saved", {"url": "https://exemplo.com/vaga"})
    ok(status_salvar == esperado,
       f"salvar vaga sem token responde {esperado} (deu {status_salvar})")

    # PLT-12: /config/* e so do admin, e a rota de produto nao vaza configuracao.
    #
    # Este bloco existe porque o defeito que ele cobre nasceu de um comentario
    # que envelheceu: `GET /settings/recursos` era aberto quando so devolvia um
    # booleano, e continuou aberto quando passou a devolver o `hint` das chaves
    # e a ordem da cadeia de IA. Nada apontava para a frase desatualizada. Aqui
    # aponta.
    if sem_login:
        print("  pulado  papeis (AUTH_DISABLED: todo mundo e admin)")
    else:
        tok_user = token_de_papel("COMMON_USER")
        if tok_user is None:
            print("  pulado  papeis (nenhum COMMON_USER no banco)")
        else:
            def status_com(rota: str, tok: str):
                req = urllib.request.Request(
                    API + rota, headers={"Authorization": f"Bearer {tok}"})
                try:
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        return resp.status, json.load(resp)
                except urllib.error.HTTPError as e:
                    return e.code, None
                except (urllib.error.URLError, TimeoutError, ValueError) as e:
                    return str(e), None

            def patch_com(rota: str, tok: str, corpo: dict):
                req = urllib.request.Request(
                    API + rota, data=json.dumps(corpo).encode(), method="PATCH",
                    headers={"Authorization": f"Bearer {tok}",
                             "Content-Type": "application/json"})
                try:
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        return resp.status
                except urllib.error.HTTPError as e:
                    return e.code
                except (urllib.error.URLError, TimeoutError) as e:
                    return str(e)

            # As rotas que alimentam as sub-paginas de /config.
            for rota in ["/settings/recursos", "/settings/tokens",
                         "/settings/deploy/prontidao", "/jobs/descobertas",
                         "/email/metricas"]:
                obtido, _ = status_com(rota, tok_user)
                ok(obtido == 403, f"{rota} nega usuario comum (deu {obtido})")

            # PLT-11: a gestao de usuarios tem TRES niveis, e nao dois.
            #
            # Este bloco existe porque o defeito que ele cobre e invisivel na
            # tela: a listagem nao pode ser @AdminOnly() (o manager ve), e um
            # decorador trocado por engano abriria a lista de todo mundo — ou
            # deixaria o manager de fora sem ninguem notar ate ele reclamar.
            for rota in ["/usuarios"]:
                obtido, _ = status_com(rota, tok_user)
                ok(obtido == 403, f"{rota} nega usuario comum (deu {obtido})")

            tok_manager = token_de_papel("MANAGER")
            if tok_manager is None:
                print("  pulado  gestao (nenhum MANAGER no banco)")
            else:
                obtido, _ = status_com("/usuarios", tok_manager)
                ok(obtido == 200, f"/usuarios atende o manager (deu {obtido})")

                # Mudar papel continua @AdminOnly(). Se um dia a classe inteira
                # virar @ManagerOrAdmin(), o manager passaria a promover
                # managers — e o dono nao saberia.
                alvo = None
                obtido, corpo_lista = status_com("/usuarios", tok_manager)
                if isinstance(corpo_lista, dict):
                    comuns = [u for u in corpo_lista.get("itens", [])
                              if u.get("role") == "COMMON_USER"]
                    alvo = comuns[0]["id"] if comuns else None
                if alvo:
                    obtido = patch_com(f"/usuarios/{alvo}/papel", tok_manager,
                                       {"role": "MANAGER"})
                    ok(obtido == 403,
                       f"manager nao muda papel de ninguem (deu {obtido})")

                # A lista NAO carrega dado pessoal. O jeito mais seguro de nao
                # vazar um campo e nunca busca-lo — este teste pega o campo
                # acrescentado ao `select:` sem pensar.
                if isinstance(corpo_lista, dict) and corpo_lista.get("itens"):
                    proibidos = {"document", "documentHint", "documentEnc",
                                 "documentCountry", "phone", "address"}
                    vazou = proibidos & set(corpo_lista["itens"][0])
                    ok(not vazou,
                       f"/usuarios nao devolve dado pessoal (vazou: {sorted(vazou)})")

            # Ninguem vira ADMIN pela tela: o papel de admin vem do
            # ADMIN_EMAILS, e um caminho pela API criaria a segunda fonte de
            # verdade que o proximo login desfaz.
            tok_admin = token_de_papel("ADMIN")
            if tok_admin:
                obtido, corpo_lista = status_com("/usuarios", tok_admin)
                alvo = None
                if isinstance(corpo_lista, dict):
                    outros = [u for u in corpo_lista.get("itens", [])
                              if not u.get("isSelf") and u.get("role") != "ADMIN"]
                    alvo = outros[0]["id"] if outros else None
                    eu = [u for u in corpo_lista.get("itens", []) if u.get("isSelf")]
                    if eu:
                        # O dono nao se rebaixa nem se desativa: perderia o
                        # acesso a tela que o devolveria.
                        obtido = patch_com(f"/usuarios/{eu[0]['id']}/papel",
                                           tok_admin, {"role": "COMMON_USER"})
                        ok(obtido == 403,
                           f"admin nao rebaixa a si mesmo (deu {obtido})")
                        obtido = patch_com(f"/usuarios/{eu[0]['id']}/ativo",
                                           tok_admin, {"active": False})
                        ok(obtido == 403,
                           f"admin nao desativa a si mesmo (deu {obtido})")
                if alvo:
                    obtido = patch_com(f"/usuarios/{alvo}/papel", tok_admin,
                                       {"role": "ADMIN"})
                    ok(obtido == 400,
                       f"ninguem vira ADMIN pela API (deu {obtido})")

            # A rota de produto continua aberta — a aba Jobs depende dela.
            obtido, corpo = status_com("/settings/recursos/produto", tok_user)
            ok(obtido == 200,
               f"/settings/recursos/produto atende usuario comum (deu {obtido})")

            # E devolve SO os dois booleanos. Este e o teste que pega o campo
            # acrescentado sem pensar: qualquer chave a mais reprova aqui.
            if isinstance(corpo, dict):
                esperadas = {"leituraCvAtiva", "historicoAtivo"}
                sobrando = set(corpo) - esperadas
                ok(not sobrando,
                   f"rota de produto nao vaza configuracao (sobrou: {sorted(sobrando) or 'nada'})")

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

            tok = None if sem_login else token_de_teste()
            if tok:
                # Precisa de uma navegacao antes: localStorage e por origem,
                # e about:blank nao tem a origem do app.
                pg.goto(BASE, wait_until="domcontentloaded")
                pg.evaluate(
                    "t => localStorage.setItem('horizons.token', t)", tok
                )
            if not sem_login:
                ok(tok is not None, "consegue abrir sessao de teste")

            pg.goto(f"{BASE}/invoice", wait_until="networkidle")
            ok(pg.locator("main#conteudo").count() == 1,
               "invoice tem main#conteudo (contrato do skip link)")

            # A soma tem de bater com a soma das linhas impressas. Este e o
            # teste que protege o dinheiro: 3 x 33.33 = 99.99, e 0.1 dez vezes
            # nao pode virar 0.9999999999999999.
            # aria-controls e nao o nome: o icone de ajuda ao lado tambem
            # tem "Items" no rotulo, e o get_by_role acharia os dois.
            pg.locator('button[aria-controls="bloco-4"]').click()
            pg.wait_for_timeout(300)
            li = pg.locator("#bloco-4 ul li").first
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
            # A previa pode estar desligada (a escolha fica no localStorage).
            # Liga antes de conferir, senao o hook reprova por uma preferencia
            # da pessoa em vez de por um defeito.
            if pg.locator('[aria-labelledby="preview-heading"]').count() == 0:
                pg.get_by_role("button", name="Show preview").click()
                pg.wait_for_timeout(600)
            previa = pg.locator('[aria-labelledby="preview-heading"]').inner_text()
            ok("$99.99" in previa, "previa mostra o mesmo valor da linha")

            # A home nao pode quebrar por causa de mexida na invoice. Era a
            # pagina de trilhas ate 01/10; desde o PLT-13 e a busca de vagas.
            #
            # Confere o `main#conteudo` E um elemento que so existe depois que
            # a pagina monta de verdade (o campo de busca), e nao o <h1>: um
            # titulo estatico aparece mesmo com a API fora do ar, entao
            # afirmar sobre ele passaria numa tela quebrada.
            pg.goto(f"{BASE}/", wait_until="networkidle")
            ok(pg.locator("main#conteudo").count() == 1,
               "home tem main#conteudo (contrato do skip link)")
            ok(pg.locator('input[type="search"], input[role="combobox"]').count() > 0,
               "home mostra a busca de vagas")

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

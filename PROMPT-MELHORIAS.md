# Prompt de melhoria — Horizons (pós-auditoria de usabilidade)

> Cole o conteúdo abaixo (a partir de "CONTEXTO") no agente da sua IDE.
> Ele é autocontido: não depende de nenhuma conversa anterior.

---

## CONTEXTO

Você vai corrigir problemas de usabilidade e acessibilidade do **Horizons**,
uma plataforma pessoal de trilhas de estudo que já está pronta e rodando em
`/home/legion/projects/horizons`. A trilha de System Design tem 13 módulos e
75 aulas, todas com conteúdo escrito. Não há nada a construir do zero — o
trabalho é de correção pontual.

**Usuário:** um desenvolvedor em progressão de carreira, estudando por conta
própria. É o único usuário da plataforma. Isso importa nas decisões: não há
onboarding a projetar nem base de usuários a segmentar, mas há uma expectativa
alta de eficiência de teclado, e a anotação pessoal é o dado mais valioso do
sistema — é o registro do que ele aprendeu.

Uma auditoria heurística (Nielsen + WCAG 2.2 AA) mediu a aplicação no navegador
e encontrou **6 achados graves e 10 menores**, com conformidade em 69%.
Nenhum crítico. O que segue é a lista dos achados, com a evidência medida.

## STACK (versões exatas — não faça downgrade)

| Camada   | Tecnologia                                    |
| -------- | --------------------------------------------- |
| Frontend | React 19.2 + Vite 8.2 + TypeScript + Tailwind **v4**.3 |
| Router   | react-router-dom 7.18                         |
| HTTP     | axios 1.19                                    |
| Backend  | NestJS 11 + TypeScript                        |
| ORM      | Prisma **7**.9 + PostgreSQL 16                |

### Armadilhas de versão

1. **Tailwind v4** não usa `tailwind.config.js`. A configuração é CSS-first via
   `@import 'tailwindcss'` e bloco `@theme` em `frontend/src/index.css`.
2. **Prisma 7** removeu `url` do `datasource`; a URL vive em
   `backend/prisma.config.ts`, e o comando de seed fica em `migrations.seed`
   nesse mesmo arquivo (não no `package.json`).
3. **React 19** — sem `React.FC`, sem import obrigatório de React.
4. O build do backend emite em `dist/src/main`, não `dist/main` (o
   `prisma.config.ts` na raiz amplia o rootDir inferido pelo tsc).

## COMO RODAR

A aplicação inteira sobe em contêiner:

```bash
docker compose up -d --build     # web:5173, api:3333, db:5433
```

Para desenvolver com hot reload, use só o banco em contêiner:

```bash
docker compose up -d db
cd backend  && npm run start:dev     # :3333
cd frontend && npm run dev           # :5173
```

Os dois modos disputam as portas 3333 e 5173 — rode um de cada vez.

## ARQUIVOS RELEVANTES

```
frontend/
├── index.html                          ← G5 (lang e title)
└── src/
    ├── index.css                       design system, tokens semânticos
    ├── App.tsx                         rotas e header
    ├── lib/api.ts                      cliente axios
    ├── types/api.ts                    espelho manual dos DTOs do backend
    ├── components/
    │   ├── LessonSidebar.tsx           ← G3, G4
    │   ├── ProgressBar.tsx
    │   ├── Quiz.tsx
    │   ├── States.tsx                  loading / erro / vazio
    │   └── blocks/
    │       ├── BlockRenderer.tsx       ← M1 (cor do bloco warn)
    │       └── inline.tsx              ênfase e código inline
    └── pages/
        ├── TracksPage.tsx
        ├── TrackPage.tsx
        └── LessonPage.tsx              ← G1, G2, G6, M2, M4 (NoteBox no fim)
```

**Regra de estilo:** use sempre os tokens semânticos (`var(--surface)`,
`var(--text)`, `var(--brand)`, `var(--accent)`, `var(--border)`,
`var(--text-muted)`, `var(--accent-ink)`), nunca a cor crua — o tema escuro
depende disso e já funciona. Comentários em português, só onde explicam o
"porquê".

---

## O QUE CORRIGIR

Faça na ordem abaixo: ela vai do mais barato/mais crítico ao polimento.

### Etapa 1 — Correções de uma linha (minutos)

**G5 · O documento se declara em inglês.** `frontend/index.html` tem
`lang="en"` com todo o conteúdo em português, e o `<title>` é `frontend` — o
nome do diretório. Leitores de tela aplicam pronúncia inglesa ao texto inteiro.

- Trocar para `lang="pt-BR"`.
- Definir o título por rota: `Consistent hashing · Horizons` na aula,
  `System Design · Horizons` na trilha, `Horizons` na home. Um `useEffect` que
  ajusta `document.title` em cada página resolve, sem adicionar dependência.

**M1 · Um rótulo reprova em contraste.** O label `O ERRO CLÁSSICO` do bloco
`warn` fica em 4,42:1 no tema claro — abaixo do mínimo de 4,5:1 da WCAG AA.
Todo o resto passa, inclusive o dourado.

- Em `BlockRenderer.tsx`, trocar a constante `WARN` de `#B4531A` para
  `#A34A17`, que mede 5,22:1 sobre o mesmo fundo. O tema escuro já passa
  (6,71:1) e não precisa mudar.

### Etapa 2 — Proteger a anotação (o achado mais importante)

Três dos seis graves saem daqui. A anotação é o único dado que o usuário cria
e o único que ele pode perder — e hoje perde em silêncio. O componente é o
`NoteBox`, no fim de `frontend/src/pages/LessonPage.tsx`.

**G1 · O rascunho é descartado ao trocar de aula.** O texto só persiste com
clique no botão. Navegar para outra aula apaga o que foi digitado, sem aviso.

Evidência medida:

```
digitou "RASCUNHO NAO SALVO" → clicou numa aula na sidebar → voltou
campo = ""     ← perdido, sem confirmação e sem aviso
```

- Implementar salvamento automático com debounce de ~800 ms após a última
  tecla, mantendo o botão como confirmação explícita.
- Indicar o estado de forma discreta: "salvando…" → "salvo".
- Cancelar o debounce pendente ao desmontar, e **gravar antes de sair** se
  houver alteração não salva.

**G2 · Salvar vazio apaga a anotação existente.** O botão fica habilitado com
o campo em branco e a gravação sobrescreve o conteúdo anterior sem confirmar.
Com o salvamento automático do G1, isso fica mais perigoso, não menos — trate
os dois juntos.

Evidência medida:

```
salvou "conteudo salvo de verdade"  → persistiu
esvaziou o campo, botão habilitado  → true
salvou vazio, sem confirmação       → ""
```

- Ao passar de um conteúdo não vazio para vazio, pedir confirmação explícita
  antes de gravar (não deixar o autosave apagar sozinho).
- Ou oferecer desfazer por alguns segundos após a gravação. Escolha uma das
  duas e explique a escolha no comentário.

**M4 · O erro ao salvar é discreto demais.** A falha aparece como texto cinza
pequeno ao lado do botão — o único ponto onde se pode perder trabalho é o que
tem menos peso visual na interface.

- Usar a cor de alerta, deixar explícito que **nada foi salvo** e que o texto
  continua no campo. Não limpar o campo em caso de erro.

### Etapa 3 — Navegação e eficiência

**G3 · 78 tabulações até o conteúdo da aula.** A sidebar lista as 75 aulas
antes do `<main>` na ordem de foco.

Evidência medida: `Tab até document.activeElement.closest('main') → 78`.

- Adicionar um *skip link* como primeiro elemento focável da página
  ("Pular para o conteúdo"), visível apenas quando recebe foco, apontando para
  um `id` no `<main>`.

**G4 · Não há busca em 75 aulas.** Achar "aquela aula sobre quórum" exige
lembrar o módulo e rolar a sidebar. Para quem volta ao material para consultar,
é o atrito mais frequente.

- Campo de busca filtrando por título e resumo, no mínimo. O `GET /tracks/:slug`
  já devolve título e `summary` de todas as aulas — dá para filtrar no cliente
  sem endpoint novo.
- Se quiser buscar no corpo das aulas, aí sim precisa de backend: um
  `GET /tracks/:slug/search?q=` usando `content` no Postgres. Trate como
  opcional e diga explicitamente se não fez.

**M3 · Nenhum atalho de teclado.** A persona é desenvolvedor; atalho é
expectativa, não luxo.

- `/` abre a busca, `J`/`K` navegam entre aulas, `C` marca concluída.
- Não capturar as teclas quando o foco estiver num campo de texto — senão
  digitar na anotação vira navegação. Esse detalhe é o que costuma quebrar.

**G6 · O nome do módulo é texto morto.** A aula mostra "CONCEITOS
FUNDAMENTAIS" acima do título, sem link e sem caminho de volta ao módulo — só
à trilha inteira. No celular, com a sidebar fechada, nada indica onde você está.

- Transformar em navegação real: Trilhas › System Design › Conceitos
  fundamentais › aula. O item do módulo pode levar à trilha com aquele módulo
  expandido.

### Etapa 4 — Polimento

**M2 · Dois alvos de toque abaixo do mínimo** (WCAG 2.2 exige 24×24):

```
20px  "🏗️ System Design"    (título da sidebar)
16px  "fonte original ↗"    (link de leitura complementar)
```

Aumentar o preenchimento vertical dos dois. O botão principal já está correto
(48 px no mobile).

**M5 · O vocabulário visual nunca é explicado.** Ponto dourado, ponto cinza,
selo "em breve", barra dourada sobre verde — tudo é decifrável por dedução,
nada é declarado.

- Uma legenda discreta ao pé da sidebar resolve sem ocupar espaço.

---

## O QUE **NÃO** MEXER

A auditoria mediu estes pontos como corretos. Não os altere ao corrigir o
resto — se algum quebrar, é regressão:

- **Contraste** — corpo 18,6:1, dourado 5,76:1 no claro e 8,88:1 no escuro.
- **Foco visível** — contorno dourado de 2 px com offset, definido
  globalmente em `index.css`.
- **Estados de carga e erro** — spinner com `role="status"`, erro em
  `role="alert"` com botão de retentar em toda chamada.
- **Progresso otimista com rollback** — marcar aula reflete na hora e reverte
  se a API falhar. Já funciona nas duas telas.
- **Semântica** — `main`, `nav`, `header`; um `h1` por página; `aria-current`,
  `aria-expanded`, `aria-label` nos lugares certos.
- **Responsivo** — sem transbordo horizontal em 390 px.
- **Tema escuro** — todos os pares de cor medidos passam.

## QUALIDADE

- TypeScript estrito, sem `any`.
- Ao mudar DTO, atualizar os dois lados: `backend/src/tracks/track.dto.ts` e
  `frontend/src/types/api.ts` são duplicados conscientemente.
- **Valide antes de declarar pronto.** Não afirme que algo funciona sem ter
  executado:

```bash
cd frontend && npm run build && npx tsc --noEmit -p tsconfig.app.json && npm run lint
cd backend  && npm run build && npx tsc --noEmit -p tsconfig.json && npx eslint "src/**/*.ts"
```

- Teste no navegador de verdade, não só no build. Em especial:
  - digitar na anotação e navegar para outra aula → o texto sobrevive;
  - esvaziar uma anotação com conteúdo → pede confirmação;
  - `Tab` a partir do topo da aula → o primeiro foco é o skip link;
  - digitar "quórum" na busca → encontra a aula de consenso;
  - digitar a letra `c` dentro da anotação → **não** marca a aula como concluída.

- Ao final, reporte o que ficou de fora e por quê. Se algum item não foi feito,
  diga — não deixe implícito.

## CRITÉRIO DE PRONTO

Concluídas as etapas 1 a 3, a conformidade sai de 69% para cerca de 88%, sem
nenhum achado grave em aberto. A etapa 4 é polimento e pode ficar para depois,
desde que registrada como pendente.

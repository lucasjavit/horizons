/**
 * Rejeita caractere de controle no que vem do rastreador (JOB-54, defeito 1).
 *
 * ## O que estava acontecendo
 *
 * Um `\u0000` em QUALQUER campo string do lote derrubava o Postgres com
 * *invalid byte sequence for encoding UTF8*. Isso virava **500**, e o lote
 * ficava gravado pela metade: medido em 06/10/2026 com `[ok-antes, NUL,
 * ok-depois]`, so `ok-antes` entrou. O CLAUDE.md ja avisava sobre o `'\u0000'`;
 * o aviso valia aqui.
 *
 * O pior caso nao e o 500, e o que vem depois dele: uma vaga com NUL no titulo
 * (ATS copiando lixo de HTML) **trava o board inteiro em reenvio permanente**,
 * porque o rastreador nunca recebe a resposta que esvaziaria a fila.
 *
 * ## Por que 400 e nao sanitizacao
 *
 * Limpar o caractere em silencio gravaria um titulo diferente do que o anuncio
 * diz, e ninguem olha esta tabela — o rastreador e um processo. Um 400 com o
 * caminho do campo na mensagem e o unico desfecho em que o lado que ERROU
 * descobre que errou. O dado e de terceiro: recusar e mais honesto que
 * consertar por conta.
 *
 * ## O que conta como caractere de controle
 *
 * `C0` (U+0000–U+001F) e `C1` (U+007F–U+009F), **menos** tab, LF e CR — esses
 * tres aparecem de verdade em descricao de vaga copiada de HTML e o Postgres
 * os aceita. Os outros nao tem uso legitimo num campo de anuncio, e o NUL em
 * particular nem chega a ser gravavel.
 */
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * C0 e C1 menos `\t`, `\n`, `\r`.
 *
 * Sem a flag `g`: `RegExp.test` com `g` guarda `lastIndex` entre chamadas e o
 * segundo teste da mesma expressao sobre outra string comeca do meio — um
 * validador que erra alternadamente e pior que nenhum.
 */
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

/**
 * Quantos niveis do `snapshot` sao percorridos.
 *
 * **O limite existe para a recursao nao ser a arma.** O `snapshot` e
 * `@IsObject()` — o rastreador poe o que quiser dentro —, e uma validacao que
 * descesse sem teto estouraria a pilha com um objeto de 100.000 niveis, o que
 * trocaria o 500 do NUL por um 500 de recursao. Profundidade acima do teto e
 * **recusada**, nao ignorada: parar de olhar e deixar o NUL entrar por baixo.
 *
 * 20 e folgado para o que o snapshot guarda hoje (salario e trechos, 1 nivel).
 */
export const PROFUNDIDADE_MAXIMA_DO_SNAPSHOT = 20;

/** Onde achou o problema, para a mensagem do 400 dizer o caminho. */
type Achado = { caminho: string } | null;

/**
 * Varre um valor JSON inteiro — chaves e valores, recursivamente.
 *
 * **As chaves tambem sao verificadas**, e nao e detalhe: `{"ru\u0000im": 1}`
 * tem o NUL so na chave, e o Prisma serializa o objeto inteiro para a coluna
 * `Json` — o Postgres recusa o mesmo jeito.
 */
function acharControle(valor: unknown, caminho: string, nivel: number): Achado {
  if (nivel > PROFUNDIDADE_MAXIMA_DO_SNAPSHOT) {
    return { caminho: `${caminho} (acima de ${PROFUNDIDADE_MAXIMA_DO_SNAPSHOT} niveis)` };
  }

  if (typeof valor === 'string') {
    return CONTROLE.test(valor) ? { caminho } : null;
  }

  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i += 1) {
      const achado = acharControle(valor[i], `${caminho}[${i}]`, nivel + 1);
      if (achado) return achado;
    }
    return null;
  }

  // `null` e `typeof 'object'`, e `Object.entries(null)` estoura.
  if (valor !== null && typeof valor === 'object') {
    for (const [chave, dentro] of Object.entries(valor)) {
      if (CONTROLE.test(chave)) return { caminho: `${caminho}.<chave ${JSON.stringify(chave)}>` };
      const achado = acharControle(dentro, `${caminho}.${chave}`, nivel + 1);
      if (achado) return achado;
    }
    return null;
  }

  // Numero, booleano, `undefined`: nada a varrer.
  return null;
}

/** `true` quando o valor (e tudo dentro dele) esta livre de controle. */
export function semCaractereDeControle(valor: unknown): boolean {
  return acharControle(valor, '', 0) === null;
}

/**
 * `@SemCaractereDeControle()` — vale para string, para array de string (com
 * `{ each: true }`) e para o `snapshot` aninhado, porque a varredura e a mesma
 * funcao recursiva.
 *
 * **Um decorador e nao uma limpeza no `paraBanco()`**: o `ValidationPipe` roda
 * antes do servico, entao o 400 sai sem nenhuma ida ao banco — e o item ruim
 * nao chega perto do `upsert`. Fosse no servico, a transacao do defeito 2
 * teria de abortar um lote que o DTO podia ter recusado de graca.
 */
export function SemCaractereDeControle(opcoes?: ValidationOptions) {
  return function (alvo: object, propriedade: string) {
    registerDecorator({
      name: 'semCaractereDeControle',
      target: alvo.constructor,
      propertyName: propriedade,
      options: opcoes,
      validator: {
        validate: (valor: unknown) => semCaractereDeControle(valor),
        defaultMessage: (args?: ValidationArguments) => {
          const achado = acharControle(args?.value, '', 0);
          const onde = achado?.caminho ? ` em ${achado.caminho}` : '';
          return `${args?.property ?? 'campo'} tem caractere de controle${onde}`;
        },
      },
    });
  };
}

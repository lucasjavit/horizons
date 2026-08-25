import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decifrar } from '../settings/crypto';
import {
  baseUrlDe,
  cadeia,
  PROVEDORES,
  provedoresCom,
  type Capacidade,
  type Provedor,
} from './provedores';
import { statusDoHttp, type Verificacao } from './verificacao';

/**
 * O modelo se recusou a responder, ou respondeu "isto nao serve".
 *
 * **Nao dispara a queda para o proximo provedor.** O segundo leria o mesmo
 * texto e diria a mesma coisa, gastando credito para repetir a resposta. Foi a
 * regra que o `cv-extrator` ja acertava com `ehCurriculo: false`, e ela subiu
 * para ca porque vale para qualquer uso da cadeia.
 */
export class RecusaDoModelo extends Error {
  constructor(readonly provedor: string) {
    super(`modelo de ${provedor} recusou o pedido`);
    this.name = 'RecusaDoModelo';
  }
}

/**
 * Todo provedor da cadeia falhou.
 *
 * Carrega o motivo de CADA um, e nao so do ultimo: quando a leitura de CV para
 * de funcionar, "OpenAI deu 429" e metade da resposta — a outra metade e que a
 * Anthropic deu 401 e o Gemini nao tinha chave. Sem isso, quem le o log
 * conserta um provedor e descobre o proximo problema na tentativa seguinte.
 */
export class CadeiaEsgotada extends Error {
  constructor(readonly tentativas: readonly Tentativa[]) {
    super(
      tentativas.length === 0
        ? 'nenhum provedor de IA disponivel'
        : `todos os ${tentativas.length} provedores falharam: ` +
          tentativas.map((t) => `${t.provedor} (${t.motivo})`).join(', '),
    );
    this.name = 'CadeiaEsgotada';
  }
}

/** Por que um provedor nao atendeu. Tres motivos, e a distincao importa. */
export type Motivo =
  /** Nao ha chave cadastrada nem no ambiente. Nao e falha: e ausencia. */
  | 'sem chave'
  /** 401/402/403/429 — a chave existe e o provedor a recusou. E conta a pagar. */
  | 'chave recusada'
  /** Qualquer outra coisa: timeout, 500, resposta ilegivel. Pode ser transitorio. */
  | 'erro';

export interface Tentativa {
  provedor: string;
  motivo: Motivo;
  detalhe: string;
}

/** O que se pede a cadeia. Igual para todo provedor — o dialeto e detalhe. */
export interface Pedido {
  /** A instrucao de sistema. */
  instrucao: string;
  /** O que o usuario mandou. */
  entrada: string;
  /** O JSON Schema que a resposta tem de obedecer. */
  schema: Record<string, unknown>;
  /** Nome do schema. Alguns dialetos exigem; outros ignoram. */
  nomeDoSchema: string;
  /** Teto de tokens da resposta. */
  maxTokens: number;
  /**
   * Precisa de busca na web?
   *
   * Nao e so uma capacidade exigida do provedor: e a ferramenta que entra na
   * chamada. Um provedor com `buscaWeb` chamado sem isto responde de cabeca.
   */
  buscaWeb?: boolean;
}

/**
 * 401/402/403/429 dizem a mesma coisa: **esta chave nao vai funcionar agora**.
 *
 * Um 500 do provedor nao entra aqui — ele e transitorio, e o proximo provedor
 * tem a mesma chance de falhar. A distincao vive no log, que e onde alguem vai
 * procurar quando a feature parar.
 */
function ehChaveMorta(e: unknown): boolean {
  const status =
    e instanceof Anthropic.APIError || e instanceof OpenAI.APIError
      ? e.status
      : e instanceof ErroHttp
        ? e.status
        : undefined;
  return status === 401 || status === 402 || status === 403 || status === 429;
}

/**
 * O codigo HTTP de um erro, qualquer que seja o cliente que o levantou.
 *
 * Tres origens: o SDK da Anthropic, o da OpenAI (que cobre tambem Groq,
 * Cerebras e Mistral) e o `ErroHttp` do Gemini, que fala `fetch` cru.
 *
 * `null` significa **nao houve resposta** — timeout, DNS, conexao recusada —,
 * e isso e diferente de um 500. A tela usa a distincao: sem resposta nao se
 * culpa a chave.
 */
function statusHttpDe(e: unknown): number | null {
  if (e instanceof Anthropic.APIError || e instanceof OpenAI.APIError) {
    return e.status ?? null;
  }
  if (e instanceof ErroHttp) return e.status;
  return null;
}

/** A mensagem do provedor, cortada. Alguns devolvem um HTML inteiro de erro. */
function mensagemDe(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}

/**
 * Os SDKs nao repetem a chamada: a cadeia e o mecanismo de retry.
 *
 * **Medido em 25/08/2026**, com a Anthropic devolvendo 401 e a OpenAI 429: o
 * SDK da OpenAI repetia o 429 tres vezes com backoff antes de desistir, e a
 * requisicao inteira levava **2,5s** — dos quais ~2,2s eram espera para
 * receber o mesmo 429 duas vezes a mais. Com `maxRetries: 0` a cadeia cai
 * direto para o proximo provedor.
 *
 * A logica e a mesma que justifica a cadeia existir: quando uma chave e
 * recusada, o proximo PROVEDOR e uma resposta melhor que a mesma chave de
 * novo. Repetir so faz sentido quando nao ha para onde ir — e aqui sempre ha,
 * ate a cadeia acabar.
 */
const SEM_RETRY = 0;

/** Erro de um dialeto que fala HTTP cru (hoje so o Gemini). */
class ErroHttp extends Error {
  constructor(
    readonly status: number,
    detalhe: string,
  ) {
    super(`HTTP ${status}: ${detalhe}`);
  }
}

/**
 * A cadeia de provedores de IA, percorrida ate um funcionar.
 *
 * **Substitui a arvore de `if` que existia para exatamente dois provedores.**
 * Antes, `escolherIa(preferida, temAnthropic, temOpenAi)` e
 * `qual === 'openai' ? A : B` — cada provedor novo dobrava os ramos. Aqui a
 * lista e percorrida, e adicionar um provedor e adicionar uma entrada em
 * `provedores.ts`.
 *
 * Tres regras que nao sao estilo:
 *
 * 1. **Um erro nao mata a cadeia.** Falhou, tenta o proximo, e o log nomeia
 *    quem falhou e por que. So quando todos falham e que o usuario ve erro.
 * 2. **A cadeia e filtrada por capacidade.** Groq e Cerebras nao tem busca na
 *    web, entao a busca de vagas nem os tenta — em vez de eles "falharem" de um
 *    jeito que pareceria erro de chave.
 * 3. **Recusa do modelo nao e falha de provedor.** Ela sobe direto, sem gastar
 *    o resto da cadeia repetindo a mesma resposta.
 */
@Injectable()
export class IaService {
  private readonly log = new Logger(IaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ha algum provedor com chave para esta capacidade?
   *
   * E o que decide se um motor existe. Substitui o `disponivel()` que somava
   * dois booleanos.
   */
  async disponivel(capacidade: Capacidade): Promise<boolean> {
    for (const p of provedoresCom(capacidade)) {
      if (await this.chave(p)) return true;
    }
    return false;
  }

  /** Quais provedores desta capacidade tem chave. Para a tela explicar-se. */
  async comChave(capacidade: Capacidade): Promise<ApiProvider[]> {
    const achados: ApiProvider[] = [];
    for (const p of provedoresCom(capacidade)) {
      if (await this.chave(p)) achados.push(p.id);
    }
    return achados;
  }

  /**
   * Verifica UMA chave, com uma chamada real e minima.
   *
   * **Uma chamada de verdade, e nao um HEAD na URL base.** O que interessa
   * saber e se ESTA chave e aceita por ESTE modelo — e isso so a chamada que
   * a cadeia faz responde. Um endpoint de listagem responderia 200 para uma
   * conta sem credito, que e exatamente o caso que a tela precisa separar.
   *
   * Barata, mas nao mesquinha: `maxTokens: 256` e um schema de um campo.
   *
   * **256 e medido, nao chutado.** Com 16 o Gemini 3.6 respondia 200 com texto
   * VAZIO e `finishReason: MAX_TOKENS`: ele gasta 49–79 tokens de raciocinio
   * interno (`thoughtsTokenCount`) antes de emitir o primeiro caractere, e o
   * orcamento acabava antes da resposta. Medido em 25/08/2026 com chave real:
   * 16 → "" · 64 → "H" · 256 → `{"ok":true}`. Uma verificacao apertada demais
   * reprovaria uma chave boa, que e o pior erro que esta tela pode cometer.
   *
   * Nao pede `buscaWeb` nem para os provedores que tem: a ferramenta de busca
   * transformaria a verificacao numa chamada cara e lenta, e a pergunta aqui
   * e sobre a CHAVE, que e a mesma nos dois modos.
   */
  async verificar(p: Provedor): Promise<Verificacao> {
    const chave = await this.chave(p);
    if (!chave) {
      return { provider: p.id, status: 'sem_chave', httpStatus: null, detalhe: '' };
    }

    try {
      await this.chamar(p, chave, {
        instrucao: 'Reply with {"ok":true}.',
        entrada: 'ping',
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
          additionalProperties: false,
        },
        nomeDoSchema: 'ping',
        maxTokens: 256,
      });
      return { provider: p.id, status: 'funcionando', httpStatus: 200, detalhe: '' };
    } catch (e) {
      // Recusa do modelo e uma resposta: a chave foi aceita, o conteudo e que
      // nao passou. Contar isso como chave morta faria a tela mandar trocar
      // uma chave que funciona.
      if (e instanceof RecusaDoModelo) {
        return { provider: p.id, status: 'funcionando', httpStatus: 200, detalhe: '' };
      }
      const httpStatus = statusHttpDe(e);
      return {
        provider: p.id,
        status: statusDoHttp(httpStatus),
        httpStatus,
        detalhe: mensagemDe(e),
      };
    }
  }

  /**
   * Verifica todos os provedores do registro, em paralelo.
   *
   * Em paralelo porque sao seis servicos independentes e o admin esta olhando
   * para a tela: em serie, seis timeouts de 120s seriam dez minutos de
   * "Checking…". O que pode falhar aqui e um provedor de cada vez, e cada
   * resultado e independente dos outros.
   */
  async verificarTodos(): Promise<Verificacao[]> {
    return Promise.all(PROVEDORES.map((p) => this.verificar(p)));
  }

  /**
   * Percorre a cadeia ate um provedor responder. Devolve o JSON cru.
   *
   * `ordem` e a lista completa de provedores como o admin a arrumou (vem de
   * `OrdemDaIaService`); a cadeia e ela filtrada pela capacidade. Provedor sem
   * chave nao trava nada — ele so e tentado e pulado, e "sem chave" e uma
   * tentativa que custa zero.
   */
  async pedir(
    capacidade: Capacidade,
    ordem: readonly ApiProvider[],
    pedido: Pedido,
  ): Promise<string> {
    const tentativas: Tentativa[] = [];

    for (const p of cadeia(capacidade, ordem)) {
      const chave = await this.chave(p);
      if (!chave) {
        // Ausencia nao e falha, e nao merece `warn`: e o estado normal de um
        // provedor que o admin nunca cadastrou.
        tentativas.push({ provedor: p.nome, motivo: 'sem chave', detalhe: '' });
        continue;
      }

      try {
        const bruto = await this.chamar(p, chave, pedido);
        if (tentativas.length > 0) {
          this.log.log(
            `${p.nome} respondeu depois de ${tentativas.length} provedor(es) ` +
              `nao terem atendido: ${tentativas.map((t) => `${t.provedor} (${t.motivo})`).join(', ')}`,
          );
        }
        return bruto;
      } catch (e) {
        // Recusa do modelo sobe direto: o proximo diria o mesmo.
        if (e instanceof RecusaDoModelo) throw e;

        const motivo: Motivo = ehChaveMorta(e) ? 'chave recusada' : 'erro';
        const detalhe = String(e).slice(0, 300);
        tentativas.push({ provedor: p.nome, motivo, detalhe });
        this.log.warn(`${p.nome} falhou (${motivo}): ${detalhe}`);
      }
    }

    throw new CadeiaEsgotada(tentativas);
  }

  /** Uma tentativa com um provedor, no dialeto dele. */
  private chamar(p: Provedor, chave: string, pedido: Pedido): Promise<string> {
    switch (p.dialeto) {
      case 'anthropic':
        return this.comAnthropic(p, chave, pedido);
      case 'openai-responses':
        return this.comOpenAiResponses(p, chave, pedido);
      case 'openai-compativel':
        return this.comOpenAiCompativel(p, chave, pedido);
      case 'gemini':
        return this.comGemini(p, chave, pedido);
    }
  }

  private async comAnthropic(
    p: Provedor,
    chave: string,
    pedido: Pedido,
  ): Promise<string> {
    const base = baseUrlDe(p);
    const client = new Anthropic({
      apiKey: chave,
      maxRetries: SEM_RETRY,
      ...(base ? { baseURL: base } : {}),
    });
    const resposta = await client.messages.create({
      model: p.modelo,
      max_tokens: pedido.maxTokens,
      system: pedido.instrucao,
      ...(pedido.buscaWeb
        ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' }] }
        : {}),
      output_config: {
        format: { type: 'json_schema', schema: pedido.schema as never },
      },
      messages: [{ role: 'user', content: pedido.entrada }],
    });

    // Refusal e 200 com content vazio: ler content[0] direto quebraria aqui.
    if (resposta.stop_reason === 'refusal') throw new RecusaDoModelo(p.nome);

    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco || bloco.type !== 'text') {
      throw new Error(`resposta de ${p.nome} sem bloco de texto`);
    }
    return bloco.text;
  }

  /**
   * A Responses API da OpenAI.
   *
   * Separada do `openai-compativel` porque **so ela tem `web_search`
   * hospedado**. Os clones (Groq, Cerebras, Mistral) implementam
   * `/chat/completions`, e nenhum deles tem a ferramenta de busca.
   */
  private async comOpenAiResponses(
    p: Provedor,
    chave: string,
    pedido: Pedido,
  ): Promise<string> {
    const base = baseUrlDe(p);
    const client = new OpenAI({
      apiKey: chave,
      maxRetries: SEM_RETRY,
      ...(base ? { baseURL: base } : {}),
    });
    const resposta = await client.responses.create({
      model: p.modelo,
      ...(pedido.buscaWeb ? { tools: [{ type: 'web_search' as const }] } : {}),
      input: [
        { role: 'system', content: pedido.instrucao },
        { role: 'user', content: pedido.entrada },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: pedido.nomeDoSchema,
          schema: pedido.schema,
        },
      },
    });
    const bruto = resposta.output_text ?? '';
    if (!bruto.trim()) throw new Error(`resposta de ${p.nome} veio vazia`);
    return bruto;
  }

  /**
   * O adaptador que cobre Groq, Cerebras e Mistral de uma vez.
   *
   * **Os tres falam `/chat/completions` com o corpo da OpenAI**, entao o que
   * muda entre eles e `baseURL` e nome do modelo — os dois vindos do registro.
   * Foi o que permitiu os tres entrarem no mesmo commit, e e o que faz o
   * proximo compativel (OpenRouter, Cloudflare, GitHub Models, SambaNova,
   * Vercel AI Gateway) custar uma entrada em `provedores.ts` e nada mais.
   *
   * Nao passa `tools`: nenhum deles tem busca na web hospedada, e o registro ja
   * os mantem fora da cadeia que exige `buscaWeb`.
   */
  private async comOpenAiCompativel(
    p: Provedor,
    chave: string,
    pedido: Pedido,
  ): Promise<string> {
    const base = baseUrlDe(p);
    const client = new OpenAI({
      apiKey: chave,
      maxRetries: SEM_RETRY,
      ...(base ? { baseURL: base } : {}),
    });
    const resposta = await client.chat.completions.create({
      model: p.modelo,
      max_tokens: pedido.maxTokens,
      messages: [
        { role: 'system', content: pedido.instrucao },
        { role: 'user', content: pedido.entrada },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: pedido.nomeDoSchema,
          schema: pedido.schema,
          strict: true,
        },
      },
    });

    const escolha = resposta.choices[0];
    // `content_filter` e a forma que os compativeis dao a recusa. Vira
    // RecusaDoModelo em vez de erro de infra, pelo mesmo motivo do refusal da
    // Anthropic: o proximo provedor diria o mesmo.
    if (escolha?.finish_reason === 'content_filter') throw new RecusaDoModelo(p.nome);

    const bruto = escolha?.message?.content ?? '';
    if (!bruto.trim()) throw new Error(`resposta de ${p.nome} veio vazia`);
    return bruto;
  }

  /**
   * O Gemini, por `fetch` e nao por SDK.
   *
   * **Decisao deliberada:** o `@google/genai` sao ~400 KB de dependencia para
   * uma unica chamada POST. O repositorio ja fala HTTP cru com o Telegram
   * (`telegram.provider.ts`) e com os ATS (`busca-ats.service.ts`), entao este
   * e o caminho chato e ja trilhado. Se um dia o Gemini for usado para
   * streaming ou multimodal, o SDK passa a pagar o proprio peso.
   *
   * Duas particularidades da API que nao sao opcionais:
   *
   * - `responseJsonSchema` (e nao `responseSchema`) e o campo que aceita JSON
   *   Schema completo — com `enum`, `["string","null"]` e
   *   `additionalProperties`, que e exatamente o que os nossos schemas usam.
   * - A busca na web e `tools: [{ google_search: {} }]`, e o Google **nao
   *   permite** combinar grounding com `responseMimeType: application/json` na
   *   mesma chamada. Por isso, com busca ligada, o schema vai na INSTRUCAO e a
   *   resposta e limpa de cerca de markdown antes do parse.
   */
  private async comGemini(
    p: Provedor,
    chave: string,
    pedido: Pedido,
  ): Promise<string> {
    const base = baseUrlDe(p) ?? 'https://generativelanguage.googleapis.com';
    const url = `${base}/v1beta/models/${p.modelo}:generateContent`;

    // Com grounding o JSON estruturado nao e aceito pela API; o schema vira
    // instrucao. Sem grounding, o schema e obrigatorio de verdade.
    const instrucao = pedido.buscaWeb
      ? `${pedido.instrucao}\n\nResponda SOMENTE com JSON valido obedecendo a este schema, sem cercas de markdown:\n${JSON.stringify(pedido.schema)}`
      : pedido.instrucao;

    const corpo = {
      systemInstruction: { parts: [{ text: instrucao }] },
      contents: [{ role: 'user', parts: [{ text: pedido.entrada }] }],
      ...(pedido.buscaWeb ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        maxOutputTokens: pedido.maxTokens,
        ...(pedido.buscaWeb
          ? {}
          : {
              responseMimeType: 'application/json',
              responseJsonSchema: pedido.schema,
            }),
      },
    };

    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(120_000),
    });

    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      // ErroHttp para o `ehChaveMorta` enxergar o status: sem isto, um 429 do
      // Gemini viraria 'erro' generico e o log perderia a distincao que
      // justifica a cadeia inteira.
      throw new ErroHttp(resposta.status, texto.slice(0, 300));
    }

    const lido = (await resposta.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const candidato = lido.candidates?.[0];
    if (candidato?.finishReason === 'SAFETY' || candidato?.finishReason === 'PROHIBITED_CONTENT') {
      throw new RecusaDoModelo(p.nome);
    }

    const bruto = (candidato?.content?.parts ?? [])
      .map((parte) => parte.text ?? '')
      .join('');
    if (!bruto.trim()) throw new Error(`resposta de ${p.nome} veio vazia`);
    return semCerca(bruto);
  }

  /**
   * A chave do provedor: primeiro o ambiente, depois a guardada em Configuracoes.
   *
   * Mantem o padrao que `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` ja tinham, agora
   * generalizado — cada provedor declara sua variavel em `provedores.ts`.
   */
  private async chave(p: Provedor): Promise<string | null> {
    const doAmbiente = process.env[p.envChave];
    if (doAmbiente && doAmbiente.trim()) return doAmbiente.trim();

    const guardada = await this.prisma.apiToken.findFirst({
      where: { provider: p.id },
      select: { secret: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!guardada?.secret) return null;
    try {
      return decifrar(guardada.secret);
    } catch {
      // Chave cifrada com outra ENCRYPTION_KEY: trata como ausente, em vez de
      // derrubar a requisicao com erro de cripto.
      this.log.warn(`token de ${p.nome} nao pode ser decifrado`);
      return null;
    }
  }
}

/**
 * Tira a cerca de markdown que alguns modelos poem em volta do JSON.
 *
 * So e necessario onde o schema nao e obrigatorio pela API — hoje, o Gemini
 * com grounding ligado. Onde o schema manda, isto e um no-op barato.
 */
function semCerca(bruto: string): string {
  const limpo = bruto.trim();
  if (!limpo.startsWith('```')) return limpo;
  return limpo
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

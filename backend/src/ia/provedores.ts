import { ApiProvider } from '@prisma/client';

/**
 * O que um provedor de IA sabe fazer.
 *
 * Duas capacidades **independentes**, e nao um nivel: um provedor pode ter
 * saida estruturada sem ter busca na web (Groq, Cerebras, Mistral), e o
 * contrario nao acontece hoje mas o tipo nao proibe.
 *
 * - `estruturada`: obedece a um JSON Schema obrigatorio. E o que a leitura de
 *   CV exige, e o que impede o `JSON.parse` de quebrar numa terca-feira.
 * - `buscaWeb`: tem ferramenta de busca na web de verdade. A busca de vagas
 *   **nao funciona sem isto** — medido em 18/08/2026: sem acesso a web o
 *   modelo acerta o nome das empresas e nao sabe UMA vaga, produzindo URL bem
 *   formada que da 404.
 */
export type Capacidade = 'estruturada' | 'buscaWeb';

/**
 * Como se fala com o provedor.
 *
 * `openai-compativel` nao e um provedor — e um PROTOCOLO. Groq, Cerebras e
 * Mistral expoem `/chat/completions` com o mesmo corpo da OpenAI, entao os
 * tres sao atendidos por um adaptador so, parametrizado por `baseURL` e
 * modelo. Foi por isso que o custo de adicionar Cerebras depois de Groq foi
 * uma entrada nesta lista, e nao um arquivo novo.
 *
 * `anthropic` e `gemini` tem API propria: `messages.create` com
 * `output_config` num, `:generateContent` com `responseJsonSchema` no outro.
 */
export type Dialeto = 'anthropic' | 'openai-responses' | 'openai-compativel' | 'gemini';

/** Uma entrada do registro. Adicionar provedor e adicionar uma destas. */
export interface Provedor {
  id: ApiProvider;
  /** Nome que aparece no log e na tela. */
  nome: string;
  dialeto: Dialeto;
  /** Modelo pedido. Fixo por provedor: o admin nao escolhe modelo. */
  modelo: string;
  capacidades: readonly Capacidade[];
  /**
   * Variavel de ambiente que serve de chave alternativa.
   *
   * Mantem o padrao que `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` ja tinham: a
   * chave pode vir do ambiente sem passar pela tela, o que e como se roda em
   * desenvolvimento e como o deploy injeta segredo sem banco.
   */
  envChave: string;
  /**
   * Variavel que sobrescreve a URL base.
   *
   * Existe para o deploy poder apontar para um gateway ou um proxy — e e o que
   * torna a cadeia verificavel sem chave de verdade, apontando para um
   * provedor falso.
   */
  envBaseUrl: string;
  /** URL base padrao. `null` no Anthropic, que o SDK ja sabe. */
  baseUrl: string | null;
  /**
   * O provedor treina modelos com o que recebe no free tier.
   *
   * **Isto e visivel na tela, ao lado do nome.** O texto do CV vai inteiro
   * para o provedor — com CPF, endereco e telefone (registrado no JOB-02) — e
   * a tela de vagas promete que "so guardamos stack, senioridade e anos".
   * Guardar pouco nao e o mesmo que enviar pouco, e quem liga a chave precisa
   * saber a diferenca antes de ligar, nao depois.
   */
  treinaComOsDados: boolean;
  /** Onde a pessoa cria a chave. So para a tela. */
  console: string;
}

/**
 * Os provedores que a aplicacao sabe usar, na ordem em que sao tentados.
 *
 * **A ordem aqui e o default da cadeia**, e ela nao e alfabetica: os pagos vem
 * primeiro porque entregam mais qualidade quando ha credito, e os gratuitos
 * atras porque existem para a feature nao morrer quando nao ha. O admin
 * promove um deles ao topo em Configuracoes; o resto da ordem fica como esta.
 *
 * Gratuito sem cartao: Gemini, Groq, Cerebras, Mistral. Foi o que motivou a
 * cadeia — em 25/08/2026 as duas chaves pagas cadastradas estavam mortas
 * (Anthropic 401 `API key is invalid`, OpenAI 429 `exceeded your current
 * quota`) e a leitura de CV simplesmente nao existia nesta instalacao.
 */
export const PROVEDORES: readonly Provedor[] = [
  {
    id: ApiProvider.ANTHROPIC,
    nome: 'Claude (Anthropic)',
    dialeto: 'anthropic',
    modelo: 'claude-opus-5',
    capacidades: ['estruturada', 'buscaWeb'],
    envChave: 'ANTHROPIC_API_KEY',
    envBaseUrl: 'ANTHROPIC_BASE_URL',
    baseUrl: null,
    treinaComOsDados: false,
    console: 'console.anthropic.com → Settings → API keys',
  },
  {
    id: ApiProvider.OPENAI,
    nome: 'ChatGPT (OpenAI)',
    dialeto: 'openai-responses',
    modelo: 'gpt-5.6',
    capacidades: ['estruturada', 'buscaWeb'],
    envChave: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    baseUrl: null,
    treinaComOsDados: false,
    console: 'platform.openai.com → API keys',
  },
  {
    id: ApiProvider.GEMINI,
    nome: 'Gemini (Google)',
    dialeto: 'gemini',
    // `gemini-2.5-flash` foi aposentado para contas novas: a chave real
    // cadastrada em 25/08/2026 recebia **404** com a propria API dizendo
    // "no longer available to new users ... use models/gemini-3.6-flash".
    // Foi a verificacao de chaves que expos isto — a cadeia so registrava
    // "erro" e caia para o proximo.
    modelo: 'gemini-3.6-flash',
    // O unico gratuito com busca na web: o Google Search grounding entra como
    // ferramenta na mesma chamada. Por isso ele e o unico provedor gratuito
    // que aparece na cadeia de BUSCA, e nao so na de extracao.
    capacidades: ['estruturada', 'buscaWeb'],
    envChave: 'GEMINI_API_KEY',
    envBaseUrl: 'GEMINI_BASE_URL',
    baseUrl: 'https://generativelanguage.googleapis.com',
    // Fora de EU/UK/EEA o free tier do Google AI Studio e usado para melhorar
    // os produtos dele. O tier pago nao e.
    treinaComOsDados: true,
    console: 'aistudio.google.com → Get API key',
  },
  {
    id: ApiProvider.GROQ,
    nome: 'Groq (Llama 3.3)',
    dialeto: 'openai-compativel',
    modelo: 'llama-3.3-70b-versatile',
    // Sem busca na web: o Groq serve modelo aberto, sem ferramenta de busca
    // hospedada. Entra so na cadeia de extracao — e por isso a cadeia e
    // filtrada por capacidade, e nao uma lista unica que "falharia" aqui de um
    // jeito que pareceria erro de chave.
    capacidades: ['estruturada'],
    envChave: 'GROQ_API_KEY',
    envBaseUrl: 'GROQ_BASE_URL',
    baseUrl: 'https://api.groq.com/openai/v1',
    treinaComOsDados: false,
    console: 'console.groq.com → API Keys',
  },
  {
    id: ApiProvider.CEREBRAS,
    nome: 'Cerebras',
    dialeto: 'openai-compativel',
    modelo: 'llama-3.3-70b',
    capacidades: ['estruturada'],
    envChave: 'CEREBRAS_API_KEY',
    envBaseUrl: 'CEREBRAS_BASE_URL',
    baseUrl: 'https://api.cerebras.ai/v1',
    treinaComOsDados: false,
    console: 'cloud.cerebras.ai → API Keys',
  },
  {
    id: ApiProvider.MISTRAL,
    nome: 'Mistral',
    dialeto: 'openai-compativel',
    modelo: 'mistral-large-latest',
    capacidades: ['estruturada'],
    envChave: 'MISTRAL_API_KEY',
    envBaseUrl: 'MISTRAL_BASE_URL',
    baseUrl: 'https://api.mistral.ai/v1',
    // O Experiment tier (o gratuito) e usado para treinar. O pago nao e.
    treinaComOsDados: true,
    console: 'console.mistral.ai → API Keys',
  },
];

/** O provedor por id, ou `undefined` se o id nao esta no registro. */
export function provedor(id: ApiProvider): Provedor | undefined {
  return PROVEDORES.find((p) => p.id === id);
}

/**
 * Os provedores que atendem uma capacidade, na ordem do registro.
 *
 * **E aqui que Groq e Cerebras deixam de existir para a busca de vagas.** Sem
 * este filtro eles seriam tentados, devolveriam um JSON de vagas inventadas
 * (que e o que um modelo sem busca produz), e o resultado seria pior que um
 * erro: URLs bem formadas que dao 404.
 */
export function provedoresCom(capacidade: Capacidade): readonly Provedor[] {
  return PROVEDORES.filter((p) => p.capacidades.includes(capacidade));
}

/**
 * A cadeia para uma capacidade, na ordem que o admin arrumou.
 *
 * `ordem` e a lista COMPLETA de provedores, como gravada em
 * `ProviderOrder` (ver `ordem.service.ts`). Aqui ela e so filtrada pela
 * capacidade: quem nao atende sai, e os demais mantem as posicoes relativas.
 *
 * **Era `preferido: ApiProvider | null`**, que promovia um ao topo e deixava
 * o resto na ordem do registro. Isso bastava para dois provedores; com seis, a
 * segunda e a terceira posicoes passam a decidir quem atende quando o topo
 * cai, e uma preferencia unica nao as representa.
 *
 * Id fora do registro na `ordem` e ignorado, e provedor do registro que falta
 * na `ordem` entra no fim: a cadeia sempre cobre os aptos, mesmo com o banco
 * desatualizado em relacao ao codigo.
 */
export function cadeia(
  capacidade: Capacidade,
  ordem: readonly ApiProvider[],
): readonly Provedor[] {
  const aptos = provedoresCom(capacidade);
  const porId = new Map(aptos.map((p) => [p.id, p]));

  const ordenados: Provedor[] = [];
  const vistos = new Set<ApiProvider>();
  for (const id of ordem) {
    const p = porId.get(id);
    if (p && !vistos.has(id)) {
      ordenados.push(p);
      vistos.add(id);
    }
  }
  // Quem o banco nao posicionou entra no fim, na ordem do registro.
  for (const p of aptos) {
    if (!vistos.has(p.id)) ordenados.push(p);
  }
  return ordenados;
}

/** A URL base efetiva: o ambiente manda, para o deploy poder apontar noutro lugar. */
export function baseUrlDe(p: Provedor): string | null {
  const doAmbiente = process.env[p.envBaseUrl];
  if (doAmbiente && doAmbiente.trim()) return doAmbiente.trim();
  return p.baseUrl;
}

import { Injectable } from '@nestjs/common';

/** Como um segredo aparece na tela de prontidao. */
export type EstadoDoSegredo =
  /** Definido e dentro do que o codigo exige. */
  | 'ok'
  /** Ausente ou vazio. */
  | 'ausente'
  /** Definido, mas o valor nao serve (curto demais, ou o default do dev). */
  | 'invalido';

/** Quanto custa trocar o valor depois que a aplicacao esta no ar. */
export type CustoDeRotacao =
  /** Trocar nao quebra nada de permanente. */
  | 'seguro'
  /** Trocar derruba as sessoes abertas — e so isso. */
  | 'desloga'
  /** Trocar torna ilegivel o que ja foi cifrado com o valor antigo. */
  | 'destrutivo'
  /** Trocar exige mudar do outro lado tambem (o banco). */
  | 'coordenado';

/**
 * Um item da checklist de publicacao.
 *
 * **Nao ha campo de valor, e isso e proposital.** Nem o valor, nem um prefixo,
 * nem os ultimos caracteres. A regra da casa para os tokens de IA e mostrar o
 * final da chave (`ApiTokenDto.hint`), porque ali a pessoa cadastrou varias e
 * precisa reconhecer qual esta guardada. Aqui e segredo de infraestrutura, com
 * um valor so por ambiente: nao ha o que desambiguar, e todo caractere exposto
 * e um caractere a menos de entropia para quem le a tela por cima do ombro.
 * `tamanho` responde "chegou inteiro?" sem revelar nada.
 */
export interface SegredoDto {
  /** O nome da variavel de ambiente, como se escreve no painel do Coolify. */
  nome: string;
  /** O compose de producao usa `${VAR:?}` — faltando, ele recusa subir. */
  obrigatorio: boolean;
  estado: EstadoDoSegredo;
  /**
   * Quantos caracteres tem o valor. Zero quando ausente.
   *
   * Comprimento nao e conteudo: serve para ver que a variavel chegou inteira
   * (uma `JWT_SECRET` de 8 caracteres e um boot que nao acontece) sem revelar
   * um unico caractere dela.
   */
  tamanho: number;
  rotacao: CustoDeRotacao;
}

/** O estado do login, que nao e um segredo mas decide se a instalacao e segura. */
export interface EstadoDoLoginDto {
  /** `AUTH_DISABLED=true`. Em producao isto e uma emergencia. */
  authDisabled: boolean;
  /** Ha `GOOGLE_CLIENT_ID` — sem ele ninguem entra. */
  googleConfigurado: boolean;
  /** Quantos e-mails em `ADMIN_EMAILS`. Zero = ninguem administra. */
  admins: number;
}

/**
 * O que a API consegue afirmar sobre um passo do guia.
 *
 * `manual` nao e "desconhecido por enquanto", e uma categoria permanente: sao
 * os passos cuja prova esta FORA deste processo (o Google Cloud Console, o
 * certificado do proxy, o bundle do frontend). Marcar como pendente sugeriria
 * que um redeploy resolve; marcar como cumprido seria mentira. A tela diz onde
 * a confirmacao se faz, e nao finge saber.
 */
export type EstadoDoPasso = 'cumprido' | 'pendente' | 'manual';

/**
 * Um passo do guia de publicacao, com o que o servidor sabe dele.
 *
 * **So o estado cruza a rede.** O texto de cada passo e texto de interface: e
 * igual em qualquer instalacao, e mandar prosa pelo DTO a cada carga da pagina
 * so cria uma segunda copia para divergir da primeira. O backend responde o que
 * so ele pode saber — se a variavel chegou a ESTE processo.
 */
export interface PassoDeDeployDto {
  /** Casa com a chave do texto no front. */
  id: string;
  estado: EstadoDoPasso;
}

export interface ProntidaoDto {
  segredos: SegredoDto[];
  login: EstadoDoLoginDto;
  /**
   * Ha algo que impede publicar com seguranca.
   *
   * Calculado no servidor e nao na tela: a regra de "pronto" e a mesma que o
   * compose e o boot aplicam, e duplica-la no front daria duas verdades que
   * divergem na primeira mudanca.
   */
  pronto: boolean;
  /**
   * Os passos de publicar, na ordem em que se executam.
   *
   * O guia estava so no `docs/DEPLOY.md`, que exige sair do painel do Coolify,
   * achar o arquivo no GitHub e voltar. E um arquivo nao sabe o estado do
   * servidor: aqui um passo ja cumprido se mostra cumprido, o que e a diferenca
   * entre um guia e uma lista de tarefas viva.
   */
  passos: PassoDeDeployDto[];
  /**
   * Ha sinal de que este processo NAO e o de producao.
   *
   * A tela le o ambiente em que ela mesma roda — aberta em desenvolvimento, ela
   * descreve o desenvolvimento. Sem este aviso, um "cumprido" verde ao lado de
   * um passo de producao seria lido como producao ja configurada.
   *
   * **Nao se usa `NODE_ENV` para isto**, e medir custou uma versao errada: o
   * conteiner de DESENVOLVIMENTO tambem sobe com `NODE_ENV=production`, porque
   * o Dockerfile e o mesmo e constroi a imagem de producao nos dois casos. O
   * aviso teria ficado apagado exatamente na maquina que precisa dele.
   *
   * O sinal usado e o unico que separa os dois de fato: o `docker-compose.yml`
   * de desenvolvimento embute valores publicos, no repositorio — a senha
   * `horizons` e `CORS_ORIGIN: http://localhost:5173`. O de producao exige
   * `${VAR:?}` em ambos e recusa subir sem eles. Achar um valor publico aqui e
   * prova de que este processo subiu pelo compose de desenvolvimento.
   */
  ambienteDeDesenvolvimento: boolean;
}

/**
 * O minimo que o codigo exige de cada segredo.
 *
 * `JWT_SECRET` tem 16 no `AuthService`, que derruba o boot abaixo disso.
 * `ENCRYPTION_KEY` tem 16 em `crypto.ts`, que lanca ao cifrar — mais tarde e
 * pior: a aplicacao sobe e falha so quando alguem salva uma chave.
 */
const MINIMO = 16;

/**
 * Senhas de desenvolvimento que estao no repositorio, em texto claro.
 *
 * Encontrar uma delas em producao nao e "senha fraca", e "senha publica": ela
 * esta no `docker-compose.yml` que qualquer um le no GitHub. Por isso conta
 * como `invalido` e nao como `ok`.
 */
const DEFAULTS_DO_DEV = new Set(['horizons', 'postgres', 'changeme', 'senha']);

/**
 * O que falta para publicar, lido do ambiente deste processo.
 *
 * **A tela ensina o comando; ela nao gera o segredo.** Um botao "gerar" que
 * devolvesse o valor no navegador criaria um caminho novo de vazamento (o
 * valor passaria pelo log do servidor, pelo HTML e pelo histórico da aba) para
 * substituir um comando de uma linha que a pessoa ja pode rodar no servidor
 * dela. No caso da ENCRYPTION_KEY seria pior ainda: gerar uma nova por engano,
 * com um clique, tornaria ilegivel toda chave de IA ja cadastrada.
 *
 * Le `process.env` direto porque e exatamente essa a pergunta: o que ESTE
 * processo recebeu. Um valor guardado no banco responderia outra coisa.
 */
@Injectable()
export class DeployService {
  prontidao(): ProntidaoDto {
    const segredos: SegredoDto[] = [
      this.senhaDoBanco(),
      this.avaliar('JWT_SECRET', true, 'desloga', { minimo: MINIMO }),
      this.avaliar('ENCRYPTION_KEY', true, 'destrutivo', { minimo: MINIMO }),
      this.avaliar('CORS_ORIGIN', true, 'seguro', { minimo: 1 }),
    ];

    const login: EstadoDoLoginDto = {
      authDisabled: process.env.AUTH_DISABLED === 'true',
      googleConfigurado: !!process.env.GOOGLE_CLIENT_ID,
      admins: this.contarAdmins(),
    };

    // `pronto` exige as tres coisas juntas, e nenhuma e opcional: um segredo
    // faltando impede o compose de subir, o login desligado abre a aplicacao
    // inteira, e sem admin ninguem alcanca esta propria tela depois do deploy.
    const pronto =
      segredos.every((s) => s.estado === 'ok') &&
      !login.authDisabled &&
      login.googleConfigurado &&
      login.admins > 0;

    return {
      segredos,
      login,
      pronto,
      passos: this.passos(segredos, login),
      ambienteDeDesenvolvimento: this.pareceDesenvolvimento(segredos),
    };
  }

  /**
   * Este processo subiu pelo compose de desenvolvimento?
   *
   * Ver a nota em `ProntidaoDto.ambienteDeDesenvolvimento`: `NODE_ENV` nao
   * serve, porque vale `production` nos dois. Reusa o veredito de
   * `senhaDoBanco()` em vez de comparar a senha de novo — uma segunda copia da
   * lista de defaults divergiria da primeira.
   */
  private pareceDesenvolvimento(segredos: SegredoDto[]): boolean {
    const senhaPublica =
      segredos.find((s) => s.nome === 'POSTGRES_PASSWORD')?.estado ===
      'invalido';
    const origemLocal = (process.env.CORS_ORIGIN ?? '').includes('localhost');
    return senhaPublica || origemLocal;
  }

  /**
   * Os passos de publicar, com o que este processo consegue provar de cada um.
   *
   * A ordem e a de execucao, e nao a de importancia: quem publica pela primeira
   * vez segue de cima a baixo. Os `manual` estao no meio de proposito — o
   * cadastro da origem no Google vem DEPOIS do dominio existir e ANTES de
   * testar o login, e tira-los da sequencia para um bloco separado quebraria
   * justamente a ordem que faz o guia funcionar.
   */
  private passos(
    segredos: SegredoDto[],
    login: EstadoDoLoginDto,
  ): PassoDeDeployDto[] {
    const temSegredo = (nome: string) =>
      segredos.find((s) => s.nome === nome)?.estado === 'ok';

    return [
      // O recurso do Coolify: fora deste processo por definicao. A API nao sabe
      // por qual compose ela subiu — nada no ambiente distingue os dois.
      { id: 'recurso', estado: 'manual' },
      {
        id: 'segredos',
        estado: segredos.every((s) => s.estado === 'ok')
          ? 'cumprido'
          : 'pendente',
      },
      {
        id: 'admins',
        estado: login.admins > 0 ? 'cumprido' : 'pendente',
      },
      // TLS: o proxy termina o HTTPS antes da API. Um `x-forwarded-proto` seria
      // uma alegacao do proxy, nao uma prova do certificado — e um certificado
      // padrao do Traefik responde 443 igual a um do Let's Encrypt.
      { id: 'tls', estado: 'manual' },
      {
        // A variavel existir e verificavel; a origem estar cadastrada no Google
        // Cloud Console nao e. Cumprido aqui significa "metade que eu vejo".
        id: 'google',
        estado: login.googleConfigurado ? 'cumprido' : 'pendente',
      },
      {
        id: 'cors',
        estado: temSegredo('CORS_ORIGIN') ? 'cumprido' : 'pendente',
      },
      {
        // O unico que se inverte: aqui `cumprido` e AUTH_DISABLED desligada.
        id: 'login',
        estado: login.authDisabled ? 'pendente' : 'cumprido',
      },
      // O backlog vazar depende de VITE_QUADRO no build do FRONTEND, que e
      // outro conteiner e outra imagem. Esta API nao le aquele bundle.
      { id: 'quadro', estado: 'manual' },
      // A prova final e uma requisicao de fora, atravessando o proxy. Vista de
      // dentro, ela sempre passa — e por isso e que ela existe.
      { id: 'verificar', estado: 'manual' },
    ];
  }

  /**
   * A senha do Postgres, lida da `DATABASE_URL`.
   *
   * **Nao se le `process.env.POSTGRES_PASSWORD` aqui**, e isso custou uma
   * versao errada desta tela: nos DOIS compose a variavel vai so para o
   * conteiner do banco. A api recebe a senha ja embutida na `DATABASE_URL`
   * (`postgresql://user:SENHA@db:5432/...`), montada pelo compose. Ler a
   * variavel direto dizia "Not set" num servidor de producao corretamente
   * configurado — uma tela de estado que mente sobre o proprio estado.
   *
   * O nome exibido continua `POSTGRES_PASSWORD` porque e o que a pessoa
   * escreve no painel do Coolify. A leitura e que vem de outro lugar.
   */
  private senhaDoBanco(): SegredoDto {
    const url = process.env.DATABASE_URL ?? '';
    let senha = '';
    try {
      // `decodeURIComponent`: uma senha com caractere especial chega escapada
      // na URL, e `%40` tem 3 caracteres onde a senha real tem 1.
      senha = decodeURIComponent(new URL(url).password);
    } catch {
      // URL ausente ou malformada. Sem senha legivel — cai em `ausente`, que e
      // a leitura honesta: nao da para afirmar que esta boa.
      senha = '';
    }

    const estado: EstadoDoSegredo = !senha
      ? 'ausente'
      : DEFAULTS_DO_DEV.has(senha.toLowerCase())
        ? 'invalido'
        : 'ok';

    return {
      nome: 'POSTGRES_PASSWORD',
      obrigatorio: true,
      estado,
      tamanho: senha.length,
      rotacao: 'coordenado',
    };
  }

  private avaliar(
    nome: string,
    obrigatorio: boolean,
    rotacao: CustoDeRotacao,
    regras: { minimo: number },
  ): SegredoDto {
    const bruto = process.env[nome] ?? '';
    const estado: EstadoDoSegredo = !bruto
      ? 'ausente'
      : bruto.length < regras.minimo
        ? 'invalido'
        : 'ok';

    return { nome, obrigatorio, estado, tamanho: bruto.length, rotacao };
  }

  /**
   * Quantos admins. So a contagem: os e-mails sao dados pessoais e a pergunta
   * da tela e "ha alguem?", nao "quem".
   */
  private contarAdmins(): number {
    return (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean).length;
  }
}

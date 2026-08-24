import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CAMPOS, passaNoFiltro, toDto } from '../jobs/vagas.service';
import type { FiltrosDto, VagaDto } from '../jobs/job.dto';
import { EmailProvider } from './email.provider';
import { montarCorpo } from './email-corpo';
import { montarTexto } from './telegram-corpo';
import { TelegramProvider } from './telegram.provider';
import { TelegramService } from './telegram.service';
import type {
  AssinaturaDto,
  MetricasEmailDto,
  ResultadoRodadaDto,
} from './email.dto';

/** Cadencias possiveis. Uniao de string, nao enum — o front proibe enum de TS. */
export const CADENCIAS = ['semanal', 'mensal'] as const;
export type Cadencia = (typeof CADENCIAS)[number];

/** Sete dias, em ms. */
const UMA_SEMANA = 7 * 24 * 60 * 60 * 1000;
/** Trinta dias. Nao "mes de calendario": o intervalo tem de ser comparavel. */
const UM_MES = 30 * 24 * 60 * 60 * 1000;

/**
 * Quantas pessoas por rodada.
 *
 * Mesmo motivo do teto da busca agendada: sem limite, uma base grande faria a
 * rodada durar mais que o intervalo entre rodadas. Quem nao coube volta na
 * proxima — a fila gira por `ultimoEnvioEm`.
 */
const PESSOAS_POR_RODADA = 50;

/**
 * O e-mail de vagas.
 *
 * **O produto, na frase do stakeholder**: "vamos encontrar uma vaga para voce
 * e te mando um email". E o que o ChatGPT nao faz — nao varrer 839 empresas
 * enquanto a pessoa dorme.
 *
 * Duas regras mandam aqui, e as duas vem do card:
 *
 * 1. **So vaga nova desde o ultimo envio.** Repetir a vaga da semana passada
 *    treina a pessoa a nao abrir.
 * 2. **Nao existe e-mail vazio.** Semana sem vaga nova nao gera mensagem, e
 *    `ultimoEnvioEm` NAO avanca — as vagas continuam "novas" para o proximo.
 */
@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: EmailProvider,
    private readonly telegramProvider: TelegramProvider,
    private readonly telegram: TelegramService,
  ) {}

  /** A base publica do site, para os links de um clique. */
  private urlBase(): string {
    return (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  }

  /**
   * A assinatura da pessoa, criando na primeira leitura.
   *
   * Criar sob demanda em vez de no cadastro: as contas que ja existem nunca
   * passariam por um hook de criacao, e uma migracao que gera token para toda
   * a base gastaria linha para quem talvez nunca use a feature.
   */
  /**
   * A assinatura de quem esta logado, **sem criar nada**.
   *
   * Ler nao pode inscrever. Medido pelo QA em 24/08: abrir a aba Jobs
   * chamava esta rota, que criava a linha com `ativo = true` do default do
   * schema — e a pessoa virava candidata a receber e-mail que nunca pediu.
   * Ligado o SMTP, todo mundo que ja tinha aberto a aba receberia.
   *
   * E-mail nao solicitado queima o dominio e nao tem desfazer, entao o
   * caminho de escrita e so `definirAtivo`, que exige um clique.
   */
  async minhaAssinatura(userId: string): Promise<AssinaturaDto> {
    const existente = await this.prisma.emailSubscription.findUnique({
      where: { userId },
      select: CAMPOS_SUB,
    });
    // Sem linha, a tela recebe o estado "nao inscrito" — sem gravar nada.
    return existente ? paraDto(existente) : naoInscrito();
  }

  /**
   * Cria a assinatura **desligada**, e so a pedido.
   *
   * O default `ativo = true` do schema vale para quem clica em "Email me new
   * jobs" — `definirAtivo` liga logo em seguida. Aqui a linha nasce inerte,
   * para que criar nao seja o mesmo que inscrever.
   */
  private async garantir(userId: string) {
    const existente = await this.prisma.emailSubscription.findUnique({
      where: { userId },
      select: CAMPOS_SUB,
    });
    if (existente) return existente;

    return this.prisma.emailSubscription.create({
      data: { userId, token: novoToken(), ativo: false },
      select: CAMPOS_SUB,
    });
  }

  /**
   * Liga e desliga o recebimento, pela sessao.
   *
   * A versao com token (sem login) e `sairPorToken` — sao caminhos diferentes
   * para a mesma coluna porque as credenciais sao diferentes.
   */
  async definirAtivo(userId: string, ativo: boolean): Promise<AssinaturaDto> {
    await this.garantir(userId);
    const sub = await this.prisma.emailSubscription.update({
      where: { userId },
      data: { ativo },
      select: CAMPOS_SUB,
    });
    return paraDto(sub);
  }

  /**
   * Descadastro em um clique, **sem login** (criterio do JOB-24).
   *
   * O token e a credencial. Nao apaga a linha: apagar perderia
   * `ultimoEnvioEm`, e quem voltasse atras receberia de uma vez todas as vagas
   * acumuladas. Tambem perderia a metrica de contratado.
   *
   * Token desconhecido da 404 e nao 200 silencioso — dizer "pronto,
   * descadastrado" para quem nao foi descadastrado e mentir na unica tela que
   * a pessoa vai ver.
   */
  async sairPorToken(token: string): Promise<AssinaturaDto> {
    const sub = await this.porToken(token);
    const atualizado = await this.prisma.emailSubscription.update({
      where: { id: sub.id },
      data: { ativo: false },
      select: CAMPOS_SUB,
    });
    return paraDto(atualizado);
  }

  /**
   * "Consegui a vaga" (JOB-25), sem login.
   *
   * **Nao e downgrade.** Quem foi contratado parou de precisar de vaga e passou
   * a precisar de outra coisa; uma vaga por mes e acompanhar o mercado sem
   * procurar. Por isso `ativo` continua `true` — reduzir para zero seria
   * exatamente o "produto pior" que o card recusa.
   *
   * `contratadoEm` e coluna propria e nao se apaga no desfazer: e a metrica que
   * vale mais que todas (quantas pessoas o produto empregou), e voltar a
   * procurar nao desfaz o fato de ter sido contratado.
   */
  async contratadoPorToken(token: string): Promise<AssinaturaDto> {
    const sub = await this.porToken(token);
    const atualizado = await this.prisma.emailSubscription.update({
      where: { id: sub.id },
      data: {
        cadencia: 'mensal',
        ativo: true,
        // Preserva o primeiro registro: quem alterna procurando/contratado
        // varias vezes conta uma vez, na data em que aconteceu.
        contratadoEm: sub.contratadoEm ?? new Date(),
      },
      select: CAMPOS_SUB,
    });
    return paraDto(atualizado);
  }

  /**
   * Voltar a procurar — o desfazer do criterio do JOB-25.
   *
   * Devolve a cadencia semanal e mantem `contratadoEm`: a pessoa voltou ao
   * mercado, e nao deixou de ter sido contratada um dia.
   */
  async voltarAProcurarPorToken(token: string): Promise<AssinaturaDto> {
    const sub = await this.porToken(token);
    const atualizado = await this.prisma.emailSubscription.update({
      where: { id: sub.id },
      data: { cadencia: 'semanal', ativo: true },
      select: CAMPOS_SUB,
    });
    return paraDto(atualizado);
  }

  /** Igual as de token, mas pela sessao — para os botoes da tela. */
  async definirCadencia(userId: string, cadencia: Cadencia): Promise<AssinaturaDto> {
    const sub = await this.garantir(userId);
    const atualizado = await this.prisma.emailSubscription.update({
      where: { id: sub.id },
      data: {
        cadencia,
        ...(cadencia === 'mensal'
          ? { contratadoEm: sub.contratadoEm ?? new Date() }
          : {}),
      },
      select: CAMPOS_SUB,
    });
    return paraDto(atualizado);
  }

  private async porToken(token: string) {
    // **Token vazio nao pode virar `findFirst` sem filtro.** String vazia com
    // `findUnique` nao casa (a coluna e unica e nao aceita vazio na pratica),
    // mas a checagem explicita evita depender disso.
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new NotFoundException('Link invalido ou expirado');
    }
    const sub = await this.prisma.emailSubscription.findUnique({
      where: { token },
      select: CAMPOS_SUB,
    });
    if (!sub) throw new NotFoundException('Link invalido ou expirado');
    return sub;
  }

  /**
   * A metrica do admin (criterio do JOB-25).
   *
   * "Quantas pessoas o Horizons empregou" e o numero que vende o produto para
   * o proximo usuario.
   */
  async metricas(): Promise<MetricasEmailDto> {
    const [assinantes, ativos, contratados, mensais, jaEnviados] = await Promise.all([
      this.prisma.emailSubscription.count(),
      this.prisma.emailSubscription.count({ where: { ativo: true } }),
      this.prisma.emailSubscription.count({ where: { contratadoEm: { not: null } } }),
      this.prisma.emailSubscription.count({ where: { cadencia: 'mensal' } }),
      this.prisma.emailSubscription.count({ where: { ultimoEnvioEm: { not: null } } }),
    ]);
    const tg = await this.telegram.contarVinculos();

    return {
      assinantes,
      ativos,
      contratados,
      emCadenciaMensal: mensais,
      jaReceberamAlgum: jaEnviados,
      provedor: this.provider.nome,
      provedorEntrega: this.provider.entrega,
      telegramVinculados: tg.vinculados,
      telegramAtivos: tg.ativos,
      telegramLigado: this.telegramProvider.entrega,
    };
  }

  /**
   * As vagas novas para uma pessoa, desde o ultimo envio.
   *
   * **`foundAt > ultimoEnvioEm` e o coracao do criterio "so vagas novas".** O
   * `skipDuplicates` da busca agendada (JOB-03) e o que faz isso funcionar: a
   * mesma vaga reencontrada nao ganha `foundAt` novo, entao nao volta a
   * parecer nova.
   *
   * Quem nunca recebeu (`ultimoEnvioEm` nulo) leva as vagas dos ultimos 7
   * dias, e nao tudo o que existe: o primeiro e-mail com 15 dias de acumulo
   * seria uma parede de texto justamente na hora de causar a primeira
   * impressao.
   */
  async vagasNovas(userId: string): Promise<VagaDto[]> {
    const perfil = await this.prisma.jobProfile.findUnique({
      where: { userId },
      select: { grupo: true, filtros: true, ativo: true },
    });
    // Sem perfil nao ha grupo, e sem grupo nao ha o que mandar. Diferente da
    // tela, que mostra tudo: um e-mail nao solicitado com vagas de outro grupo
    // seria spam.
    if (!perfil || !perfil.ativo) return [];

    const sub = await this.prisma.emailSubscription.findUnique({
      where: { userId },
      select: { ultimoEnvioEm: true },
    });
    const desde = sub?.ultimoEnvioEm ?? new Date(Date.now() - UMA_SEMANA);

    const achadas = await this.prisma.foundJob.findMany({
      where: {
        grupo: perfil.grupo,
        foundAt: { gt: desde },
        expiresAt: { gt: new Date() },
      },
      select: CAMPOS,
      orderBy: [{ postedAt: 'desc' }, { foundAt: 'desc' }],
      take: 100,
    });

    // O MESMO filtro da tela: quem pediu "minimo 12k" nao pode receber 8k por
    // e-mail so porque outra pessoa do grupo pediu 8k.
    const filtros = (perfil.filtros ?? {}) as FiltrosDto;
    return achadas.filter((v) => passaNoFiltro(v, filtros)).map(toDto);
  }

  /**
   * Uma rodada de envio, **para os dois canais**.
   *
   * Devolve o que aconteceu em vez de so logar: e o que a tela do admin mostra
   * ao clicar em "enviar agora", e o que torna a feature conferivel sem SMTP e
   * sem token de bot.
   *
   * **A selecao de vagas acontece UMA vez por pessoa e serve os dois canais**
   * (decisao de arquitetura do JOB-32). E o que garante o criterio "a lista de
   * vagas e a mesma nos dois": ela e literalmente a mesma variavel, e nao duas
   * consultas que precisariam concordar. O que e por canal e so o carimbo de
   * ultimo envio e a renderizacao.
   */
  async rodar(): Promise<ResultadoRodadaDto> {
    const agora = new Date();

    // **Varre PESSOAS, e nao assinaturas de e-mail.** Antes do JOB-32 a
    // consulta partia de `emailSubscription`, o que bastava quando so havia um
    // canal. Agora quem vinculou o Telegram sem nunca ligar o e-mail nao tem
    // linha la — e ficaria fora da rodada para sempre, com o canal ligado na
    // tela e nada chegando.
    const candidatos = await this.prisma.user.findMany({
      where: {
        active: true,
        // Ao menos um canal ligado. Sem isto a rodada consideraria a base
        // inteira e gastaria uma consulta de vagas por pessoa para nada.
        OR: [{ emailSub: { ativo: true } }, { telegram: { ativo: true } }],
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailSub: {
          select: {
            id: true,
            token: true,
            cadencia: true,
            ativo: true,
            ultimoEnvioEm: true,
          },
        },
        telegram: { select: { id: true, chatId: true, ativo: true, ultimoEnvioEm: true } },
      },
      // A fila gira pelo que esperou mais, igual a busca agendada. Ordena pelo
      // carimbo do e-mail, que e o canal que existe desde o JOB-24; quem so
      // tem Telegram entra com nulo, ou seja, na frente.
      orderBy: [{ emailSub: { ultimoEnvioEm: { sort: 'asc', nulls: 'first' } } }],
      take: PESSOAS_POR_RODADA,
    });

    const resultado: ResultadoRodadaDto = {
      considerados: candidatos.length,
      enviados: 0,
      pulados: 0,
      falhas: 0,
      provedor: this.provider.nome,
      provedorEntrega: this.provider.entrega,
      enviadosTelegram: 0,
      provedorTelegramEntrega: this.telegramProvider.entrega,
    };

    for (const c of candidatos) {
      const sub = c.emailSub;
      const tg = c.telegram;

      // A cadencia e da PESSOA, e nao do canal (JOB-25: "quem foi contratado
      // recebe uma vez por mes"). Mora em `emailSubscription`; quem so tem
      // Telegram nao tem essa linha e usa o default.
      const cadencia = sub?.cadencia ?? 'semanal';

      const emailVence = Boolean(sub?.ativo) && venceu(cadencia, sub?.ultimoEnvioEm ?? null, agora);
      const telegramVence =
        Boolean(tg?.ativo) && venceu(cadencia, tg?.ultimoEnvioEm ?? null, agora);

      // Nenhum canal vencido: nem consulta vaga.
      if (!emailVence && !telegramVence) {
        resultado.pulados++;
        continue;
      }

      try {
        const vagas = await this.vagasNovas(c.id);
        // **Nao existe mensagem vazia**, em canal nenhum (criterio do JOB-24 e
        // do JOB-32), e nenhum carimbo avanca: as vagas desta semana continuam
        // novas na proxima.
        if (vagas.length === 0) {
          resultado.pulados++;
          continue;
        }

        // A MESMA selecao alimenta as duas renderizacoes.
        const dados = {
          nome: primeiroNome(c.name),
          vagas,
          totalNovas: vagas.length,
          urlBase: this.urlBase(),
          // Os links de um clique precisam do token da assinatura. Quem so tem
          // Telegram ainda nao tem um; `garantir` cria a linha DESLIGADA, sem
          // inscrever ninguem em e-mail nenhum.
          token: sub?.token ?? (await this.garantir(c.id)).token,
          cadencia,
        };

        let algumEnviado = false;

        if (emailVence && sub) {
          const corpo = montarCorpo(dados);
          const envio = await this.provider.enviar({
            para: c.email,
            assunto: corpo.assunto,
            html: corpo.html,
            texto: corpo.texto,
          });

          if (envio.enviado) {
            await this.prisma.emailSubscription.update({
              where: { id: sub.id },
              data: { ultimoEnvioEm: agora },
              select: { id: true },
            });
            resultado.enviados++;
            algumEnviado = true;
          } else {
            // **`ultimoEnvioEm` NAO avanca quando nao saiu.** E o que faz o
            // provedor de log ser honesto: no dia em que o SMTP entrar, a
            // pessoa recebe as vagas que se acumularam, e nao um e-mail
            // comecando do zero como se as semanas anteriores tivessem sido
            // entregues.
            this.log.log(
              `${c.email}: ${vagas.length} vagas prontas, e-mail nao enviado (${envio.motivo ?? 'provedor nao entrega'})`,
            );
          }
        }

        if (telegramVence && tg) {
          const texto = montarTexto(dados).texto;
          const envio = await this.telegramProvider.enviar(tg.chatId, texto);

          if (envio.enviado) {
            // Carimbo POR CANAL: o Telegram ter entregue nao pode fazer o
            // e-mail achar que entregou, nem o contrario.
            await this.prisma.telegramLink.update({
              where: { id: tg.id },
              data: { ultimoEnvioEm: agora },
              select: { id: true },
            });
            resultado.enviadosTelegram++;
            algumEnviado = true;
          } else {
            this.log.log(
              `${c.email}: ${vagas.length} vagas prontas, Telegram nao enviado (${envio.motivo ?? 'canal desligado'})`,
            );
            // Bot bloqueado e descadastro de fato: desliga o canal em vez de
            // insistir toda semana (caso de borda do card).
            if (envio.destinoInvalido) {
              await this.telegram.desativarPorBloqueio(c.id, envio.motivo ?? 'destino invalido');
            }
          }
        }

        if (!algumEnviado) resultado.pulados++;
      } catch (e) {
        // Uma pessoa que falha nao derruba a rodada dos outros.
        resultado.falhas++;
        this.log.error(`envio para ${c.email} falhou: ${String(e).slice(0, 200)}`);
      }
    }

    this.log.log(
      `rodada de vagas: ${resultado.considerados} considerados, ` +
        `${resultado.enviados} e-mails, ${resultado.enviadosTelegram} telegram, ` +
        `${resultado.pulados} pulados, ${resultado.falhas} falhas`,
    );
    return resultado;
  }

  /**
   * O corpo que sairia para esta pessoa agora, sem enviar nada.
   *
   * **E como se confere o e-mail sem SMTP** — o admin abre a previa e le o que
   * a pessoa leria. Sem isto, a unica prova de que o e-mail esta certo seria
   * um provedor que ninguem tem.
   */
  async previa(userId: string): Promise<{ assunto: string; html: string; texto: string } | null> {
    const sub = await this.garantir(userId);
    const vagas = await this.vagasNovas(userId);
    if (vagas.length === 0) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return montarCorpo({
      nome: primeiroNome(user?.name ?? ''),
      vagas,
      totalNovas: vagas.length,
      urlBase: this.urlBase(),
      token: sub.token,
      cadencia: sub.cadencia,
    });
  }
}

const CAMPOS_SUB = {
  id: true,
  cadencia: true,
  ativo: true,
  token: true,
  ultimoEnvioEm: true,
  contratadoEm: true,
} as const;

/** Ja passou o intervalo da cadencia desde o ultimo envio? */
function venceu(cadencia: string, ultimo: Date | null, agora: Date): boolean {
  if (!ultimo) return true;
  const intervalo = cadencia === 'mensal' ? UM_MES : UMA_SEMANA;
  return agora.getTime() - ultimo.getTime() >= intervalo;
}

/**
 * Token de 32 bytes em hex.
 *
 * `randomBytes` e nao `Math.random()`: isto e credencial — quem adivinha o
 * token descadastra a pessoa ou marca ela como contratada.
 */
function novoToken(): string {
  return randomBytes(32).toString('hex');
}

/** "Lucas Silva" vira "Lucas". Vazio devolve "there", para o "Hi ,". */
function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0];
  return primeiro || 'there';
}

/**
 * O estado de quem nunca se inscreveu.
 *
 * `id` vazio e o sinal de "nao existe linha" — a tela so precisa saber que
 * `ativo` e `false` para oferecer o botao de inscrever.
 */
function naoInscrito(): AssinaturaDto {
  return {
    id: '',
    cadencia: 'semanal',
    ativo: false,
    ultimoEnvioEm: null,
    contratadoEm: null,
  };
}

function paraDto(sub: {
  id: string;
  cadencia: string;
  ativo: boolean;
  token: string;
  ultimoEnvioEm: Date | null;
  contratadoEm: Date | null;
}): AssinaturaDto {
  return {
    id: sub.id,
    cadencia: sub.cadencia,
    ativo: sub.ativo,
    ultimoEnvioEm: sub.ultimoEnvioEm?.toISOString() ?? null,
    contratadoEm: sub.contratadoEm?.toISOString() ?? null,
  };
}

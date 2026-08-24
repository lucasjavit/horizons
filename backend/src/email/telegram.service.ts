import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramProvider, temTokenDoBot, usernameDoBot } from './telegram.provider';
import type { TelegramStatusDto, TelegramVinculoDto } from './telegram.dto';

/**
 * A vinculacao com o Telegram e o que o `/start` faz (JOB-32).
 *
 * **A restricao que decide o desenho**: um bot nao pode iniciar conversa com
 * quem nunca falou com ele. O `chat_id` — que e o endereco de entrega — so
 * passa a existir depois do START. Dai os cinco passos do card: botao, token,
 * deep link, START, grava e invalida o token.
 *
 * O envio NAO mora aqui. Ele esta em `EmailService.rodar`, junto com o do
 * e-mail, porque a selecao de vagas e a cadencia sao as mesmas — duplicar a
 * varredura era exatamente o que a decisao de arquitetura do card proibiu.
 */

/** Meia hora. Convite aberto e nao usado nao pode ficar aguardando para sempre. */
const VALIDADE_MS = 30 * 60 * 1000;

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: TelegramProvider,
  ) {}

  /**
   * O canal esta utilizavel?
   *
   * Exige token **e** username: com token e sem username o envio funcionaria,
   * mas ninguem conseguiria vincular, porque o deep link nao teria bot. Um
   * canal que ninguem pode vincular e um canal desligado.
   */
  private disponivel(): boolean {
    return temTokenDoBot() && Boolean(usernameDoBot());
  }

  /**
   * O que a tela precisa saber. **Nunca inclui o token do convite** — ele e
   * credencial, mesma regra do token do JOB-24.
   */
  async status(userId: string): Promise<TelegramStatusDto> {
    if (!this.disponivel()) {
      // Canal desligado: a tela nao mostra a opcao. Devolver o estado em vez
      // de 404 deixa o front decidir sem tratar erro para um caso normal.
      return { disponivel: false, vinculado: false, username: null, ativo: false };
    }

    const link = await this.prisma.telegramLink.findUnique({
      where: { userId },
      select: { username: true, ativo: true },
    });

    return {
      disponivel: true,
      vinculado: link !== null,
      username: link?.username ?? null,
      ativo: link?.ativo ?? false,
    };
  }

  /**
   * Passo 2 dos cinco: gera o token de uso unico e devolve o deep link.
   *
   * Devolve a **URL montada**, e nao o token: assim o token nunca aparece
   * sozinho numa resposta de API, e a tela so precisa abrir o que recebeu.
   * Ele continua visivel dentro da URL — e inevitavel, e o Telegram exige que
   * a pessoa o carregue —, mas nao ha campo `token` em resposta nenhuma.
   */
  async criarConvite(userId: string): Promise<TelegramVinculoDto> {
    if (!this.disponivel()) {
      throw new BadRequestException('O canal do Telegram nao esta configurado.');
    }

    const ja = await this.prisma.telegramLink.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (ja) {
      // Em ingles porque a tela de vagas e em ingles (decisao do JOB-04) — a
      // mensagem do backend chega direto ao usuario.
      throw new BadRequestException(
        'This account is already connected to Telegram.',
      );
    }

    // Convites vencidos ou nao usados desta pessoa saem do caminho: sem isto,
    // clicar no botao tres vezes deixaria tres tokens validos abertos.
    await this.prisma.telegramConvite.deleteMany({
      where: { userId, usadoEm: null },
    });

    const convite = await this.prisma.telegramConvite.create({
      data: {
        userId,
        token: novoTokenDeConvite(),
        expiraEm: new Date(Date.now() + VALIDADE_MS),
      },
      select: { token: true, expiraEm: true },
    });

    return {
      url: `https://t.me/${usernameDoBot()}?start=${convite.token}`,
      expiraEm: convite.expiraEm.toISOString(),
    };
  }

  /**
   * Passos 4 e 5: o `/start <token>` chegou pelo webhook.
   *
   * Devolve o texto que o bot responde na conversa — a pessoa esta olhando o
   * Telegram neste instante, e silencio ali parece que nao funcionou.
   *
   * **Nunca lanca.** Um erro aqui viraria 500 para o Telegram, que reentrega o
   * mesmo update por minutos. Todo caminho ruim vira uma resposta explicando o
   * que houve.
   */
  async processarStart(
    chatId: bigint,
    payload: string,
    username: string | null,
  ): Promise<string> {
    // START sem token: alguem achou o bot na busca do Telegram e apertou.
    if (!payload) {
      return (
        'Hi! To get job alerts here, open the Jobs tab on Horizons and click ' +
        '"Connect Telegram". This link has to start from there so we know which account is yours.'
      );
    }

    const convite = await this.prisma.telegramConvite.findUnique({
      where: { token: payload },
      select: { id: true, userId: true, expiraEm: true, usadoEm: true },
    });

    if (!convite) {
      return 'This link is not valid. Open the Jobs tab on Horizons and click "Connect Telegram" to get a new one.';
    }

    // **Token usado nao vincula uma segunda conta** (criterio do card). Por
    // isso a linha e marcada e nao apagada: apagada, este caso seria
    // indistinguivel de "token inexistente".
    if (convite.usadoEm) {
      return 'This link was already used. Open the Jobs tab on Horizons to connect again.';
    }

    if (convite.expiraEm.getTime() < Date.now()) {
      return 'This link expired. Open the Jobs tab on Horizons and click "Connect Telegram" to get a new one.';
    }

    // A pessoa apagou a conversa e apertou START de novo: o `chat_id` e o
    // mesmo, e nao pode virar vinculo duplicado. Caso de borda do card.
    const doMesmoChat = await this.prisma.telegramLink.findUnique({
      where: { chatId },
      select: { userId: true },
    });
    if (doMesmoChat && doMesmoChat.userId !== convite.userId) {
      // **A segunda vinculacao e recusada** (decidido em 24/08). Um chat
      // recebendo vagas de dois perfis e confusao sem dono: quem recebe nao
      // teria como saber de qual conta veio cada vaga.
      await this.marcarUsado(convite.id);
      return 'This Telegram account is already connected to another Horizons account. Disconnect it there first.';
    }

    // Tudo certo: grava o vinculo e invalida o token, na mesma transacao. Sem
    // ela, uma falha entre as duas deixaria o token valido com o vinculo ja
    // feito — e ele serviria para uma segunda tentativa.
    await this.prisma.$transaction([
      this.prisma.telegramLink.upsert({
        where: { userId: convite.userId },
        // O upsert cobre o START repetido do mesmo dono: religa e atualiza o
        // username, em vez de estourar na chave unica.
        create: { userId: convite.userId, chatId, username, ativo: true },
        update: { chatId, username, ativo: true },
        select: { id: true },
      }),
      this.prisma.telegramConvite.update({
        where: { id: convite.id },
        data: { usadoEm: new Date() },
        select: { id: true },
      }),
    ]);

    this.log.log(`vinculo criado para o usuario ${convite.userId}`);
    return "You're connected. New jobs matching your profile will arrive here. You'll keep getting them by email too, if that's on.";
  }

  /**
   * Desvincular. **O `chat_id` some do banco** — criterio do card.
   *
   * Apaga a linha em vez de so desligar `ativo`, ao contrario do e-mail: la o
   * que se preserva e `ultimoEnvioEm` e o token dos links de um clique, que
   * nao existem aqui. E o `chat_id` e o dado da pessoa; guardar depois de ela
   * pedir para sair seria guardar o que nao se usa mais.
   */
  async desvincular(userId: string): Promise<TelegramStatusDto> {
    const link = await this.prisma.telegramLink.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException('This account is not connected to Telegram.');
    }

    await this.prisma.telegramLink.delete({ where: { userId }, select: { id: true } });
    // Convites pendentes tambem: deixar um aberto permitiria revincular sem
    // passar pela tela.
    await this.prisma.telegramConvite.deleteMany({ where: { userId } });

    return this.status(userId);
  }

  /**
   * Desliga o canal de quem bloqueou o bot, sem apagar o vinculo.
   *
   * Caso de borda do card: 403 do Telegram e um descadastro de fato. Nao apaga
   * porque a pessoa pode desbloquear e religar pela tela — e ai o `chat_id`
   * ainda esta la.
   */
  async desativarPorBloqueio(userId: string, motivo: string): Promise<void> {
    await this.prisma.telegramLink.updateMany({
      where: { userId },
      data: { ativo: false },
    });
    this.log.warn(`canal desativado para ${userId}: ${motivo}`);
  }

  private async marcarUsado(id: string): Promise<void> {
    await this.prisma.telegramConvite.update({
      where: { id },
      data: { usadoEm: new Date() },
      select: { id: true },
    });
  }

  /** Quantos vinculos existem — a taxa de vinculacao que o card quer medir. */
  async contarVinculos(): Promise<{ vinculados: number; ativos: number }> {
    const [vinculados, ativos] = await Promise.all([
      this.prisma.telegramLink.count(),
      this.prisma.telegramLink.count({ where: { ativo: true } }),
    ]);
    return { vinculados, ativos };
  }
}

/**
 * O token do deep link.
 *
 * **16 bytes em base64url, e nao os 32 em hex do JOB-24.** O parametro `start`
 * do Telegram aceita no maximo 64 caracteres de `A-Z a-z 0-9 _ -`, e 32 bytes
 * em hex dariam exatamente 64 — sem folga nenhuma. base64url de 16 bytes da 22
 * caracteres, dentro do alfabeto permitido, com 128 bits de entropia: mais que
 * suficiente para um segredo que vive 30 minutos.
 *
 * `randomBytes` e nao `Math.random()`: quem adivinha o token vincula o proprio
 * Telegram a conta de outra pessoa.
 */
function novoTokenDeConvite(): string {
  return randomBytes(16).toString('base64url');
}

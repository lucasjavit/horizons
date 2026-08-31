import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  POR_PAGINA,
  type ListaDeUsuariosDto,
  type UsuarioDaListaDto,
} from './usuarios.dto';

/**
 * Os campos que saem do banco. **Nunca o registro inteiro.**
 *
 * ⚠️ Nao ha `documentEnc`, `documentHint`, `documentCountry`, `phone` nem
 * nenhuma coluna de endereco. Nao e economia de bytes: gerenciar papel nao
 * precisa do CPF de ninguem, e o jeito mais seguro de nao vazar um campo e
 * nunca busca-lo — nao ha `delete` a esquecer no caminho de volta (PLT-11).
 */
const CAMPOS = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  active: true,
  createdAt: true,
  lastLoginAt: true,
  deactivatedAt: true,
  deactivatedBy: { select: { name: true } },
} as const;

/** O shape que o `select` acima produz. */
interface LinhaDoBanco {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  deactivatedAt: Date | null;
  deactivatedBy: { name: string } | null;
}

/** Quem esta agindo. So o que as regras precisam. */
interface Ator {
  id: string;
  role: string;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pode ligar/desligar a conta de `alvo`?
   *
   * **Uma funcao so, usada pelo `PATCH` e pela lista.** A lista manda
   * `canToggleActive` para a tela decidir se desenha o botao; se a regra
   * vivesse em dois lugares, o botao apareceria para um gesto que da 403 — ou,
   * pior, o contrario.
   *
   * As tres recusas, e o motivo de cada uma:
   *
   * - **em si mesmo**: quem se desativa perde o acesso a tela que o
   *   reativaria. Irreversivel sem mexer no banco;
   * - **manager sobre admin**: o cargo viraria uma forma de derrubar quem o
   *   supervisiona;
   * - **manager sobre manager**: dois managers podem se desativar mutuamente,
   *   e o dono descobre depois.
   */
  private podeMudarAtivo(ator: Ator, alvo: { id: string; role: string }): boolean {
    if (ator.id === alvo.id) return false;
    if (ator.role === 'ADMIN') return true;
    if (ator.role === 'MANAGER') return alvo.role === 'COMMON_USER';
    return false;
  }

  /**
   * Pode mudar o papel de `alvo`?
   *
   * So o ADMIN, e nunca em si mesmo: um dono que se rebaixa perde o acesso a
   * tela que o promoveria de volta. (Na pratica o `ADMIN_EMAILS` o devolveria
   * no login seguinte — mas so porque ele esta na variavel; a tela nao deve
   * oferecer um gesto cuja reversao depende de um arquivo no servidor.)
   */
  private podeMudarPapel(ator: Ator, alvo: { id: string }): boolean {
    return ator.role === 'ADMIN' && ator.id !== alvo.id;
  }

  async listar(
    ator: Ator,
    q: string | undefined,
    pagina: number,
  ): Promise<ListaDeUsuariosDto> {
    const busca = (q ?? '').trim();

    // **`undefined` e nao `{}` quando nao ha busca.** Em Prisma, `undefined`
    // num `where:` descarta a condicao — que e o que se quer aqui, e o mesmo
    // comportamento que ja apagou uma tabela inteira neste projeto (JOB-05)
    // quando era o que NAO se queria. Fica explicito para nao virar acidente.
    const where = busca
      ? {
          OR: [
            { email: { contains: busca, mode: 'insensitive' as const } },
            { name: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const total = await this.prisma.user.count({ where });
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    // A pagina pedida pode nao existir mais — alguem buscou algo na pagina 4 e
    // o filtro deixou duas. Grampeia em vez de devolver lista vazia, senao a
    // tela mostra "0 users" com o contador dizendo que ha 30.
    const atual = Math.min(Math.max(1, pagina), paginas);

    const linhas = await this.prisma.user.findMany({
      where,
      // Quem entrou por ultimo primeiro: a pergunta que traz alguem a esta
      // tela costuma ser sobre quem acabou de se cadastrar.
      orderBy: { createdAt: 'desc' },
      skip: (atual - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: CAMPOS,
    });

    return {
      itens: linhas.map((l) => this.paraDto(ator, l)),
      total,
      pagina: atual,
      paginas,
      porPagina: POR_PAGINA,
    };
  }

  /**
   * Promove a MANAGER ou rebaixa a COMMON_USER.
   *
   * `ADMIN` nao chega aqui: o DTO tem `@IsIn(['COMMON_USER','MANAGER'])`, entao
   * o corpo com `"ADMIN"` para no ValidationPipe com 400. A checagem abaixo
   * repete de proposito — o DTO e a barreira de entrada, e esta e a regra de
   * negocio, que precisa valer mesmo se alguem acrescentar um papel a lista.
   */
  async mudarPapel(
    ator: Ator,
    alvoId: string,
    papel: string,
  ): Promise<UsuarioDaListaDto> {
    if (papel === 'ADMIN') {
      throw new BadRequestException(
        'O papel de admin vem da variavel ADMIN_EMAILS, e nao da tela.',
      );
    }

    const alvo = await this.buscar(alvoId);

    if (!this.podeMudarPapel(ator, alvo)) {
      throw new ForbiddenException(
        ator.id === alvo.id
          ? 'Voce nao pode mudar o proprio papel.'
          : 'Somente o administrador muda o papel de alguem.',
      );
    }

    // **Rebaixar um ADMIN pela tela nao funciona, e a tela nao deve fingir que
    // sim.** O `ADMIN_EMAILS` o devolveria no login seguinte, entao o gesto
    // duraria ate a proxima entrada e ninguem veria erro. Dizer o que de fato
    // tira o papel e mais util que gravar um valor que nao dura.
    if (alvo.role === 'ADMIN') {
      throw new BadRequestException(
        'Esta conta e admin pela variavel ADMIN_EMAILS. Remova o e-mail de la para tirar o papel.',
      );
    }

    const salvo = await this.prisma.user.update({
      where: { id: alvoId },
      data: { role: papel },
      select: CAMPOS,
    });
    return this.paraDto(ator, salvo);
  }

  /**
   * Liga ou desliga a conta.
   *
   * **`active = false` derruba a sessao na requisicao seguinte** — o guard rele
   * o usuario do banco a cada request (PLT-02). Nao ha token a revogar nem
   * espera de 30 dias, e e por isso que a tela pede confirmacao antes.
   */
  async mudarAtivo(
    ator: Ator,
    alvoId: string,
    ativo: boolean,
  ): Promise<UsuarioDaListaDto> {
    const alvo = await this.buscar(alvoId);

    if (!this.podeMudarAtivo(ator, alvo)) {
      throw new ForbiddenException(
        ator.id === alvo.id
          ? 'Voce nao pode desativar a propria conta.'
          : 'Voce nao pode desativar esta conta.',
      );
    }

    const salvo = await this.prisma.user.update({
      where: { id: alvoId },
      data: ativo
        ? // Reativar LIMPA o registro: manter "disabled by Lucas on 31/08" ao
          // lado de alguem que esta dentro faria a tela mentir. O historico
          // completo e o card do log de auditoria.
          { active: true, deactivatedAt: null, deactivatedById: null }
        : { active: false, deactivatedAt: new Date(), deactivatedById: ator.id },
      select: CAMPOS,
    });
    return this.paraDto(ator, salvo);
  }

  /** O alvo, ou 404. Mensagem em portugues sem acento, como o resto da API. */
  private async buscar(id: string): Promise<{ id: string; role: string }> {
    const alvo = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!alvo) throw new NotFoundException('Usuario nao encontrado');
    return alvo;
  }

  private paraDto(ator: Ator, l: LinhaDoBanco): UsuarioDaListaDto {
    return {
      id: l.id,
      email: l.email,
      name: l.name,
      avatarUrl: l.avatarUrl,
      role: l.role,
      active: l.active,
      createdAt: l.createdAt.toISOString(),
      lastLoginAt: l.lastLoginAt?.toISOString() ?? null,
      deactivatedAt: l.deactivatedAt?.toISOString() ?? null,
      deactivatedByName: l.deactivatedBy?.name ?? null,
      isSelf: l.id === ator.id,
      canToggleActive: this.podeMudarAtivo(ator, l),
      // Um ADMIN nao tem papel mudavel pela tela: quem decide e a variavel.
      canChangeRole: this.podeMudarPapel(ator, l) && l.role !== 'ADMIN',
    };
  }
}

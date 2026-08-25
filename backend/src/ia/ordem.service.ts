import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PROVEDORES, provedor, provedoresCom, type Capacidade } from './provedores';

/**
 * A ordem da cadeia, como o admin a deixou.
 *
 * **Substitui a preferencia unica** (`jobs.iaDaBusca`), que promovia UM
 * provedor ao topo e deixava o resto na ordem do registro. Isso resolvia para
 * dois provedores; para seis, a segunda e a terceira posicoes passam a
 * importar — quando o topo cai, quem atende e o segundo, e nao "algum outro".
 *
 * ## Provedor sem linha vai para o fim
 *
 * A ordem gravada nao precisa cobrir os seis. Quem nao tem linha entra depois
 * de quem tem, na ordem do registro. E o que faz um provedor NOVO em
 * `provedores.ts` aparecer sem migracao de dados — ele nasce no fim, que e
 * onde um provedor que ninguem posicionou deve estar.
 */
@Injectable()
export class OrdemDaIaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A ordem completa dos seis provedores.
   *
   * Sempre devolve os seis, sempre na mesma base: o gravado primeiro, o resto
   * na ordem do registro. Nunca devolve um id que saiu do registro — uma
   * linha orfa no banco (provedor removido do codigo) e ignorada, em vez de
   * virar um item fantasma na tela.
   */
  async ordem(): Promise<ApiProvider[]> {
    const linhas = await this.prisma.providerOrder.findMany({
      select: { provider: true, posicao: true },
      orderBy: { posicao: 'asc' },
    });

    const posicionados = linhas
      .map((l) => l.provider)
      .filter((id) => provedor(id) !== undefined);
    const vistos = new Set(posicionados);
    const resto = PROVEDORES.map((p) => p.id).filter((id) => !vistos.has(id));
    return [...posicionados, ...resto];
  }

  /** A ordem restrita a quem atende uma capacidade. E a cadeia daquele uso. */
  async ordemPara(capacidade: Capacidade): Promise<ApiProvider[]> {
    const aptos = new Set(provedoresCom(capacidade).map((p) => p.id));
    return (await this.ordem()).filter((id) => aptos.has(id));
  }

  /**
   * Move um provedor uma posicao na cadeia em que ele aparece.
   *
   * **O vizinho e o VISIVEL, e nao o adjacente na lista completa.** A tela
   * mostra a cadeia de busca com tres provedores (so eles tem busca na web);
   * se a ordem completa fosse `Claude, Groq, ChatGPT, …`, mover ChatGPT para
   * cima trocando com o adjacente o poria acima do Groq — que nao aparece
   * naquela lista. A tela nao mudaria, e o botao pareceria quebrado.
   *
   * Entao a troca acontece com o vizinho DENTRO da capacidade, e as posicoes
   * de quem nao participa ficam onde estao. `capacidade` diz qual cadeia a
   * pessoa esta olhando; sem ela, a lista completa (a de leitura tem os seis).
   *
   * Fora dos limites nao e erro: a tela ja desabilita a seta na ponta, e um
   * clique que chega assim mesmo (teclado rapido, dois cliques) nao merece
   * um 400 — merece nao fazer nada.
   */
  async mover(
    id: ApiProvider,
    direcao: 'cima' | 'baixo',
    capacidade?: Capacidade,
  ): Promise<ApiProvider[]> {
    if (!provedor(id)) {
      throw new BadRequestException('Provedor de IA desconhecido.');
    }

    const atual = await this.ordem();
    // A lista que a pessoa esta vendo: e nela que "o de cima" faz sentido.
    const aptos = capacidade
      ? new Set(provedoresCom(capacidade).map((p) => p.id))
      : null;
    const visiveis = aptos ? atual.filter((x) => aptos.has(x)) : atual;

    const deVisivel = visiveis.indexOf(id);
    const paraVisivel = direcao === 'cima' ? deVisivel - 1 : deVisivel + 1;
    if (deVisivel < 0 || paraVisivel < 0 || paraVisivel >= visiveis.length) {
      return atual;
    }

    // Traduz de volta para indices da lista completa e troca os dois — os que
    // nao aparecem na cadeia mantem suas posicoes.
    const de = atual.indexOf(id);
    const para = atual.indexOf(visiveis[paraVisivel]);
    const nova = [...atual];
    [nova[de], nova[para]] = [nova[para], nova[de]];
    await this.gravar(nova);
    return nova;
  }

  /**
   * Grava a lista inteira, uma linha por provedor.
   *
   * Regrava os seis e nao so os dois que trocaram: a posicao e relativa, e uma
   * gravacao parcial deixaria o banco com posicoes que so fazem sentido junto
   * com as antigas.
   */
  private async gravar(ordem: readonly ApiProvider[]): Promise<void> {
    await this.prisma.$transaction(
      ordem.map((id, i) =>
        this.prisma.providerOrder.upsert({
          where: { provider: id },
          create: { provider: id, posicao: i },
          update: { posicao: i },
          select: { provider: true },
        }),
      ),
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IaService } from '../ia/ia.service';
import { RecursosService } from '../settings/recursos.service';
import { BASE_FREEHIRE, UA_FREEHIRE } from './freehire-consulta';
import {
  SCHEMA_REMOTO,
  entradaRemoto,
  instrucaoRemoto,
  nomeDoPais,
  textoDoHtml,
  validarVeredito,
  type Veredito,
} from './remoto-do-pais';
import {
  MAX_VAGAS_POR_PEDIDO,
  type RemotoDoPaisDto,
  type VereditoDto,
} from './remoto-do-pais.dto';

/**
 * Quantos anuncios sao lidos ao mesmo tempo.
 *
 * Quatro e nao 25: o free tier dos provedores devolve 429 em rajada, e cada
 * 429 faz a cadeia cair para o proximo provedor — a pagina inteira acabaria no
 * provedor pago por causa da pressa.
 */
const CONCORRENCIA = 4;

/**
 * O `public_slug` do freehire. So o que tem esta forma vira requisicao: o id
 * vem do navegador e entra numa URL montada aqui.
 */
const SLUG = /^[a-z0-9][a-z0-9-]{2,180}$/;

const VEREDITOS: readonly string[] = ['sim', 'nao', 'nao_diz'];

@Injectable()
export class RemotoDoPaisService {
  private readonly log = new Logger(RemotoDoPaisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
    private readonly recursos: RecursosService,
  ) {}

  /**
   * O veredito de cada vaga da pagina, para o pais de quem pede.
   *
   * **Nunca lanca por causa da IA nem do freehire.** A verificacao e um
   * acrescimo sobre a lista: quando ela falha, a vaga simplesmente nao vem em
   * `vereditos`, e a tela fica com a resposta por campo (`elegibilidade.ts`).
   *
   * Falha NAO e guardada — so resposta. Guardar "nao consegui ler" faria uma
   * chave vencida numa tarde virar `nao_diz` para sempre.
   */
  async verificar(userId: string, ids: string[]): Promise<RemotoDoPaisDto> {
    const { verificacaoRemotoAtiva, ordemDaIa } = await this.recursos.obter();
    if (!verificacaoRemotoAtiva) return { estado: 'desligado', pais: null, vereditos: [] };

    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    const country = (usuario?.country ?? '').trim().toUpperCase();
    const pais = nomeDoPais(country);
    if (!pais) return { estado: 'sem_pais', pais: null, vereditos: [] };

    const pedidos = [...new Set(ids)].slice(0, MAX_VAGAS_POR_PEDIDO);
    const guardados = await this.prisma.remoteVerdict.findMany({
      where: { vagaId: { in: pedidos }, country },
      select: { vagaId: true, veredito: true, trecho: true },
    });
    const vereditos: VereditoDto[] = guardados
      .filter((g) => VEREDITOS.includes(g.veredito))
      .map((g) => ({ id: g.vagaId, veredito: g.veredito as Veredito, trecho: g.trecho }));

    const jaTem = new Set(vereditos.map((v) => v.id));
    const faltam = pedidos.filter((id) => !jaTem.has(id) && SLUG.test(id));

    const inicio = Date.now();
    let chamadas = 0;
    const fila = [...faltam];
    const operario = async (): Promise<void> => {
      for (let id = fila.shift(); id !== undefined; id = fila.shift()) {
        try {
          const anuncio = await this.anuncio(id);
          if (!anuncio) continue;
          chamadas++;
          const bruto = await this.ia.pedir('estruturada', ordemDaIa, {
            instrucao: instrucaoRemoto(pais),
            entrada: entradaRemoto(anuncio),
            schema: SCHEMA_REMOTO as unknown as Record<string, unknown>,
            nomeDoSchema: 'remoto_do_pais',
            maxTokens: 400,
          });
          const lido = validarVeredito(bruto, anuncio);
          if (!lido) continue;
          // `upsert` e nao `create`: duas pessoas do mesmo pais abrindo a
          // mesma pagina ao mesmo tempo leem a mesma vaga em paralelo, e a
          // segunda gravacao nao pode virar erro de chave unica.
          await this.prisma.remoteVerdict.upsert({
            where: { vagaId_country: { vagaId: id, country } },
            create: { vagaId: id, country, veredito: lido.veredito, trecho: lido.trecho },
            update: { veredito: lido.veredito, trecho: lido.trecho },
            select: { id: true },
          });
          vereditos.push({ id, ...lido });
        } catch (e) {
          // Sem chave, sem cota, recusa do modelo, banco: a vaga fica sem
          // veredito e a lista segue. O detalhe por provedor ja esta no log
          // do `IaService`.
          this.log.warn(`vaga ${id} ficou sem veredito: ${String(e).slice(0, 200)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCORRENCIA }, () => operario()));

    if (faltam.length > 0) {
      this.log.log(
        `remoto de ${country}: ${pedidos.length} pedidas, ${guardados.length} do cache, ` +
          `${chamadas} chamadas de IA, ${vereditos.length - guardados.length} gravadas, ` +
          `${Date.now() - inicio} ms`,
      );
    }
    return { estado: 'ok', pais, vereditos };
  }

  /**
   * O texto do anuncio, buscado no freehire pelo slug.
   *
   * A busca (`/agent/jobs/search`) ja traz a descricao, mas o `VagaDto` nao a
   * carrega — e nao deve: sao ~2-8 KB por vaga que o navegador so devolveria
   * para ca. O local vai junto, na primeira linha: ele e parte do anuncio e
   * muitas vezes e a unica frase que diz de onde ("Remote - US").
   *
   * `null` em qualquer falha. Sem repeticao: e um acrescimo, e insistir
   * penduraria a pagina.
   */
  private async anuncio(slug: string): Promise<string | null> {
    try {
      const r = await fetch(`${BASE_FREEHIRE}/api/v1/jobs/${encodeURIComponent(slug)}`, {
        headers: { 'User-Agent': UA_FREEHIRE, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) return null;
      const corpo = (await r.json()) as { data?: { description?: unknown; location?: unknown } };
      const descricao =
        typeof corpo.data?.description === 'string' ? textoDoHtml(corpo.data.description) : '';
      if (descricao.length < 40) return null;
      const local = typeof corpo.data?.location === 'string' ? corpo.data.location.trim() : '';
      return local ? `Location: ${local}\n\n${descricao}` : descricao;
    } catch {
      return null;
    }
  }
}

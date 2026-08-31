import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cifrar, SALT_DOCUMENTOS } from '../settings/crypto';
import {
  dicaDoDocumento,
  PAISES,
  PAISES_COM_REGRA,
  paisPorCodigo,
  validarDocumento,
} from './documentos';
import type { PaisDto, PerfilDto, SalvarPerfilDto } from './perfil.dto';

/** O que o Prisma devolve, e o unico shape que o servico le. */
const CAMPOS = {
  country: true,
  phone: true,
  documentHint: true,
  documentCountry: true,
} as const;

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  /** A lista de paises e estatica — nao toca no banco. */
  paises(): PaisDto[] {
    return PAISES.map((p) => ({
      codigo: p.codigo,
      nome: p.nome,
      ddi: p.ddi,
      documento: p.documento,
      validado: PAISES_COM_REGRA.includes(p.codigo),
    exemplo: p.exemplo,
    }));
  }

  async ler(userId: string): Promise<PerfilDto> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      // `documentEnc` NAO entra no select. Nao e economia: o valor cifrado nao
      // tem por que existir na memoria de um handler de leitura, e o jeito
      // mais seguro de nunca vazar um campo e nunca busca-lo.
      select: CAMPOS,
    });
    if (!u) throw new BadRequestException('Usuario nao encontrado');
    return this.paraDto(u);
  }

  /**
   * Grava o que a pessoa preencheu.
   *
   * ## As duas regras que este metodo existe para garantir
   *
   * **1. Trocar de pais invalida o documento guardado.** Um CPF valido nao e
   * um CUIT; aceitar em silencio o documento antigo depois da troca e
   * exatamente o defeito que o PLT-10 nomeia. Quando o pais muda e nao vem
   * documento novo, o guardado e APAGADO — nao fica um documento validado
   * contra um pais que nao vale mais.
   *
   * **2. String vazia apaga; campo ausente nao mexe.** Sao gestos diferentes:
   * `undefined` e "a tela nao falou deste campo", `''` e "quero limpar". Em
   * Prisma, `undefined` num `data:` descarta a atualizacao daquele campo — e o
   * mesmo comportamento que num `where:` ja apagou uma tabela aqui (JOB-05),
   * mas aqui e o que se quer.
   */
  async salvar(userId: string, corpo: SalvarPerfilDto): Promise<PerfilDto> {
    const atual = await this.prisma.user.findUnique({
      where: { id: userId },
      select: CAMPOS,
    });
    if (!atual) throw new BadRequestException('Usuario nao encontrado');

    // O pais que vale para ESTE salvamento: o que veio, ou o que ja estava.
    const paisNovo = corpo.country !== undefined ? corpo.country : atual.country;
    const pais = paisNovo || '';

    const documento = corpo.document?.trim() ?? '';
    if (documento) {
      if (!pais) {
        throw new BadRequestException(
          'Escolha o pais antes de informar o documento',
        );
      }
      const erro = validarDocumento(pais, documento);
      if (erro) throw new BadRequestException(erro);
    }

    const dados: {
      country?: string | null;
      phone?: string | null;
      documentEnc?: string | null;
      documentHint?: string | null;
      documentCountry?: string | null;
    } = {};

    if (corpo.country !== undefined) dados.country = corpo.country || null;
    if (corpo.phone !== undefined) dados.phone = corpo.phone || null;

    if (documento) {
      dados.documentEnc = cifrar(documento, SALT_DOCUMENTOS);
      dados.documentHint = dicaDoDocumento(documento);
      dados.documentCountry = pais;
    } else if (corpo.document !== undefined) {
      // Veio explicitamente vazio: apagar.
      dados.documentEnc = null;
      dados.documentHint = null;
      dados.documentCountry = null;
    } else if (
      atual.documentCountry &&
      corpo.country !== undefined &&
      atual.documentCountry !== pais
    ) {
      // Trocou de pais sem mandar documento novo. O guardado foi validado
      // contra outro pais, entao nao vale mais — apagar e mais honesto que
      // guardar um documento que a regra atual recusaria.
      //
      // **`corpo.country !== undefined` e nao `pais &&`** (QA, 31/08). Com
      // `pais &&`, escolher "Not set" caia fora dos tres ramos e o documento
      // sobrevivia orfao: pais nulo, documento cifrado, e nenhum gesto na tela
      // capaz de apaga-lo — o campo fica `disabled` sem pais, entao a pessoa
      // que se arrependeu nao tinha como remover o proprio CPF.
      //
      // "Not set" e gesto de limpar, e limpar tem de limpar. A distincao que
      // importa e "o campo veio no corpo" (a pessoa mexeu nele), e nao "o
      // valor novo e verdadeiro".
      dados.documentEnc = null;
      dados.documentHint = null;
      dados.documentCountry = null;
    }

    const salvo = await this.prisma.user.update({
      where: { id: userId },
      data: dados,
      select: CAMPOS,
    });
    return this.paraDto(salvo);
  }

  private paraDto(u: {
    country: string | null;
    phone: string | null;
    documentHint: string | null;
    documentCountry: string | null;
  }): PerfilDto {
    return {
      // Um pais que saiu da lista curada nao pode virar rotulo vazio na tela:
      // devolve-se so o que ainda existe.
      country: u.country && paisPorCodigo(u.country) ? u.country : null,
      phone: u.phone,
      documentHint: u.documentHint,
      documentCountry: u.documentCountry,
    };
  }
}

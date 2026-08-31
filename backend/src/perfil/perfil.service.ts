import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cifrar, SALT_DOCUMENTOS } from '../settings/crypto';
import { validarCodigoPostal, validarTextoDeEndereco } from './endereco';
import {
  dicaDoDocumento,
  PAISES,
  PAISES_COM_REGRA,
  paisPorCodigo,
  validarDocumento,
} from './documentos';
import type {
  EnderecoSalvoDto,
  PaisDto,
  PerfilDto,
  SalvarPerfilDto,
} from './perfil.dto';

/** O que o Prisma devolve, e o unico shape que o servico le. */
const CAMPOS = {
  country: true,
  phone: true,
  documentHint: true,
  documentCountry: true,
  addressStreet: true,
  addressNumber: true,
  addressComplement: true,
  addressDistrict: true,
  addressCity: true,
  addressState: true,
  addressPostalCode: true,
  addressCountry: true,
} as const;

/**
 * Os campos do endereco, ligando o nome da API a coluna e ao rotulo do erro.
 *
 * Uma tabela e nao oito `if`: acrescentar um campo de endereco passa a ser uma
 * linha aqui, e a validacao, a gravacao e a leitura ficam impossiveis de
 * divergir entre si — que e como um campo entra sem validacao sem ninguem ver.
 *
 * `country` fica de FORA: ele nao e texto livre, e validado pela lista fechada
 * no DTO, entao rodar o alfabeto de logradouro nele seria checar duas vezes a
 * coisa errada.
 */
const CAMPOS_DE_ENDERECO = [
  { api: 'street', coluna: 'addressStreet', rotulo: 'Street', max: 120 },
  { api: 'number', coluna: 'addressNumber', rotulo: 'Number', max: 20 },
  { api: 'complement', coluna: 'addressComplement', rotulo: 'Complement', max: 60 },
  { api: 'district', coluna: 'addressDistrict', rotulo: 'District', max: 60 },
  { api: 'city', coluna: 'addressCity', rotulo: 'City', max: 80 },
  { api: 'state', coluna: 'addressState', rotulo: 'State', max: 60 },
] as const;

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

    // O endereco e validado ANTES de qualquer gravacao. Nao ha transacao aqui
    // (e um unico `update`), mas validar no meio da montagem do `data` deixaria
    // o codigo dependendo de a ordem nunca mudar.
    const end = corpo.address;
    if (end) {
      for (const campo of CAMPOS_DE_ENDERECO) {
        const valor = end[campo.api];
        if (valor === undefined) continue;
        const erro = validarTextoDeEndereco(campo.rotulo, valor, campo.max);
        if (erro) throw new BadRequestException(erro);
      }
      if (end.postalCode !== undefined) {
        const erro = validarCodigoPostal(end.postalCode);
        if (erro) throw new BadRequestException(erro);
      }
    }

    const dados: {
      country?: string | null;
      phone?: string | null;
      documentEnc?: string | null;
      documentHint?: string | null;
      documentCountry?: string | null;
    } & Partial<Record<(typeof CAMPOS_DE_ENDERECO)[number]['coluna'], string | null>> & {
      addressPostalCode?: string | null;
      addressCountry?: string | null;
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

    // **`!== undefined` campo a campo, e nao `end.campo || null`.** E a mesma
    // regra que o QA cobrou no documento em 31/08: o que distingue os gestos e
    // *"o campo veio no corpo"* (a pessoa mexeu nele), e nao *"o valor novo e
    // verdadeiro"*. Apagar a cidade e um gesto legitimo, e `''` tem de chegar
    // ao banco como `null` em vez de cair fora do `if`.
    //
    // Campo ausente nao vira `null`: quem salva so o telefone nao pode perder
    // o endereco. Em Prisma, `undefined` no `data:` descarta a atualizacao
    // daquele campo — o mesmo comportamento que num `where:` ja apagou uma
    // tabela aqui (JOB-05), mas aqui e exatamente o que se quer.
    if (end) {
      for (const campo of CAMPOS_DE_ENDERECO) {
        const valor = end[campo.api];
        if (valor !== undefined) dados[campo.coluna] = valor.trim() || null;
      }
      if (end.postalCode !== undefined) {
        dados.addressPostalCode = end.postalCode.trim() || null;
      }
      if (end.country !== undefined) {
        dados.addressCountry = end.country || null;
      }
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
    addressStreet: string | null;
    addressNumber: string | null;
    addressComplement: string | null;
    addressDistrict: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressPostalCode: string | null;
    addressCountry: string | null;
  }): PerfilDto {
    const address: EnderecoSalvoDto = {
      street: u.addressStreet,
      number: u.addressNumber,
      complement: u.addressComplement,
      district: u.addressDistrict,
      city: u.addressCity,
      state: u.addressState,
      postalCode: u.addressPostalCode,
      // Mesmo cuidado do `country`: pais fora da lista curada nao pode virar
      // rotulo vazio na tela.
      country:
        u.addressCountry && paisPorCodigo(u.addressCountry)
          ? u.addressCountry
          : null,
    };
    return {
      // Um pais que saiu da lista curada nao pode virar rotulo vazio na tela:
      // devolve-se so o que ainda existe.
      country: u.country && paisPorCodigo(u.country) ? u.country : null,
      phone: u.phone,
      documentHint: u.documentHint,
      documentCountry: u.documentCountry,
      address,
    };
  }
}

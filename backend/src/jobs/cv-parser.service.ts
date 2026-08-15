import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/** Teto do arquivo. Recusado no backend, nao so no front. */
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/**
 * Quanto texto de CV segue adiante.
 *
 * Um CV cabe folgado nisto. O teto existe porque o texto vai para dentro de um
 * prompt: sem limite, um PDF de 300 paginas viraria uma conta de IA inesperada.
 */
const MAXIMO_CARACTERES = 20_000;

/**
 * Minimo para considerar que ha texto de verdade.
 *
 * PDF que e imagem escaneada extrai quase nada — devolve alguns bytes de lixo
 * ou string vazia. Abaixo disto e recusa com mensagem, nunca perfil inventado:
 * um perfil alucinado a partir de PDF vazio produziria busca ruim sem a pessoa
 * entender por que.
 */
const MINIMO_CARACTERES = 200;

/**
 * Le o texto de um CV em PDF ou DOCX.
 *
 * **O arquivo nunca toca o disco.** Chega em memoria, e texto sai daqui; o
 * buffer e descartado quando a requisicao termina. Guardar o arquivo seria
 * guardar CPF, endereco e telefone — e token se revoga, CPF nao.
 */
@Injectable()
export class CvParserService {
  private readonly log = new Logger(CvParserService.name);

  async extrairTexto(arquivo: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  }): Promise<string> {
    if (arquivo.size > TAMANHO_MAXIMO) {
      throw new BadRequestException(
        'O arquivo passa de 5 MB. Envie um PDF ou DOCX menor.',
      );
    }

    const nome = arquivo.originalname.toLowerCase();
    const ehPdf = arquivo.mimetype === 'application/pdf' || nome.endsWith('.pdf');
    const ehDocx =
      arquivo.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      nome.endsWith('.docx');

    let texto: string;
    if (ehPdf) {
      texto = await this.lerPdf(arquivo.buffer);
    } else if (ehDocx) {
      texto = await this.lerDocx(arquivo.buffer);
    } else {
      throw new BadRequestException(
        'Formato nao suportado. Envie o curriculo em PDF ou DOCX.',
      );
    }

    const limpo = texto.replace(/\s+/g, ' ').trim();

    if (limpo.length < MINIMO_CARACTERES) {
      throw new BadRequestException(
        'Nao consegui ler texto neste arquivo. Se o curriculo for uma imagem ' +
          'escaneada, exporte em PDF de texto e tente de novo.',
      );
    }

    return limpo.slice(0, MAXIMO_CARACTERES);
  }

  private async lerPdf(buffer: Buffer): Promise<string> {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const doc = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(doc, { mergePages: true });
      return Array.isArray(text) ? text.join(' ') : text;
    } catch (e) {
      const msg = String(e);
      this.log.warn(`PDF ilegivel: ${msg.slice(0, 200)}`);
      // A senha e o caso mais comum, e a mensagem generica faria a pessoa
      // tentar o mesmo arquivo de novo sem entender o que houve.
      if (/password|encrypt/i.test(msg)) {
        throw new BadRequestException(
          'Este PDF esta protegido por senha. Remova a protecao e envie de novo.',
        );
      }
      throw new BadRequestException(
        'Nao consegui abrir este PDF. Ele pode estar corrompido.',
      );
    }
  }

  private async lerDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    } catch (e) {
      this.log.warn(`DOCX ilegivel: ${String(e).slice(0, 200)}`);
      throw new BadRequestException(
        'Nao consegui abrir este DOCX. Ele pode estar corrompido.',
      );
    }
  }
}

import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException } from '@nestjs/common';
import { CadeiaEsgotada, ehChaveMorta, IaService } from '../ia/ia.service';
import type { Tentativa } from '../ia/ia.service';
import { RecursosService } from '../settings/recursos.service';
import { CvExtratorService } from './cv-extrator.service';

// JOB-56: o upload do CV diz POR QUE falhou. "Tente de novo" so quando tentar
// de novo resolve.

function servicoCom(tentativas: Tentativa[]): CvExtratorService {
  const ia = {
    pedir: jest.fn().mockRejectedValue(new CadeiaEsgotada(tentativas)),
  } as unknown as IaService;
  const recursos = {
    obter: jest.fn().mockResolvedValue({ ordemDaIa: [] }),
  } as unknown as RecursosService;
  return new CvExtratorService(ia, recursos);
}

async function mensagemDe(tentativas: Tentativa[]): Promise<string> {
  const erro: unknown = await servicoCom(tentativas)
    .extrair('um curriculo')
    .catch((e: unknown) => e);
  expect(erro).toBeInstanceOf(BadRequestException);
  return (erro as BadRequestException).message;
}

const t = (provedor: string, motivo: Tentativa['motivo']): Tentativa => ({
  provedor,
  motivo,
  detalhe: '',
});

describe('CvExtratorService — a mensagem de quando a cadeia se esgota', () => {
  it('o caso medido em 06/10: chave recusada misturada com erro diz que e a chave', async () => {
    const msg = await mensagemDe([
      t('Mistral', 'chave recusada'),
      t('ChatGPT (OpenAI)', 'chave recusada'),
      t('Gemini (Google)', 'erro'),
      t('Groq (Llama 3.3)', 'sem chave'),
    ]);
    expect(msg).toContain('chave recusada ou sem credito');
    expect(msg).not.toContain('Tente de novo');
  });

  it('uma unica chave recusada ja basta', async () => {
    const msg = await mensagemDe([t('Mistral', 'chave recusada'), t('Groq', 'sem chave')]);
    expect(msg).toContain('chave recusada ou sem credito');
  });

  it('so erro transitorio continua mandando tentar de novo', async () => {
    const msg = await mensagemDe([t('Gemini (Google)', 'erro'), t('Groq', 'sem chave')]);
    expect(msg).toContain('Tente de novo em instantes');
    expect(msg).not.toContain('sem credito');
  });

  it('sem nenhuma chave, a mensagem de configuracao ausente nao muda', async () => {
    const msg = await mensagemDe([t('Groq', 'sem chave'), t('Cerebras', 'sem chave')]);
    expect(msg).toContain('precisa da chave de algum provedor de IA');
  });
});

describe('ehChaveMorta — o 400 de saldo da Anthropic', () => {
  const erro400 = (texto: string) =>
    new Anthropic.APIError(
      400,
      { type: 'error', error: { type: 'invalid_request_error', message: texto } },
      undefined,
      new Headers(),
    );

  it('conta sem saldo e chave morta, mesmo com status 400', () => {
    expect(
      ehChaveMorta(
        erro400(
          'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
        ),
      ),
    ).toBe(true);
  });

  it('outro 400 continua sendo erro, e nao chave morta', () => {
    expect(ehChaveMorta(erro400('messages: at least one message is required'))).toBe(false);
  });

  it('os status de sempre continuam valendo', () => {
    expect(ehChaveMorta(new Anthropic.APIError(401, undefined, 'x', new Headers()))).toBe(true);
    expect(ehChaveMorta(new Anthropic.APIError(500, undefined, 'x', new Headers()))).toBe(false);
    expect(ehChaveMorta(new Error('timeout'))).toBe(false);
  });
});

import { fundamentos } from './modules/01-fundamentos';
import { redes } from './modules/02-redes';
import { apis } from './modules/03-apis';
import { bancos } from './modules/04-bancos';
import { cache } from './modules/05-cache';
import { assincrono } from './modules/06-assincrono';
import { distribuidos } from './modules/07-distribuidos';
import { arquitetura } from './modules/08-arquitetura';
import { tradeoffs } from './modules/09-tradeoffs';
import { entrevistas } from './modules/10-entrevistas';
import { engenhariaReal } from './modules/11-engenharia-real';
import { papers } from './modules/12-papers';
import { continuar } from './modules/13-continuar';
import type { ModuleSeed } from './types';

export const systemDesignTrack = {
  slug: 'system-design',
  title: 'System Design',
  description:
    'Do vocabulário básico ao projeto de sistemas em escala: fundamentos, rede, APIs, dados, cache, distribuição e os tradeoffs que sustentam cada decisão.',
  icon: '🏗️',
  position: 0,
  published: true,
  // A ordem do array define a posição de cada módulo na trilha.
  modules: [
    fundamentos,
    redes,
    apis,
    bancos,
    cache,
    assincrono,
    distribuidos,
    arquitetura,
    tradeoffs,
    entrevistas,
    engenhariaReal,
    papers,
    continuar,
  ] satisfies ModuleSeed[],
};

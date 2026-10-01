/**
 * O extrator de (host, ats, slug) — a metade barata da colheita (JOB-37/40).
 *
 * **Ele nasceu sem teste**, e o JOB-40 o cobre porque e a peca que decide o
 * que entra na fila: um slug errado aqui vira uma consulta a `/boards/jobs`
 * que da 404 e consome uma das 60 verificacoes da noite.
 *
 * As URLs abaixo sao **reais**, tiradas da tabela `ats_discoveries` em
 * 01/10/2026 — nao inventadas. A URL de vaga e a unica entrada deste codigo, e
 * uma URL de mentira testaria o formato que eu imaginei em vez do que os ATS
 * publicam.
 *
 * O bug que o JOB-37 pagou para achar esta fixado em "host conhecido ganha do
 * gh_jid": sem ele, `boards.greenhouse.io/applovin/...?gh_jid=...` perdia o
 * slug `applovin`, que estava ali no caminho.
 */
import { extrair, palpitesDeSlug } from './descobertas';

describe('extrair: URL real de cada ATS que sabemos ler', () => {
  it.each([
    // Lever — o slug e o primeiro segmento.
    ['https://jobs.lever.co/luxurypresence/273baefd-de56-4885-9f17-846f36364818', 'lever', 'luxurypresence'],
    ['https://jobs.lever.co/dlocal/21e58ab6-0726-400d-ab98-b5d65fc48d1f', 'lever', 'dlocal'],
    // Ashby.
    ['https://jobs.ashbyhq.com/arq/1a7d7e04-297c-404d-823f-25de418cbf06', 'ashby', 'arq'],
    ['https://jobs.ashbyhq.com/rula/4e168916-d28d-4ae7-8c93-e5666376e970', 'ashby', 'rula'],
    // Greenhouse, no dominio do proprio Greenhouse.
    ['https://job-boards.greenhouse.io/smartsheet/jobs/8070067', 'greenhouse', 'smartsheet'],
    ['https://job-boards.greenhouse.io/nationalpublicradioinc/jobs/4662521005', 'greenhouse', 'nationalpublicradioinc'],
    // Com query de rastreio: nao pode virar parte do slug.
    ['https://job-boards.greenhouse.io/canopyconnect/jobs/4076674004?gh_src=2baaf9064us', 'greenhouse', 'canopyconnect'],
    // Greenhouse europeu — host diferente, mesmo dialeto.
    ['https://job-boards.eu.greenhouse.io/feverup/jobs/123456', 'greenhouse', 'feverup'],
  ])('%s → %s:%s', (url, ats, slug) => {
    expect(extrair(url)).toMatchObject({ ats, slug });
  });

  it('host conhecido ganha do gh_jid — o bug que o JOB-37 mediu', () => {
    // Com o ramo do `gh_jid` na frente, esta URL caia no caso "dominio
    // proprio" e o slug `applovin`, que esta ali no caminho, era jogado fora:
    // oito vagas viravam uma descoberta sem slug.
    expect(extrair('https://boards.greenhouse.io/applovin/jobs/4705009006?gh_jid=4705009006'))
      .toMatchObject({ ats: 'greenhouse', slug: 'applovin' });
  });

  it('dominio proprio com gh_jid: e Greenhouse, mas o slug fica para a verificacao', () => {
    const d = extrair('https://careers.duolingo.com/jobs/8734207002?gh_jid=8734207002');
    expect(d).toMatchObject({ host: 'careers.duolingo.com', ats: 'greenhouse', slug: '' });
  });

  it('careerpuck carrega o slug depois de job-board — e Greenhouse, nao um ATS novo', () => {
    // Medido no JOB-37: `boards-api.greenhouse.io/v1/boards/careerpuck` da
    // 404. Tratar o careerpuck como ATS novo era o erro que sustentava o card.
    expect(extrair('https://app.careerpuck.com/job-board/udemy/job/6142399004?gh_jid=614'))
      .toMatchObject({ ats: 'greenhouse', slug: 'udemy' });
  });

  it('host desconhecido fica com ats nulo — e o caso que interessa', () => {
    // Dos 1.297 de 01/10, 705 sao assim: workday, oraclecloud, icims, gupy.
    expect(extrair('https://pagseguro.gupy.io/jobs/9103021'))
      .toMatchObject({ host: 'pagseguro.gupy.io', ats: null, slug: '' });
    expect(extrair('https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers/job/x'))
      .toMatchObject({ ats: null });
  });

  it('nao confunde caminho do proprio ATS com slug', () => {
    // Sem a lista `NAO_E_SLUG`, isto daria o slug `jobs`.
    expect(extrair('https://jobs.lever.co/jobs/abc')).toMatchObject({ slug: 'abc' });
    // E sem o corte do puramente numerico, daria o slug `1` — o id da vaga.
    expect(extrair('https://job-boards.greenhouse.io/jobs/1')).toMatchObject({ slug: '' });
  });

  it('normaliza host e slug: sem www, minusculo', () => {
    expect(extrair('https://WWW.Jobs.Lever.co/AcmeCorp/123'))
      .toMatchObject({ host: 'jobs.lever.co', slug: 'acmecorp' });
  });

  it('mantem hifen e ponto no slug — "alternative-payments" e slug legitimo', () => {
    expect(extrair('https://jobs.ashbyhq.com/alternative-payments/abc'))
      .toMatchObject({ slug: 'alternative-payments' });
  });

  it.each([
    ['URL torta', 'nao e uma url'],
    ['vazia', ''],
    ['protocolo que nunca e vaga', 'javascript:alert(1)'],
    ['ftp', 'ftp://exemplo.com/vaga'],
  ])('%s devolve null em vez de lancar', (_, url) => {
    // **Nunca lanca** e o contrato: isto roda no caminho da busca, e uma URL
    // torta nao pode derrubar a vaga que a carregava.
    expect(() => extrair(url)).not.toThrow();
    expect(extrair(url)).toBeNull();
  });
});

describe('palpitesDeSlug (quando a URL nao carrega o slug)', () => {
  it('tira o rotulo especifico do dominio, o mais provavel primeiro', () => {
    expect(palpitesDeSlug('careers.duolingo.com')).toEqual(['duolingo']);
  });

  it('descarta rotulo generico', () => {
    const p = palpitesDeSlug('jobs.careers.app.wise.com');
    expect(p).toEqual(['wise']);
  });

  it('no maximo dois palpites — cada um e uma chamada de rede', () => {
    expect(palpitesDeSlug('a.b.c.d.e.f.com').length).toBeLessThanOrEqual(2);
  });

  it('host so de rotulo generico nao gera palpite', () => {
    expect(palpitesDeSlug('www.careers.com')).toEqual([]);
  });
});

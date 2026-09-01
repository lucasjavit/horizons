import { assinaturaDoGrupo } from './grupo';
import type { FiltrosDto } from './job.dto';

/**
 * A assinatura existe para uma coisa so: **perfis que leem as mesmas vagas
 * caem no mesmo grupo, e o grupo roda UMA busca**.
 *
 * E o que impede N perfis virarem N buscas a cada 50 minutos — decisao do
 * stakeholder, e a diferenca entre a feature caber no orcamento ou nao.
 *
 * Entao o que se testa nao e o formato da string, e sim as duas perguntas que
 * ela responde:
 *
 * - **mesmo resultado -> mesma assinatura** (senao a busca roda duas vezes
 *   para nada, e a conta dobra);
 * - **resultado diferente -> assinatura diferente** (senao um perfil recebe
 *   vaga que nao pediu).
 *
 * O formato exato e detalhe: nenhum teste aqui casa a string inteira.
 */

function filtros(f: Partial<FiltrosDto>): FiltrosDto {
  return f as FiltrosDto;
}

describe('assinaturaDoGrupo — mesmo resultado, mesmo grupo', () => {
  it('a ordem em que a pessoa digitou a stack nao cria grupo novo', () => {
    // "React, Node" e "node,react" tem de cair no mesmo grupo.
    const a = assinaturaDoGrupo(filtros({ technologies: ['React', 'Node'] }));
    const b = assinaturaDoGrupo(filtros({ technologies: ['Node', 'React'] }));
    expect(a).toBe(b);
  });

  it('a caixa nao cria grupo novo', () => {
    const a = assinaturaDoGrupo(filtros({ technologies: ['REACT'] }));
    const b = assinaturaDoGrupo(filtros({ technologies: ['react'] }));
    expect(a).toBe(b);
  });

  it('o acento nao cria grupo novo', () => {
    // Sem isto "São Paulo" e "sao paulo" rodariam a busca duas vezes para o
    // mesmo resultado.
    const a = assinaturaDoGrupo(filtros({ locations: ['São Paulo'] }));
    const b = assinaturaDoGrupo(filtros({ locations: ['sao paulo'] }));
    expect(a).toBe(b);
  });

  it('espaco sobrando nao cria grupo novo', () => {
    const a = assinaturaDoGrupo(filtros({ locations: ['  Sao   Paulo  '] }));
    const b = assinaturaDoGrupo(filtros({ locations: ['Sao Paulo'] }));
    expect(a).toBe(b);
  });

  it('a mesma tecnologia repetida nao cria grupo novo', () => {
    const a = assinaturaDoGrupo(filtros({ technologies: ['React', 'react', 'REACT'] }));
    const b = assinaturaDoGrupo(filtros({ technologies: ['React'] }));
    expect(a).toBe(b);
  });

  it('campo vazio e campo ausente sao o mesmo grupo', () => {
    const a = assinaturaDoGrupo(filtros({}));
    const b = assinaturaDoGrupo(filtros({ technologies: [], locations: [], job_titles: [] }));
    expect(a).toBe(b);
  });

  it('a assinatura e estavel: a mesma entrada da sempre a mesma saida', () => {
    const f = filtros({ seniority: 'senior', technologies: ['Go'] });
    expect(assinaturaDoGrupo(f)).toBe(assinaturaDoGrupo(f));
  });
});

describe('assinaturaDoGrupo — o que muda QUAIS vagas existem separa o grupo', () => {
  it('senioridade diferente e grupo diferente', () => {
    const a = assinaturaDoGrupo(filtros({ seniority: 'senior' }));
    const b = assinaturaDoGrupo(filtros({ seniority: 'junior' }));
    expect(a).not.toBe(b);
  });

  it('stack diferente e grupo diferente', () => {
    const a = assinaturaDoGrupo(filtros({ technologies: ['Go'] }));
    const b = assinaturaDoGrupo(filtros({ technologies: ['Rust'] }));
    expect(a).not.toBe(b);
  });

  it('cargo diferente e grupo diferente, ainda que a stack coincida', () => {
    // "Data Engineer Python" e "Backend Python" procuram vagas diferentes.
    const a = assinaturaDoGrupo(
      filtros({ technologies: ['Python'], job_titles: ['Data Engineer'] }),
    );
    const b = assinaturaDoGrupo(
      filtros({ technologies: ['Python'], job_titles: ['Backend Engineer'] }),
    );
    expect(a).not.toBe(b);
  });

  it('local diferente e grupo diferente', () => {
    const a = assinaturaDoGrupo(filtros({ locations: ['Brazil'] }));
    const b = assinaturaDoGrupo(filtros({ locations: ['Mexico'] }));
    expect(a).not.toBe(b);
  });

  it('regime diferente e grupo diferente', () => {
    const a = assinaturaDoGrupo(filtros({ remote: 'remoto' }));
    const b = assinaturaDoGrupo(filtros({ remote: 'presencial' }));
    expect(a).not.toBe(b);
  });

  it('stack a mais e grupo diferente', () => {
    const a = assinaturaDoGrupo(filtros({ technologies: ['Go'] }));
    const b = assinaturaDoGrupo(filtros({ technologies: ['Go', 'Rust'] }));
    expect(a).not.toBe(b);
  });
});

describe('assinaturaDoGrupo — o que muda so QUAIS INTERESSAM nao separa', () => {
  it('salario minimo diferente e o MESMO grupo', () => {
    // Colocar salario na assinatura faria "senior React 8k" e "senior React
    // 12k" dispararem duas buscas identicas. Filtra-se depois, sobre o mesmo
    // resultado.
    const a = assinaturaDoGrupo(filtros({ seniority: 'senior', salary_min: 8000 }));
    const b = assinaturaDoGrupo(filtros({ seniority: 'senior', salary_min: 12000 }));
    expect(a).toBe(b);
  });

  it('palavra excluida diferente e o MESMO grupo', () => {
    const a = assinaturaDoGrupo(
      filtros({ seniority: 'senior', excluded_keywords: ['recrutadora'] }),
    );
    const b = assinaturaDoGrupo(
      filtros({ seniority: 'senior', excluded_keywords: ['consultoria'] }),
    );
    expect(a).toBe(b);
  });

  it('salario ausente e salario preenchido caem no mesmo grupo', () => {
    const a = assinaturaDoGrupo(filtros({ seniority: 'senior' }));
    const b = assinaturaDoGrupo(filtros({ seniority: 'senior', salary_min: 100000 }));
    expect(a).toBe(b);
  });
});

describe('assinaturaDoGrupo — a assinatura nao colide', () => {
  it('stack e cargo nao se confundem entre si', () => {
    // Se os campos fossem concatenados sem separador, ["a","b"] no cargo e
    // ["ab"] na stack poderiam gerar a mesma string.
    const a = assinaturaDoGrupo(filtros({ technologies: ['Go'], job_titles: [] }));
    const b = assinaturaDoGrupo(filtros({ technologies: [], job_titles: ['Go'] }));
    expect(a).not.toBe(b);
  });

  it('local e regime nao se confundem entre si', () => {
    const a = assinaturaDoGrupo(filtros({ remote: 'remoto', locations: [] }));
    const b = assinaturaDoGrupo(filtros({ locations: ['remoto'] }));
    expect(a).not.toBe(b);
  });

  it('devolve uma string nao vazia mesmo sem filtro nenhum', () => {
    // O grupo "sem filtro" existe e precisa de chave propria.
    expect(assinaturaDoGrupo(filtros({}))).toBeTruthy();
  });
});

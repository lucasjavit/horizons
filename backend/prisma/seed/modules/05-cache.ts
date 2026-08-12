import type { ModuleSeed } from '../types';

export const cache: ModuleSeed = {
  slug: 'cache',
  title: 'Cache',
  goal: 'Usar cache sem criar bugs de consistência: saber onde colocar, qual estratégia de escrita usar, como expirar, e como sobreviver aos três modos clássicos de falha.',
  lessons: [
    {
      slug: 'caching-101',
      title: 'Caching 101',
      summary:
        'Onde o cache pode morar, o que a taxa de acerto realmente significa e por que ele é a otimização de melhor retorno — e a mais perigosa.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Cache guarda o resultado de um trabalho caro para reaproveitá-lo. Existe em várias camadas do caminho da requisição, e cada camada tem custos e riscos próprios.',
        blocks: [
          {
            type: 'p',
            text: 'Cache funciona por causa de duas propriedades quase universais do acesso a dados. Localidade temporal: o que foi acessado agora provavelmente será acessado de novo em breve. E distribuição desigual: uma fração pequena dos itens responde pela maior parte dos acessos. Em muitos sistemas, 1% dos dados atende 90% das requisições — o que significa que uma quantidade modesta de memória pode eliminar quase todo o trabalho repetido.',
          },
          {
            type: 'h',
            text: 'As camadas',
          },
          {
            type: 'table',
            head: ['Camada', 'Onde fica', 'Escopo', 'Melhor para'],
            rows: [
              ['Cache do navegador', 'No cliente', 'Um usuário', 'Assets estáticos, respostas imutáveis'],
              ['CDN', 'Borda da rede', 'Todos os usuários da região', 'Imagens, JS/CSS, páginas públicas'],
              ['Cache do reverse proxy', 'Antes da aplicação', 'Global', 'Respostas HTTP semi-estáticas'],
              ['Cache em processo', 'Memória da instância', 'Uma instância', 'Configuração, dados minúsculos e quentes'],
              ['Cache distribuído', 'Redis/Memcached', 'Todas as instâncias', 'Sessão, resultados de consulta, agregados'],
              ['Buffer pool do banco', 'Dentro do banco', 'Global', 'Páginas de dados e índice acessadas com frequência'],
            ],
          },
          {
            type: 'p',
            text: 'A regra geral é que quanto mais perto do usuário o acerto acontece, maior a economia — mas maior também a dificuldade de invalidar. Um item cacheado no navegador do usuário está fora do seu alcance até o TTL expirar; por isso a prática de versionar URLs de assets (`app.a3f9c1.js`), que troca invalidação por um nome novo.',
          },
          {
            type: 'key',
            text: 'A métrica que importa é a taxa de acerto (hit rate), e ela tem retorno não linear: subir de 80% para 90% corta as chamadas à origem pela metade; de 95% para 99%, corta em cinco vezes. As últimas frações são as mais valiosas.',
          },
          {
            type: 'p',
            text: 'Vale mencionar o cache em processo, que costuma ser subestimado. Um mapa em memória dentro da própria aplicação não paga round-trip de rede nenhum — é uma ordem de grandeza mais rápido que Redis. O problema é que cada instância tem sua própria cópia, então a invalidação vira um problema distribuído e o consumo de memória se multiplica pelo número de réplicas. Serve muito bem para dados pequenos, quentes e raramente alterados; mal para qualquer coisa que precise ser consistente entre instâncias.',
          },
          {
            type: 'p',
            text: 'As camadas não competem entre si: elas se empilham, e cada uma vê apenas o que a anterior deixou passar. Isso muda como se lê a taxa de acerto de cada nível. Se a CDN absorve 95% do tráfego, o que chega ao cache de aplicação já é o resíduo difícil — as chaves menos populares, justamente as de pior localidade. Um acerto de 60% nessa camada não a torna ruim; ela está trabalhando com o que sobrou. Comparar hit rate entre camadas sem considerar isso leva a otimizar a camada errada.',
          },
          {
            type: 'h',
            text: 'Dimensionando o conjunto de trabalho',
          },
          {
            type: 'p',
            text: 'A pergunta prática é quanta memória se precisa para atingir a taxa de acerto desejada, e ela se responde estimando o conjunto de trabalho — o volume de dados distintos realmente acessados numa janela relevante. O cálculo é direto: itens quentes vezes o tamanho médio serializado, mais a sobrecarga da estrutura. Um milhão de perfis de 2 KB são 2 GB; com o overhead por chave (ponteiros, metadados de expiração, fragmentação) é prudente contar de 20% a 50% a mais. Errar essa conta para baixo não gera erro visível — gera eviction constante e uma taxa de acerto que nunca sobe, por mais que se ajuste o TTL.',
          },
          {
            type: 'p',
            text: 'A relação entre memória e acerto tem retornos decrescentes acentuados. Como poucos itens concentram a maior parte dos acessos, o primeiro gigabyte captura a maior fatia e cada gigabyte seguinte compra progressivamente menos; existe um joelho na curva, acima do qual dobrar a memória rende talvez um ponto percentual. Encontrá-lo é trabalho experimental — aumentar o limite e observar a curva —, e a decisão de parar é econômica: comparar o custo da memória com o custo do tráfego adicional na origem.',
          },
          {
            type: 'p',
            text: 'Sobre medição, três métricas importam mais que a taxa de acerto isolada. A primeira é a latência do miss, não a média: quem sofre é o usuário que caiu no caminho lento, e um p99 saudável de 8 ms pode esconder que 2% das requisições levam 900 ms. A segunda é a taxa de eviction, que denuncia pressão de memória antes de o hit rate cair. A terceira é a distribuição de acessos por chave — sem ela não há como saber se existe uma chave quente prestes a causar stampede, ou se o cache virou depósito de dados frios que ninguém vai reler.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Cachear sem medir a taxa de acerto. Um cache com 20% de acerto adiciona latência, memória, complexidade e uma nova fonte de inconsistência para economizar um quinto do trabalho — e às vezes deixa o sistema mais lento, porque toda requisição paga a consulta ao cache antes de ir à origem mesmo assim. Instrumente acertos, erros e evicções desde o primeiro dia.',
          },
          {
            type: 'p',
            text: 'Vale lembrar também que cache não conserta arquitetura ruim. Uma consulta sem índice que leva dois segundos continua levando dois segundos em todo cache miss, em toda expiração e em todo deploy que limpa a memória. Cache esconde o problema no caso bom e o expõe, ampliado, exatamente no pior momento.',
          },
        ],
        quiz: [
          {
            q: 'Por que subir a taxa de acerto de 95% para 99% é mais valioso do que de 60% para 64%?',
            a: 'Porque o que importa é o volume de misses que chega à origem. De 95% para 99%, os misses caem de 5% para 1% — uma redução de cinco vezes na carga do backend. De 60% para 64%, caem de 40% para 36%, apenas 10% de redução. O ganho está no que se elimina, não nos pontos percentuais.',
          },
          {
            q: 'Qual a vantagem e a desvantagem do cache em processo em relação ao distribuído?',
            a: 'Vantagem: não paga round-trip de rede, sendo uma ordem de grandeza mais rápido. Desvantagens: cada instância tem sua cópia, multiplicando o uso de memória e criando divergência entre réplicas; a invalidação vira um problema distribuído; e uma instância nova sobe com o cache vazio.',
          },
        ],
      },
    },
    {
      slug: 'estrategias-de-cache',
      title: 'Estratégias de leitura e escrita',
      summary:
        'Cache-aside, read-through, write-through, write-behind e write-around: quem escreve, quando, e o que acontece se falhar no meio.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'As estratégias diferem em quem popula o cache e como as escritas o atravessam. Cada combinação tem uma janela de inconsistência diferente.',
        blocks: [
          {
            type: 'h',
            text: 'Leitura',
          },
          {
            type: 'p',
            text: 'Cache-aside (lazy loading) é a estratégia dominante: a aplicação consulta o cache, e se não encontra, busca na origem e grava no cache. Toda a lógica fica no código da aplicação. As vantagens são resiliência (se o cache cai, o sistema continua funcionando mais devagar) e economia (só entra no cache o que foi realmente pedido). As desvantagens são o código repetido em cada ponto de leitura e o fato de que todo item começa com um miss.',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `// Cache-aside: o caso mais comum.
async function buscarUsuario(id: string) {
  const cacheado = await cache.get(\`user:\${id}\`)
  if (cacheado) return JSON.parse(cacheado)

  const usuario = await db.user.findUnique({ where: { id } })
  if (usuario) {
    // TTL sempre: sem ele, um erro de invalidação vira dado errado permanente.
    await cache.set(\`user:\${id}\`, JSON.stringify(usuario), { ex: 300 })
  }
  return usuario
}`,
          },
          {
            type: 'p',
            text: 'Read-through move essa lógica para a própria camada de cache: a aplicação sempre pergunta ao cache, e ele busca na origem quando não tem. O código da aplicação fica limpo, mas o cache passa a ser uma dependência obrigatória — se ele cai, não há caminho alternativo.',
          },
          {
            type: 'h',
            text: 'Escrita',
          },
          {
            type: 'table',
            head: ['Estratégia', 'Como escreve', 'Ganho', 'Risco'],
            rows: [
              ['Write-through', 'Cache e banco, sincronamente', 'Cache sempre atual', 'Latência de escrita maior; cacheia o que talvez nunca seja lido'],
              ['Write-behind', 'Cache agora, banco depois', 'Escrita muito rápida; agrupa atualizações', 'Perda de dados se o cache cair antes de descarregar'],
              ['Write-around', 'Só no banco; invalida a chave', 'Não polui o cache com dados frios', 'A próxima leitura é sempre um miss'],
            ],
          },
          {
            type: 'p',
            text: 'A combinação mais frequente na prática é cache-aside na leitura e write-around na escrita: escreve no banco, invalida a chave, e a próxima leitura repopula. É simples, tem poucas partes móveis e falha de forma previsível.',
          },
          {
            type: 'key',
            text: 'Ao escrever, prefira invalidar a chave em vez de atualizá-la. Atualizar cria uma corrida: duas escritas concorrentes podem gravar no cache em ordem inversa à do banco, deixando o cache permanentemente com o valor mais antigo. Invalidar apenas força uma releitura, que sempre pega o estado correto.',
          },
          {
            type: 'p',
            text: 'A ordem entre banco e cache também importa. O padrão seguro é escrever no banco primeiro e invalidar depois. Invalidar antes abre uma janela em que uma leitura concorrente repopula o cache com o valor antigo — que ainda está no banco — e o deixa desatualizado até o TTL expirar. Mesmo com a ordem correta a janela não é zero, e por isso o TTL continua sendo a rede de segurança.',
          },
          {
            type: 'p',
            text: 'Write-behind merece cuidado especial. Ele oferece um ganho enorme de throughput ao acumular várias atualizações de um mesmo item e gravar uma vez só no banco — pense num contador de visualizações. Mas o dado passa a existir apenas na memória do cache por um intervalo, e a queda do nó nesse intervalo perde escritas confirmadas. É aceitável para métricas e contadores, e inaceitável para qualquer coisa que o usuário considere salva.',
          },
          {
            type: 'h',
            text: 'Quando a invalidação falha',
          },
          {
            type: 'p',
            text: 'Escrever no banco e invalidar depois esconde um problema que só aparece em produção: os dois passos não são atômicos. Se o processo morre entre o commit e o `DEL`, a entrada errada sobrevive até o TTL — e como é raro, ninguém investiga. Sistemas que não toleram essa janela adotam uma de duas saídas. A primeira é gravar a intenção de invalidar na mesma transação, numa tabela de saída (outbox) consumida por um processo separado que garante a remoção com retentativa. A segunda, mais elegante, é abandonar a invalidação explícita e derivá-la do log de replicação do banco: quem publica o evento de mudança é o próprio banco, então nenhum caminho de escrita pode ser esquecido, nem mesmo um UPDATE manual.',
          },
          {
            type: 'p',
            text: 'A granularidade da chave também é uma decisão de projeto com consequências duráveis. Cachear a resposta pronta de um endpoint dá o maior ganho — uma leitura resolve tudo —, mas é frágil: qualquer campo de qualquer entidade envolvida invalida o bloco inteiro, e a mesma informação acaba duplicada em dezenas de respostas diferentes. Cachear por entidade (`user:42`, `produto:98`) é bem mais fácil de invalidar com precisão, ao preço de a montagem da resposta exigir várias buscas. O meio-termo comum é cachear entidades individualmente e usar leitura em lote (`MGET`) para montar a resposta em um único round-trip.',
          },
          {
            type: 'p',
            text: 'Um detalhe operacional que raramente é planejado no início: o formato serializado do valor cacheado é um contrato entre versões da sua aplicação. Durante um deploy gradual, instâncias novas e antigas leem as mesmas chaves; se a versão nova adicionou um campo obrigatório e desserializa estritamente, ela vai quebrar ao ler o que a antiga gravou — e vice-versa. As saídas são desserializar de forma tolerante, tratando falha de parse como miss, ou embutir a versão do esquema no nome da chave (`v3:user:42`), o que troca um bug sutil por um período previsível de cache frio.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Cachear sem TTL, confiando apenas na invalidação explícita. Basta um caminho de escrita que alguém esqueceu de instrumentar — um script de manutenção, uma migração, um endpoint novo, uma alteração feita direto no banco — para que a entrada fique errada indefinidamente. O TTL é o que garante que qualquer inconsistência tenha prazo de validade.',
          },
        ],
        quiz: [
          {
            q: 'Por que invalidar a chave é mais seguro que atualizá-la ao escrever?',
            a: 'Porque atualizar cria uma corrida entre escritas concorrentes: se duas requisições atualizam o banco na ordem A depois B, mas gravam no cache na ordem B depois A, o cache fica com o valor de A — desatualizado e sem qualquer evento futuro para corrigi-lo. Invalidar apenas remove a entrada, e a próxima leitura busca o estado correto do banco.',
          },
          {
            q: 'Qual a ordem correta entre escrever no banco e invalidar o cache, e por quê?',
            a: 'Banco primeiro, invalidação depois. Invalidando antes, uma leitura concorrente pode ocorrer entre a invalidação e a gravação, repopulando o cache com o valor antigo ainda presente no banco — e essa entrada errada persiste até o TTL. A ordem correta reduz muito a janela, mas não a elimina, então o TTL continua necessário.',
          },
          {
            q: 'Quando write-behind é aceitável?',
            a: 'Quando a perda das últimas escritas é tolerável e o volume justifica a agregação: contadores de visualização, métricas, "visto por último". Como o dado fica só na memória do cache até ser descarregado, a queda do nó perde o que estava pendente — inaceitável para qualquer informação que o usuário considere confirmada.',
          },
        ],
      },
    },
    {
      slug: 'politicas-de-eviction',
      title: 'Políticas de eviction e TTL',
      summary:
        'Memória é finita: quem sai quando enche, e como escolher o tempo de vida de cada chave.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Quando o cache atinge o limite de memória, precisa remover algo. A política de eviction decide o quê, e o TTL decide quando um dado deixa de ser confiável independentemente de espaço.',
        blocks: [
          {
            type: 'p',
            text: 'Eviction e expiração são coisas diferentes que costumam ser confundidas. Expiração (TTL) é sobre *correção*: depois de N segundos o dado pode não refletir mais a realidade. Eviction é sobre *espaço*: a memória acabou e algo precisa sair, mesmo que ainda fosse válido. Um cache bem configurado usa os dois.',
          },
          {
            type: 'table',
            head: ['Política', 'Remove', 'Bom para', 'Problema'],
            rows: [
              ['LRU', 'O menos recentemente usado', 'Caso geral — aposta na localidade temporal', 'Uma varredura grande expulsa os itens quentes'],
              ['LFU', 'O menos frequentemente usado', 'Itens com popularidade estável', 'Itens antigos e populares resistem mesmo quando esfriam'],
              ['FIFO', 'O mais antigo inserido', 'Simples, previsível', 'Ignora completamente o padrão de uso'],
              ['Random', 'Um qualquer', 'Custo mínimo, surpreendentemente aceitável', 'Pode remover itens quentes'],
              ['TTL puro', 'O que expirou', 'Dados com validade natural', 'Não resolve falta de memória'],
            ],
          },
          {
            type: 'p',
            text: 'LRU é o padrão para a maioria dos casos porque a localidade temporal é uma aposta boa. Sua fraqueza clássica é a poluição por varredura: um job noturno que percorre milhões de registros carrega tudo no cache, empurra para fora os itens realmente quentes, e na manhã seguinte o cache está cheio de dados que ninguém vai pedir. Variantes como LRU segmentado atacam isso mantendo uma área de "probação" para os itens vistos uma única vez, que só são promovidos ao serem acessados de novo.',
          },
          {
            type: 'key',
            text: 'Taxa alta de eviction significa que o cache está pequeno demais para o conjunto de trabalho. É um sinal a monitorar tão importante quanto a taxa de acerto — e frequentemente a causa dela ser baixa.',
          },
          {
            type: 'p',
            text: 'Vale abrir o LRU segmentado. A memória é dividida em dois segmentos: um de probação, que recebe todo item recém-inserido, e um protegido, para onde o item só é promovido ao ser acessado uma segunda vez. A eviction ataca sempre a cauda da probação. Assim, um item visto uma única vez — o padrão do job de varredura — entra, ocupa espaço por pouco tempo e sai sem ameaçar o conteúdo quente. O custo é que um item popular precisa de dois acessos para se estabelecer.',
          },
          {
            type: 'p',
            text: 'A mesma intuição sustenta políticas que combinam recência e frequência, como o TinyLFU: mantém-se um esboço probabilístico e barato da frequência, e um candidato só desloca um residente se sua frequência estimada for maior. Isso corrige a fraqueza central do LRU puro — tratar como iguais o item que passou uma vez e o que passa mil vezes por dia.',
          },
          {
            type: 'p',
            text: 'Vale saber ainda que o LRU dos caches reais não é exato: manter uma lista perfeitamente ordenada exigiria mover um nó, com trava, a cada leitura. O Redis usa amostragem — sorteia algumas candidatas e descarta a mais antiga entre elas. A política nominal descreve a intenção, não uma garantia.',
          },
          {
            type: 'h',
            text: 'Comportamento sob pressão de memória',
          },
          {
            type: 'p',
            text: 'O que acontece quando a memória enche depende de uma configuração que muita gente nunca revisa. Um cache pode estar ajustado para recusar escritas ao atingir o limite em vez de expulsar — correto quando guarda dados que ninguém pode perder, desastroso quando é cache. Vale também distinguir as políticas que olham todas as chaves das que só olham as com TTL: se boa parte foi gravada sem expiração, a segunda deixa o cache sem candidatos e ele trava cheio de dados frios.',
          },
          {
            type: 'p',
            text: 'Outro efeito pouco intuitivo: a memória reportada pelo sistema operacional quase nunca cai depois de uma limpeza em massa. Alocadores devolvem blocos ao próprio pool, e a fragmentação mantém a memória residente alta mesmo quando a útil já é pequena — pior ainda com valores de tamanhos muito variados. Por isso o limite configurado precisa ficar bem abaixo da memória física: encostar no teto do sistema não gera eviction, gera o processo morto e o cache esvaziado de uma vez.',
          },
          {
            type: 'h',
            text: 'Escolhendo o TTL',
          },
          {
            type: 'p',
            text: 'O TTL é uma declaração explícita de quanta desatualização o produto tolera para aquele dado. Vale escolhê-lo por categoria: dados essencialmente imutáveis (um asset versionado, um post publicado) toleram horas ou dias; dados de perfil e configuração, minutos; agregados e contadores, dezenas de segundos; preço, estoque e saldo, poucos segundos ou nenhum cache.',
          },
          {
            type: 'p',
            text: 'Duas técnicas melhoram muito o comportamento sob TTL. A primeira é adicionar jitter: em vez de 300 segundos exatos, use algo entre 270 e 330. Sem isso, itens carregados juntos expiram juntos e produzem uma onda de misses simultâneos. A segunda é a atualização antecipada (early refresh): quando uma leitura encontra um item perto do fim da validade, ela dispara uma atualização em background e ainda assim devolve o valor atual — o usuário nunca espera pela recarga.',
          },
          {
            type: 'p',
            text: 'Em situações de emergência, servir dado vencido pode ser a decisão certa. O padrão stale-while-revalidate devolve o valor expirado enquanto atualiza por trás; o stale-if-error devolve o valor vencido quando a origem está fora do ar. Nos dois casos, a alternativa a um dado velho é nenhum dado — e para a maioria dos conteúdos, velho é melhor que erro.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Usar o mesmo TTL para tudo. Um valor único obriga a escolher entre desatualizar dados sensíveis e desperdiçar cache com dados que quase nunca mudam. O TTL é uma decisão por tipo de dado, derivada de quanto tempo de desatualização o produto realmente aceita naquele caso — e essa resposta varia de segundos a dias dentro do mesmo sistema.',
          },
        ],
        quiz: [
          {
            q: 'O que é poluição de cache por varredura e como mitigá-la?',
            a: 'É quando um job que percorre um grande volume de dados carrega tudo no cache e, sob LRU, expulsa os itens realmente quentes, derrubando a taxa de acerto do tráfego normal. Mitiga-se com LRU segmentado (itens vistos uma vez só ficam numa área de probação), com um cliente separado que não popula o cache para esses jobs, ou marcando essas leituras para ignorar o cache.',
          },
          {
            q: 'Por que adicionar jitter ao TTL?',
            a: 'Porque itens carregados no mesmo instante — após um deploy, um restart do cache ou um pico inicial — expiram no mesmo instante, gerando uma onda simultânea de misses que atinge a origem de uma vez. Espalhar o TTL numa faixa aleatória distribui as expirações no tempo e transforma o pico em fluxo suave.',
          },
          {
            q: 'Quando faz sentido servir dado expirado?',
            a: 'Quando a origem está indisponível ou lenta e a alternativa é erro (stale-if-error), ou quando se quer evitar que o usuário espere a recarga (stale-while-revalidate: devolve o valor vencido e atualiza em background). Para a maioria dos conteúdos, um dado alguns segundos desatualizado é muito melhor que uma página de erro.',
          },
        ],
      },
    },
    {
      slug: 'falhas-de-cache',
      title: 'Stampede, penetração e avalanche',
      summary:
        'Os três modos clássicos de falha do cache — todos derrubam a origem — e como se defender de cada um.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Cache costuma falhar de três formas conhecidas: muitos pedidos pela mesma chave ausente, pedidos por chaves que nunca existirão, e expiração em massa. Todas concentram carga na origem.',
        blocks: [
          {
            type: 'key',
            text: 'Os três modos de falha têm a mesma consequência: a origem recebe de uma vez o tráfego que o cache absorvia. Se ela não aguenta esse volume, o cache não é otimização — é dependência crítica disfarçada.',
          },
          {
            type: 'h',
            text: 'Stampede (thundering herd)',
          },
          {
            type: 'p',
            text: 'Uma chave muito requisitada expira. No instante seguinte, mil requisições concorrentes encontram o miss e, todas elas, vão buscar o mesmo dado na origem — que recebe mil consultas idênticas onde uma bastaria. Se a consulta é cara, o banco satura, as consultas ficam mais lentas, mais requisições se acumulam, e o sistema entra em colapso justamente por causa de uma otimização.',
          },
          {
            type: 'p',
            text: 'A defesa principal é o bloqueio de recarga: apenas a primeira requisição que encontra o miss adquire um lock (um `SET NX` com TTL curto no Redis, por exemplo) e vai à origem; as demais esperam brevemente e releem o cache, ou recebem o valor antigo. Complementarmente, a atualização antecipada evita que a expiração aconteça sob demanda — o item é renovado em background antes de vencer. Uma terceira defesa é a coalescência local: dentro de cada instância, agrupar as chamadas concorrentes pela mesma chave em uma única execução.',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `// Só um recarrega; os outros aguardam e releem.
async function comLock<T>(chave: string, carregar: () => Promise<T>) {
  const cacheado = await cache.get(chave)
  if (cacheado) return JSON.parse(cacheado) as T

  const lock = await cache.set(\`lock:\${chave}\`, '1', { nx: true, ex: 10 })
  if (!lock) {
    await esperar(50)
    return comLock(chave, carregar) // relê — provavelmente já populado
  }

  try {
    const valor = await carregar()
    await cache.set(chave, JSON.stringify(valor), { ex: comJitter(300) })
    return valor
  } finally {
    await cache.del(\`lock:\${chave}\`)
  }
}`,
          },
          {
            type: 'h',
            text: 'Penetração',
          },
          {
            type: 'p',
            text: 'Acontece quando as requisições pedem chaves que não existem no banco. Como não há o que cachear, todo pedido é um miss e vai direto à origem — o cache deixa de proteger. Pode ser acidental (IDs inválidos vindos de um cliente com bug) ou deliberado: um atacante que dispara IDs aleatórios atravessa o cache por definição e ataca o banco diretamente.',
          },
          {
            type: 'p',
            text: 'A defesa mais simples é cachear a ausência: gravar um marcador de "não existe" com TTL curto, para que a repetição do mesmo ID inexistente não chegue ao banco. Para o caso adversarial, com IDs sempre diferentes, usa-se um filtro de Bloom: uma estrutura probabilística compacta que responde "definitivamente não existe" ou "talvez exista", permitindo descartar a maioria das consultas inválidas antes de tocar o banco. Validar o formato do identificador na entrada também elimina uma parte considerável do tráfego inválido de graça.',
          },
          {
            type: 'h',
            text: 'Avalanche',
          },
          {
            type: 'p',
            text: 'É a expiração em massa: um grande número de chaves vence ao mesmo tempo e todo o tráfego cai sobre a origem simultaneamente. Costuma ocorrer depois de um deploy que aqueceu o cache de uma vez, após um restart do Redis, ou simplesmente porque todas as chaves foram criadas com o mesmo TTL fixo no mesmo momento.',
          },
          {
            type: 'p',
            text: 'As defesas: jitter no TTL para espalhar as expirações; aquecimento progressivo em vez de popular tudo de uma vez; e um limitador de concorrência na camada de acesso à origem, para que o número de recargas simultâneas seja limitado por construção. Vale também considerar a queda total do cache como cenário de projeto — o sistema aguenta o tráfego indo direto ao banco por alguns minutos? Se a resposta é não, o cache deixou de ser otimização e virou dependência crítica sem redundância.',
          },
          {
            type: 'h',
            text: 'A recuperação é a parte mais perigosa',
          },
          {
            type: 'p',
            text: 'Há um detalhe que transforma qualquer um dos três modos em incidente prolongado: o ciclo de realimentação. Quando a origem satura, as consultas ficam mais lentas; requisições lentas seguram conexões; o pool esgota; timeouts estouram; e cada timeout vira retentativa que acrescenta carga a um sistema já sobrecarregado. A partir de certo ponto o trabalho descartado supera o útil concluído, e o sistema não sai sozinho desse estado nem quando o tráfego diminui.',
          },
          {
            type: 'p',
            text: 'Por isso as defesas mais eficazes não moram no cache, e sim no acesso à origem. Um limite rígido de concorrência — um semáforo de 50 consultas simultâneas ao banco — faz o pico de misses virar fila em vez de saturação, e uma fila curta com rejeição rápida é melhor que uma infinita que só adia o colapso. Timeouts curtos e um disjuntor completam o conjunto: com a origem doente, falhar rápido preserva a capacidade que ainda existe.',
          },
          {
            type: 'p',
            text: 'A volta do cache também merece plano. Um Redis que reinicia sobe vazio, e apontar o tráfego inteiro para ele significa 100% de miss sobre uma origem que acabou de sair de um incidente — a avalanche outra vez, com o sistema já fragilizado. O procedimento saudável é liberar tráfego gradualmente, aquecer antes as chaves quentes conhecidas e manter o limitador de concorrência ativo durante o reaquecimento. Ensaiar essa sequência antes de precisar dela separa um incidente de dez minutos de um de três horas.',
          },
          {
            type: 'table',
            head: ['Falha', 'Causa', 'Defesa principal'],
            rows: [
              ['Stampede', 'Uma chave quente expira sob alta concorrência', 'Lock de recarga + refresh antecipado'],
              ['Penetração', 'Chaves que não existem no banco', 'Cachear ausência + filtro de Bloom'],
              ['Avalanche', 'Muitas chaves expiram simultaneamente', 'Jitter no TTL + limite de concorrência'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tratar o cache como opcional no diagrama e obrigatório na prática. Se a origem só aguenta o tráfego porque 98% dele é absorvido pelo cache, então o cache é um componente crítico — e precisa de redundância, monitoramento e um plano para quando cair. Descobrir isso durante um incidente, com o banco saturado e o cache vazio, é a pior hora possível.',
          },
        ],
        quiz: [
          {
            q: 'Por que o stampede é pior justamente nas chaves mais populares?',
            a: 'Porque o número de requisições concorrentes que encontram o miss no instante da expiração é proporcional à popularidade da chave. A chave mais acessada do sistema é a que gera o maior número de consultas idênticas simultâneas à origem — e normalmente é também a que sustenta a consulta mais cara, justamente por isso ter sido cacheada.',
          },
          {
            q: 'Como um filtro de Bloom ajuda contra penetração, e qual sua limitação?',
            a: 'Ele responde com certeza que uma chave não existe, permitindo rejeitar a consulta sem tocar o banco, ocupando pouquíssima memória para milhões de chaves. A limitação são os falsos positivos: pode dizer "talvez exista" para algo inexistente, e nesse caso a consulta segue normalmente. Além disso, o filtro clássico não suporta remoção, exigindo reconstrução periódica ou variantes com contador.',
          },
          {
            q: 'Seu Redis cai por completo. O que precisa ser verdade para que o sistema sobreviva?',
            a: 'A origem precisa aguentar, por algum tempo, o tráfego que o cache absorvia — o que exige folga de capacidade, limite de concorrência nas chamadas ao banco e degradação graciosa nas funcionalidades mais caras. Se isso não for verdade, o cache é dependência crítica e precisa de redundância (réplicas, failover) e de um plano de recuperação com aquecimento progressivo, para não repetir a avalanche ao voltar.',
          },
        ],
      },
    },
    {
      slug: 'cdn',
      title: 'CDN',
      summary:
        'Cache geograficamente distribuído: o que faz sentido servir da borda e como invalidar o que já está lá fora.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Uma CDN é uma rede de servidores de cache espalhados geograficamente que servem conteúdo do ponto mais próximo do usuário, reduzindo latência e tirando carga da origem.',
        blocks: [
          {
            type: 'p',
            text: 'A motivação é física. A velocidade da luz na fibra impõe um piso à latência: uma requisição de São Paulo a um servidor na Virgínia leva por volta de 120ms só de ida e volta, e nada no código muda isso. A única saída é encurtar a distância — colocar uma cópia do conteúdo perto do usuário. É exatamente o que uma CDN faz, com centenas de pontos de presença espalhados pelo mundo.',
          },
          {
            type: 'p',
            text: 'O ganho é duplo. Latência: o usuário busca de um servidor a poucos milissegundos. E descarga: se 95% das requisições são atendidas na borda, a origem recebe uma fração do tráfego — o que muda completamente o dimensionamento e o custo de banda de saída.',
          },
          {
            type: 'key',
            text: 'A regra do que colocar na CDN: qualquer coisa idêntica para muitos usuários e que não mude a cada requisição. Assets estáticos são o caso óbvio, mas páginas públicas, respostas de API públicas e imagens geradas sob demanda também se qualificam.',
          },
          {
            type: 'h',
            text: 'Controlando o cache pela borda',
          },
          {
            type: 'p',
            text: 'O comportamento da CDN é governado por cabeçalhos HTTP, e vale conhecer os principais. `Cache-Control: max-age` define por quanto tempo o cliente pode reutilizar; `s-maxage` define o mesmo para caches compartilhados (a CDN), permitindo TTLs diferentes na borda e no navegador. `immutable` diz que o conteúdo nunca muda, dispensando revalidação. `stale-while-revalidate` autoriza servir a versão vencida enquanto atualiza por trás. E `Vary` declara quais cabeçalhos da requisição fazem parte da chave de cache — um `Vary: Accept-Encoding` é necessário e inofensivo, mas um `Vary` sobre um cabeçalho de alta cardinalidade fragmenta o cache a ponto de anulá-lo.',
          },
          {
            type: 'p',
            text: 'Para revalidação, `ETag` e `Last-Modified` permitem que o cliente pergunte "mudou?" e receba um 304 minúsculo quando não mudou — economiza banda, mas não economiza o round-trip. Por isso, para assets, a estratégia dominante é outra.',
          },
          {
            type: 'h',
            text: 'Invalidação: a parte difícil',
          },
          {
            type: 'p',
            text: 'Um conteúdo já distribuído por centenas de pontos de presença não é fácil de retirar. Existe o purge explícito, oferecido por todo provedor, que propaga a remoção — mas leva de segundos a minutos e, em geral, é uma operação com custo e limite de uso. Por isso a solução preferida é não invalidar: usar URLs versionadas por conteúdo (`app.a3f9c1.js`), em que qualquer mudança gera um nome novo. O arquivo antigo simplesmente para de ser referenciado, e nada precisa ser expurgado.',
          },
          {
            type: 'p',
            text: 'Isso leva a um padrão importante para aplicações web: o HTML deve ter TTL curto ou nenhum, enquanto os assets que ele referencia têm TTL longuíssimo e nomes versionados. O HTML é o ponto de indireção que aponta para a versão nova — cachear o HTML agressivamente é o erro que faz usuários ficarem presos numa versão antiga do aplicativo.',
          },
          {
            type: 'p',
            text: 'Vale saber ainda que CDNs modernas fazem mais que cache estático. Terminam TLS na borda (economizando round-trips de handshake), fazem cache hierárquico com um nível intermediário que protege a origem de misses de muitos pontos de presença, aceitam execução de código na borda para personalização leve, e absorvem ataques volumétricos por serem a camada com mais capacidade de rede do caminho.',
          },
          {
            type: 'h',
            text: 'A chave de cache é o que decide a taxa de acerto',
          },
          {
            type: 'p',
            text: 'Toda entrada na borda é indexada por uma chave, e o que entra nessa chave determina quantas cópias do mesmo conteúdo passam a existir. Por padrão ela é a URL completa — incluindo a query string inteira. Isso significa que parâmetros de rastreamento de campanha, que não mudam a resposta em nada, criam uma entrada separada para cada variação: o mesmo artigo pode ocupar dezenas de posições no cache e sofrer miss em todas na primeira visita. Normalizar a chave, descartando os parâmetros que não afetam o conteúdo, costuma render pontos percentuais imediatos de acerto.',
          },
          {
            type: 'p',
            text: 'O mesmo raciocínio vale ao contrário: parâmetros que *afetam* a resposta precisam estar na chave, sob pena de servir o conteúdo errado. E cabeçalhos declarados em `Vary` entram na chave por definição, o que exige contenção — variar por idioma cria poucas variantes e é útil; variar pelo cabeçalho de identificação do navegador cria milhares e destrói o cache. Quando é preciso diferenciar por dispositivo, o caminho é normalizar antes: mapear a identificação para um pequeno conjunto de categorias e variar por ele.',
          },
          {
            type: 'p',
            text: 'Cookies merecem atenção especial porque são a causa mais frequente de cache que nunca funciona. Muitos frameworks emitem um cookie de sessão em toda resposta, inclusive nas páginas públicas, e a presença dele faz a maioria das CDNs tratar a resposta como privada e não cacheável. O sintoma é uma taxa de acerto próxima de zero num conteúdo que deveria ser trivialmente cacheável, e a correção é não emitir sessão onde ela não é necessária.',
          },
          {
            type: 'h',
            text: 'Medir do lado certo',
          },
          {
            type: 'p',
            text: 'A métrica que a maioria dos painéis mostra é a proporção de requisições atendidas na borda, mas ela engana em serviços de mídia: um arquivo pequeno e um vídeo de um gigabyte contam igual. O número que corresponde ao custo real é a proporção de *bytes* servidos da borda, e os dois podem divergir bastante — 98% das requisições atendidas localmente enquanto metade do tráfego em volume ainda sai da origem, porque justamente os objetos grandes estão sofrendo miss.',
          },
          {
            type: 'p',
            text: 'Vale acompanhar também a distribuição do estado de cada resposta, e não apenas a média: quantas foram acerto, quantas foram revalidação bem-sucedida, quantas foram miss e quantas foram explicitamente marcadas como não cacheáveis. Essa última categoria é a mais reveladora — quando cresce sem explicação, quase sempre alguém introduziu um cookie, um cabeçalho de resposta ou uma diretiva que desabilitou o cache de um caminho inteiro sem perceber.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Cachear na CDN uma resposta que varia por usuário. Se um endpoint devolve dados autenticados e a CDN os guarda pela URL, o próximo visitante recebe a resposta de outra pessoa — um vazamento de dados grave, difícil de detectar e que atinge muita gente de uma vez. Respostas personalizadas exigem `Cache-Control: private, no-store` ou a inclusão explícita da identidade na chave de cache.',
          },
        ],
        quiz: [
          {
            q: 'Por que versionar o nome do arquivo é melhor que fazer purge na CDN?',
            a: 'Porque elimina a invalidação: um conteúdo novo tem um nome novo, então não existe entrada errada a remover em ponto de presença nenhum. O purge é lento para propagar, costuma ter custo e limite, e é uma operação sujeita a erro humano. Com URLs versionadas por conteúdo, o asset antigo apenas deixa de ser referenciado.',
          },
          {
            q: 'Por que HTML e assets devem ter políticas de cache opostas?',
            a: 'Porque o HTML é o ponto de indireção que aponta para as versões atuais dos assets. Se ele for cacheado agressivamente, o usuário continua carregando referências antigas mesmo depois do deploy. Assets versionados por conteúdo podem ter TTL longuíssimo e immutable, já que qualquer mudança gera outra URL.',
          },
          {
            q: 'Qual o risco de configurar Vary com um cabeçalho de alta cardinalidade?',
            a: 'Cada valor distinto do cabeçalho cria uma entrada separada no cache. Com um cabeçalho de alta cardinalidade — User-Agent completo, por exemplo —, o mesmo conteúdo é armazenado milhares de vezes, a taxa de acerto despenca e a origem passa a receber quase todo o tráfego, anulando a CDN.',
          },
        ],
      },
    },
  ],
};

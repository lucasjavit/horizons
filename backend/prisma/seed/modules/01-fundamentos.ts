import type { ModuleSeed } from '../types';

// Conteúdo autoral, escrito em português. As URLs em `sourceUrl` são apenas
// leitura complementar — nenhum texto foi copiado delas.

export const fundamentos: ModuleSeed = {
  slug: 'conceitos-fundamentais',
  title: 'Conceitos fundamentais',
  goal: 'Falar de sistemas com precisão: distinguir escalabilidade de performance, disponibilidade de confiabilidade, e entender por que todo sistema distribuído é uma negociação entre garantias.',
  lessons: [
    {
      slug: 'escalabilidade',
      title: 'Escalabilidade',
      summary:
        'O que significa um sistema "escalar" e por que dobrar máquinas quase nunca dobra a capacidade.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Escalabilidade é a capacidade de um sistema absorver mais carga aumentando recursos, sem que o custo por unidade de trabalho exploda.',
        blocks: [
          {
            type: 'p',
            text: 'Escalabilidade é uma das palavras mais usadas e menos definidas em engenharia. Ela não significa "ser rápido" — um sistema pode ser rapidíssimo com dez usuários e derreter com dez mil, e outro pode ser mediocremente lento mas atender milhões sem mudar de comportamento. O primeiro é performático e não escalável; o segundo é escalável e pouco performático. Escalabilidade é sobre a *forma da curva*: o que acontece com latência, throughput e custo quando a carga cresce.',
          },
          {
            type: 'p',
            text: 'Um sistema escalável tem uma propriedade específica: existe um recurso que você pode adicionar (máquinas, CPUs, réplicas) para que a capacidade cresça de forma próxima a linear. Se dobrar o número de servidores web faz o sistema atender aproximadamente o dobro de requisições, aquela camada escala bem. Se dobrar os servidores aumenta a capacidade em 20% porque todos disputam o mesmo banco de dados, a camada web escala mas o sistema não — o gargalo migrou.',
          },
          {
            type: 'key',
            text: 'Escalabilidade não é uma propriedade global do sistema: é uma propriedade de cada camada, e o sistema inteiro escala tão bem quanto sua camada mais travada.',
          },
          {
            type: 'h',
            text: 'Vertical e horizontal',
          },
          {
            type: 'p',
            text: 'Há dois modos de adicionar recursos. Escalar verticalmente (scale up) é trocar a máquina por uma maior: mais CPU, mais RAM, disco mais rápido. É a solução mais simples que existe, não exige nenhuma mudança no código e resolve mais problemas do que a internet costuma admitir — uma máquina moderna com 128 núcleos e um terabyte de RAM atende cargas que a maioria das empresas nunca vai ver. O limite é físico e econômico: existe uma máquina maior disponível até certo ponto, e o preço cresce muito mais rápido que a capacidade.',
          },
          {
            type: 'p',
            text: 'Escalar horizontalmente (scale out) é adicionar mais máquinas trabalhando em paralelo. Não tem teto teórico e usa hardware barato, mas cobra um preço alto em complexidade: agora você precisa distribuir a carga (load balancer), lidar com o fato de que uma requisição pode cair em qualquer máquina (estado compartilhado), e conviver com falhas parciais — com cem máquinas, alguma sempre está com problema.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Vertical (scale up)', 'Horizontal (scale out)'],
            rows: [
              ['Complexidade', 'Baixa — nenhuma mudança de código', 'Alta — distribuição, estado, coordenação'],
              ['Teto', 'Limite físico da maior máquina', 'Praticamente ilimitado'],
              ['Custo', 'Cresce superlinearmente no topo', 'Linear com hardware comum'],
              ['Tolerância a falhas', 'Ruim — a máquina é um SPOF', 'Boa — perder um nó é aceitável'],
              ['Downtime para escalar', 'Normalmente exige reinício', 'Zero — adiciona-se nós em produção'],
            ],
          },
          {
            type: 'h',
            text: 'Por que a curva quase nunca é linear',
          },
          {
            type: 'p',
            text: 'A lei de Amdahl diz que o ganho de paralelizar é limitado pela fração serial do trabalho. Se 5% do processamento de uma requisição é inerentemente sequencial — pegar um lock, escrever no mesmo registro, esperar um ID único —, mesmo com infinitas máquinas você não passa de 20× o desempenho original. Na prática é pior: a lei de Gunther (Universal Scalability Law) adiciona um termo de *coerência*, o custo de manter as máquinas concordando entre si. Esse termo é quadrático, o que significa que a partir de certo ponto adicionar máquinas piora o desempenho. Todo mundo que já viu um cluster ficar mais lento ao ganhar nós viu esse termo em ação.',
          },
          {
            type: 'p',
            text: 'A consequência prática é que escalar bem é, quase sempre, um exercício de *eliminar coordenação*. Cache reduz idas ao banco. Sharding faz cada máquina cuidar de um pedaço dos dados sem falar com as outras. Serviços stateless permitem que qualquer réplica atenda qualquer requisição. Filas assíncronas tiram trabalho do caminho crítico. Nenhuma dessas técnicas torna o computador mais rápido — todas reduzem o quanto as partes precisam concordar.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Projetar para escala que não existe. Sharding, event sourcing e microsserviços em um produto com 500 usuários custam meses de trabalho, multiplicam os modos de falha e resolvem um problema hipotético. O caminho honesto é: meça, encontre o gargalo real, ataque só ele. "Escalabilidade" antes de ter carga costuma ser complexidade disfarçada de previdência.',
          },
          {
            type: 'p',
            text: 'Ainda assim, algumas decisões são caras de reverter e merecem cuidado desde o início: manter os serviços de aplicação sem estado local, não assumir que existe uma única instância do processo, e escolher uma chave de partição plausível para os dados que mais crescem. São decisões baratas hoje e dolorosas depois — o oposto de sharding prematuro.',
          },
        ],
        quiz: [
          {
            q: 'Um sistema atende uma requisição em 50ms com 10 usuários e em 50ms com 10 mil usuários, usando 100 servidores. Ele é performático, escalável, ou os dois?',
            a: 'Os dois, mas as propriedades são independentes. A latência baixa e estável mostra performance; a capacidade de manter essa latência multiplicando servidores mostra escalabilidade. Um sistema com latência de 2s que também se mantém em 2s com 100× a carga seria escalável e não performático.',
          },
          {
            q: 'Por que adicionar máquinas a um cluster pode, a partir de certo ponto, deixá-lo mais lento?',
            a: 'Por causa do custo de coerência: cada nó precisa se coordenar com os outros (consenso, invalidação de cache, gossip, locks distribuídos), e esse custo cresce aproximadamente com o quadrado do número de nós. Quando o ganho linear de capacidade é superado por esse termo quadrático, a curva vira para baixo.',
          },
          {
            q: 'Quando escalar verticalmente é a decisão correta?',
            a: 'Quando a carga cabe com folga na maior máquina disponível, o time é pequeno, e a complexidade de distribuição custaria mais do que o hardware. Também é a única saída rápida para componentes difíceis de distribuir, como um banco relacional primário com muitas escritas.',
          },
        ],
      },
    },
    {
      slug: 'disponibilidade-e-confiabilidade',
      title: 'Disponibilidade e confiabilidade',
      summary:
        'Dois conceitos que soam iguais, medem coisas diferentes e levam a decisões opostas de arquitetura.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Disponibilidade é a fração do tempo em que o sistema responde; confiabilidade é a probabilidade de ele responder *corretamente* durante um intervalo. Um sistema pode ter uma sem a outra.',
        blocks: [
          {
            type: 'p',
            text: 'Disponibilidade (availability) é a proporção do tempo em que o sistema está apto a atender. É medida em "noves": 99% de disponibilidade permite cerca de 3,65 dias de indisponibilidade por ano; 99,9% permite 8,8 horas; 99,99% permite 52 minutos; 99,999% permite pouco mais de 5 minutos — o famoso "cinco noves", que na prática significa que nenhuma intervenção humana cabe dentro do orçamento de falha, porque só perceber o problema já consome o tempo todo.',
          },
          {
            type: 'table',
            head: ['Disponibilidade', 'Downtime por ano', 'Downtime por mês', 'O que isso exige'],
            rows: [
              ['99%', '3,65 dias', '7,2 horas', 'Um servidor bem cuidado'],
              ['99,9%', '8,8 horas', '43 minutos', 'Redundância e deploy sem downtime'],
              ['99,99%', '52 minutos', '4,3 minutos', 'Failover automático, multi-zona'],
              ['99,999%', '5,3 minutos', '26 segundos', 'Multi-região, recuperação sem humano no loop'],
            ],
          },
          {
            type: 'p',
            text: 'Confiabilidade (reliability) é diferente: é a probabilidade de o sistema funcionar corretamente por um período contínuo. Envolve não só estar no ar, mas dar a resposta certa. Um serviço que responde 100% das requisições, mas 2% delas com dados corrompidos, tem disponibilidade excelente e confiabilidade péssima. O inverso também existe: um sistema que nunca dá resposta errada, mas cai por meia hora toda semana, é confiável e indisponível.',
          },
          {
            type: 'key',
            text: 'Disponibilidade pergunta "ele respondeu?". Confiabilidade pergunta "ele respondeu certo, e continuará respondendo certo?". Redundância aumenta a primeira; correção, testes e verificação aumentam a segunda.',
          },
          {
            type: 'h',
            text: 'Durabilidade — o terceiro conceito',
          },
          {
            type: 'p',
            text: 'Durabilidade é a garantia de que o dado gravado não se perde. É comum confundir com disponibilidade porque as duas usam replicação, mas o objetivo é oposto no tempo: disponibilidade é sobre o agora, durabilidade é sobre o futuro. Um sistema de armazenamento pode estar fora do ar por uma hora (indisponível) sem perder um único byte (durável). Serviços de object storage costumam anunciar "onze noves" de durabilidade — uma probabilidade de perda por objeto tão baixa que o risco dominante passa a ser o operador apagando por engano.',
          },
          {
            type: 'h',
            text: 'Como se compõe a disponibilidade',
          },
          {
            type: 'p',
            text: 'Componentes em série multiplicam a disponibilidade e sempre pioram o resultado. Se uma requisição precisa passar por um gateway (99,9%), um serviço (99,9%) e um banco (99,9%), a disponibilidade do caminho é 0,999³ ≈ 99,7% — pior que qualquer peça isolada. É por isso que cadeias longas de dependências síncronas são caras: cada salto novo corrói o número.',
          },
          {
            type: 'p',
            text: 'Componentes em paralelo (redundantes) fazem o contrário: a indisponibilidade é que se multiplica. Duas réplicas de 99% de disponibilidade, em que basta uma funcionar, dão 1 − 0,01² = 99,99%. É a matemática que justifica redundância — desde que as falhas sejam realmente independentes. Se as duas réplicas estão no mesmo rack, com a mesma fonte de energia e o mesmo bug de software, elas falham juntas e a conta não vale.',
          },
          {
            type: 'h',
            text: 'MTBF, MTTR e onde os noves realmente se ganham',
          },
          {
            type: 'p',
            text: 'Existe uma decomposição da disponibilidade que muda a forma de priorizar trabalho: ela é aproximadamente MTBF / (MTBF + MTTR), onde MTBF é o tempo médio entre falhas e MTTR o tempo médio de reparo. Ou seja, disponibilidade tem dois caminhos — falhar menos ou se recuperar mais rápido — e o segundo costuma ser muito mais barato. Reduzir o MTTR de 40 minutos para 4 tem o mesmo efeito no número final que espaçar as falhas em dez vezes, e ninguém sabe como fazer software falhar dez vezes menos por decreto. Investir em rollback de um clique, failover automático e alarme que dispara em segundos rende mais nove do que qualquer esforço de "escrever código sem bugs".',
          },
          {
            type: 'p',
            text: 'Vale abrir o MTTR, porque ele quase nunca é dominado pelo conserto em si. O tempo total é detecção, mais notificação, mais diagnóstico, mais mitigação. Um incidente típico gasta minutos até alguém perceber, mais minutos até a pessoa certa estar no teclado, um bom tanto entendendo o que houve, e frequentemente segundos aplicando a correção — um rollback. Por isso o alarme baseado em sintoma do usuário (taxa de erro, latência) vale mais que dezenas de alarmes de causa (CPU, memória): ele encurta a primeira parcela, que é a única presente em todo incidente.',
          },
          {
            type: 'p',
            text: 'Por fim, cuidado ao herdar os noves dos fornecedores. Se a sua aplicação depende de um banco gerenciado com SLA de 99,95%, de um storage com 99,9% e de um provedor de identidade com 99,9%, o teto do seu SLA já está abaixo de 99,75% antes de você escrever uma linha de código — e SLA contratual não é promessa de comportamento, é o limiar a partir do qual você recebe um crédito na fatura. Prometer ao cliente um número melhor que o produto das suas dependências síncronas só é possível tirando alguma delas do caminho crítico.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Perseguir noves sem definir o que conta como "estar no ar". Se a métrica é ping no servidor, você pode anunciar 99,99% enquanto o usuário vê erro em metade dos pedidos. A disponibilidade que importa é medida da perspectiva do usuário, sobre requisições reais, e com um critério explícito de sucesso — normalmente um SLI do tipo "fração de requisições que retornam sem erro em menos de X ms".',
          },
          {
            type: 'p',
            text: 'Daí vem a ideia de *error budget*: se o alvo é 99,9%, você tem 43 minutos de falha por mês para gastar. Isso transforma confiabilidade em orçamento em vez de dogma — enquanto sobra budget, o time pode arriscar deploys mais agressivos; quando o budget acaba, a prioridade vira estabilidade. É a forma mais saudável de resolver a briga entre "entregar rápido" e "não quebrar".',
          },
        ],
        quiz: [
          {
            q: 'Um serviço depende de quatro outros, todos com 99,95% de disponibilidade, todos no caminho síncrono. Qual é a disponibilidade máxima que ele pode oferecer?',
            a: 'Aproximadamente 0,9995⁴ ≈ 99,8%. Dependências em série multiplicam-se, então o resultado é sempre pior que a pior peça. Para melhorar, é preciso tirar dependências do caminho crítico (tornando-as assíncronas, com cache ou com degradação graciosa), não apenas melhorar cada uma.',
          },
          {
            q: 'Dê um exemplo de sistema com alta disponibilidade e baixa confiabilidade.',
            a: 'Um serviço que sempre responde HTTP 200 mas serve dados de um cache desatualizado ou parcialmente corrompido. Do ponto de vista de uptime está perfeito; do ponto de vista de correção está falhando silenciosamente — o tipo de falha mais perigoso, porque nenhum alarme de disponibilidade dispara.',
          },
          {
            q: 'Por que duplicar um componente nem sempre eleva a disponibilidade como a fórmula prevê?',
            a: 'Porque a fórmula pressupõe falhas independentes. Réplicas que compartilham energia, rede, região, imagem de software ou configuração falham de forma correlacionada — um bug de deploy derruba as duas ao mesmo tempo. Redundância real exige diversidade nas dimensões que podem falhar juntas.',
          },
        ],
      },
    },
    {
      slug: 'latencia-e-throughput',
      title: 'Latência vs throughput',
      summary:
        'Por que otimizar um frequentemente piora o outro, e por que a média de latência mente.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Latência é o tempo de uma operação; throughput é quantas operações cabem por unidade de tempo. São eixos distintos, e a maior parte das técnicas de otimização troca um pelo outro.',
        blocks: [
          {
            type: 'p',
            text: 'A analogia mais útil é a de uma estrada. Latência é quanto tempo um carro leva para ir de A a B. Throughput é quantos carros passam por hora. Adicionar faixas aumenta o throughput sem mudar a latência de nenhum carro. Aumentar o limite de velocidade reduz a latência e aumenta o throughput. Encher a estrada de carros aumenta o throughput até o ponto de saturação — a partir dele, o congestionamento faz a latência explodir e o throughput até cair.',
          },
          {
            type: 'key',
            text: 'Sistemas não degradam linearmente: até certa utilização a latência é estável, e perto da saturação ela cresce de forma explosiva. É por isso que rodar a 95% de capacidade "para aproveitar o hardware" é uma péssima ideia.',
          },
          {
            type: 'p',
            text: 'Esse comportamento vem da teoria de filas. Numa aproximação simples, o tempo de espera cresce proporcionalmente a 1/(1−ρ), onde ρ é a utilização. A 50% de utilização, a espera é comparável ao tempo de serviço. A 90%, é dez vezes maior. A 99%, cem vezes. O sistema não avisa que vai quebrar: ele parece bem até não parecer mais.',
          },
          {
            type: 'p',
            text: 'Há um segundo fator que a fórmula simples esconde: a variabilidade. A fila não cresce só com a utilização, cresce também com o quanto os tempos de chegada e de serviço variam em torno da média. Duas filas com a mesma utilização de 70% se comportam de forma completamente diferente se uma atende requisições sempre de 10ms e a outra mistura chamadas de 1ms com relatórios de 3 segundos. É por isso que separar tráfego heterogêneo em pools distintos costuma reduzir a latência sem adicionar hardware nenhum — você não ficou mais rápido, só parou de deixar o pedido caro bloquear a fila do pedido barato.',
          },
          {
            type: 'p',
            text: 'A lei de Little amarra tudo isso numa relação surpreendentemente simples: L = λ × W, ou seja, o número médio de requisições dentro do sistema é igual à taxa de chegada multiplicada pelo tempo médio de permanência. Ela vale sem qualquer hipótese sobre a distribuição, e serve como sanidade em dimensionamento: se o serviço recebe 2.000 requisições por segundo e cada uma leva 50ms, existem em média 100 requisições em voo — logo, um pool de 20 threads vai formar fila e um de 500 está desperdiçando memória. É a conta que responde "quantas conexões simultâneas eu preciso suportar?" sem chute.',
          },
          {
            type: 'h',
            text: 'A média mente; use percentis',
          },
          {
            type: 'p',
            text: 'Reportar latência média é quase sempre um erro. Distribuições de latência têm cauda longa: a maioria das requisições é rápida e uma minoria é muito lenta. Uma média de 80ms pode esconder que 1% dos usuários espera 4 segundos. E como uma única página costuma disparar dezenas de chamadas internas, a chance de *alguma* delas cair na cauda é alta — o p99 de um serviço interno vira a experiência típica do usuário final. Por isso se mede p50 (a experiência mediana), p95, p99 e p99,9 (a cauda que define a pior impressão).',
          },
          {
            type: 'table',
            head: ['Técnica', 'Efeito na latência', 'Efeito no throughput'],
            rows: [
              ['Batching (agrupar operações)', 'Piora — espera formar o lote', 'Melhora muito — dilui custo fixo'],
              ['Cache', 'Melhora nos acertos', 'Melhora — tira carga da origem'],
              ['Fila assíncrona', 'Melhora o tempo de resposta percebido', 'Melhora — absorve picos'],
              ['Mais réplicas', 'Neutra (ou melhora, se havia fila)', 'Melhora quase linearmente'],
              ['Compressão', 'Melhora em rede lenta, piora em CPU', 'Depende do gargalo'],
            ],
          },
          {
            type: 'p',
            text: 'Vale também ter noção das ordens de grandeza, porque elas decidem arquitetura: acesso a memória RAM na casa de dezenas de nanossegundos; leitura em SSD, dezenas a centenas de microssegundos; ida e volta na mesma região de datacenter, entre 0,5 e 2 milissegundos; travessia entre continentes, 100 a 200 milissegundos, limitada pela velocidade da luz na fibra. Nenhuma otimização de código muda o último número — só mudar a geografia dos dados muda.',
          },
          {
            type: 'p',
            text: 'Medir percentil, no entanto, é mais delicado do que parece. Percentis não se somam nem se tiram média: a média dos p99 de dez servidores não é o p99 do conjunto, e o p99 de cinco minutos não vira o p99 da hora por média aritmética. Agregar corretamente exige guardar a distribuição — histogramas com buckets fixos ou estruturas como t-digest e HDR histogram — e só então calcular o percentil sobre o total. Dashboards que fazem `avg(p99)` entre instâncias produzem um número que não corresponde a experiência de usuário nenhuma, e costumam esconder justamente a réplica doente que está gerando a cauda.',
          },
          {
            type: 'p',
            text: 'Há ainda um viés clássico de medição chamado coordinated omission. Quando o gerador de carga espera a resposta anterior para disparar a próxima, ele deixa de enviar requisições exatamente durante as pausas do sistema — e portanto não mede o tempo que um usuário real teria esperado na fila. O resultado é um p99 otimista por ordens de grandeza: uma pausa de GC de 2 segundos aparece como uma única amostra lenta, quando deveria aparecer como milhares de requisições atrasadas. Ferramentas sérias corrigem isso mantendo uma taxa de envio fixa e contabilizando o atraso a partir do instante em que a requisição *deveria* ter sido enviada.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Otimizar o que é fácil de medir em vez do que domina o tempo. Um time gasta uma semana tirando 3ms de uma função enquanto cada requisição faz oito chamadas sequenciais ao banco, gastando 60ms em espera de rede. Antes de otimizar, meça onde o tempo realmente vai — tracing distribuído existe exatamente para isso.',
          },
          {
            type: 'p',
            text: 'A pergunta certa no início de qualquer projeto é qual dos dois eixos o produto exige. Um chat precisa de latência baixa e tolera throughput modesto. Um pipeline de faturamento noturno precisa de throughput alto e tolera horas de latência. Confundir os dois leva a arquiteturas caras que resolvem o problema errado.',
          },
        ],
        quiz: [
          {
            q: 'Por que agrupar escritas em lotes melhora o throughput e piora a latência?',
            a: 'Porque o custo fixo por operação (round-trip de rede, fsync, parsing, abertura de transação) é diluído entre muitos itens, elevando o total processado por segundo. Em compensação, cada item precisa esperar o lote se formar antes de ser processado, o que adiciona um atraso que não existiria no envio individual.',
          },
          {
            q: 'O p50 do serviço é 30ms e o p99 é 900ms. Por que o p99 pode ser a experiência mais comum do usuário?',
            a: 'Porque uma tela costuma disparar várias chamadas e espera a mais lenta. Com 50 chamadas independentes, a probabilidade de pelo menos uma cair no percentil 99 é cerca de 1 − 0,99⁵⁰ ≈ 39%. A cauda de um serviço interno vira a mediana da página.',
          },
          {
            q: 'Por que manter servidores a 90% de utilização é arriscado mesmo que estejam respondendo bem?',
            a: 'Porque a latência de espera cresce com 1/(1−ρ): a 90% ela já é dez vezes o tempo de serviço, e qualquer pico de tráfego, GC ou perda de uma réplica empurra a utilização para perto de 100%, onde a latência explode. Folga de capacidade é o que dá tempo de reagir.',
          },
        ],
      },
    },
    {
      slug: 'spof-e-tolerancia-a-falhas',
      title: 'SPOF e tolerância a falhas',
      summary:
        'Como encontrar o ponto único de falha que ninguém desenhou no diagrama e projetar para falhar bem.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Um SPOF é qualquer componente cuja falha derruba o sistema inteiro. Tolerância a falhas não é evitar falhas — é garantir que elas fiquem contidas.',
        blocks: [
          {
            type: 'p',
            text: 'Single Point of Failure (SPOF) é o componente sem o qual nada funciona. Em escala suficiente, falhas deixam de ser exceção e viram rotina: discos morrem, cabos são desconectados, certificados expiram, alguém aplica uma regra de firewall errada. Projetar assumindo que nada falha é projetar para o dia bom. A pergunta de design não é "isso pode falhar?", e sim "quando isso falhar, o que o usuário sente?".',
          },
          {
            type: 'key',
            text: 'Tolerância a falhas é a propriedade de continuar entregando serviço — possivelmente degradado — enquanto partes do sistema estão quebradas.',
          },
          {
            type: 'h',
            text: 'Os SPOFs que os diagramas escondem',
          },
          {
            type: 'p',
            text: 'A camada de aplicação costuma ser a primeira a ganhar redundância, porque é a mais visível. Os pontos únicos que sobram são justamente os que ninguém desenha:',
          },
          {
            type: 'list',
            items: [
              'O banco primário: réplicas de leitura não protegem contra a perda do nó que aceita escritas.',
              'O load balancer: se ele é uma máquina só, virou o SPOF que veio para eliminar SPOFs.',
              'DNS e certificados TLS: expiração de certificado derruba tudo simultaneamente, e nenhuma redundância de servidor ajuda.',
              'O serviço de autenticação: se todo request passa por ele, sua queda equivale à queda do produto.',
              'A pipeline de deploy e o registro de imagens: não derrubam o que está no ar, mas impedem a correção — quando você mais precisa dela.',
              'A zona de disponibilidade: máquinas diferentes no mesmo datacenter compartilham energia e rede.',
              'A configuração: um valor errado aplicado globalmente falha em todas as réplicas ao mesmo tempo.',
            ],
          },
          {
            type: 'p',
            text: 'Repare no padrão: os SPOFs mais perigosos são compartilhamentos invisíveis. Duas réplicas idênticas parecem independentes até você notar que ambas leem a mesma feature flag, resolvem o mesmo nome DNS e rodam a mesma versão de código com o mesmo bug latente.',
          },
          {
            type: 'h',
            text: 'Padrões para conter falhas',
          },
          {
            type: 'p',
            text: 'Redundância com failover automático é o básico: mais de uma instância, detecção de saúde e promoção de um substituto sem humano no meio. Vale distinguir os modos — ativo-ativo (todos atendem, a carga se redistribui) e ativo-passivo (um atende, o outro espera). Ativo-ativo aproveita o hardware e prova continuamente que o secundário funciona; ativo-passivo é mais simples, mas costuma esconder um standby que nunca foi testado e falha justo na hora H.',
          },
          {
            type: 'p',
            text: 'Isolamento por bulkhead vem da metáfora dos compartimentos estanques de um navio: separar pools de conexão, threads e filas por dependência, para que um serviço lento não consuma todos os recursos e derrube os caminhos que estavam saudáveis. Circuit breaker corta chamadas para uma dependência que já demonstrou estar quebrada, evitando que cada requisição pague o timeout inteiro. Timeouts agressivos e retry com backoff exponencial e jitter completam o kit — sem jitter, todos os clientes tentam de novo no mesmo instante e transformam a recuperação em um novo pico de carga.',
          },
          {
            type: 'p',
            text: 'Acima de tudo vem a degradação graciosa: decidir de antemão o que pode ser desligado. Se o serviço de recomendação cai, a loja mostra uma lista genérica em vez de erro. Se o cálculo de frete falha, a página exibe uma estimativa. É a diferença entre perder uma funcionalidade e perder o produto.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Retry sem limite e sem backoff. Quando uma dependência começa a falhar por sobrecarga, retentativas imediatas multiplicam o tráfego para ela — três tentativas por cliente viram o triplo da carga exatamente no momento em que o serviço precisava de alívio. É a receita do colapso em cascata (retry storm). Sempre com teto de tentativas, backoff exponencial, jitter aleatório e, de preferência, um circuit breaker por trás.',
          },
          {
            type: 'p',
            text: 'Por fim, tolerância a falhas não testada é ficção. Failover que ninguém exercita costuma falhar quando é acionado de verdade: a réplica estava com replicação atrasada, o script de promoção tinha um bug, o DNS levou dez minutos para propagar. Daí a prática de engenharia do caos — injetar falhas de propósito, em horário controlado, para descobrir os pressupostos errados antes que a produção descubra por conta própria.',
          },
        ],
        quiz: [
          {
            q: 'Um sistema roda em três instâncias atrás de um load balancer, com banco replicado. Onde ainda pode haver SPOF?',
            a: 'Em vários lugares: no próprio load balancer se for instância única, no nó primário do banco (réplicas de leitura não aceitam escrita), no DNS e no certificado TLS, na zona de disponibilidade compartilhada pelas três instâncias, e na configuração/versão de software idêntica que pode conter o mesmo bug em todas.',
          },
          {
            q: 'Por que retry sem jitter é perigoso mesmo com backoff exponencial?',
            a: 'Porque todos os clientes que falharam no mesmo instante calculam o mesmo intervalo e voltam sincronizados, criando picos periódicos de carga. O jitter aleatório espalha as retentativas no tempo, transformando um pico agudo numa curva suave que o serviço em recuperação consegue absorver.',
          },
          {
            q: 'Qual a diferença prática entre redundância ativo-ativo e ativo-passivo?',
            a: 'No ativo-ativo todas as instâncias atendem tráfego, o que aproveita o hardware e valida continuamente que cada uma funciona; exige que o estado seja compartilhado ou que a requisição seja independente. No ativo-passivo o secundário fica ocioso até a falha, o que é mais simples, mas cria o risco de um standby não testado e adiciona o tempo de failover à indisponibilidade.',
          },
        ],
      },
    },
    {
      slug: 'teorema-cap',
      title: 'Teorema CAP (e por que ele é mal citado)',
      summary:
        'A escolha real não é entre três letras: é o que fazer quando a rede particiona.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'O teorema CAP afirma que, durante uma partição de rede, um sistema distribuído precisa escolher entre consistência e disponibilidade. Fora da partição, a escolha real é entre consistência e latência.',
        blocks: [
          {
            type: 'p',
            text: 'O enunciado corrente — "escolha 2 de 3 entre consistência, disponibilidade e tolerância a partição" — é enganoso. Tolerância a partição não é uma opção de projeto: se o sistema roda em mais de uma máquina ligada por rede, partições vão acontecer, quer você queira ou não. Cabos são cortados, switches reiniciam, uma zona fica isolada por minutos. Descartar o P equivale a projetar para um mundo que não existe.',
          },
          {
            type: 'key',
            text: 'A leitura correta do CAP: quando ocorre uma partição, você escolhe entre responder com dado possivelmente desatualizado (AP) ou recusar responder até ter certeza (CP). Não existe terceira opção.',
          },
          {
            type: 'p',
            text: 'Sendo mais preciso nos termos: consistência aqui é linearizabilidade — toda leitura enxerga a escrita mais recente confirmada, como se existisse uma única cópia dos dados. Disponibilidade significa que todo nó não-falho responde a toda requisição. Partição é a rede perdendo mensagens arbitrariamente entre grupos de nós.',
          },
          {
            type: 'h',
            text: 'Como a escolha aparece na prática',
          },
          {
            type: 'p',
            text: 'Imagine dois datacenters com uma réplica cada, e o link entre eles cai. Um cliente escreve no datacenter A e outro lê do B. O sistema CP recusa a leitura (ou a escrita) no lado que não consegue confirmar quem é o líder — prefere erro a resposta errada. O sistema AP responde nos dois lados, aceitando que por algum tempo eles divergem, e reconcilia depois que o link volta. Nenhuma das duas é "melhor": elas erram de formas diferentes.',
          },
          {
            type: 'table',
            head: ['Cenário', 'Escolha razoável', 'Por quê'],
            rows: [
              ['Saldo bancário / transferência', 'CP', 'Responder com saldo velho permite gastar dinheiro duas vezes'],
              ['Carrinho de compras', 'AP', 'Melhor um carrinho divergente que reconciliar depois do que uma loja fora do ar'],
              ['Contador de curtidas', 'AP', 'Número aproximado por alguns segundos não causa dano'],
              ['Reserva de assento / estoque unitário', 'CP', 'Duas pessoas no mesmo assento é pior que um erro visível'],
              ['Configuração de cluster / eleição de líder', 'CP', 'Dois líderes simultâneos corrompem o estado (split brain)'],
            ],
          },
          {
            type: 'h',
            text: 'PACELC: a parte que o CAP não conta',
          },
          {
            type: 'p',
            text: 'Partições são raras. O CAP descreve o comportamento num evento excepcional e cala sobre o dia a dia — que é onde 99,9% do tempo é vivido. O PACELC completa: *se* há partição (P), escolha entre A e C; *senão* (E, de else), escolha entre latência (L) e consistência (C). Esse segundo trade-off é o que realmente molda o sistema. Garantir consistência forte exige que a escrita seja confirmada por um quórum de réplicas antes de responder, e se essas réplicas estão em regiões diferentes, cada escrita paga a latência entre continentes. Consistência não é grátis nem quando tudo funciona.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tratar CAP como rótulo de banco de dados — "Mongo é AP, Postgres é CP". A maioria dos sistemas modernos é configurável por operação: dá para pedir quórum forte numa escrita crítica e leitura local rápida numa consulta tolerante. A pergunta certa não é qual letra o banco tem no marketing, e sim qual garantia *esta operação específica* precisa, e o que acontece com ela quando um nó fica isolado.',
          },
          {
            type: 'p',
            text: 'Vale lembrar ainda que "eventualmente consistente" não é um único nível. Entre linearizabilidade e "eventualmente" existem garantias intermediárias bastante úteis: read-your-writes (você sempre enxerga o que acabou de escrever), monotonic reads (o dado nunca anda para trás na sua sessão) e consistência causal (efeito nunca aparece antes da causa). Muitas vezes é exatamente uma dessas — e não consistência forte — que o produto realmente precisa.',
          },
          {
            type: 'h',
            text: 'Os níveis intermediários, com exemplos',
          },
          {
            type: 'p',
            text: 'Read-your-writes é a garantia que quase todo produto precisa e quase todo time descobre por acidente. O usuário edita o perfil, o sistema grava no primário, a tela recarrega lendo de uma réplica atrasada e o nome antigo reaparece — o clássico "salvou mas não salvou". A correção raramente exige consistência forte global: basta rotear as leituras daquela sessão para o primário durante alguns segundos após uma escrita, ou carregar no cliente um token com a posição do log de replicação e exigir que a réplica tenha alcançado aquele ponto antes de responder.',
          },
          {
            type: 'p',
            text: 'Monotonic reads resolve um sintoma diferente: o dado que anda para trás. O usuário atualiza a página duas vezes seguidas, cai em réplicas com atrasos distintos e vê primeiro o comentário novo, depois ele sumindo. Nenhuma leitura está errada isoladamente — cada réplica devolveu um estado que existiu — mas a sequência é incoerente. A solução usual é afinidade: amarrar a sessão a uma réplica específica enquanto ela estiver saudável, de modo que o relógio lógico daquele usuário nunca retroceda.',
          },
          {
            type: 'p',
            text: 'Consistência causal é a mais forte das três e cobre o caso em que ordem entre operações relacionadas importa. Se alguém publica uma foto e em seguida comenta nela, nenhum leitor deve ver o comentário antes da foto — mesmo que as duas escritas tenham ido para partições diferentes. Sistemas que oferecem essa garantia carregam metadados de dependência junto do dado (vetores de versão, relógios lógicos como o de Lamport) e seguram a entrega de uma operação até que suas causas já tenham sido aplicadas localmente.',
          },
          {
            type: 'p',
            text: 'Quando a escolha é AP, a divergência precisa ser resolvida de alguma forma quando a partição termina, e a estratégia é decisão de produto, não de infraestrutura. Last-write-wins é simples e descarta dados silenciosamente — aceitável para uma preferência de tema, desastroso para um carrinho. Merge semântico preserva intenção: a união dos itens do carrinho quase sempre é a resposta certa, e é isso que os CRDTs formalizam ao definir operações comutativas cujo resultado independe da ordem. A alternativa honesta, quando não existe merge automático defensável, é guardar as versões conflitantes e devolver a decisão ao usuário.',
          },
        ],
        quiz: [
          {
            q: 'Por que dizer que um sistema distribuído "escolheu CA" é quase sempre incorreto?',
            a: 'Porque partições de rede não são uma escolha: acontecem em qualquer sistema que se comunica por rede. Abrir mão de P significa não ter plano para um evento inevitável — na prática o sistema vai simplesmente se comportar mal quando a partição ocorrer. Só um sistema de nó único pode legitimamente ignorar P.',
          },
          {
            q: 'O que o PACELC acrescenta ao CAP e por que isso importa mais no dia a dia?',
            a: 'Acrescenta o trade-off que existe quando *não* há partição: consistência versus latência. Como partições são raras e o resto do tempo é a operação normal, é esse segundo eixo que domina as decisões — quantas réplicas precisam confirmar uma escrita, se leituras podem vir de réplica local, quanto de atraso é aceitável.',
          },
          {
            q: 'Um contador de visualizações e um sistema de reserva de assentos exigem escolhas opostas. Explique.',
            a: 'O contador tolera divergência: mostrar 1.204 em vez de 1.207 por alguns segundos não causa dano, então vale priorizar disponibilidade (AP) e reconciliar depois. A reserva de assentos não tolera: dois usuários confirmando o mesmo assento gera um problema real e caro no mundo físico, então é melhor recusar a operação durante a partição (CP).',
          },
        ],
      },
    },
    {
      slug: 'consistent-hashing',
      title: 'Consistent hashing',
      summary:
        'A técnica que permite adicionar e remover nós sem reembaralhar todos os dados do cluster.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Consistent hashing distribui chaves entre nós de modo que adicionar ou remover um nó só realoque a fração de chaves que pertencia a ele, em vez de reorganizar o cluster inteiro.',
        blocks: [
          {
            type: 'p',
            text: 'O problema começa com a solução ingênua. Para distribuir chaves entre N servidores, o caminho óbvio é `hash(chave) % N`. Funciona perfeitamente enquanto N não muda. No instante em que um servidor entra ou sai, N muda e praticamente todas as chaves passam a mapear para outro nó. Num cache, isso significa perder quase todo o conteúdo de uma vez e despejar a carga inteira no banco — um evento capaz de derrubar o sistema justo durante um escalonamento ou uma falha.',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `// Com 4 nós:  hash("user:42") % 4 = 2
// Com 5 nós:  hash("user:42") % 5 = 1   ← mudou de nó
// Na prática, ~80% das chaves mudam de dono ao passar de 4 para 5 nós.`,
          },
          {
            type: 'key',
            text: 'A ideia central: mapear nós e chaves no mesmo espaço circular de hash, e fazer cada chave pertencer ao primeiro nó encontrado ao caminhar no sentido horário. Assim a saída de um nó afeta apenas as chaves entre ele e o nó anterior.',
          },
          {
            type: 'h',
            text: 'O anel',
          },
          {
            type: 'p',
            text: 'Imagine um círculo representando todos os valores possíveis de hash — por exemplo, de 0 a 2³²−1, com o fim emendado no começo. Cada nó é posicionado no círculo pelo hash do seu identificador. Cada chave também. Para descobrir quem guarda uma chave, calcula-se seu hash e caminha-se no sentido horário até encontrar o primeiro nó: ele é o dono.',
          },
          {
            type: 'p',
            text: 'Quando um nó sai do anel, só as chaves que estavam no arco entre ele e seu antecessor precisam migrar — e vão para o próximo nó no sentido horário. Todas as outras ficam onde estão. Com N nós, a fração de chaves realocadas é aproximadamente 1/N, em vez dos quase 100% do módulo. Ao adicionar um nó, o efeito é simétrico: ele "rouba" um arco de um vizinho e ninguém mais é perturbado.',
          },
          {
            type: 'h',
            text: 'Nós virtuais',
          },
          {
            type: 'p',
            text: 'O anel puro tem um defeito: com poucos nós, os pontos caem de forma irregular no círculo e os arcos ficam desbalanceados — um nó pode ficar com o dobro das chaves de outro. A solução é dar a cada nó físico muitas posições no anel, chamadas nós virtuais (vnodes). Em vez de um ponto, o servidor A ocupa 150 pontos espalhados; a lei dos grandes números faz a distribuição convergir para algo bem uniforme.',
          },
          {
            type: 'p',
            text: 'Os vnodes trazem um segundo benefício, talvez mais importante: quando um nó cai, seus arcos estão espalhados por todo o anel, então sua carga se redistribui entre *todos* os nós restantes, e não apenas para o vizinho imediato. Sem vnodes, a queda de um nó dobraria a carga de um único sobrevivente — que provavelmente cairia em seguida, começando uma cascata. Os vnodes também permitem heterogeneidade: uma máquina com o dobro de memória recebe o dobro de posições e, portanto, o dobro dos dados.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'hash % N', 'Consistent hashing'],
            rows: [
              ['Chaves realocadas ao mudar N', '~100%', '~1/N'],
              ['Distribuição com nós iguais', 'Uniforme', 'Uniforme (com vnodes)'],
              ['Suporte a nós heterogêneos', 'Não', 'Sim, via número de vnodes'],
              ['Complexidade de implementação', 'Trivial', 'Moderada (anel ordenado + busca binária)'],
              ['Custo de lookup', 'O(1)', 'O(log V) com busca binária no anel'],
            ],
          },
          {
            type: 'h',
            text: 'Replicação sobre o anel',
          },
          {
            type: 'p',
            text: 'Num sistema real, cada chave não mora em um nó só — mora em N. A extensão natural do anel é simples: caminhando no sentido horário a partir da posição da chave, os N primeiros nós *físicos distintos* encontrados formam sua lista de réplicas. A exigência de serem físicos distintos importa: sem ela, dois nós virtuais da mesma máquina poderiam ser escolhidos como réplicas diferentes, e a "redundância" seria ilusória — a queda daquela máquina levaria duas cópias de uma vez.',
          },
          {
            type: 'p',
            text: 'Esse arranjo dá uma propriedade valiosa. Quando um nó cai, cada uma das suas faixas tem um sucessor natural que já era réplica daquele intervalo e, portanto, já possui os dados — não é preciso copiar nada para voltar a atender. A recuperação é imediata, e a transferência que acontece depois serve apenas para restaurar o fator de replicação, em segundo plano.',
          },
          {
            type: 'p',
            text: 'Sistemas que levam a disponibilidade a sério refinam ainda mais, distribuindo as réplicas por domínios de falha: exigir que as N cópias estejam em racks ou zonas diferentes evita que um único disjuntor ou switch derrube todas ao mesmo tempo. É uma restrição adicional na escolha dos sucessores, e a razão pela qual a lista de réplicas raramente é apenas "os próximos N do anel" numa implementação de produção.',
          },
          {
            type: 'p',
            text: 'Vale registrar um detalhe operacional que costuma passar despercebido: o anel precisa ser conhecido por todos os participantes, e mudanças nele precisam propagar. Enquanto essa propagação acontece, nós diferentes podem discordar sobre quem é o dono de uma chave, o que gera leituras que não encontram o dado e escritas que vão para o lugar errado. É por isso que a topologia costuma ser disseminada por gossip com número de versão, e por que mudanças de composição são feitas uma de cada vez, não em lote.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Achar que consistent hashing resolve hot keys. Ele distribui *chaves* uniformemente, não *acessos*. Se uma única chave concentra metade do tráfego — o post viral, o produto em promoção —, ela mora em um nó só e aquele nó vai saturar independentemente do anel. Para isso a resposta é outra: replicar a chave quente em vários nós, adicionar um sufixo aleatório para dividi-la, ou pôr um cache local na frente.',
          },
          {
            type: 'p',
            text: 'Consistent hashing é a base de sistemas de cache distribuído, de bancos como Cassandra e DynamoDB, e de camadas de sharding em geral. Vale conhecer também a alternativa moderna: rendezvous hashing (highest random weight), que calcula hash(chave, nó) para cada nó e escolhe o de maior valor. Dá as mesmas garantias de realocação mínima com implementação mais simples, ao custo de um lookup O(N) — perfeitamente aceitável quando o número de nós é pequeno.',
          },
        ],
        quiz: [
          {
            q: 'Por que `hash(chave) % N` é ruim para um cache distribuído que às vezes perde nós?',
            a: 'Porque mudar N remapeia quase todas as chaves de uma vez. O cache inteiro vira miss simultaneamente e todo o tráfego cai sobre o banco de origem no mesmo instante — um pico capaz de derrubar o backend justamente durante um evento de falha ou escalonamento.',
          },
          {
            q: 'Qual problema os nós virtuais resolvem além do balanceamento de carga?',
            a: 'Resolvem a redistribuição concentrada em caso de falha. Sem vnodes, toda a carga de um nó que cai vai para seu vizinho imediato no anel, que pode dobrar de carga e cair em seguida. Com vnodes, os arcos do nó morto estão espalhados e sua carga se divide entre todos os nós restantes.',
          },
          {
            q: 'Uma única chave responde por 40% das requisições. Consistent hashing ajuda?',
            a: 'Não. O anel distribui chaves distintas, mas uma chave individual mora sempre em um nó — que vai saturar. É preciso outra técnica: replicar essa chave em várias réplicas de leitura, dividi-la artificialmente com sufixos (key splitting), ou colocar um cache local no cliente/proxy para absorver os acessos antes de chegarem ao anel.',
          },
        ],
      },
    },
  ],
};

import type { ModuleSeed } from '../types';

// Aulas autorais sobre cada paper: o problema que ele resolveu, a ideia
// central e onde ela reaparece hoje. O texto do paper em si fica no link de
// leitura complementar.

export const papers: ModuleSeed = {
  slug: 'papers-classicos',
  title: 'Papers clássicos',
  goal: 'Reconhecer as ideias que definiram a área e enxergá-las nos sistemas que usamos hoje, sabendo o problema que cada uma resolveu.',
  lessons: [
    {
      slug: 'mapreduce',
      title: 'MapReduce',
      kind: 'PAPER',
      summary:
        'Processamento paralelo em escala com duas primitivas e tolerância a falhas por reexecução.',
      sourceUrl:
        'https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/',
      content: {
        summary:
          'MapReduce mostrou que processar petabytes em milhares de máquinas comuns podia ser expresso com duas funções, deixando paralelização e tolerância a falhas para o framework.',
        blocks: [
          {
            type: 'p',
            text: 'O problema não era conceitual — todo mundo sabia como contar palavras. Era operacional: para rodar isso em mil máquinas, cada programa precisava resolver distribuição do trabalho, comunicação entre nós, tratamento de máquinas que morrem no meio, e balanceamento quando algumas ficam lentas. Cada nova análise reimplementava tudo isso, e a lógica de negócio se perdia no meio.',
          },
          {
            type: 'key',
            text: 'A contribuição foi de abstração, não de algoritmo: separar o *o quê* (duas funções simples, escritas pelo usuário) do *como* (distribuição, falhas, reexecução, tudo no framework).',
          },
          {
            type: 'p',
            text: 'O modelo tem duas etapas. Map recebe um registro e emite pares chave-valor. O framework agrupa todos os valores por chave — o embaralhamento, que é onde mora o trabalho pesado de rede. Reduce recebe uma chave com todos os seus valores e produz o resultado. Contagem de palavras, índice invertido, agregações e junções cabem nesse formato.',
          },
          {
            type: 'p',
            text: 'A tolerância a falhas é elegante justamente por ser simples: como as funções são determinísticas e sem estado externo, uma tarefa que falha é apenas executada de novo em outra máquina. Não há recuperação parcial, não há estado a reconstruir. Numa escala em que falhas de máquina são rotina, essa propriedade é o que torna o sistema viável.',
          },
          {
            type: 'p',
            text: 'Duas otimizações do paper viraram práticas gerais. A localidade de dados: enviar a computação para a máquina que já tem o bloco, em vez de trazer os dados pela rede. E a execução especulativa: perto do fim do job, disparar cópias das tarefas mais lentas em outras máquinas e usar o primeiro resultado — porque uma única máquina degradada segurava o job inteiro.',
          },
          {
            type: 'p',
            text: 'MapReduce foi superado como ferramenta: o modelo de duas etapas é rígido, escrever em disco entre estágios é lento, e algoritmos iterativos ficam desajeitados. Motores modernos generalizam para grafos de operações e mantêm dados em memória. Mas as ideias — computação junto dos dados, tolerância por reexecução determinística, e a separação entre lógica do usuário e mecânica distribuída — estão em tudo que veio depois.',
          },
          {
            type: 'h',
            text: 'O que existia antes e o que foi deixado de fora',
          },
          {
            type: 'p',
            text: 'O estado da arte anterior era de duas famílias. De um lado, os bancos analíticos paralelos, caros, rodando em hardware confiável e especializado, ótimos em consulta declarativa e frágeis quando uma máquina morria. Do outro, bibliotecas de computação científica que davam controle fino sobre comunicação entre processos e exigiam que o programador tratasse falha manualmente. Nenhuma das duas servia para milhares de máquinas comuns, onde uma falha por hora é o normal e o objetivo não é uma consulta elegante, mas varrer todo o conjunto de dados.',
          },
          {
            type: 'p',
            text: 'A restrição concreta que moldou o desenho é econômica: se você compra máquinas baratas em vez de servidores robustos, precisa aceitar que elas falham constantemente. Isso elimina qualquer estratégia que dependa de a máquina sobreviver ao trabalho. Daí a insistência em funções determinísticas e sem efeito colateral — não é purismo funcional, é a condição que torna a reexecução segura. Um map que escrevesse num banco externo quebraria a garantia inteira, porque a reexecução aplicaria o efeito duas vezes.',
          },
          {
            type: 'p',
            text: 'Igualmente instrutivo é o que foi deliberadamente omitido. Não há otimizador de consulta, não há esquema, não há índice — cada job varre a entrada inteira, mesmo quando o resultado tocaria uma fração dela. Não há computação incremental: dados novos exigem rodar tudo de novo. E não há suporte real a iteração, porque cada rodada paga o custo de escrever e ler o disco. Essas ausências foram aceitas em troca de simplicidade e robustez, e são precisamente as lacunas que a geração seguinte de motores se dedicou a preencher.',
          },
          {
            type: 'p',
            text: 'Onde a ideia reaparece hoje: no plano de execução de qualquer motor distribuído moderno, o embaralhamento por chave continua sendo a etapa cara e o principal alvo de otimização. A execução especulativa virou comportamento padrão de agendadores. E a exigência de determinismo migrou para o vocabulário de pipelines de dados, onde transformações puras e reprocessáveis são a base de qualquer arquitetura que precise recomputar histórico depois de corrigir um bug.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Confundir a ferramenta com a ideia. Dizer que "MapReduce está morto" é verdade sobre a implementação e falso sobre o modelo: toda a família de motores de processamento distribuído que o sucedeu herdou sua abstração central. O que morreu foi a rigidez de duas etapas com disco no meio.',
          },
        ],
        quiz: [
          {
            q: 'Qual foi a contribuição central do MapReduce?',
            a: 'Separar a lógica do usuário — duas funções simples e determinísticas — de toda a mecânica distribuída: particionamento do trabalho, embaralhamento por chave, tratamento de máquinas que falham e balanceamento. O programador deixou de reimplementar computação distribuída a cada análise.',
          },
          {
            q: 'Por que a reexecução funciona como estratégia de tolerância a falhas?',
            a: 'Porque as funções são determinísticas e não dependem de estado externo: rodar a mesma tarefa sobre a mesma entrada produz o mesmo resultado. Uma tarefa perdida pode simplesmente ser refeita em outra máquina, sem recuperação parcial nem reconstrução de estado.',
          },
          {
            q: 'O que é execução especulativa e qual problema resolve?',
            a: 'É disparar cópias das tarefas mais lentas em outras máquinas perto do fim do job e usar o primeiro resultado que chegar. Resolve o problema do retardatário: uma única máquina degradada — disco ruim, contenção — segurava a conclusão do job inteiro.',
          },
        ],
      },
    },
    {
      slug: 'gfs',
      title: 'The Google File System',
      kind: 'PAPER',
      summary:
        'Armazenamento distribuído desenhado para hardware que falha o tempo todo.',
      sourceUrl: 'https://research.google/pubs/the-google-file-system/',
      content: {
        summary:
          'O GFS partiu de premissas incomuns — falhas constantes, arquivos enormes, escrita por acréscimo — e desenhou um sistema de arquivos otimizado exatamente para elas.',
        blocks: [
          {
            type: 'p',
            text: 'A lição mais importante do paper não é técnica, é metodológica: os autores questionaram as premissas herdadas de sistemas de arquivos tradicionais e projetaram para a carga que realmente tinham. Falhas de máquina não eram exceção mas rotina; arquivos tinham gigabytes e não kilobytes; a escrita dominante era acréscimo ao fim, não modificação no meio; e leituras eram majoritariamente sequenciais e grandes.',
          },
          {
            type: 'key',
            text: 'Cada premissa questionada virou uma simplificação. Como quase não há modificação no meio do arquivo, o sistema pode otimizar radicalmente para acréscimo. Como falhas são rotina, a recuperação é caminho principal e não caso de exceção.',
          },
          {
            type: 'p',
            text: 'A arquitetura tem um nó mestre e muitos servidores de dados. Arquivos são divididos em blocos grandes — 64 MB, uma escolha deliberada — replicados em três máquinas. O mestre guarda apenas os metadados: quais blocos formam cada arquivo e onde estão. É a decisão que faz o sistema funcionar: com blocos grandes, os metadados de um sistema gigantesco cabem na memória de uma máquina.',
          },
          {
            type: 'p',
            text: 'Igualmente importante é que o mestre sai do caminho dos dados. O cliente pergunta a ele onde está o bloco e depois conversa diretamente com os servidores. Assim o mestre não vira gargalo de banda, e um único nó de metadados sustenta um cluster inteiro — simplicidade que teria sido impossível se todos os bytes passassem por ele.',
          },
          {
            type: 'p',
            text: 'O ponto mais controverso é o modelo de consistência, deliberadamente frouxo. O GFS garante que um acréscimo aparece pelo menos uma vez em algum offset, e permite duplicatas e regiões de preenchimento entre réplicas. Isso simplificou enormemente a implementação e transferiu trabalho para as aplicações, que passaram a usar checksums e identificadores para filtrar duplicatas. Foi uma troca consciente, e é o aspecto que sistemas posteriores mais revisaram.',
          },
          {
            type: 'p',
            text: 'O GFS é o ancestral direto do HDFS e influenciou toda a geração de armazenamento distribuído que veio depois. A separação entre plano de metadados e plano de dados, a replicação como comportamento padrão e o desenho assumindo falhas contínuas são hoje suposições básicas de qualquer sistema desse tipo.',
          },
          {
            type: 'h',
            text: 'O contexto e os limites assumidos',
          },
          {
            type: 'p',
            text: 'Antes do GFS, armazenamento em rede significava sistemas que replicavam a semântica POSIX sobre uma rede: permissões, escrita em qualquer offset, visibilidade imediata, e a expectativa de que o servidor fosse confiável. A alta disponibilidade vinha de hardware — controladoras redundantes, discos em RAID, equipamento caro. O salto conceitual foi trocar confiabilidade de hardware por redundância de software, aceitando que máquinas comuns morressem e replicando os dados em três delas.',
          },
          {
            type: 'p',
            text: 'A restrição que amarra o desenho é a memória do nó mestre. Se todo o mapa de blocos precisa caber na RAM de uma máquina, o número total de blocos vira o teto do sistema — e o único jeito de armazenar petabytes com poucos milhões de blocos é fazer cada bloco enorme. O bloco de 64 MB não é uma escolha de desempenho de disco; é a consequência aritmética de querer um mestre único, e ter um mestre único é o que dispensa consenso distribuído para metadados e mantém o sistema simples o bastante para funcionar.',
          },
          {
            type: 'p',
            text: 'Várias coisas foram deixadas de fora conscientemente. Não há semântica POSIX completa, então programas comuns não funcionam sem adaptação. Não há suporte a arquivos pequenos em grande número, porque cada um consumiria uma entrada de metadados. A consistência é fraca o bastante para que duas réplicas do mesmo arquivo não sejam byte a byte idênticas — algo que soaria inaceitável em um sistema de arquivos tradicional e foi tolerável porque as aplicações que rodavam sobre ele foram escritas sabendo disso.',
          },
          {
            type: 'p',
            text: 'A ideia reaparece hoje em toda parte, ainda que com o modelo de consistência apertado. Armazenamento de objetos na nuvem herda a separação entre plano de metadados e plano de dados, a replicação como padrão e o acesso direto do cliente aos nós que guardam os bytes. E a lição metodológica — listar as premissas reais da sua carga antes de aceitar as de um sistema de propósito geral — continua sendo o que mais se aproveita do paper, mais até do que o desenho em si.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Copiar o desenho sem copiar as premissas. O GFS é excelente para arquivos enormes lidos sequencialmente e péssimo para milhões de arquivos pequenos com acesso aleatório — o mestre não comportaria os metadados e o bloco de 64 MB seria desperdício. A lição a levar é o método, não a receita.',
          },
        ],
        quiz: [
          {
            q: 'Por que blocos de 64 MB foram uma decisão central?',
            a: 'Porque reduzem drasticamente a quantidade de metadados: com blocos grandes, o mapa de um sistema de vários petabytes cabe na memória de um único nó mestre. Também diminuem a interação cliente-mestre e favorecem leituras sequenciais grandes, que eram o padrão de acesso dominante.',
          },
          {
            q: 'Por que tirar o mestre do caminho dos dados foi essencial?',
            a: 'Porque se todos os bytes passassem por ele, sua banda seria o teto do cluster inteiro. Fazendo o cliente consultar apenas a localização e depois conversar direto com os servidores de dados, o mestre lida só com metadados — o que permite manter a simplicidade de um nó central sem que ele vire gargalo.',
          },
          {
            q: 'Qual foi a troca feita no modelo de consistência do GFS?',
            a: 'Ele garante apenas que um acréscimo apareça pelo menos uma vez, tolerando duplicatas e regiões de preenchimento entre réplicas. Isso simplificou muito a implementação e transferiu às aplicações a responsabilidade de filtrar duplicatas com checksums e identificadores — uma troca consciente entre simplicidade do sistema e complexidade do cliente.',
          },
        ],
      },
    },
    {
      slug: 'bigtable',
      title: 'Bigtable',
      kind: 'PAPER',
      summary:
        'Um mapa ordenado, esparso e multidimensional — a origem de boa parte dos bancos wide-column.',
      sourceUrl:
        'https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/',
      content: {
        summary:
          'Bigtable ofereceu um modelo de dados simples — um mapa ordenado e esparso indexado por linha, coluna e tempo — que escala para petabytes mantendo consultas por intervalo eficientes.',
        blocks: [
          {
            type: 'p',
            text: 'A descrição do próprio paper é a melhor definição: um mapa esparso, distribuído, persistente e multidimensional, indexado por chave de linha, chave de coluna e timestamp. Cada termo aí carrega uma decisão de projeto.',
          },
          {
            type: 'p',
            text: 'Esparso significa que colunas ausentes não ocupam espaço — uma linha pode ter três colunas e a vizinha ter mil, sem desperdício. Multidimensional pelo tempo significa que cada célula guarda várias versões, permitindo ler o valor de um instante passado. E a ordenação por chave de linha é a propriedade que mais influencia a modelagem.',
          },
          {
            type: 'key',
            text: 'As linhas são armazenadas em ordem lexicográfica de chave, e é isso que torna consultas por intervalo eficientes. Projetar a chave de linha é, portanto, projetar quais consultas serão rápidas — a decisão mais importante do modelo.',
          },
          {
            type: 'p',
            text: 'O exemplo do paper virou clássico: para armazenar páginas web, a chave é a URL com o domínio invertido, de modo que todas as páginas de um mesmo site ficam contíguas e podem ser lidas numa varredura. A mesma técnica reaparece em qualquer modelagem wide-column: concatenar entidade e tempo na chave para que "os eventos desta entidade, neste período" seja uma leitura sequencial.',
          },
          {
            type: 'p',
            text: 'Internamente, as linhas são agrupadas em tablets — faixas contíguas de chaves — que são a unidade de distribuição e balanceamento. Quando um tablet cresce demais, ele é dividido; quando um servidor fica sobrecarregado, tablets migram. A escrita usa a estrutura LSM: vai para um log e para uma tabela em memória, que periodicamente é descarregada em arquivos imutáveis ordenados, compactados depois em segundo plano.',
          },
          {
            type: 'p',
            text: 'Bigtable também foi transparente sobre o que não oferece: nada de transações entre linhas, nada de joins, nada de índices secundários. Essa recusa deliberada é o que permitiu a escala, e é a mesma escolha que aparece nos descendentes diretos — HBase, Cassandra e a família wide-column em geral.',
          },
          {
            type: 'h',
            text: 'Por que não bastava um banco relacional',
          },
          {
            type: 'p',
            text: 'O estado da arte para dados estruturados era o relacional, e ele resolvia bem quase tudo — desde que coubesse em uma máquina, ou em poucas com particionamento manual. O que ele não oferecia era crescimento incremental para milhares de servidores com esquemas irregulares e voláteis. Distribuir um relacional preservando joins, transações entre linhas e índices secundários exige coordenação em cada operação, e é essa coordenação que impede o sistema de crescer linearmente com o número de máquinas.',
          },
          {
            type: 'p',
            text: 'A restrição concreta era a natureza dos dados: bilhões de páginas web, cada uma com um conjunto imprevisível de atributos, versionadas ao longo do tempo, com padrões de acesso dominados por varredura de faixas contíguas. Uma tabela relacional com colunas fixas seria majoritariamente nula, e um esquema rígido exigiria migração a cada novo tipo de atributo coletado. O modelo esparso com famílias de colunas responde exatamente a isso: adicionar um atributo novo não é uma alteração de esquema, é apenas escrever numa coluna que ainda não existia.',
          },
          {
            type: 'p',
            text: 'As omissões são o coração do desenho e vale enunciá-las com clareza. Sem transações entre linhas, cada operação atômica se limita a uma linha — o que significa que qualquer invariante envolvendo duas entidades precisa ser resolvida pela aplicação ou codificada dentro da mesma linha. Sem índices secundários, consultar por qualquer campo que não seja a chave exige varredura ou uma segunda tabela mantida manualmente. Sem joins, denormalização deixa de ser otimização e passa a ser o modo normal de modelar.',
          },
          {
            type: 'p',
            text: 'Essas escolhas ecoam até hoje. A estrutura LSM — escrever em memória, descarregar em arquivos ordenados imutáveis, compactar depois — é a base de praticamente todo motor de armazenamento otimizado para escrita, inclusive dos que vivem embutidos dentro de bancos maiores. E o exercício de projetar a chave para que as consultas virem varreduras contíguas é a mesma disciplina exigida por bancos de chave-valor ordenados modernos, onde continua sendo a decisão que separa um sistema rápido de um caro.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Chave de linha monotonicamente crescente. Usar timestamp ou um contador sequencial como prefixo faz todas as escritas novas caírem no último tablet, criando um hotspot permanente enquanto o resto do cluster fica ocioso. A correção é embaralhar o prefixo — inverter, adicionar hash — sem perder a contiguidade que interessa às consultas.',
          },
        ],
        quiz: [
          {
            q: 'Por que a ordenação lexicográfica das chaves de linha é tão importante?',
            a: 'Porque torna consultas por intervalo eficientes: linhas com prefixo comum ficam fisicamente contíguas e são lidas numa varredura sequencial. Como não há índices secundários, a chave de linha é praticamente o único caminho de acesso — projetá-la é projetar quais consultas serão viáveis.',
          },
          {
            q: 'O que significa o modelo ser "esparso" e por que isso importa?',
            a: 'Que colunas ausentes não ocupam espaço algum. Isso permite que linhas da mesma tabela tenham conjuntos de colunas completamente diferentes, viabilizando esquemas muito largos e irregulares sem desperdício — algo inviável em uma tabela relacional com colunas fixas.',
          },
          {
            q: 'Por que uma chave de linha monotonicamente crescente é problemática?',
            a: 'Porque todas as escritas recentes caem no mesmo tablet — o que contém o fim do intervalo de chaves —, criando um hotspot de escrita permanente enquanto os demais servidores ficam ociosos. O cluster inteiro passa a escalar como uma máquina só.',
          },
        ],
      },
    },
    {
      slug: 'dynamo',
      title: 'Dynamo',
      kind: 'PAPER',
      summary:
        'Disponibilidade acima de tudo: consistent hashing, quóruns e reconciliação por vector clocks.',
      sourceUrl:
        'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
      content: {
        summary:
          'Dynamo escolheu disponibilidade sobre consistência de forma explícita e mostrou como construir um armazenamento sem líder que nunca recusa uma escrita.',
        blocks: [
          {
            type: 'p',
            text: 'O requisito de origem era comercial, não técnico: o carrinho de compras não pode recusar um item. Indisponibilidade de escrita é perda de receita direta, então o sistema deveria aceitar escritas mesmo durante falhas de rede e partições — e resolver a divergência depois.',
          },
          {
            type: 'key',
            text: 'Dynamo é o exemplo mais claro de um sistema AP: durante uma partição, todos os lados continuam aceitando escritas e a reconciliação acontece na leitura. É a escolha oposta à de sistemas baseados em consenso, e igualmente legítima para a carga certa.',
          },
          {
            type: 'p',
            text: 'A arquitetura não tem líder: todos os nós são iguais e qualquer um pode coordenar uma operação. A distribuição usa consistent hashing com nós virtuais, que dá realocação mínima ao adicionar ou remover máquinas e distribui a carga de um nó que cai entre todos os demais.',
          },
          {
            type: 'p',
            text: 'As garantias são ajustáveis por quórum. Com N réplicas, W confirmações para escrever e R para ler, a configuração W + R > N garante que a leitura alcance ao menos uma réplica com o valor mais recente. Baixar W favorece disponibilidade de escrita; baixar R favorece latência de leitura. É o mesmo trade-off do CAP, exposto como parâmetro por operação.',
          },
          {
            type: 'p',
            text: 'Como escritas concorrentes em réplicas diferentes são permitidas, é preciso detectar divergência. Dynamo usa vector clocks: cada versão carrega um contador por nó que a modificou, o que permite distinguir "esta versão descende daquela" de "estas duas versões são concorrentes". No primeiro caso, a mais nova simplesmente vence; no segundo, ambas são devolvidas ao cliente, que decide como fundir — no carrinho, unir os itens dos dois lados, que é a semântica correta do domínio.',
          },
          {
            type: 'p',
            text: 'Para manter as réplicas convergindo, o sistema usa hinted handoff — quando um nó está fora, outro guarda a escrita e a entrega quando ele volta — e árvores de Merkle, que comparam grandes volumes de dados entre réplicas trocando poucos hashes e identificando rapidamente apenas as faixas divergentes.',
          },
          {
            type: 'p',
            text: 'A influência foi enorme: Cassandra, Riak e DynamoDB descendem direta ou indiretamente dessas ideias, e consistent hashing com nós virtuais virou vocabulário básico da área.',
          },
          {
            type: 'h',
            text: 'A restrição que ninguém tinha assumido antes',
          },
          {
            type: 'p',
            text: 'O que havia antes era, em essência, replicação com líder: um nó aceita escritas e os demais copiam. Esse desenho é simples e dá consistência forte, mas tem um custo que só aparece na operação — quando o líder cai, a escrita para até que alguém novo seja eleito, e durante uma partição de rede metade do sistema fica sem poder escrever. Para um catálogo isso é tolerável; para o carrinho de um varejista em pico de vendas, cada segundo de recusa de escrita é receita perdida e um cliente que desiste.',
          },
          {
            type: 'p',
            text: 'A inversão do Dynamo foi transformar disponibilidade em requisito rígido e consistência em parâmetro ajustável, e não o contrário. Isso muda a pergunta de projeto: em vez de "como garantir que ninguém veja um valor antigo?", passa a ser "quais divergências este domínio consegue absorver, e como as resolvo depois?". A resposta depende do dado, não da infraestrutura — e é por isso que a decisão de reconciliação não podia ficar no banco.',
          },
          {
            type: 'p',
            text: 'Também vale entender o que o sistema não entrega. Não há operações entre chaves, não há consulta por qualquer coisa que não seja a chave primária, não há transações. As leituras podem devolver múltiplas versões e obrigar o cliente a lidar com isso, o que complica o código da aplicação de forma real. E os vector clocks crescem com o número de nós que tocaram um valor, exigindo poda — que, mal feita, pode fazer o sistema perder a capacidade de distinguir descendência de concorrência.',
          },
          {
            type: 'p',
            text: 'A herança prática é grande. Consistent hashing com nós virtuais é hoje a técnica padrão para distribuir carga em caches, balanceadores e sharding de aplicação. Quóruns ajustáveis por operação viraram recurso de vários bancos distribuídos. E o problema da reconciliação, que o Dynamo empurrou para o cliente, foi depois atacado por estruturas de dados que convergem por construção — a linha de pesquisa que produziu os CRDTs e que hoje sustenta edição colaborativa e sincronização de aplicativos offline.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Adotar um sistema estilo Dynamo e ignorar a reconciliação. O modelo transfere ao aplicativo a responsabilidade de fundir versões concorrentes, e se ele simplesmente pega uma delas, está descartando escritas silenciosamente. A resolução precisa fazer sentido no domínio — unir conjuntos, somar contadores — ou a disponibilidade foi comprada com perda de dados.',
          },
        ],
        quiz: [
          {
            q: 'O que a configuração W + R > N garante?',
            a: 'Que o conjunto de réplicas consultadas na leitura se sobrepõe ao conjunto que confirmou a escrita mais recente, de modo que a leitura sempre encontre ao menos uma cópia com o valor atual. Ajustar W e R desloca o custo entre latência de escrita e de leitura, sem perder essa sobreposição.',
          },
          {
            q: 'Para que servem os vector clocks no Dynamo?',
            a: 'Para distinguir versões que descendem uma da outra de versões genuinamente concorrentes. Se uma descende da outra, a mais recente prevalece automaticamente. Se são concorrentes — escritas simultâneas em réplicas diferentes —, ambas são devolvidas ao cliente para que ele as funda segundo a semântica do domínio.',
          },
          {
            q: 'Por que árvores de Merkle são eficientes para sincronizar réplicas?',
            a: 'Porque permitem comparar grandes volumes de dados trocando apenas hashes: se a raiz coincide, tudo está igual e nada mais precisa ser transferido. Se difere, a comparação desce pelos ramos divergentes, localizando rapidamente as faixas específicas que precisam ser sincronizadas.',
          },
        ],
      },
    },
    {
      slug: 'paxos-e-raft',
      title: 'Paxos e Raft',
      kind: 'PAPER',
      summary:
        'Consenso tolerante a falhas — o problema difícil, e a versão feita para ser compreensível.',
      sourceUrl: 'https://raft.github.io/raft.pdf',
      content: {
        summary:
          'Paxos resolveu o consenso e ficou famoso por ser incompreensível; Raft resolveu o mesmo problema com o objetivo explícito de ser ensinável — e por isso domina as implementações modernas.',
        blocks: [
          {
            type: 'p',
            text: 'Paxos provou que é possível um grupo de máquinas concordar sobre um valor mesmo com falhas e mensagens perdidas, desde que a maioria esteja disponível. A prova é correta e a exposição, notoriamente difícil: o paper original usa uma alegoria de um parlamento fictício, e por anos a comunidade produziu artigos apenas para explicá-lo. Pior, ele descreve o consenso sobre *um* valor, e sistemas reais precisam de uma sequência ordenada — a extensão para múltiplos valores ficou como exercício, e cada implementação a resolveu à sua maneira.',
          },
          {
            type: 'key',
            text: 'Raft é a demonstração de que a compreensibilidade é um requisito legítimo de projeto. Não resolve nada que Paxos não resolvesse; organiza a solução de forma que uma pessoa consiga implementá-la corretamente — o que, na prática, importa mais.',
          },
          {
            type: 'p',
            text: 'A estratégia do Raft é decompor. Ele separa o problema em eleição de líder, replicação de log e segurança, e trata cada parte de forma independente. E adota uma restrição forte que simplifica tudo: o log flui apenas do líder para os seguidores, nunca o contrário. Um seguidor com log divergente é corrigido para coincidir com o do líder, e não há necessidade de fundir históricos.',
          },
          {
            type: 'p',
            text: 'A eleição usa tempos de espera aleatórios: um seguidor que fica sem notícias do líder por um intervalo sorteado vira candidato e pede votos. A aleatoriedade evita que todos comecem juntos, dividam os votos e travem a eleição. Quem obtém a maioria vira líder e mantém a autoridade com batidas periódicas.',
          },
          {
            type: 'p',
            text: 'A propriedade que garante a segurança é uma regra simples de votação: um nó só vota em candidatos cujo log seja pelo menos tão atualizado quanto o seu. Como qualquer maioria contém pelo menos um nó que possui todas as entradas já confirmadas, um candidato desatualizado nunca reúne votos suficientes — e nenhuma entrada confirmada pode ser perdida.',
          },
          {
            type: 'p',
            text: 'Raft está por baixo de etcd, Consul e da camada de metadados de dezenas de sistemas distribuídos. Na prática, você vai usá-lo com muito mais frequência do que implementá-lo — e essa é a recomendação: consenso é um dos raros casos em que escrever a própria versão é quase sempre um erro, porque os bugs vivem em casos de borda que só aparecem em produção, sob falha, quando você menos quer descobri-los.',
          },
          {
            type: 'h',
            text: 'Por que o problema é difícil',
          },
          {
            type: 'p',
            text: 'Vale entender por que consenso não é trivial, porque a dificuldade não é evidente. O obstáculo é que, numa rede assíncrona, um nó não consegue distinguir uma máquina morta de uma máquina lenta ou de uma rede que engoliu as mensagens. Qualquer decisão baseada em "ele não respondeu, deve ter caído" pode estar errada — e se dois nós concluírem simultaneamente que são o líder, ambos aceitam escritas e o histórico se bifurca. É por isso que toda solução se apoia em maioria: dois conjuntos que somam mais da metade sempre se intersectam, então não podem existir duas maiorias discordantes ao mesmo tempo.',
          },
          {
            type: 'p',
            text: 'Há também um resultado teórico incômodo por trás disso: em um sistema assíncrono onde até um único processo pode falhar, nenhum algoritmo determinístico garante chegar a uma decisão em tempo finito. Os protocolos práticos contornam isso abrindo mão da garantia de terminação em todos os cenários e preservando apenas a segurança — ou seja, eles nunca decidem errado, mas podem, em teoria, demorar indefinidamente. É exatamente esse o papel dos timeouts e da aleatoriedade na eleição: não fazem parte da prova de correção, servem para que o progresso aconteça na prática.',
          },
          {
            type: 'p',
            text: 'Uma consequência frequentemente ignorada é o custo da mudança de configuração. Adicionar ou remover nós de um grupo em consenso não pode ser feito trocando a lista de uma vez, porque durante a troca existiriam duas noções de maioria capazes de decidir independentemente. Tanto Paxos quanto Raft precisam de um mecanismo específico — transição por etapas ou uma fase conjunta — e é justamente aí que implementações caseiras costumam introduzir bugs que só se manifestam durante uma operação de manutenção.',
          },
          {
            type: 'p',
            text: 'A ideia reaparece em quase toda infraestrutura moderna: no armazenamento de configuração de orquestradores de contêiner, na eleição do nó que coordena um shard, no registro de metadados de brokers de mensagem que abandonaram dependências externas de coordenação, e na camada que decide qual réplica é a primária em bancos distribuídos. Quase nunca você implementa consenso; quase sempre você depende de alguém que implementou, e entender o custo de cada decisão coordenada é o que evita colocá-lo onde ele não cabe.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Achar que consenso resolve todos os problemas de coordenação e usá-lo no caminho de dados. Cada operação custa um round-trip até a maioria, o que é aceitável para eleger líder ou guardar configuração e proibitivo para tráfego de aplicação. Consenso é para metadados críticos; os dados fluem por fora.',
          },
        ],
        quiz: [
          {
            q: 'Qual foi a contribuição do Raft, se ele resolve o mesmo problema que Paxos?',
            a: 'Compreensibilidade como objetivo explícito de projeto. Ao decompor o problema em eleição, replicação e segurança, e ao restringir o fluxo do log a uma única direção — do líder para os seguidores —, tornou possível implementar consenso corretamente sem anos de estudo, o que Paxos não permitia na prática.',
          },
          {
            q: 'Por que a regra de "só votar em quem tem log ao menos tão atualizado" garante segurança?',
            a: 'Porque qualquer maioria contém ao menos um nó que possui todas as entradas já confirmadas. Um candidato com log atrasado não obtém voto desse nó e, portanto, nunca alcança a maioria. Assim, todo líder eleito já possui tudo que foi confirmado antes dele, e nenhuma entrada confirmada pode ser sobrescrita.',
          },
          {
            q: 'Por que consenso não deve ficar no caminho de dados?',
            a: 'Porque cada operação exige confirmação de uma maioria, custando ao menos um round-trip até o nó mediano — e latência geográfica se as réplicas estão em regiões diferentes. É um custo aceitável para decisões raras e críticas como eleição e configuração, mas proibitivo para o tráfego de aplicação.',
          },
        ],
      },
    },
    {
      slug: 'spanner',
      title: 'Spanner',
      kind: 'PAPER',
      summary:
        'Transações globais com consistência externa usando incerteza de relógio explícita.',
      sourceUrl:
        'https://research.google/pubs/spanner-googles-globally-distributed-database-2/',
      content: {
        summary:
          'Spanner mostrou que transações fortemente consistentes em escala global são possíveis, tratando a incerteza dos relógios como um valor explícito em vez de fingir que ela não existe.',
        blocks: [
          {
            type: 'p',
            text: 'A crença corrente era que, em escala planetária, seria preciso abrir mão de transações e de consistência forte — a experiência acumulada com sistemas eventualmente consistentes apontava nessa direção. Spanner mostrou o contrário: dá para ter transações distribuídas com ordenação global, desde que se resolva o problema do tempo.',
          },
          {
            type: 'p',
            text: 'O problema do tempo é fundamental. Para ordenar transações globalmente, é preciso saber qual aconteceu antes. Relógios de máquinas diferentes divergem, e a sincronização por rede tem erro de milissegundos. Usar timestamps ingenuamente produz ordenações incorretas, e é por isso que sistemas distribuídos tradicionalmente evitam depender de relógio físico.',
          },
          {
            type: 'key',
            text: 'A inovação foi não esconder a incerteza: em vez de devolver "agora são 10:00:00.000", a API de tempo devolve um intervalo — "agora está entre 10:00:00.000 e 10:00:00.007" — e o sistema raciocina sobre esse intervalo.',
          },
          {
            type: 'p',
            text: 'Isso é possível porque o relógio é ancorado em hardware confiável — receptores GPS e relógios atômicos distribuídos pelos datacenters — o que mantém o intervalo de incerteza pequeno e, crucialmente, *limitado*. Saber o teto do erro é o que permite provar propriedades sobre a ordenação.',
          },
          {
            type: 'p',
            text: 'Com isso, a regra para garantir ordenação correta é quase trivial: ao confirmar uma transação, o sistema espera o tempo de incerteza passar antes de liberar o commit. Depois dessa espera, tem-se certeza de que o timestamp atribuído já passou em qualquer relógio do planeta, então nenhuma transação futura pode receber um timestamp menor. A consistência externa — se A terminou antes de B começar, A tem timestamp menor — sai como consequência.',
          },
          {
            type: 'p',
            text: 'O custo é uma latência adicional a cada commit, proporcional à incerteza do relógio. Investir em hardware de tempo melhor reduz esse número diretamente — uma relação incomum e bonita entre infraestrutura física e desempenho de banco de dados.',
          },
          {
            type: 'p',
            text: 'Uma consequência prática valiosa: leituras num timestamp passado não precisam de lock nem de coordenação. Como cada versão tem timestamp global consistente, ler "o estado de dez minutos atrás" é uma operação local em qualquer réplica, o que torna relatórios e análises consistentes praticamente gratuitos.',
          },
          {
            type: 'h',
            text: 'O que veio antes e o que continua caro',
          },
          {
            type: 'p',
            text: 'O contexto imediato é revelador: a própria empresa havia passado anos empurrando aplicações para armazenamento sem transações e com consistência fraca, e a conta chegou na forma de complexidade dentro de cada aplicação. Times reimplementavam, mal e de formas diferentes, aquilo que uma transação daria de graça — verificação de invariantes, correção de divergências, lógica de reconciliação. Spanner é em boa medida uma resposta a essa experiência: a conclusão de que é mais barato pagar latência no banco do que pagar bugs distribuídos em dezenas de aplicações.',
          },
          {
            type: 'p',
            text: 'Sob o mecanismo de tempo, a estrutura é convencional e vale notar isso. Os dados são particionados, cada partição é replicada e mantida coerente por um grupo em consenso com um líder, e transações que tocam mais de uma partição usam commit em duas fases — com a diferença crucial de que o coordenador não é um ponto único de falha, porque ele mesmo é um grupo replicado. A novidade não está em inventar um protocolo transacional novo, está em tornar o commit em duas fases operacionalmente viável em escala global.',
          },
          {
            type: 'p',
            text: 'O que continua caro é escrever em várias partições distantes. Cada transação distribuída paga consenso em cada grupo envolvido, mais as fases do commit, mais a espera pela incerteza do relógio. Isso torna a modelagem de dados uma decisão de desempenho de primeira ordem: agrupar fisicamente as entidades que costumam ser alteradas juntas transforma a maioria das transações em operações de uma única partição, que são muito mais baratas. A garantia forte existe, mas quem escreve o esquema decide quantas vezes por segundo vai precisar dela.',
          },
          {
            type: 'p',
            text: 'A influência foi imediata e visível: a geração de bancos distribuídos que se apresenta como relacional e escalável horizontalmente adota a mesma estrutura de partições replicadas por consenso, e substitui o relógio de precisão por intervalos de incerteza medidos por software — com esperas maiores e garantias que dependem de o desvio real permanecer dentro do que foi assumido. O legado conceitual mais durável, no entanto, é a postura: quantificar a incerteza e projetar em cima dela é melhor do que fingir precisão que não se tem.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tentar reproduzir a ideia sem a base de hardware. A garantia depende de o intervalo de incerteza ser pequeno e ter um teto conhecido. Com sincronização comum pela internet, a incerteza é grande e ocasionalmente imprevisível — a espera ficaria longa demais e, pior, o teto poderia ser violado sem aviso, quebrando silenciosamente a garantia que se acreditava ter.',
          },
        ],
        quiz: [
          {
            q: 'Qual foi a mudança conceitual central do Spanner em relação ao tempo?',
            a: 'Expor a incerteza em vez de escondê-la: a API devolve um intervalo dentro do qual o instante atual certamente está, em vez de um valor pontual falsamente preciso. Com um limite conhecido para o erro, torna-se possível raciocinar e provar propriedades sobre a ordenação global das transações.',
          },
          {
            q: 'Como a espera no commit garante consistência externa?',
            a: 'Ao aguardar o intervalo de incerteza antes de liberar o commit, o sistema assegura que o timestamp atribuído já passou em qualquer relógio do sistema. Assim, nenhuma transação iniciada depois pode receber timestamp menor, e a ordem dos timestamps coincide com a ordem real dos eventos.',
          },
          {
            q: 'Por que leituras em timestamps passados são baratas no Spanner?',
            a: 'Porque cada versão de dado carrega um timestamp globalmente consistente. Ler o estado de um instante anterior não exige lock nem coordenação entre réplicas — qualquer réplica que tenha as versões daquele período responde localmente, o que torna relatórios consistentes praticamente gratuitos.',
          },
        ],
      },
    },
    {
      slug: 'kafka',
      title: 'Kafka',
      kind: 'PAPER',
      summary: 'O log distribuído como abstração central de integração de dados.',
      sourceUrl: 'https://notes.stephenholiday.com/Kafka.pdf',
      content: {
        summary:
          'Kafka tratou o log append-only como a abstração primária de integração, em vez de tratá-lo como detalhe interno de implementação de um broker.',
        blocks: [
          {
            type: 'p',
            text: 'Brokers tradicionais tratavam mensagens como itens transitórios: entregues, confirmadas, apagadas. O broker rastreava o estado de cada mensagem para cada consumidor, o que é caro e limita a escala. Kafka inverteu: o log é a estrutura primária, as mensagens ficam por um período de retenção independentemente de terem sido consumidas, e o consumidor é quem guarda sua posição.',
          },
          {
            type: 'key',
            text: 'Mover o controle de posição para o consumidor foi a decisão que destravou tudo. O broker deixa de rastrear estado por mensagem e por consumidor, e passa a servir arquivos sequenciais — barato, simples e rápido.',
          },
          {
            type: 'p',
            text: 'As consequências são grandes. Vários consumidores independentes leem o mesmo log em posições diferentes, sem interferência. Um consumidor pode voltar atrás e reprocessar dados históricos — para corrigir um bug, popular um sistema novo ou reconstruir um estado derivado. E um consumidor lento não afeta ninguém: apenas fica para trás.',
          },
          {
            type: 'p',
            text: 'O desempenho vem de escolhas deliberadamente simples. Escrita sequencial em disco, que é ordens de grandeza mais rápida que escrita aleatória e chega a rivalizar com memória. Nenhuma reescrita por consumidor. E transferência direta do arquivo para a rede, sem copiar os dados pelo espaço da aplicação. Kafka é rápido por fazer menos, não por fazer mais.',
          },
          {
            type: 'p',
            text: 'Um tópico é dividido em partições, que são a unidade de paralelismo e de ordenação. A ordem é garantida dentro de uma partição, e a partição é escolhida pelo hash de uma chave — de modo que eventos da mesma entidade chegam em ordem. Dentro de um grupo de consumidores, cada partição é atribuída a um único consumidor, o que combina paralelismo com ordenação por chave.',
          },
          {
            type: 'p',
            text: 'A ideia mais influente do ecossistema é a dualidade entre log e tabela: uma tabela é o estado acumulado de um log de mudanças, e um log é a sequência de alterações de uma tabela. Isso conecta bancos de dados, replicação, CDC e stream processing sob uma mesma abstração — e é o que fez o log virar a espinha dorsal de arquiteturas de dados inteiras.',
          },
          {
            type: 'h',
            text: 'A restrição que gerou o desenho',
          },
          {
            type: 'p',
            text: 'O problema de origem não era mensageria transacional, era coleta de dados de atividade em volume alto: cliques, visualizações, eventos de interface. Esse tráfego tem características próprias — volume ordens de grandeza maior que o de pedidos, valor individual baixo, e vários consumidores independentes querendo o mesmo fluxo para propósitos diferentes: um alimenta o data warehouse, outro o monitoramento, outro a recomendação. Os brokers da época, desenhados para mensagens caras e individualmente importantes, desmoronavam nesse regime.',
          },
          {
            type: 'p',
            text: 'A alternativa praticada antes era ainda pior: cada sistema produzia arquivos de log, e um emaranhado de scripts os copiava periodicamente para os destinos. Isso dava latência de horas, nenhuma garantia de entrega e um grafo de integrações ponto a ponto que crescia quadraticamente com o número de sistemas. A proposta de um log central e compartilhado resolve o problema de integração antes de resolver o de mensageria: cada produtor escreve num lugar, cada consumidor lê de onde quiser, e o número de conexões cresce linearmente.',
          },
          {
            type: 'p',
            text: 'As omissões deliberadas explicam o desempenho. Não há índice por mensagem, não há prioridade, não há seleção por conteúdo, não há reordenação e, na versão original, nem replicação forte havia — a durabilidade vinha do sistema de arquivos e da retenção. Um consumidor só sabe avançar sequencialmente. Cada uma dessas ausências elimina uma estrutura de dados que precisaria ser mantida por mensagem, e é a soma delas que permite o broker se comportar como um arquivo sendo anexado e lido, que é a operação que o hardware faz melhor.',
          },
          {
            type: 'p',
            text: 'A retenção por tempo é uma decisão mais profunda do que parece. Ao desacoplar o descarte do consumo, ela transforma o broker em algo entre canal e armazenamento: dá para adicionar um consumidor novo hoje e fazê-lo processar a última semana de eventos, o que é impossível quando a mensagem some ao ser lida. É essa propriedade que viabiliza reprocessamento após correção de bug, migração de sistemas por releitura do histórico e as arquiteturas que tratam o log como fonte da verdade e as tabelas como projeções dele.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Usar Kafka como fila de tarefas comum. Ele não tem confirmação por mensagem individual nem redistribuição de itens que falharam: o consumidor avança um offset sequencial. Uma mensagem problemática no meio da partição bloqueia o progresso ou é pulada, e não existe reentrega seletiva. Para tarefas com repetição individual e fila morta, um broker de fila tradicional é a ferramenta certa.',
          },
        ],
        quiz: [
          {
            q: 'Por que mover o controle de posição para o consumidor foi tão importante?',
            a: 'Porque libera o broker de rastrear o estado de cada mensagem para cada consumidor, que é o que limitava a escala dos brokers tradicionais. O broker passa a apenas anexar e servir arquivos sequenciais, enquanto múltiplos consumidores leem o mesmo log em posições distintas — inclusive voltando atrás para reprocessar.',
          },
          {
            q: 'Qual o papel das partições em relação à ordenação?',
            a: 'A ordem é garantida apenas dentro de uma partição. Como a partição é escolhida pelo hash de uma chave, todos os eventos de uma mesma entidade caem na mesma partição e chegam em ordem, enquanto entidades diferentes são processadas em paralelo. Escolher a chave é escolher qual ordenação o sistema garante.',
          },
          {
            q: 'Por que Kafka não é adequado como fila de tarefas?',
            a: 'Porque não há confirmação nem reentrega por mensagem individual: o consumidor avança um offset sequencial. Uma mensagem que falha repetidamente bloqueia o avanço da partição ou é pulada, sem redistribuição seletiva nem fila morta nativa por item — recursos que um broker de fila tradicional oferece.',
          },
        ],
      },
    },
    {
      slug: 'zookeeper',
      title: 'ZooKeeper',
      kind: 'PAPER',
      summary:
        'Coordenação distribuída como serviço: locks, eleição e configuração compartilhada.',
      sourceUrl:
        'https://www.usenix.org/legacy/event/atc10/tech/full_papers/Hunt.pdf',
      content: {
        summary:
          'ZooKeeper transformou coordenação distribuída em serviço reutilizável, oferecendo primitivas simples sobre as quais locks, eleição e descoberta podem ser construídos com segurança.',
        blocks: [
          {
            type: 'p',
            text: 'A observação por trás do sistema é que quase todo sistema distribuído precisa das mesmas poucas coisas: eleger um líder, saber quem está vivo, guardar configuração compartilhada e coordenar acesso exclusivo. Cada projeto reimplementava isso — e implementações caseiras de coordenação são notoriamente sujeitas a bugs sutis que só aparecem sob falha.',
          },
          {
            type: 'key',
            text: 'A decisão de projeto mais interessante foi não oferecer locks ou eleição diretamente. ZooKeeper expõe um punhado de primitivas de baixo nível, cuidadosamente escolhidas, e as receitas de alto nível são construídas sobre elas.',
          },
          {
            type: 'p',
            text: 'A interface é um sistema de arquivos hierárquico em memória, com nós pequenos que guardam dados. Três propriedades fazem o resto funcionar. Nós efêmeros existem enquanto a sessão do cliente estiver viva e desaparecem sozinhos quando ela cai — o que dá detecção de falha automática, sem processo de limpeza. Nós sequenciais recebem um sufixo numérico crescente atribuído pelo servidor, o que dá ordenação global. E watches notificam o cliente quando um nó muda, dispensando polling.',
          },
          {
            type: 'p',
            text: 'Com essas três peças, a eleição de líder cai por gravidade: cada candidato cria um nó efêmero e sequencial; quem receber o menor número é o líder; os demais observam o nó imediatamente anterior ao seu. Se o líder cai, seu nó efêmero some, o próximo da fila é notificado e assume. Não há votação, timeout nem lógica complexa — a semântica das primitivas produz o comportamento.',
          },
          {
            type: 'p',
            text: 'Internamente, o ZooKeeper usa um protocolo de consenso próprio, o Zab, com garantias fortes: escritas são ordenadas globalmente e passam pelo líder. Leituras, por padrão, são atendidas localmente por qualquer réplica e podem estar levemente atrasadas — um detalhe importante, porque significa que ler não garante ver a escrita mais recente a menos que se peça sincronização explícita.',
          },
          {
            type: 'p',
            text: 'O sistema é deliberadamente limitado: destina-se a metadados pequenos e alta taxa de leitura, não a armazenamento de dados. Cada nó guarda kilobytes, e o conjunto todo cabe em memória. Usá-lo como banco é o caminho mais rápido para degradar o cluster inteiro — e, com ele, todos os sistemas que dependem da coordenação.',
          },
          {
            type: 'h',
            text: 'Por que primitivas em vez de serviços prontos',
          },
          {
            type: 'p',
            text: 'A alternativa disponível antes eram bibliotecas de comunicação em grupo, que ofereciam abstrações fortes de pertencimento e entrega ordenada a todos os membros. Elas funcionavam, mas acoplavam a aplicação a um modelo específico e escalavam mal com muitos clientes. A aposta do ZooKeeper foi oposta: expor um núcleo minúsculo e deixar que cada aplicação componha a semântica de que precisa. Um serviço de lock pronto teria que escolher um comportamento em caso de expiração de sessão, e essa escolha nunca serve a todos os domínios — deixando as primitivas expostas, cada um decide.',
          },
          {
            type: 'p',
            text: 'A restrição concreta é a proporção entre leitura e escrita. Coordenação é dominada por consultas — quem é o líder, quais nós estão vivos, qual é a configuração atual — e escritas são comparativamente raras. Por isso as leituras não passam por consenso e são servidas localmente por qualquer réplica: é o que permite adicionar servidores para aumentar a capacidade de leitura. A contrapartida é que adicionar servidores torna a escrita mais lenta, já que a maioria fica maior, e é por isso que esses conjuntos costumam ter três ou cinco nós, não vinte.',
          },
          {
            type: 'p',
            text: 'As garantias oferecidas são deliberadamente estranhas até para quem já conhece consenso, e vale enunciá-las: escritas são totalmente ordenadas, um cliente enxerga seus próprios efeitos em ordem, e nunca se observa o estado retroceder — mas nada garante que uma leitura veja a escrita que outro cliente acabou de fazer. Duas aplicações podem, no mesmo instante, enxergar líderes diferentes se uma delas está falando com uma réplica atrasada. Quem construir uma receita ignorando esse detalhe produz código que funciona nos testes e falha sob carga.',
          },
          {
            type: 'p',
            text: 'O padrão se consolidou de tal forma que a arquitetura virou lugar-comum: sistemas distribuídos passaram a delegar a um serviço externo de coordenação a eleição, a descoberta e a configuração, mantendo o próprio núcleo livre de consenso. O movimento mais recente é de reinternalização — vários projetos incorporaram uma implementação de consenso própria para eliminar a dependência operacional de mais um cluster para manter de pé. A ideia permanece; o que mudou foi onde ela é executada.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tratar o lock obtido via nó efêmero como garantia absoluta. Se a sessão do cliente expira por uma pausa longa ou por lentidão de rede, o nó some e outro cliente adquire o lock — enquanto o primeiro ainda acredita possuí-lo. Vale a mesma regra dos locks distribuídos em geral: a proteção real vem de fencing token verificado pelo recurso.',
          },
        ],
        quiz: [
          {
            q: 'Por que ZooKeeper oferece primitivas em vez de locks e eleição prontos?',
            a: 'Porque um conjunto pequeno e bem escolhido de primitivas — nós efêmeros, sequenciais e watches — permite construir várias receitas de coordenação diferentes com semântica correta, mantendo o núcleo do sistema simples e auditável. As receitas de alto nível ficam em bibliotecas cliente, fora do caminho crítico.',
          },
          {
            q: 'Como eleição de líder se resolve com nós efêmeros e sequenciais?',
            a: 'Cada candidato cria um nó efêmero e sequencial; o de menor número é o líder, e cada um dos demais observa o nó imediatamente anterior ao seu. Se o líder falha, sua sessão expira, o nó efêmero desaparece e o próximo da sequência é notificado e assume — sem votação nem timeouts na aplicação.',
          },
          {
            q: 'Por que usar ZooKeeper para armazenar dados de aplicação é perigoso?',
            a: 'Porque ele foi desenhado para metadados pequenos mantidos inteiramente em memória e replicados por consenso. Volumes maiores degradam a latência de todas as operações de coordenação e, como muitos sistemas dependem dele para eleição e descoberta, essa degradação se propaga para o cluster inteiro.',
          },
        ],
      },
    },
  ],
};

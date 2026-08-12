import type { ModuleSeed } from '../types';

export const tradeoffs: ModuleSeed = {
  slug: 'tradeoffs',
  title: 'Tradeoffs',
  goal: 'Ter na ponta da língua as decisões recorrentes de arquitetura e saber defender cada lado com argumentos concretos.',
  lessons: [
    {
      slug: 'vertical-vs-horizontal',
      title: 'Escala vertical vs horizontal',
      summary: 'Máquina maior ou mais máquinas: custo, teto e complexidade.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Escalar verticalmente é simples e tem teto; escalar horizontalmente é ilimitado e cobra em complexidade distribuída. A escolha depende de onde está o gargalo e do tamanho do time.',
        blocks: [
          {
            type: 'p',
            text: 'Escalar verticalmente é trocar a máquina por uma maior. Não exige mudança de código, não introduz nenhum modo de falha novo e resolve mais problemas do que a conversa de corredor admite: máquinas atuais chegam a centenas de núcleos e vários terabytes de memória, capacidade que a maioria absoluta das empresas nunca vai esgotar.',
          },
          {
            type: 'p',
            text: 'Os limites são dois. O físico: existe uma maior máquina disponível, e depois dela não há para onde ir. E o econômico: o preço cresce mais rápido que a capacidade, de modo que o topo da linha custa desproporcionalmente caro por unidade de desempenho. Há ainda o limite operacional que quase ninguém menciona — trocar de máquina costuma exigir reinício, e a máquina única continua sendo um ponto de falha por mais potente que seja.',
          },
          {
            type: 'key',
            text: 'A pergunta que decide não é "qual escala mais?", e sim "onde está o gargalo e quanto custa cada caminho?". Duplicar servidores web não adianta nada se o gargalo é o banco — e nesse caso a máquina maior pode ser a única saída rápida.',
          },
          {
            type: 'p',
            text: 'Escalar horizontalmente adiciona máquinas em paralelo. Não tem teto teórico, usa hardware comum e melhora a tolerância a falhas: perder um nó entre trinta é um não-evento. O custo é toda a complexidade de distribuição — balanceamento, estado compartilhado, consistência, falhas parciais e a coordenação que faz a curva de ganho se afastar da linearidade.',
          },
          {
            type: 'table',
            head: ['Critério', 'Vertical', 'Horizontal'],
            rows: [
              ['Mudança de código', 'Nenhuma', 'Stateless, sessão externa, sharding'],
              ['Teto', 'A maior máquina existente', 'Praticamente nenhum'],
              ['Custo por unidade', 'Cresce no topo da linha', 'Aproximadamente linear'],
              ['Tolerância a falhas', 'Ruim — SPOF', 'Boa — perder um nó é aceitável'],
              ['Escalar em produção', 'Normalmente exige reinício', 'Adiciona nós sem downtime'],
              ['Componente típico', 'Banco relacional primário', 'Servidores de aplicação'],
            ],
          },
          {
            type: 'p',
            text: 'Na prática, os sistemas reais combinam os dois por camada. Aplicação stateless escala horizontalmente sem esforço. O banco primário, que aceita escritas, costuma escalar verticalmente até doer, porque distribuí-lo exige sharding — a mudança mais cara e mais difícil de reverter da arquitetura de dados.',
          },
          {
            type: 'h',
            text: 'Por que dobrar os nós não dobra a vazão',
          },
          {
            type: 'p',
            text: 'A lei de Amdahl descreve o teto do ganho quando parte do trabalho é inerentemente serial. Se 5% de cada requisição passa por um trecho que não paraleliza — adquirir um lock, gravar numa sequência única, aguardar o mesmo primário — o ganho máximo é de 20 vezes, por mais nós que se adicione. Com 10% de trecho serial, o teto cai para 10 vezes. Em sistemas reais essa fração serial raramente é medida, e é ela que explica por que a vigésima máquina entrega bem menos que a segunda.',
          },
          {
            type: 'p',
            text: 'Há um agravante que Amdahl não captura: coordenação não apenas deixa de ajudar, ela custa. Cada nó novo aumenta o número de pares que precisam trocar heartbeat, invalidar cache, disputar o mesmo lock ou concorrer pelas mesmas conexões do banco. A partir de certo ponto, a curva de vazão para de subir e começa a descer — adicionar máquinas piora o sistema. Reconhecer que existe um número ótimo de nós, e que ele não é infinito, é o que separa a discussão madura da conversa de brochura.',
          },
          {
            type: 'p',
            text: 'É por isso que a pergunta útil na entrevista não é "vertical ou horizontal", e sim "o que exatamente impede este componente de escalar horizontalmente?". As respostas costumam ser poucas e concretas: estado em memória local, uma sequência global, uma transação que abrange registros de partições diferentes, uma restrição de unicidade sobre todo o conjunto, ou um índice secundário que exige varrer todos os shards. Cada uma dessas amarras tem uma saída conhecida, e nomeá-la é mais valioso que apontar a estratégia genérica.',
          },
          {
            type: 'p',
            text: 'Sobre custo, vale ser específico. O preço por núcleo costuma ser razoavelmente estável na faixa média das famílias de máquina e dispara nos maiores tamanhos, onde se paga também por soquetes adicionais, memória de altíssima densidade e disponibilidade limitada. Só que o cálculo honesto compara esse prêmio de hardware com meses de engenharia para particionar, com a lentidão permanente que a distribuição impõe às consultas que antes eram um join local e com o risco de uma migração de dados que não tem botão de desfazer. Muitas vezes a máquina cara é a opção barata.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Distribuir antes de esgotar o caminho simples. Sharding, filas e serviços separados custam meses e criam modos de falha permanentes para resolver um problema que uma máquina do dobro do tamanho resolveria numa tarde. Meça, encontre o gargalo real, e só distribua o que já provou não caber.',
          },
        ],
        quiz: [
          {
            q: 'Por que o banco primário costuma ser o último componente a escalar horizontalmente?',
            a: 'Porque distribuir escritas exige sharding, que quebra joins, transações multi-registro e unicidade global, além de amarrar o sistema a uma chave de partição difícil de mudar depois. Réplicas resolvem leitura, mas não escrita. Por isso vale escalar verticalmente o primário enquanto for possível.',
          },
          {
            q: 'Quando escalar verticalmente é a decisão tecnicamente correta, e não apenas preguiçosa?',
            a: 'Quando a carga cabe com folga na maior máquina viável, quando o time é pequeno e a complexidade distribuída custaria mais que o hardware, e quando o gargalo está num componente difícil de distribuir. Nesses casos o hardware é a solução mais barata em tempo de engenharia e em risco.',
          },
        ],
      },
    },
    {
      slug: 'concorrencia-vs-paralelismo',
      title: 'Concorrência vs paralelismo',
      summary:
        'Lidar com várias coisas ao mesmo tempo não é o mesmo que executá-las ao mesmo tempo.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Concorrência é estruturar o programa para lidar com várias tarefas em progresso; paralelismo é executá-las simultaneamente em múltiplos núcleos. Uma é sobre design, a outra sobre hardware.',
        blocks: [
          {
            type: 'p',
            text: 'Concorrência é uma propriedade da estrutura do programa: várias tarefas estão em andamento, intercaladas, e o progresso de uma não depende de a outra terminar. Paralelismo é uma propriedade da execução: várias tarefas rodam de fato no mesmo instante, em núcleos diferentes. Um programa concorrente com um único núcleo não tem paralelismo nenhum — e ainda assim ganha muito.',
          },
          {
            type: 'key',
            text: 'Concorrência ataca tempo de espera; paralelismo ataca tempo de cálculo. Se as tarefas passam a maior parte do tempo esperando rede ou disco, concorrência resolve mesmo com um núcleo. Se elas passam o tempo calculando, só mais núcleos ajudam.',
          },
          {
            type: 'p',
            text: 'Essa distinção decide a arquitetura de qualquer servidor. Uma requisição web típica é dominada por espera: consulta ao banco, chamada a outro serviço, leitura de cache. Com um modelo bloqueante, cada requisição ocupa uma thread parada esperando — e threads são caras, então mil requisições simultâneas exigem mil threads e muita memória. Com um modelo assíncrono, a thread devolve o controle enquanto espera e atende outra requisição, de modo que um punhado de threads sustenta milhares de conexões.',
          },
          {
            type: 'p',
            text: 'É por isso que runtimes de I/O assíncrono se destacam em servidores de API e mal aparecem em processamento numérico: eles multiplicam a capacidade de esperar, não a de calcular. Para trabalho intensivo em CPU, o caminho é distribuir entre núcleos ou processos.',
          },
          {
            type: 'table',
            head: ['Situação', 'O que resolve', 'Ferramenta típica'],
            rows: [
              ['Milhares de conexões esperando I/O', 'Concorrência', 'Async/await, event loop, corrotinas'],
              ['Processar um array grande', 'Paralelismo', 'Múltiplos núcleos, threads de trabalho'],
              ['Chamar 5 serviços independentes', 'Concorrência', 'Executar em conjunto e aguardar todos'],
              ['Compilar, transcodificar, treinar modelo', 'Paralelismo', 'Processos por núcleo, GPU'],
            ],
          },
          {
            type: 'p',
            text: 'Um ganho de concorrência que aparece o tempo todo e é frequentemente esquecido: chamadas independentes feitas em sequência. Cinco chamadas de 40ms cada, uma após a outra, custam 200ms; disparadas juntas e aguardadas em conjunto, custam 40ms. Não é preciso mais nenhum núcleo — apenas parar de esperar uma coisa de cada vez.',
          },
          {
            type: 'h',
            text: 'Os três modelos e onde cada um quebra',
          },
          {
            type: 'p',
            text: 'Threads do sistema operacional são o modelo mais antigo e o mais fácil de escrever: o código é sequencial e o escalonador do kernel intercala tudo. O custo é que cada thread reserva pilha própria — tipicamente na casa de um megabyte — e toda troca de contexto passa pelo kernel, salvando registradores e sujando os caches da CPU. Alguns milhares de threads já consomem gigabytes só de pilha, e o tempo gasto trocando de contexto começa a rivalizar com o tempo gasto trabalhando. É o modelo que quebra primeiro quando o número de conexões cresce.',
          },
          {
            type: 'p',
            text: 'O event loop inverte a estrutura: uma única thread mantém um registro de operações pendentes e reage a eventos de conclusão vindos do sistema operacional. O custo por conexão cai para o tamanho de um objeto de callback, e a troca entre tarefas não envolve o kernel. O preço é que o modelo é cooperativo — nada tira a vez de ninguém. Qualquer trecho que não devolva o controle bloqueia todas as conexões ao mesmo tempo, e o sintoma é a latência de cauda subir para todo mundo enquanto a CPU média parece confortável.',
          },
          {
            type: 'p',
            text: 'Corrotinas e threads virtuais são a tentativa de ficar com as duas coisas: código aparentemente sequencial, sem callbacks explícitos, mas com suspensão barata em espaço de usuário e milhões de tarefas por processo. A armadilha aqui é sutil — chamadas bloqueantes escondidas dentro de bibliotecas antigas, drivers nativos ou trechos que seguram um monitor do sistema não suspendem a corrotina, elas prendem a thread portadora. O modelo parece leve até que uma dependência qualquer volta a se comportar como thread do kernel.',
          },
          {
            type: 'p',
            text: 'Um detalhe que fecha a diferença entre os dois eixos: concorrência introduz intercalação, e intercalação introduz corridas. Duas tarefas que leem e escrevem o mesmo contador podem se atrapalhar mesmo num único núcleo, porque o ponto de suspensão cai no meio da operação. Já paralelismo real acrescenta um problema que não existia — visibilidade entre caches de núcleos diferentes, que é por que existem barreiras de memória e operações atômicas. Concorrência sem paralelismo já exige disciplina; com paralelismo, exige também entender o modelo de memória.',
          },
          {
            type: 'p',
            text: 'Na prática há um limite de utilidade que aparece na medição: acima de determinado nível de paralelismo, a vazão para de crescer e a latência começa a subir, porque as tarefas passam a disputar cache, memória e disco. É por isso que pools de conexão com o banco costumam ser pequenos — algo próximo de duas vezes o número de núcleos do servidor de banco —, e ampliá-los normalmente piora o tempo de resposta em vez de melhorar. Mais paralelismo só ajuda até o recurso escasso saturar.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Adotar um framework assíncrono e bloquear o event loop com trabalho de CPU. Uma única operação pesada e síncrona — parsear um JSON gigante, calcular um hash caro — trava a thread que atende todas as conexões, e a latência de *todo mundo* dispara. Em runtimes de loop único, trabalho intensivo de CPU precisa ir para um worker separado.',
          },
        ],
        quiz: [
          {
            q: 'Por que um modelo assíncrono sustenta muito mais conexões que um bloqueante?',
            a: 'Porque no modelo bloqueante cada conexão prende uma thread enquanto espera I/O, e threads consomem memória e custam troca de contexto. No assíncrono, a thread devolve o controle durante a espera e atende outra conexão, de modo que poucas threads cobrem milhares de conexões que estão majoritariamente ociosas.',
          },
          {
            q: 'Concorrência ajuda num programa que só faz cálculo pesado num único núcleo?',
            a: 'Praticamente não. Concorrência elimina tempo ocioso de espera, e um programa limitado por CPU não tem espera a eliminar — intercalar tarefas apenas adiciona troca de contexto. O ganho nesse caso vem de paralelismo real: distribuir o cálculo entre múltiplos núcleos ou máquinas.',
          },
          {
            q: 'Por que bloquear o event loop é tão grave?',
            a: 'Porque em runtimes de loop único a mesma thread atende todas as conexões. Uma operação síncrona pesada impede o loop de processar qualquer outro evento durante sua execução, então a latência sobe para todos os clientes simultaneamente — não só para quem disparou a operação cara.',
          },
        ],
      },
    },
    {
      slug: 'long-polling-vs-websockets',
      title: 'Long polling vs WebSockets vs SSE',
      summary:
        'Três formas de o servidor empurrar dados, com custos de conexão bem diferentes.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Quando o servidor precisa iniciar a comunicação, escolhe-se entre segurar requisições (long polling), manter um canal unidirecional (SSE) ou um canal full-duplex (WebSocket).',
        blocks: [
          {
            type: 'p',
            text: 'Polling comum é o ponto de partida: o cliente pergunta a cada N segundos se há novidade. É trivial e funciona em qualquer lugar, mas desperdiça — a maior parte das respostas é "nada mudou" — e ainda assim entrega a informação com até N segundos de atraso. Piora nos dois eixos conforme a base cresce: mais clientes significam mais requisições vazias, e reduzir o atraso multiplica esse número.',
          },
          {
            type: 'p',
            text: 'Long polling melhora mantendo a requisição aberta até haver novidade ou até um timeout. O cliente recebe a informação assim que ela existe, sem requisições vazias. O custo é uma conexão e um handler ocupados por cliente, e o ciclo de reabertura a cada mensagem entregue — o que fica pesado quando as mensagens são frequentes.',
          },
          {
            type: 'p',
            text: 'SSE mantém uma conexão HTTP aberta pela qual o servidor envia uma sequência de eventos em texto. É unidirecional, o que cobre a maioria dos casos reais — notificações, progresso de tarefa, feed ao vivo, atualização de dashboard. Como roda sobre HTTP comum, atravessa proxies e balanceadores sem configuração especial, e o navegador reconecta sozinho após uma queda, retomando de onde parou pelo último id recebido.',
          },
          {
            type: 'p',
            text: 'WebSocket estabelece um canal full-duplex sobre uma conexão TCP persistente, com overhead mínimo por mensagem em ambas as direções. É a escolha certa quando o cliente também envia com frequência: chat, jogos, edição colaborativa, ferramentas de desenho compartilhado.',
          },
          {
            type: 'key',
            text: 'A pergunta que resolve a escolha: o cliente precisa *enviar* com frequência? Se não, SSE entrega o mesmo resultado com uma fração da complexidade operacional de um WebSocket.',
          },
          {
            type: 'table',
            head: ['Técnica', 'Direção', 'Latência', 'Complexidade'],
            rows: [
              ['Polling', 'Cliente pergunta', 'Até o intervalo', 'Mínima'],
              ['Long polling', 'Servidor responde quando há', 'Imediata', 'Baixa'],
              ['SSE', 'Servidor → cliente, contínuo', 'Imediata', 'Baixa'],
              ['WebSocket', 'Bidirecional', 'Imediata', 'Alta — estado, escala, deploy'],
            ],
          },
          {
            type: 'p',
            text: 'A complexidade das duas últimas não está em abrir a conexão — está em operá-la. Conexões persistentes tornam o serviço stateful: cada cliente fica preso a uma instância. Entregar uma mensagem a alguém conectado em outra instância exige um pub/sub interno para rotear. Um deploy desconecta todos os clientes daquela instância de uma vez, produzindo uma onda de reconexões que precisa de backoff e jitter para não virar um pico. E o limite de escala deixa de ser requisições por segundo e passa a ser conexões simultâneas.',
          },
          {
            type: 'h',
            text: 'O que morde na operação',
          },
          {
            type: 'p',
            text: 'Conexões ociosas não sobrevivem sozinhas. Balanceadores, proxies reversos e NATs domésticos derrubam sessões TCP sem tráfego, tipicamente entre trinta segundos e alguns minutos, e o cliente frequentemente não percebe: a conexão parece aberta e simplesmente nada mais chega. Por isso todo canal persistente precisa de um sinal periódico — ping do WebSocket ou comentário de keep-alive no SSE — em intervalo menor que o timeout mais curto do caminho. Sem isso, o sintoma clássico é o usuário parar de receber atualizações sem nenhum erro visível.',
          },
          {
            type: 'p',
            text: 'Há também um limite prático de conexões por cliente que costuma passar despercebido. O SSE roda sobre HTTP comum, e sobre HTTP/1.1 o navegador permite apenas seis conexões simultâneas por domínio — se o usuário abre várias abas, as últimas ficam simplesmente penduradas esperando uma vaga. Sobre HTTP/2 e HTTP/3 o problema desaparece, porque os fluxos são multiplexados numa única conexão. É um detalhe de infraestrutura que decide se a solução funciona ou não em produção.',
          },
          {
            type: 'p',
            text: 'Do lado do servidor, o custo por conexão aberta é dominado pelos buffers de socket e pelo estado da sessão, não por CPU. Uma instância bem configurada sustenta centenas de milhares de conexões majoritariamente ociosas, desde que o modelo de concorrência não gaste uma thread por cliente. O que realmente derruba não é o número de conexões, e sim uma difusão simultânea para todas elas: um evento que precisa alcançar cem mil clientes ao mesmo tempo produz um pico de escrita que satura a placa de rede e faz a latência disparar.',
          },
          {
            type: 'p',
            text: 'Vale ainda distinguir entrega de recebimento. Escrever no socket não significa que o cliente processou a mensagem; ele pode estar com a tela em segundo plano, com a rede móvel oscilando ou prestes a reconectar. Canais persistentes por si só não dão garantia nenhuma de entrega. Quando a mensagem importa, o padrão é o mesmo do chat: numerar os eventos por canal e deixar o cliente informar, ao reconectar, o último número que recebeu — o que o SSE já formaliza com o cabeçalho de retomada por último id.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Escolher WebSocket por reflexo quando o fluxo é só de descida. Paga-se toda a complexidade operacional — roteamento entre instâncias, heartbeat, reconexão, deploy cuidadoso — para obter exatamente o que SSE entrega sobre HTTP comum, com reconexão automática de fábrica. Reserve o WebSocket para quando houver tráfego real do cliente para o servidor.',
          },
        ],
        quiz: [
          {
            q: 'Quando SSE é suficiente e WebSocket é excesso?',
            a: 'Sempre que a comunicação for essencialmente do servidor para o cliente — notificações, progresso, feed, dashboards. SSE roda sobre HTTP comum, atravessa proxies sem configuração e reconecta automaticamente retomando pelo último id. WebSocket só se justifica quando o cliente também envia mensagens com frequência.',
          },
          {
            q: 'Por que conexões persistentes tornam o deploy mais delicado?',
            a: 'Porque cada conexão prende um cliente a uma instância específica. Derrubar uma instância desconecta todos os seus clientes simultaneamente, gerando uma onda de reconexões que pode sobrecarregar as instâncias restantes. É preciso drenagem gradual e reconexão com backoff e jitter no cliente.',
          },
          {
            q: 'Qual a desvantagem do long polling frente ao SSE quando as mensagens são frequentes?',
            a: 'Cada mensagem entregue encerra a requisição e obriga o cliente a abrir outra, pagando o ciclo de requisição repetidamente. Com SSE, a mesma conexão permanece aberta e transporta uma sequência contínua de eventos, sem custo de reabertura por mensagem.',
          },
        ],
      },
    },
    {
      slug: 'batch-vs-stream',
      title: 'Batch vs stream',
      summary:
        'Processar tudo de uma vez ou item a item: latência contra simplicidade e custo.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Processamento em lote roda sobre um conjunto finito de dados acumulados; processamento em stream trata cada evento à medida que chega. A escolha define a latência do resultado e a complexidade do sistema.',
        blocks: [
          {
            type: 'p',
            text: 'Batch opera sobre um conjunto delimitado: os pedidos de ontem, os arquivos da última hora. Como a entrada é finita e conhecida, o processamento é fácil de raciocinar — dá para reprocessar tudo, comparar resultados, corrigir um bug e rodar de novo sobre exatamente os mesmos dados. Falhas são triviais de tratar: reexecuta-se o lote.',
          },
          {
            type: 'p',
            text: 'Stream opera sobre um fluxo sem fim. Cada evento é processado assim que chega, e o resultado está sempre atualizado. Isso reduz a latência de horas para segundos, e habilita coisas que batch não faz: detectar fraude durante a transação, atualizar um painel ao vivo, disparar um alerta no momento do evento.',
          },
          {
            type: 'key',
            text: 'A dificuldade do stream não é processar rápido — é lidar com o tempo. Num fluxo infinito não existe "todos os dados chegaram", então toda agregação precisa decidir quando parar de esperar por eventos atrasados.',
          },
          {
            type: 'h',
            text: 'Janelas e eventos atrasados',
          },
          {
            type: 'p',
            text: 'Para agregar num fluxo infinito, recorta-se o tempo em janelas: contar pedidos por minuto, somar valores das últimas cinco horas. O problema é que a rede entrega fora de ordem e clientes ficam offline, então um evento carimbado às 10h01 pode chegar às 10h07 — depois de a janela do minuto já ter sido fechada e reportada.',
          },
          {
            type: 'p',
            text: 'Daí a distinção crucial entre tempo do evento (quando aconteceu) e tempo de processamento (quando chegou). Agregar por tempo de processamento é simples e dá respostas erradas sempre que há atraso. Agregar por tempo do evento é correto, mas exige decidir quanto esperar — o mecanismo de watermark, que declara "não espero mais eventos anteriores a este ponto" — e o que fazer com o que chegar depois: descartar, corrigir retroativamente ou mandar para um fluxo lateral.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Batch', 'Stream'],
            rows: [
              ['Latência do resultado', 'Minutos a horas', 'Segundos'],
              ['Reprocessar', 'Trivial — rode de novo', 'Difícil — precisa reproduzir o fluxo'],
              ['Tratar falha', 'Reexecutar o lote', 'Checkpoint e retomada de offset'],
              ['Eventos fora de ordem', 'Irrelevante — tudo já chegou', 'Problema central'],
              ['Custo de operar', 'Baixo', 'Alto — sistema sempre no ar'],
            ],
          },
          {
            type: 'p',
            text: 'É por isso que muitas organizações mantêm os dois caminhos: o stream entrega o número aproximado agora, e um lote noturno recalcula o número correto sobre os dados completos, corrigindo o que ficou de fora. A alternativa moderna é usar o mesmo motor para ambos, tratando o lote como um stream limitado, o que elimina manter duas implementações da mesma lógica.',
          },
          {
            type: 'h',
            text: 'Estado, checkpoint e o custo real de operar',
          },
          {
            type: 'p',
            text: 'O que torna streaming caro não é o volume, é o estado. Uma contagem por janela de cinco minutos, mantida para milhões de chaves, é um mapa grande que precisa sobreviver a reinícios, deploys e perda de máquina. A resposta padrão é o checkpoint periódico: o motor salva o estado das agregações junto com a posição de leitura no fluxo, de modo que a retomada reprocesse apenas o intervalo desde o último ponto salvo. Isso significa que checkpoint mais frequente reduz o retrabalho na falha e aumenta o custo constante em regime normal.',
          },
          {
            type: 'p',
            text: 'Aí entra a garantia de entrega, que é onde a maioria das discussões escorrega. Um pipeline com retomada por checkpoint reprocessa eventos já vistos após uma falha, então "pelo menos uma vez" é o padrão barato — e ele duplica contagens. Chegar a efeito exatamente uma vez exige que o estado e a posição de leitura avancem de forma atômica, e que a saída seja idempotente ou transacional. Note a distinção que vale citar numa entrevista: processamento exatamente uma vez é atingível dentro do motor; entrega exatamente uma vez para um sistema externo só existe se aquele destino aceitar uma chave de deduplicação.',
          },
          {
            type: 'p',
            text: 'A escolha da chave de particionamento é a outra decisão que define o desempenho. O motor distribui os eventos por partição segundo essa chave, e agregar por chave exige que todos os eventos dela caiam na mesma partição. Se uma chave concentra tráfego desproporcional — um produto em promoção, um cliente gigante —, a partição correspondente vira o gargalo do pipeline inteiro enquanto as outras ficam ociosas. As saídas usuais são adicionar um sufixo aleatório à chave quente e agregar em duas etapas, ou tratar as chaves mais pesadas por um caminho separado.',
          },
          {
            type: 'p',
            text: 'Existe ainda o meio-termo que resolve muita coisa sem streaming de verdade: micro-lotes. Rodar o mesmo processamento de lote a cada um ou cinco minutos entrega latência boa o bastante para a maioria dos painéis e alertas, e preserva quase toda a simplicidade do batch — reprocessar continua sendo rodar de novo, e não há watermark nem estado distribuído para manter. Numa entrevista, propor micro-lote antes de propor um motor de stream completo demonstra exatamente o tipo de calibragem de custo que se espera.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Migrar para stream sem precisar da latência. Se o resultado é consumido em um relatório que alguém lê de manhã, um lote noturno entrega o mesmo valor com uma fração do custo operacional — sem estado distribuído, sem watermark, sem checkpoint, sem sistema que precisa ficar de pé ininterruptamente. Streaming se justifica quando a decisão precisa acontecer enquanto o evento ainda importa.',
          },
        ],
        quiz: [
          {
            q: 'Por que a distinção entre tempo do evento e tempo de processamento é central em streaming?',
            a: 'Porque eventos chegam atrasados e fora de ordem. Agregar pelo tempo de chegada é simples mas atribui o evento à janela errada, distorcendo o resultado. Agregar pelo tempo em que o evento ocorreu dá o número correto, mas exige decidir quanto tempo esperar por retardatários e o que fazer com quem chega depois.',
          },
          {
            q: 'O que é um watermark e qual problema ele resolve?',
            a: 'É a declaração de que não se esperam mais eventos anteriores a determinado ponto no tempo, permitindo fechar e emitir o resultado de uma janela. Resolve o impasse de um fluxo infinito, no qual esperar indefinidamente significa nunca produzir resultado e não esperar significa produzir resultado incompleto.',
          },
          {
            q: 'Por que reprocessar é fácil em batch e difícil em stream?',
            a: 'Em batch a entrada é um conjunto finito e imutável: corrige-se o código e roda-se de novo sobre exatamente os mesmos dados. Em stream é preciso reproduzir o fluxo histórico desde um ponto, restaurar o estado das agregações a partir de checkpoints e lidar com efeitos já emitidos pela versão anterior.',
          },
        ],
      },
    },
    {
      slug: 'stateful-vs-stateless',
      title: 'Stateful vs stateless',
      summary:
        'Onde o estado mora define o que você consegue escalar e o que quebra quando um nó cai.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Um serviço stateless não guarda nada entre requisições, então qualquer instância atende qualquer chamada. O estado não desaparece — ele é empurrado para uma camada especializada.',
        blocks: [
          {
            type: 'p',
            text: 'Stateless não significa "sem estado", e sim que o estado não vive na memória local da instância. Toda informação necessária vem na requisição ou de um armazenamento compartilhado. A consequência prática é enorme: qualquer instância pode atender qualquer requisição, o que torna o balanceamento trivial, o autoescalamento imediato e a perda de um nó irrelevante.',
          },
          {
            type: 'key',
            text: 'O estado nunca desaparece — ele se muda de endereço. Tornar a aplicação stateless significa concentrar o estado no banco, no cache ou no próprio cliente, onde a durabilidade e a consistência são tratadas por sistemas feitos para isso.',
          },
          {
            type: 'p',
            text: 'É essa concentração que dá o ganho. Um serviço de aplicação com estado em memória precisa resolver, sozinho e mal, problemas que o banco já resolve bem: durabilidade, replicação, recuperação após falha. Empurrar o estado para a camada certa deixa a aplicação descartável — e coisas descartáveis são fáceis de escalar, atualizar e substituir.',
          },
          {
            type: 'h',
            text: 'O que muda no dia a dia',
          },
          {
            type: 'table',
            head: ['Situação', 'Stateless', 'Stateful'],
            rows: [
              ['Adicionar instância', 'Recebe tráfego na hora', 'Precisa aquecer ou receber dados'],
              ['Perder instância', 'Requisições vão para outra', 'Perde o que estava em memória'],
              ['Balanceamento', 'Qualquer algoritmo', 'Precisa de afinidade'],
              ['Deploy', 'Substitui instâncias livremente', 'Drenagem e migração de estado'],
              ['Latência de acesso', 'Paga rede até o estado', 'Memória local — muito rápido'],
            ],
          },
          {
            type: 'p',
            text: 'A sessão é o exemplo canônico. Guardá-la em memória obriga a sticky session, que desequilibra a carga e perde sessões quando uma instância cai. Movê-la para um cache compartilhado resolve, ao custo de uma ida à rede por requisição. Colocá-la num token assinado no cliente elimina até essa ida — mas cria o problema da revogação, já que um token válido continua válido até expirar, mesmo depois de o usuário sair ou ser bloqueado.',
          },
          {
            type: 'p',
            text: 'Nem todo estado pode ser externalizado, e nesses casos o serviço é legitimamente stateful: bancos de dados, brokers de mensagem, servidores de WebSocket com conexões abertas, caches locais de alto desempenho. O que se faz aí é tratar o estado explicitamente — com replicação, particionamento por chave, e identidade estável para cada instância, que é exatamente o que orquestradores oferecem para cargas com estado.',
          },
          {
            type: 'h',
            text: 'Sessões: as três posições possíveis',
          },
          {
            type: 'p',
            text: 'Vale detalhar o custo de cada opção com números. Sessão em memória custa zero de latência e some junto com a instância. Sessão em cache compartilhado adiciona um round-trip de rede por requisição — meio milissegundo dentro da mesma zona, o que é irrelevante frente a uma consulta ao banco, mas deixa de ser quando a sessão passa a ser lida também por serviços internos em cadeia. Token assinado no cliente custa apenas verificação de assinatura na CPU, tipicamente dezenas de microssegundos, e nenhuma ida à rede.',
          },
          {
            type: 'p',
            text: 'O ponto que decide costuma ser a revogação. O padrão maduro combina os dois: um token de acesso curto, de cinco a quinze minutos, verificado localmente sem consulta, mais um token de renovação longo que é conferido contra um armazenamento a cada refresh. A janela de exposição após um logout ou bloqueio fica limitada à validade do token curto, e a consulta cara acontece uma vez a cada dez minutos em vez de a cada requisição. Quando o requisito é revogação verdadeiramente imediata, não há saída: a checagem por requisição volta, e o desenho precisa assumir esse custo.',
          },
          {
            type: 'p',
            text: 'Um efeito colateral frequentemente esquecido é que sessão compartilhada transforma o cache num ponto único de falha funcional: se toda requisição autenticada depende dele, sua indisponibilidade não degrada o sistema, derruba tudo. É justamente o argumento a favor do token assinado, cuja verificação não depende de nenhum serviço externo estar de pé.',
          },
          {
            type: 'h',
            text: 'Quando o estado é inevitável',
          },
          {
            type: 'p',
            text: 'Para serviços legitimamente stateful, a operação gira em torno de duas mecânicas. A primeira é a drenagem: antes de encerrar uma instância, ela para de receber novos clientes, termina o que está em curso e transfere ou libera o que mantém, o que exige que a aplicação trate corretamente o sinal de término e que o orquestrador dê um período de graça compatível. A segunda é a atribuição de partições: cada instância é dona de um subconjunto de chaves, e trocar de dono envolve um handoff explícito — congelar as escritas daquela partição, transferir o estado e retomar no novo dono.',
          },
          {
            type: 'p',
            text: 'É por isso que reequilibrar um serviço com estado é lento e escalar um serviço sem estado é instantâneo. Adicionar um nó a um cluster particionado significa mover dados pela rede, e mover terabytes leva o tempo que a rede permitir. Hashing consistente reduz o estrago ao garantir que apenas uma fração das chaves mude de dono quando o número de nós muda, em vez de reembaralhar tudo — mas não elimina a transferência, apenas a torna proporcional ao tamanho da mudança.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Estado acidental em memória. Um cache local inocente, um contador de rate limit por instância, um mapa de "usuários digitando", um agendamento com setInterval — nenhum foi projetado como estado, mas todos quebram silenciosamente ao subir a segunda instância: o resultado passa a depender de qual réplica atendeu, e o bug é intermitente e quase impossível de reproduzir localmente.',
          },
        ],
        quiz: [
          {
            q: 'Por que serviços stateless são mais fáceis de escalar?',
            a: 'Porque qualquer instância pode atender qualquer requisição: adicionar uma nova réplica a torna útil imediatamente, sem aquecimento ou migração de dados, e perder uma não destrói informação alguma. O balanceador fica livre para distribuir por qualquer critério e o deploy pode substituir instâncias sem cuidados especiais.',
          },
          {
            q: 'Qual o trade-off de guardar a sessão num token assinado no cliente?',
            a: 'Elimina a consulta de estado a cada requisição, tornando o serviço realmente independente de armazenamento compartilhado. Em troca, perde-se a revogação imediata: o token permanece válido até expirar, mesmo após logout ou bloqueio do usuário, o que obriga a expirações curtas ou a uma lista de revogação — que reintroduz a consulta que se queria evitar.',
          },
          {
            q: 'Por que estado acidental em memória produz bugs tão difíceis de diagnosticar?',
            a: 'Porque o comportamento passa a depender de qual instância atendeu a requisição, o que varia a cada chamada. O bug é intermitente em produção e não reproduz em desenvolvimento, onde roda uma instância só — e nada no código sinaliza que aquele mapa ou contador era estado compartilhado.',
          },
        ],
      },
    },
    {
      slug: 'consistencia-forte-vs-eventual',
      title: 'Consistência forte vs eventual',
      summary:
        'O preço em latência e disponibilidade de sempre enxergar o dado mais recente.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Consistência forte garante que toda leitura enxerga a escrita mais recente, ao custo de coordenação entre réplicas. Consistência eventual aceita divergência temporária em troca de latência e disponibilidade.',
        blocks: [
          {
            type: 'p',
            text: 'Consistência forte — mais precisamente, linearizabilidade — significa que o sistema se comporta como se houvesse uma única cópia dos dados: uma vez que uma escrita é confirmada, nenhuma leitura posterior pode devolver o valor antigo. É a garantia mais intuitiva e a mais cara, porque exige coordenação entre réplicas antes de responder.',
          },
          {
            type: 'p',
            text: 'Essa coordenação tem preço em milissegundos concretos. Confirmar uma escrita num quórum de réplicas custa pelo menos um round-trip até a réplica mediana; se as réplicas estão em regiões diferentes, cada escrita paga a latência geográfica. E durante uma partição, o lado que não alcança o quórum precisa recusar operações para não violar a garantia.',
          },
          {
            type: 'key',
            text: 'Consistência eventual não é "às vezes errado" — é uma promessa precisa: na ausência de novas escritas, todas as réplicas convergem para o mesmo valor. O que ela não promete é *quando*.',
          },
          {
            type: 'h',
            text: 'Os níveis intermediários',
          },
          {
            type: 'p',
            text: 'Tratar a escolha como binária é o erro mais comum, porque entre os dois extremos existem garantias intermediárias que resolvem a maioria dos problemas reais a um custo bem menor:',
          },
          {
            type: 'list',
            items: [
              'Read-your-writes: você sempre enxerga suas próprias escritas, mesmo que outros ainda não. Resolve o caso mais irritante — editar o perfil e ver o dado antigo.',
              'Monotonic reads: o dado nunca anda para trás dentro da sua sessão; você não vê um valor novo e depois o antigo ao atualizar a página.',
              'Consistência causal: se B foi causado por A, ninguém vê B sem ver A — a resposta nunca aparece antes da pergunta.',
              'Consistência de prefixo: as escritas são vistas na ordem em que ocorreram, mesmo que com atraso.',
            ],
          },
          {
            type: 'p',
            text: 'Quase todo produto que parece exigir consistência forte na verdade precisa de read-your-writes mais consistência causal. A percepção de "sistema quebrado" vem quase sempre de o usuário não ver o próprio efeito, ou de ver os fatos fora de ordem — não de outra pessoa enxergar um valor com dois segundos de atraso.',
          },
          {
            type: 'table',
            head: ['Dado', 'Garantia adequada', 'Por quê'],
            rows: [
              ['Saldo e transferências', 'Forte', 'Divergência permite gastar duas vezes'],
              ['Estoque de item único', 'Forte', 'Vender o mesmo item duas vezes gera dano real'],
              ['Perfil do usuário', 'Read-your-writes', 'Só quem editou precisa ver na hora'],
              ['Feed e timeline', 'Eventual + causal', 'Atraso é imperceptível; ordem importa'],
              ['Contadores e métricas', 'Eventual', 'Aproximação não causa dano'],
            ],
          },
          {
            type: 'h',
            text: 'Como se implementa cada garantia',
          },
          {
            type: 'p',
            text: 'Garantias intermediárias não vêm de graça, mas custam pouco quando implementadas no lugar certo. Read-your-writes normalmente se resolve roteando as leituras de um usuário para o primário durante alguns segundos após uma escrita dele, ou guardando no cliente a posição do log de replicação no momento da escrita e exigindo que a réplica escolhida já tenha alcançado aquele ponto. A segunda forma é mais elegante porque não sobrecarrega o primário: réplicas atrasadas simplesmente são descartadas para aquela leitura específica.',
          },
          {
            type: 'p',
            text: 'Monotonic reads costuma ser obtido fixando a sessão numa mesma réplica, o que também é a origem do problema quando essa réplica cai e o cliente é jogado numa outra que está mais atrasada — e o dado anda para trás na tela. Consistência causal exige carregar alguma noção de dependência junto do dado, tipicamente um relógio vetorial ou o identificador da versão que foi lida, para que o destino saiba se já viu tudo o que precedia. É o mecanismo mais caro dos três em metadados, e o único que resolve a resposta aparecendo antes da pergunta.',
          },
          {
            type: 'p',
            text: 'Do lado da consistência forte, é útil separar dois custos que se confundem. O primeiro é o consenso para replicar a escrita, que exige confirmação de uma maioria e por isso depende da réplica mediana, não da mais rápida — uma réplica lenta em três não atrapalha, duas atrapalham. O segundo é a leitura consistente, que não é automática: ler de qualquer réplica de um sistema com consenso pode devolver dado velho, e evitar isso exige ler do líder, confirmar a liderança com um round-trip, ou usar um mecanismo de leitura por índice comprometido.',
          },
          {
            type: 'p',
            text: 'Um caso de borda que rende conversa: quórum de leitura e escrita somados maiores que o número de réplicas garante interseção, mas isso ainda não é linearizabilidade. Duas leituras concorrentes podem alcançar quóruns diferentes durante uma escrita em andamento e devolver valores distintos, e uma escrita que falha no meio pode deixar o valor visível em algumas réplicas. Por isso sistemas que prometem linearizabilidade fazem leitura com reparo e usam consenso para ordenar as escritas, em vez de confiar apenas na aritmética dos quóruns.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Exigir consistência forte em tudo "por segurança". Isso impõe latência de coordenação a cada operação, reduz a disponibilidade durante partições e frequentemente força uma arquitetura de região única. O caminho correto é classificar os dados: o punhado de operações que realmente exige garantia forte recebe o tratamento caro, e o resto opera com garantias mais fracas e bem escolhidas.',
          },
        ],
        quiz: [
          {
            q: 'Por que consistência forte custa latência mesmo sem partição de rede?',
            a: 'Porque garantir que toda leitura veja a escrita mais recente exige coordenar réplicas antes de confirmar: a escrita só é aceita depois que um quórum confirmou. Isso adiciona ao menos um round-trip até a réplica mediana — e se as réplicas estão em regiões distintas, cada operação paga a distância geográfica.',
          },
          {
            q: 'Por que read-your-writes resolve a maior parte da percepção de inconsistência?',
            a: 'Porque o incômodo do usuário quase sempre vem de não ver o próprio efeito: editar algo e a tela mostrar o valor antigo parece perda de dados. Que outra pessoa veja o valor com dois segundos de atraso é imperceptível. Garantir apenas que cada um enxergue as próprias escritas custa muito menos que consistência global.',
          },
          {
            q: 'O que exatamente promete a consistência eventual?',
            a: 'Que, na ausência de novas escritas, todas as réplicas convergem para o mesmo valor. É uma garantia de convergência, não de prazo: não diz quanto tempo levará nem impede que leituras simultâneas em réplicas diferentes devolvam valores distintos durante o intervalo.',
          },
        ],
      },
    },
    {
      slug: 'push-vs-pull',
      title: 'Push vs pull',
      summary:
        'Quem toma a iniciativa muda quem sofre com picos e quem controla o ritmo.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Em push, o produtor envia assim que há novidade; em pull, o consumidor busca quando está pronto. A diferença determina quem controla o ritmo e quem absorve os picos.',
        blocks: [
          {
            type: 'p',
            text: 'Push entrega a informação com a menor latência possível: assim que o fato existe, ele é enviado. A contrapartida é que o produtor dita o ritmo, e um consumidor mais lento não tem como pedir calma — ele acumula backlog, esgota memória ou começa a descartar. Sem um mecanismo de contrapressão, push transforma um pico do produtor em falha do consumidor.',
          },
          {
            type: 'p',
            text: 'Pull inverte o controle: o consumidor busca quando tem capacidade, e naturalmente processa no seu próprio ritmo. A contrapressão é automática — se ele está ocupado, simplesmente demora a buscar, e o trabalho fica acumulado do lado do produtor ou do broker, que costuma ser o lugar preparado para acumular. O custo é latência (só se descobre a novidade na próxima busca) e requisições vazias quando não há nada novo.',
          },
          {
            type: 'key',
            text: 'A pergunta decisiva: quem deve absorver a diferença de ritmo? Em push, é o consumidor — que pode não aguentar. Em pull, é o intermediário — que foi feito para isso.',
          },
          {
            type: 'p',
            text: 'É por isso que sistemas de log distribuído são baseados em pull: os consumidores puxam do log no ritmo que aguentam, o broker guarda tudo de forma durável, e um consumidor lento apenas fica para trás sem afetar os demais nem o produtor. Consumidores diferentes podem inclusive estar em pontos diferentes do mesmo fluxo.',
          },
          {
            type: 'h',
            text: 'O mesmo dilema no feed',
          },
          {
            type: 'p',
            text: 'O trade-off reaparece com outro nome na construção de timelines. Fan-out na escrita (push) grava o post na caixa de entrada de cada seguidor no momento da publicação: a leitura fica trivial e instantânea, mas publicar para dez milhões de seguidores gera dez milhões de escritas. Fan-out na leitura (pull) monta o feed consultando quem a pessoa segue no momento em que ela abre o app: publicar é barato, ler é caro.',
          },
          {
            type: 'p',
            text: 'A solução real usada em escala é híbrida: push para a maioria das contas, cujo número de seguidores é modesto, e pull para as contas enormes, cujo fan-out seria proibitivo. O feed de um usuário é a mistura do que já estava em sua caixa de entrada com a consulta às poucas contas gigantes que ele segue.',
          },
          {
            type: 'p',
            text: 'O corte entre os dois regimes não precisa ser um número mágico: compare o custo dos dois lados. Push para uma conta com N seguidores custa N escritas por publicação; pull custa uma consulta extra em cada leitura de feed dos seguidores. Contas com muitos seguidores e pouca publicação favorecem push; quem publica muito para audiência enorme favorece pull. Na prática o limiar fica na casa de dezenas de milhares e é ajustado por medição.',
          },
          {
            type: 'h',
            text: 'Contrapressão de verdade',
          },
          {
            type: 'p',
            text: 'Contrapressão é o mecanismo pelo qual o consumidor comunica ao produtor que precisa desacelerar. Em pull ela é implícita; em push precisa ser construída, e há quatro formas honestas. Bloquear o produtor propaga a lentidão para trás, correto quando ele pode esperar e desastroso quando é uma requisição de usuário. Descartar serve para dados sem valor histórico, como métricas e presença, e é catastrófico para pedidos. Amostrar ou agregar reduz o volume preservando o sinal. Derramar para disco troca memória por latência.',
          },
          {
            type: 'p',
            text: 'A regra que orienta a escolha é observar de onde vem o produtor. Se ele é uma fonte externa que não obedece — o tráfego dos usuários, um sensor, um parceiro —, bloquear não funciona: a fila só se acumula em outro lugar. Aí a política precisa ser descarte, amostragem ou rejeição explícita na borda. Aceitar trabalho que não se consegue processar é a forma mais comum de transformar sobrecarga em indisponibilidade total.',
          },
          {
            type: 'p',
            text: 'Vale notar que o TCP já embute contrapressão: se o consumidor não lê do socket, a janela fecha e o remetente para de enviar. O problema é que essa garantia morre na borda da aplicação — código que lê da rede o mais rápido possível e despeja tudo numa fila interna sem limite desabilita a contrapressão do transporte e reintroduz o crescimento ilimitado na camada onde não há proteção nenhuma.',
          },
          {
            type: 'p',
            text: 'Do lado do pull, o defeito simétrico é a poluição por requisições vazias: mil consumidores buscando a cada segundo geram mil requisições mesmo sem nada a entregar, e reduzir o intervalo multiplica esse custo. A saída usual é o pull com espera — o consumidor pede e o servidor segura a resposta até haver dado ou até o prazo acabar —, que entrega latência de push com o controle de ritmo de pull.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Push', 'Pull'],
            rows: [
              ['Latência', 'Mínima', 'Até o próximo ciclo'],
              ['Controle do ritmo', 'Produtor', 'Consumidor'],
              ['Contrapressão', 'Precisa ser explícita', 'Natural'],
              ['Consumidor lento', 'Sofre ou descarta', 'Fica para trás sem afetar ninguém'],
              ['Sem novidade', 'Nenhum tráfego', 'Requisições vazias'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Push sem contrapressão nem limite de fila. Enquanto o consumidor acompanha, tudo parece bem; no primeiro pico, a fila interna cresce, a memória enche e o processo morre — perdendo tudo que estava acumulado. Se for usar push, defina um limite explícito e uma política para quando ele for atingido: bloquear o produtor, descartar os mais antigos ou derramar para disco.',
          },
        ],
        quiz: [
          {
            q: 'Por que pull oferece contrapressão natural?',
            a: 'Porque o consumidor só busca quando tem capacidade de processar. Se está sobrecarregado, simplesmente demora mais a buscar, e o trabalho permanece acumulado no broker — que é durável e foi feito para acumular. Não é preciso nenhum protocolo adicional para o consumidor sinalizar que não aguenta o ritmo.',
          },
          {
            q: 'Por que sistemas de feed em escala usam uma abordagem híbrida?',
            a: 'Porque push puro custa milhões de escritas quando uma conta com muitos seguidores publica, e pull puro torna cada leitura de feed cara para todo mundo. O híbrido usa push para a maioria das contas, cujo fan-out é pequeno, e pull para as poucas contas enormes, montando o feed como a mistura das duas fontes.',
          },
          {
            q: 'O que pode dar errado num sistema push sem limite de fila?',
            a: 'Durante um pico, o produtor envia mais rápido do que o consumidor processa, a fila interna cresce sem limite, a memória se esgota e o processo é encerrado — perdendo tudo que estava acumulado. É preciso um limite explícito e uma política definida ao atingi-lo: bloquear o produtor, descartar o mais antigo ou derramar para disco.',
          },
        ],
      },
    },
    {
      slug: 'rest-vs-rpc',
      title: 'REST vs RPC',
      summary:
        'Modelar recursos ou modelar chamadas de procedimento: dois jeitos de pensar a interface.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'REST organiza a API em torno de recursos e usa a semântica do HTTP; RPC organiza em torno de operações. A escolha afeta cache, evolução e a naturalidade do contrato.',
        blocks: [
          {
            type: 'p',
            text: 'A diferença é de substantivos contra verbos. REST expõe recursos identificados por URL e opera sobre eles com os métodos do HTTP; a lista de endpoints tende a ser pequena e o vocabulário de operações é fixo. RPC expõe procedimentos nomeados; a lista de operações cresce com o domínio e cada uma tem a assinatura que precisar.',
          },
          {
            type: 'p',
            text: 'O ganho concreto de REST é reaproveitar tudo que a web já entende. GET é seguro e cacheável, então proxies e CDNs cacheiam sem saber nada do seu domínio. PUT e DELETE são idempotentes, então clientes podem retentar com segurança. Os códigos de status já comunicam categorias de erro para qualquer intermediário. Nada disso precisa ser inventado ou documentado.',
          },
          {
            type: 'key',
            text: 'REST fica desconfortável quando a operação é essencialmente um verbo. "Reprocessar pagamento", "cancelar assinatura com motivo", "aprovar solicitação" não são criações nem substituições de recurso — forçá-las a virar substantivo gera contratos artificiais que ninguém entende sem documentação.',
          },
          {
            type: 'p',
            text: 'RPC é natural nesses casos e tem outras vantagens fortes entre serviços internos. gRPC, a encarnação mais comum, define o contrato em Protocol Buffers, gera clientes tipados para várias linguagens, serializa em binário compacto e suporta streaming bidirecional sobre HTTP/2. Numa malha de microsserviços com chamadas frequentes, isso reduz latência e elimina uma classe inteira de erros de integração.',
          },
          {
            type: 'table',
            head: ['Critério', 'REST', 'RPC (gRPC)'],
            rows: [
              ['Modelo', 'Recursos e verbos HTTP', 'Procedimentos nomeados'],
              ['Cache de intermediários', 'Nativo em GET', 'Não se aplica'],
              ['Contrato', 'Documentado (OpenAPI)', 'Gerado do .proto'],
              ['Payload', 'JSON legível', 'Binário compacto'],
              ['Streaming', 'Limitado', 'Nativo, bidirecional'],
              ['Navegador', 'Direto', 'Precisa de proxy'],
              ['Melhor uso', 'API pública e CRUD', 'Serviço a serviço interno'],
            ],
          },
          {
            type: 'p',
            text: 'A escolha mais comum em sistemas maduros não é uma ou outra: é REST na borda, onde há clientes diversos, cache e necessidade de legibilidade, e gRPC internamente, onde a eficiência e o contrato tipado compensam. As duas convivem sem conflito, e um gateway traduz entre elas.',
          },
          {
            type: 'p',
            text: 'Vale também dizer que a maioria das APIs chamadas de REST não é REST no sentido acadêmico — poucas implementam hipermídia, o nível mais alto do modelo. Isso não é um problema prático: o que rende benefício real é usar recursos, verbos e status codes com coerência, e essa parte é o que vale defender numa discussão de design.',
          },
          {
            type: 'h',
            text: 'Evolução do contrato',
          },
          {
            type: 'p',
            text: 'O critério que mais separa as duas famílias no longo prazo é como cada uma lida com mudanças. Protocol Buffers foi desenhado em torno de compatibilidade: campos são identificados por número, e não por nome, então renomear um campo não quebra nada e acrescentar um campo opcional é sempre seguro. As duas regras que realmente importam são nunca reutilizar um número já usado e nunca mudar o tipo de um campo existente — violá-las produz decodificação silenciosamente errada, que é bem pior que um erro explícito.',
          },
          {
            type: 'p',
            text: 'Em REST com JSON a compatibilidade é convenção, não mecanismo. Clientes toleram campos novos se ignorarem o que não conhecem, e quebram na hora em que um campo esperado some ou muda de tipo. Isso empurra a evolução para versionamento explícito — prefixo na URL, cabeçalho de versão ou tipo de mídia — e para a disciplina de tratar remoções como mudança incompatível, com período de transição em que a resposta carrega o campo velho e o novo ao mesmo tempo.',
          },
          {
            type: 'p',
            text: 'Há uma diferença de granularidade que também importa. REST devolve o recurso inteiro, o que é simples e frequentemente desperdiça banda: uma tela que precisa de três campos recebe quarenta, ou faz cinco chamadas para juntar o que precisa. RPC permite desenhar a operação exatamente para o consumidor, o que resolve o desperdício e cria acoplamento — cada tela nova tende a pedir um método novo, e a superfície da API cresce até virar um catálogo que ninguém conhece inteiro. Um gateway agregador na borda existe justamente para absorver essa tensão.',
          },
          {
            type: 'p',
            text: 'Por fim, um ponto que costuma render pergunta de acompanhamento: idempotência não vem do estilo, vem do desenho. Em REST, PUT e DELETE são idempotentes por definição do protocolo, mas POST não é — e é POST que cria pedidos e cobra cartões. Em RPC não existe nenhuma convenção que ajude. Nos dois casos a solução é a mesma: o cliente gera uma chave de idempotência por tentativa, o servidor guarda o resultado associado àquela chave e devolve a mesma resposta se ela reaparecer. Sem isso, qualquer retentativa após timeout pode duplicar o efeito.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Forçar tudo a caber no modelo de recursos e produzir endpoints incompreensíveis. Um `POST /pedidos/42/cancelamentos` para cancelar um pedido é REST no formato e confuso no significado. Quando a operação é um verbo de negócio, nomeá-la explicitamente — ou expor uma ação sobre o recurso — comunica melhor do que inventar um substantivo que não existe no domínio.',
          },
        ],
        quiz: [
          {
            q: 'Qual vantagem concreta o REST obtém ao usar a semântica do HTTP?',
            a: 'Ganha cache de proxies e CDNs em GETs sem nenhuma lógica de domínio, retentativa segura em métodos idempotentes como PUT e DELETE, e comunicação de erros por códigos de status que qualquer intermediário entende. São capacidades da infraestrutura existente, sem código nem documentação adicional.',
          },
          {
            q: 'Por que gRPC domina a comunicação interna entre serviços?',
            a: 'Porque oferece contrato tipado gerado do .proto, com clientes automáticos em várias linguagens, serialização binária compacta e streaming bidirecional sobre HTTP/2. Em chamadas internas frequentes isso reduz latência e elimina erros de integração; a falta de suporte nativo em navegadores não importa nesse contexto.',
          },
          {
            q: 'Quando o modelo de recursos do REST atrapalha?',
            a: 'Quando a operação é essencialmente um verbo de negócio — cancelar, aprovar, reprocessar — e não a criação ou substituição de um recurso. Forçá-la a virar substantivo produz endpoints artificiais cujo significado não é evidente pelo nome, exigindo documentação para algo que uma operação nomeada comunicaria diretamente.',
          },
        ],
      },
    },
  ],
};

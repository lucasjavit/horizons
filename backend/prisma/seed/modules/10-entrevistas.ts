import type { ModuleSeed } from '../types';

export const entrevistas: ModuleSeed = {
  slug: 'entrevistas',
  title: 'Entrevistas de system design',
  goal: 'Ter um método para conduzir a conversa de 45 minutos: levantar requisitos, estimar, desenhar, e defender escolhas sob questionamento.',
  lessons: [
    {
      slug: 'framework-de-resposta',
      title: 'Um framework para a entrevista',
      summary:
        'Requisitos, estimativas, API, modelo de dados, desenho de alto nível, aprofundamento, gargalos.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'A entrevista de system design avalia como você conduz uma conversa sob ambiguidade. Um roteiro explícito evita o erro mais comum: desenhar caixas antes de saber o que se está construindo.',
        blocks: [
          {
            type: 'p',
            text: 'O enunciado é sempre vago de propósito — "projete o Twitter" — porque a ambiguidade é o teste. O entrevistador quer ver se você pergunta antes de decidir, se justifica escolhas com números, e se reconhece os custos do que propôs. Um candidato que desenha imediatamente uma arquitetura genérica com load balancer, cache e microsserviços demonstra memorização, não julgamento.',
          },
          {
            type: 'key',
            text: 'A entrevista não avalia se você conhece a arquitetura "certa" — ela não existe. Avalia se você toma decisões defensáveis a partir de requisitos que você mesmo levantou.',
          },
          {
            type: 'h',
            text: 'Os sete passos',
          },
          {
            type: 'list',
            items: [
              'Requisitos funcionais (5 min): o que o sistema faz. Liste em voz alta e corte agressivamente — é melhor projetar bem três funcionalidades do que mencionar quinze.',
              'Requisitos não funcionais (5 min): escala esperada, latência aceitável, disponibilidade, e quais dados exigem consistência forte. É aqui que a arquitetura é realmente decidida.',
              'Estimativas (5 min): QPS, volume de armazenamento e banda. Números aproximados, premissas explícitas.',
              'API (5 min): as poucas operações principais, com entradas e saídas. Concretiza o que estava abstrato.',
              'Modelo de dados (5 min): entidades, relações e — crucialmente — as chaves de acesso e particionamento.',
              'Desenho de alto nível (10 min): os componentes e o caminho de uma requisição de ponta a ponta.',
              'Aprofundamento e gargalos (10 min): escolha um ou dois pontos críticos e detalhe, mostrando que você sabe onde o sistema quebra.',
            ],
          },
          {
            type: 'p',
            text: 'O passo mais subestimado é o segundo. Saber que o sistema tem 100 milhões de usuários mas apenas 100 mil escritas por dia leva a uma arquitetura completamente diferente da de 100 mil escritas por segundo. E saber que só o saldo precisa de consistência forte, enquanto o feed tolera atraso, é o que permite não pagar coordenação onde ela não é necessária.',
          },
          {
            type: 'h',
            text: 'Como conduzir a conversa',
          },
          {
            type: 'p',
            text: 'Pense em voz alta o tempo todo, inclusive nas hesitações: "vou usar cache aqui, mas isso me traz invalidação — deixe-me ver se compensa". O entrevistador não consegue avaliar raciocínio silencioso. Quando propuser algo, diga também o que custa: toda escolha tem contrapartida, e nomeá-la espontaneamente é o sinal mais forte de senioridade que existe nessa conversa.',
          },
          {
            type: 'p',
            text: 'Gerencie o tempo ativamente. Quarenta e cinco minutos passam rápido, e o erro clássico é gastar vinte no modelo de dados e não chegar ao aprofundamento. Se o entrevistador insiste num tópico, é sinal — ele quer ver profundidade ali. Se ele muda de assunto, aceite a mudança sem tentar terminar seu raciocínio anterior.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Despejar tecnologias no lugar de raciocínio. Dizer "uso Kafka, Redis, Cassandra e Kubernetes" sem explicar qual problema cada um resolve soa a checklist decorado, e a primeira pergunta de acompanhamento expõe a lacuna. É muito mais convincente dizer "preciso desacoplar essa escrita do caminho crítico, então coloco uma fila — o custo é que o cliente não recebe mais o resultado na resposta".',
          },
          {
            type: 'p',
            text: 'Vale lembrar que não saber algo é aceitável e mentir não é. "Não conheço os detalhes desse protocolo, mas o problema que ele resolve é este e eu abordaria assim" é uma resposta forte. Inventar detalhes é o caminho mais rápido para perder credibilidade no restante da conversa.',
          },
          {
            type: 'h',
            text: 'O aprofundamento é onde se ganha ou perde',
          },
          {
            type: 'p',
            text: 'Os primeiros cinco passos separam quem se preparou de quem não se preparou; o sexto e o sétimo separam níveis de senioridade. No aprofundamento, o entrevistador quer ver você escolher um ponto e ir fundo — não passear por cinco componentes com um parágrafo cada. Escolha onde a carga se concentra ou onde a falha dói mais, e anuncie a escolha em voz alta, justificando pela estimativa que apontou o gargalo.',
          },
          {
            type: 'p',
            text: 'Uma forma confiável de demonstrar profundidade é rodar o cenário de 10x: pegue o desenho apresentado e pergunte em voz alta o que quebra primeiro se a carga decuplicar. Quase sempre a resposta é um componente nomeável — o índice que deixa de caber em memória, a partição quente, a fila que acumula mais rápido do que drena. Saber qual peça cede primeiro vale mais que qualquer diagrama adicional.',
          },
          {
            type: 'p',
            text: 'Trate também os modos de falha explicitamente, porque poucos candidatos fazem isso espontaneamente. Se o cache cair por inteiro, o banco aguenta a carga que estava sendo absorvida? Se o consumidor da fila ficar parado por uma hora, quanto acúmulo o broker suporta? Se uma zona inteira sumir, o sistema perde capacidade proporcional ou para? Antecipar essas perguntas inverte a conversa: em vez de defender o desenho sob ataque, você conduz o exame dele.',
          },
          {
            type: 'p',
            text: 'E cuide da forma: desenhe poucas caixas e nomeie o que passa entre elas — o valor está nas setas. Percorra o caminho completo de uma requisição concreta em vez de descrever componentes isolados; uma narrativa de ponta a ponta prova que as peças se encaixam.',
          },
        ],
        quiz: [
          {
            q: 'Por que os requisitos não funcionais definem a arquitetura mais do que os funcionais?',
            a: 'Porque as funcionalidades costumam ser parecidas entre soluções, mas escala, latência, disponibilidade e exigência de consistência mudam tudo. O mesmo conjunto de funcionalidades com mil ou com cem milhões de usuários, ou com consistência forte versus eventual, produz arquiteturas radicalmente diferentes.',
          },
          {
            q: 'Qual o efeito de pensar em voz alta durante a entrevista?',
            a: 'Torna o raciocínio avaliável. O entrevistador não pode julgar o que não ouve, e verbalizar hipóteses, dúvidas e trade-offs mostra como você decide sob incerteza — que é exatamente o que está sendo medido. Também permite que ele corrija o rumo antes de você gastar tempo numa direção que não interessa.',
          },
          {
            q: 'Por que listar tecnologias sem justificativa é contraproducente?',
            a: 'Porque sugere memorização em vez de julgamento, e a primeira pergunta sobre por que aquela peça foi escolhida costuma expor a falta de raciocínio. Nomear o problema e depois a solução — junto do custo que ela traz — demonstra a competência que a entrevista pretende avaliar.',
          },
        ],
      },
    },
    {
      slug: 'estimativas',
      title: 'Estimativas de capacidade',
      summary:
        'Contas de guardanapo: QPS, armazenamento e banda a partir de premissas explícitas.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Estimar capacidade transforma a discussão de abstrata em concreta. O objetivo não é precisão, é ordem de grandeza — descobrir se o problema é de uma máquina ou de mil.',
        blocks: [
          {
            type: 'p',
            text: 'Estimativas existem para responder uma pergunta binária: isso cabe numa máquina? A diferença entre 500 requisições por segundo e 500 mil não é quantitativa, é arquitetural. A primeira roda num servidor com banco relacional; a segunda exige particionamento, cache em várias camadas e provavelmente distribuição geográfica. Descobrir de que lado o problema está é o que muda todo o resto da conversa.',
          },
          {
            type: 'key',
            text: 'Arredonde tudo sem constrangimento. Um ano tem 30 milhões de segundos; um dia tem 86 mil, use 100 mil. O objetivo é chegar à ordem de grandeza certa em trinta segundos, não ao número exato em cinco minutos.',
          },
          {
            type: 'h',
            text: 'O caminho da conta',
          },
          {
            type: 'p',
            text: 'Comece pelos usuários ativos diários e derive tudo a partir daí. Se há 10 milhões de usuários ativos e cada um faz 20 leituras por dia, são 200 milhões de leituras diárias. Dividindo por 100 mil segundos, dá cerca de 2.000 leituras por segundo em média. O pico costuma ser de duas a três vezes a média, então planeje para algo em torno de 5.000.',
          },
          {
            type: 'p',
            text: 'A proporção entre leitura e escrita é o número que mais orienta decisões. Uma razão de 100:1 significa que cache resolve quase tudo e réplicas de leitura sustentam o crescimento. Uma razão de 1:1 ou com escrita dominante significa que o problema real está no caminho de escrita, onde cache não ajuda e a saída é particionar.',
          },
          {
            type: 'code',
            lang: 'text',
            code: `Usuários ativos/dia:        10.000.000
Escritas por usuário/dia:            2  → 20.000.000/dia
Leituras por usuário/dia:           20  → 200.000.000/dia

QPS de escrita (média):  20M / 100k s  ≈ 200/s   → pico ~600/s
QPS de leitura (média): 200M / 100k s  ≈ 2.000/s → pico ~6.000/s
Razão leitura:escrita ≈ 10:1

Tamanho por registro:        ~1 KB
Armazenamento/dia:  20M × 1 KB       ≈ 20 GB/dia
Em 5 anos:          20 GB × 1.800    ≈ 36 TB`,
          },
          {
            type: 'p',
            text: 'Para armazenamento, multiplique o volume diário pelo horizonte de retenção — cinco anos são cerca de 1.800 dias. Não esqueça de considerar réplicas: três cópias triplicam o número, e índices costumam adicionar uma fração relevante sobre os dados. Um resultado na casa dos terabytes indica particionamento; na casa dos gigabytes, uma máquina resolve.',
          },
          {
            type: 'p',
            text: 'A banda é a terceira conta e a mais esquecida, embora frequentemente seja a que decide o custo do produto. Multiplique o QPS de leitura pelo tamanho médio da resposta: 6.000 leituras por segundo de 1 KB dão 6 MB/s, o que é irrelevante. Troque a resposta por uma imagem de 500 KB e o mesmo tráfego vira 3 GB/s — número que muda a conversa inteira e explica por que qualquer sistema com mídia coloca uma CDN no desenho antes de qualquer outra otimização.',
          },
          {
            type: 'h',
            text: 'Da conta para a decisão',
          },
          {
            type: 'p',
            text: 'Depois dos totais, faça a conta que realmente importa: quantas máquinas. Para isso é preciso uma estimativa grosseira de capacidade por instância, e as ordens de grandeza defensáveis são conhecidas — um servidor de aplicação sustenta alguns milhares de requisições simples por segundo, um cache em memória entrega dezenas ou centenas de milhares de operações por segundo, e um banco relacional bem indexado atende alguns milhares de escritas por segundo antes de precisar de ajuda. Dividir a carga estimada por esses números dá o tamanho da frota e revela onde está o problema.',
          },
          {
            type: 'p',
            text: 'Estimar memória de cache segue o mesmo espírito e costuma surpreender pela modéstia. Se 20% dos itens respondem por 80% dos acessos, cachear apenas essa fatia já entrega taxa de acerto alta. Com 200 milhões de registros de 1 KB, os 20% mais quentes ocupam cerca de 40 GB — quantidade que cabe em poucas instâncias de memória e elimina a maior parte da carga de leitura do banco. Fazer essa conta explicitamente é o que permite afirmar que o cache resolve, em vez de apenas torcer para que resolva.',
          },
          {
            type: 'p',
            text: 'Preste atenção também ao pico que não é o pico médio. O fator de duas ou três vezes cobre a variação normal do dia, mas alguns domínios têm eventos que concentram tráfego em minutos: um lançamento, uma transmissão ao vivo, a virada do ano numa aplicação de mensagens. Nesses casos o pico instantâneo pode ser dez ou cinquenta vezes a média, e dimensionar pela média com folga de três vezes garante indisponibilidade no único momento em que o sistema é observado. Quando o domínio tem eventos assim, diga isso explicitamente e dimensione o caminho crítico para eles.',
          },
          {
            type: 'table',
            head: ['Referência', 'Valor aproximado'],
            rows: [
              ['Segundos por dia', '~100.000'],
              ['Segundos por ano', '~30 milhões'],
              ['Dias em 5 anos', '~1.800'],
              ['Pico sobre a média', '2× a 3×'],
              ['Leitura de memória', 'dezenas de nanossegundos'],
              ['Leitura de SSD', '~100 microssegundos'],
              ['Round-trip na mesma região', '0,5 a 2 ms'],
              ['Round-trip entre continentes', '100 a 200 ms'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Fazer as contas e não usá-las. A estimativa só vale se mudar alguma decisão: "são 36 TB, então uma instância não comporta e preciso particionar por usuário" ou "são 200 escritas por segundo, o que um Postgres atende com folga — não vou introduzir fila". Números que ficam num canto do quadro sem influenciar o desenho são cerimônia.',
          },
          {
            type: 'p',
            text: 'Deixe as premissas explícitas ao enunciá-las: "estou assumindo 10 milhões de ativos diários e 2 escritas por usuário — se for muito diferente, me corrija". Isso convida o entrevistador a ajustar a base e demonstra que você sabe que os números são hipóteses, não fatos.',
          },
        ],
        quiz: [
          {
            q: 'Por que a proporção entre leituras e escritas é o número mais orientador?',
            a: 'Porque define onde atacar. Com razão alta de leitura, cache e réplicas resolvem quase tudo e o caminho de escrita continua simples. Com escrita dominante, cache não ajuda — o gargalo está na ingestão — e a saída passa por particionamento, escrita em lote ou armazenamento otimizado para escrita.',
          },
          {
            q: 'Por que arredondar um dia para 100 mil segundos em vez de 86.400?',
            a: 'Porque o objetivo é a ordem de grandeza, e o erro de 16% é irrelevante frente à incerteza das premissas — o número de usuários e a frequência de uso são chutes com margem muito maior. Arredondar permite fazer a conta de cabeça em segundos e manter a conversa fluindo.',
          },
          {
            q: 'O que torna uma estimativa útil em vez de cerimonial?',
            a: 'O fato de ela mudar uma decisão de projeto. A conta precisa levar a uma conclusão explícita — "não cabe numa máquina, preciso particionar" ou "isso é pouco, um banco relacional resolve e não vou adicionar complexidade". Números que não influenciam o desenho não deveriam ter sido calculados.',
          },
        ],
      },
    },
    {
      slug: 'url-shortener',
      title: 'Projeto: encurtador de URL',
      summary:
        'O clássico de aquecimento: geração de IDs, leitura dominante e cache.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Encurtar URLs é simples de enunciar e rico em decisões: como gerar códigos curtos e únicos em escala, e como servir um redirecionamento com latência mínima.',
        blocks: [
          {
            type: 'p',
            text: 'O sistema faz duas coisas: dado um endereço longo, devolver um código curto; dado o código, redirecionar para o endereço original. A característica que define a arquitetura é a assimetria brutal entre as duas operações — cada link é criado uma vez e acessado centenas ou milhares de vezes. A razão leitura:escrita fica facilmente em 100:1 ou mais.',
          },
          {
            type: 'key',
            text: 'Com leitura dominante, o problema deixa de ser armazenamento e vira latência de leitura. Todo o desenho gira em torno de responder o redirecionamento sem tocar o banco na maioria dos casos.',
          },
          {
            type: 'h',
            text: 'Gerando o código',
          },
          {
            type: 'p',
            text: 'A primeira abordagem é hashear a URL e usar os primeiros caracteres. Simples, e traz colisões: URLs diferentes podem gerar o mesmo prefixo, o que obriga a verificar a existência antes de gravar e a tratar o conflito. Também dá um efeito colateral às vezes desejável, às vezes não: a mesma URL sempre gera o mesmo código.',
          },
          {
            type: 'p',
            text: 'A abordagem mais limpa é gerar um número inteiro sequencial e codificá-lo em base62 (dígitos, minúsculas e maiúsculas). Isso elimina colisões por construção, e sete caracteres em base62 cobrem cerca de 3,5 trilhões de combinações — o suficiente para qualquer escala realista. O problema passa a ser gerar o inteiro de forma distribuída: um contador central é ponto único e gargalo.',
          },
          {
            type: 'p',
            text: 'A solução prática é distribuir faixas: cada instância pede um bloco de identificadores (digamos, mil) a um serviço central e os consome localmente, voltando a pedir só quando esgotar. Isso reduz a coordenação por um fator de mil. Alternativas são IDs no estilo Snowflake, que combinam timestamp, identificador de máquina e sequência local sem nenhuma coordenação.',
          },
          {
            type: 'p',
            text: 'Há uma consequência de segurança nos IDs sequenciais que vale mencionar: eles são enumeráveis, então qualquer pessoa pode percorrer os códigos e listar todos os links criados. Se isso importa, embaralha-se o inteiro com uma permutação reversível antes de codificar, mantendo a ausência de colisão sem expor a ordem.',
          },
          {
            type: 'h',
            text: 'Servindo o redirecionamento',
          },
          {
            type: 'p',
            text: 'A leitura é uma busca por chave — o caso mais simples que existe. Um cache na frente do banco absorve a esmagadora maioria dos acessos, já que a distribuição de popularidade dos links é extremamente desigual: uma fração minúscula dos códigos responde por quase todo o tráfego. Com um cache modesto, a taxa de acerto passa de 95% sem esforço.',
          },
          {
            type: 'p',
            text: 'Uma decisão sutil é o código de status do redirecionamento. Um 301 permanente é cacheado pelo navegador, o que torna os acessos seguintes instantâneos e reduz a carga a quase zero — mas impede contar cliques e impossibilita alterar o destino depois. Um 302 temporário força o navegador a perguntar sempre, preservando analytics e a capacidade de mudar o destino, ao custo de mais tráfego. Se o produto tem métricas de cliques, 302 é a escolha certa.',
          },
          {
            type: 'table',
            head: ['Decisão', 'Opção A', 'Opção B', 'Escolha típica'],
            rows: [
              ['Geração do código', 'Hash da URL', 'Contador + base62', 'Contador com faixas'],
              ['Coordenação de ID', 'Contador central', 'Faixas por instância', 'Faixas'],
              ['Armazenamento', 'Relacional', 'Chave-valor', 'Chave-valor em escala'],
              ['Redirecionamento', '301 permanente', '302 temporário', '302 se houver analytics'],
            ],
          },
          {
            type: 'h',
            text: 'Os números e o que eles decidem',
          },
          {
            type: 'p',
            text: 'Vale fazer a conta em voz alta, porque ela desarma metade da complexidade. Com 100 milhões de links criados por mês, são cerca de 40 escritas por segundo — carga que um relacional único atende sem transpirar. Com razão de 100:1, a leitura fica em 4.000 por segundo, talvez 12.000 no pico. Cada registro guarda código, URL longa, dono e data: perto de 500 bytes, o que dá 50 GB por mês e uns 3 TB em cinco anos.',
          },
          {
            type: 'p',
            text: 'Essa conta também define a chave de particionamento, escolha que o entrevistador costuma cobrar. Particionar pelo código curto distribui de forma uniforme e serve o caminho dominante — a busca sempre tem o código em mãos. O preço é que listar os links de um usuário passa a varrer todos os shards, o que se resolve com uma tabela secundária por dono.',
          },
          {
            type: 'p',
            text: 'Sob 10x de carga o desenho não muda de forma, muda de posicionamento: com 95% de acerto no cache, o banco recebe só 2.000 leituras por segundo. O gargalo passa a ser latência geográfica, o que empurra o redirecionamento para a borda.',
          },
          {
            type: 'p',
            text: 'A analítica de cliques quebra primeiro se tratada ingenuamente: gravar uma linha por clique de forma síncrona transforma o redirecionamento numa escrita. O padrão correto é emitir o evento de forma assíncrona — para uma fila ou buffer local esvaziado em lote — e agregar depois, aceitando alguns segundos de atraso. Ninguém precisa que o contador seja transacional; o usuário precisa que o redirecionamento seja instantâneo.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Ignorar a expiração e os links personalizados. Sem política de retenção, a base cresce para sempre com links que ninguém acessa há anos. E códigos escolhidos pelo usuário precisam de um espaço de nomes que não colida com os gerados, além de uma lista de termos reservados — detalhes pequenos que o entrevistador costuma perguntar justamente para ver se você pensou além do caminho feliz.',
          },
        ],
        quiz: [
          {
            q: 'Por que gerar o código a partir de um contador é preferível a hashear a URL?',
            a: 'Porque elimina colisões por construção, dispensando verificação de existência e tratamento de conflito a cada criação. Sete caracteres em base62 cobrem trilhões de combinações. O desafio se desloca para gerar o inteiro de forma distribuída, resolvido com faixas pré-alocadas por instância.',
          },
          {
            q: 'Por que a distribuição desigual de popularidade favorece tanto o cache aqui?',
            a: 'Porque uma fração minúscula dos links responde por quase todo o tráfego. Um cache pequeno guardando apenas os códigos mais acessados atinge taxa de acerto acima de 95%, de modo que a maioria esmagadora dos redirecionamentos é servida da memória sem tocar o banco.',
          },
          {
            q: 'Qual o trade-off entre responder 301 e 302 no redirecionamento?',
            a: 'O 301 é cacheado pelo navegador, tornando acessos seguintes instantâneos e reduzindo a carga quase a zero, mas impede contar cliques e alterar o destino depois. O 302 obriga o navegador a consultar sempre, preservando analytics e a capacidade de mudar o destino, ao custo de manter o tráfego no servidor.',
          },
        ],
      },
    },
    {
      slug: 'chat-em-tempo-real',
      title: 'Projeto: chat em tempo real',
      summary:
        'Conexões persistentes, entrega ordenada e presença em escala.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Um sistema de chat combina conexões persistentes em massa, roteamento entre servidores, ordenação de mensagens e entrega confiável para quem está offline.',
        blocks: [
          {
            type: 'p',
            text: 'A primeira decisão é o transporte. Chat tem tráfego frequente nas duas direções, então WebSocket é a escolha natural. Isso torna o serviço stateful: cada usuário mantém uma conexão aberta com uma instância específica, e o limite de escala passa a ser conexões simultâneas em vez de requisições por segundo. Um servidor bem ajustado sustenta centenas de milhares de conexões ociosas — o gargalo é memória por conexão, não CPU.',
          },
          {
            type: 'key',
            text: 'O problema central não é receber a mensagem — é encontrar o destinatário. Se A está conectado ao servidor 3 e B ao servidor 17, o servidor 3 precisa saber disso e conseguir entregar. Essa é a peça que define a arquitetura inteira.',
          },
          {
            type: 'p',
            text: 'A solução padrão tem duas partes. Um registro de sessões mapeia usuário para o servidor onde ele está conectado, mantido num armazenamento rápido e atualizado a cada conexão e desconexão. E um pub/sub interno faz o roteamento: cada servidor assina um canal por usuário conectado a ele; para entregar, basta publicar no canal do destinatário, sem que o emissor precise saber onde ele está.',
          },
          {
            type: 'h',
            text: 'Persistência e ordenação',
          },
          {
            type: 'p',
            text: 'Toda mensagem é gravada antes de ser entregue — a conexão pode cair a qualquer momento, e o histórico precisa existir. O padrão de acesso é sempre "as mensagens desta conversa, mais recentes primeiro", o que sugere uma chave composta: a conversa como chave de partição e o tempo como chave de ordenação. Assim tudo de uma conversa fica junto e a leitura da tela é uma única consulta por intervalo.',
          },
          {
            type: 'p',
            text: 'A ordenação merece cuidado. Relógios de clientes não são confiáveis e relógios de servidores diferentes divergem, então usar timestamp como ordem produz mensagens fora de sequência. A solução é atribuir um número sequencial por conversa no momento da gravação, o que dá ordem total dentro daquele contexto — que é onde a ordem realmente importa. Entre conversas diferentes, a ordem relativa é irrelevante.',
          },
          {
            type: 'p',
            text: 'Para o destinatário offline, a mensagem fica pendente e é entregue na reconexão: o cliente informa o último número de sequência que possui e recebe tudo o que veio depois. Esse mesmo mecanismo resolve a perda por queda de conexão, sem precisar de confirmação por mensagem no protocolo de transporte.',
          },
          {
            type: 'h',
            text: 'Presença e grupos',
          },
          {
            type: 'p',
            text: 'Indicadores de presença — online, digitando, visto por último — são enganosamente caros. Cada mudança precisa ser propagada a todos os contatos do usuário, e "digitando" muda várias vezes por segundo. Em escala, isso pode gerar mais tráfego que as próprias mensagens. As mitigações usuais são limitar a frequência de atualização, propagar apenas para contatos com a conversa aberta, e tratar presença como dado descartável, mantido em memória com TTL curto e sem persistência.',
          },
          {
            type: 'p',
            text: 'Grupos multiplicam o fan-out: uma mensagem num grupo de mil pessoas vira mil entregas. Para grupos pequenos, o fan-out direto funciona. Para grupos muito grandes, vale inverter — os membros buscam as mensagens novas ao abrir a conversa, em vez de receberem push individual, exatamente o mesmo trade-off de push versus pull do feed social.',
          },
          {
            type: 'h',
            text: 'Dimensionando o serviço de conexões',
          },
          {
            type: 'p',
            text: 'A conta que orienta tudo é de conexões, não de requisições. Com 50 milhões de usuários ativos diários e 10% simultaneamente conectados, são 5 milhões de conexões abertas. Se cada instância sustenta 100 mil com folga — limitada por memória de buffers e estado de sessão, não por CPU —, a camada de gateway tem cerca de 50 instâncias. Esse número justifica separar o gateway e mantê-lo burro de propósito: ele só mantém a conexão, autentica e repassa, enquanto a lógica de mensagens vive num serviço stateless que faz deploy sem derrubar conexões.',
          },
          {
            type: 'p',
            text: 'O armazenamento também é revelador: um bilhão de mensagens diárias a 300 bytes dá 300 GB por dia e mais de 100 TB por ano antes de réplicas, volume que exclui um relacional único. Como o acesso é quase todo às mensagens recentes, vale separar por temperatura — os últimos meses num armazenamento rápido, o histórico antigo num barato e mais lento.',
          },
          {
            type: 'p',
            text: 'Há ainda a diferença entre entregue e confirmado, que rende os indicadores de tíque duplo. Escrever no socket não prova recebimento: o aplicativo pode ter sido encerrado, a rede móvel pode ter caído em silêncio. Por isso o cliente confirma o número de sequência que processou. Como a mensagem pode ser reenviada após uma reconexão, cada uma carrega um identificador do remetente e o cliente descarta duplicatas — pelo menos uma vez na rede, exatamente uma vez na tela.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Esquecer da reconexão em massa. Quando uma instância cai ou é substituída num deploy, todos os seus clientes reconectam ao mesmo tempo, cada um pedindo o histórico perdido. Sem backoff exponencial com jitter no cliente e sem limite de taxa na aceitação de conexões, essa onda derruba as instâncias restantes em cascata — um deploy de rotina vira um incidente.',
          },
        ],
        quiz: [
          {
            q: 'Como uma mensagem chega a um usuário conectado em outra instância?',
            a: 'Por um pub/sub interno: cada servidor assina um canal por usuário conectado a ele, e para entregar basta publicar no canal do destinatário — o servidor que o mantém recebe e envia pela conexão aberta. Um registro de sessões mapeando usuário para servidor complementa, permitindo saber se ele está online.',
          },
          {
            q: 'Por que não usar timestamp para ordenar mensagens de uma conversa?',
            a: 'Porque relógios de clientes são manipuláveis e relógios de servidores distintos divergem entre si, produzindo ordenações incorretas e instáveis. A solução é um número sequencial atribuído por conversa no momento da gravação, que dá ordem total no único escopo onde a ordem importa.',
          },
          {
            q: 'Por que indicadores de presença podem custar mais que as mensagens?',
            a: 'Porque cada mudança de estado precisa ser propagada a todos os contatos, e estados como "digitando" mudam várias vezes por segundo por usuário. O volume de eventos de presença supera facilmente o de mensagens reais, o que obriga a limitar frequência, restringir a propagação a quem está com a conversa aberta e tratar o dado como descartável.',
          },
        ],
      },
    },
    {
      slug: 'feed-de-rede-social',
      title: 'Projeto: feed de rede social',
      summary:
        'Fan-out na escrita ou na leitura, e o problema das contas com milhões de seguidores.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Montar um feed é escolher onde pagar o custo: distribuir o post para todos os seguidores na publicação, ou juntar os posts de quem se segue na leitura.',
        blocks: [
          {
            type: 'p',
            text: 'O problema parece trivial — mostre os posts recentes de quem eu sigo, em ordem — e é um dos mais ricos em trade-offs. A dificuldade vem da distribuição extremamente desigual: a maioria das contas tem dezenas de seguidores, e um punhado tem dezenas de milhões. Nenhuma estratégia única funciona bem para os dois casos.',
          },
          {
            type: 'h',
            text: 'Fan-out na escrita',
          },
          {
            type: 'p',
            text: 'Na publicação, o post é copiado para uma lista pré-montada de cada seguidor — a caixa de entrada. Ler o feed vira uma única consulta por chave, rápida e barata, o que é ótimo porque a leitura é a operação dominante e a que o usuário percebe.',
          },
          {
            type: 'p',
            text: 'O custo aparece na publicação: um post de uma conta com 10 milhões de seguidores gera 10 milhões de escritas. Isso é caro, lento e cria picos de carga imprevisíveis. Pior, boa parte desse trabalho é desperdício — a maioria dos seguidores não abrirá o app antes de o post envelhecer.',
          },
          {
            type: 'h',
            text: 'Fan-out na leitura',
          },
          {
            type: 'p',
            text: 'A alternativa é não pré-computar nada: publicar custa uma escrita, e o feed é montado no momento da leitura, buscando os posts recentes de cada conta seguida e intercalando por data. Publicar fica trivial, mas ler fica caro — e ler é o que acontece o tempo todo. Para alguém que segue duas mil contas, montar o feed exige consultar duas mil origens.',
          },
          {
            type: 'key',
            text: 'A solução real é híbrida, e a regra é simples: fan-out na escrita para a esmagadora maioria das contas, cujo número de seguidores é pequeno; fan-out na leitura para as poucas contas gigantes, cujo fan-out seria proibitivo. O feed final é a mistura da caixa de entrada pré-montada com uma consulta às poucas contas grandes que o usuário segue.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Fan-out na escrita', 'Fan-out na leitura', 'Híbrido'],
            rows: [
              ['Custo de publicar', 'Alto para contas grandes', 'Mínimo', 'Baixo'],
              ['Custo de ler', 'Mínimo', 'Alto', 'Baixo'],
              ['Armazenamento', 'Duplica por seguidor', 'Sem duplicação', 'Moderado'],
              ['Latência do feed', 'Ótima', 'Ruim', 'Boa'],
              ['Complexidade', 'Baixa', 'Baixa', 'Média'],
            ],
          },
          {
            type: 'h',
            text: 'Detalhes que aparecem no aprofundamento',
          },
          {
            type: 'p',
            text: 'A caixa de entrada não precisa guardar o post inteiro — apenas o identificador, com o conteúdo buscado à parte. Isso reduz drasticamente o armazenamento duplicado e faz com que uma edição ou exclusão do post se reflita automaticamente em todos os feeds, sem precisar reescrever milhões de cópias.',
          },
          {
            type: 'p',
            text: 'A caixa também deve ser limitada: guardar apenas as últimas centenas de entradas por usuário. Ninguém rola milhares de posts, e a memória economizada é enorme. Quem realmente quiser ir mais fundo cai num caminho de leitura mais lento, que é aceitável por ser raro.',
          },
          {
            type: 'p',
            text: 'Usuários inativos são outra otimização importante: não faz sentido manter caixa de entrada de quem não abre o app há meses. Suspender o fan-out para eles e reconstruir sob demanda no primeiro acesso elimina uma fatia grande do trabalho desperdiçado.',
          },
          {
            type: 'p',
            text: 'Se o feed for ordenado por relevância em vez de cronologia, o desenho muda: a caixa passa a ser um conjunto de candidatos, e uma camada de ranqueamento os ordena no momento da leitura usando sinais de engajamento. Isso reintroduz custo na leitura e é o motivo de feeds algorítmicos serem bem mais caros de operar que cronológicos.',
          },
          {
            type: 'p',
            text: 'Os números tornam o argumento concreto. Com 500 milhões de ativos diários abrindo o app dez vezes, são 5 bilhões de leituras por dia — cerca de 60 mil por segundo em média, talvez 150 mil no pico. Se 1% dos usuários publica uma vez ao dia para uma média de 300 seguidores, o fan-out gera 1,5 bilhão de entradas diárias, algo como 20 mil escritas por segundo. Cada entrada guardando só identificador, autor e timestamp ocupa poucas dezenas de bytes, o que mantém as caixas de entrada em memória.',
          },
          {
            type: 'p',
            text: 'A paginação é onde desenhos ingênuos falham. Paginar por deslocamento numérico num feed que recebe posts o tempo todo faz o usuário ver itens repetidos ou pular itens, porque a lista se desloca entre uma página e a próxima. A solução é o cursor: o cliente devolve a posição do último item visto — timestamp mais identificador para desempate — e recebe o que vem depois. O feed fica estável durante a rolagem, e as novidades aparecem só ao atualizar.',
          },
          {
            type: 'p',
            text: 'Sob 10x de carga, o que cede primeiro não é a leitura, é o fan-out. A leitura escala quase linearmente por ser busca por chave com cache; a escrita cresce com o produto de publicações por seguidores, que aumenta mais rápido que o número de usuários conforme a rede adensa. É aí que o corte de contas grandes desce e mais inativos são suspensos: quando a escala aumenta, o híbrido inclina para o lado do pull.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Propor apenas uma das duas estratégias e não reconhecer o caso extremo. O entrevistador quase sempre vai perguntar "e se a conta tiver 50 milhões de seguidores?" — essa pergunta é o ponto da questão. Antecipar o híbrido e explicar o critério de corte entre os dois caminhos é o que diferencia a resposta.',
          },
        ],
        quiz: [
          {
            q: 'Por que nenhuma das duas estratégias puras funciona bem sozinha?',
            a: 'Porque a distribuição de seguidores é extremamente desigual. Fan-out na escrita é ótimo para contas comuns e proibitivo para as gigantes, que geram milhões de escritas por post. Fan-out na leitura é ótimo para publicar e caro para ler, penalizando a operação mais frequente e mais visível ao usuário.',
          },
          {
            q: 'Por que a caixa de entrada deve guardar apenas identificadores de post?',
            a: 'Porque evita duplicar o conteúdo em milhões de caixas, reduzindo muito o armazenamento, e porque faz edições e exclusões se refletirem automaticamente em todos os feeds — o conteúdo é buscado no momento da leitura a partir de uma única fonte, sem reescrever cópias.',
          },
          {
            q: 'Que otimização se aplica a usuários inativos?',
            a: 'Suspender o fan-out para eles: não faz sentido escrever em caixas de entrada de quem não abre o aplicativo há meses. Quando um usuário assim retorna, o feed é reconstruído sob demanda no primeiro acesso. Isso elimina uma fração grande do trabalho de publicação que nunca seria consumido.',
          },
        ],
      },
    },
    {
      slug: 'streaming-de-video',
      title: 'Projeto: streaming de vídeo',
      summary:
        'Transcodificação, bitrate adaptativo e a CDN como peça central.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Streaming separa dois problemas distintos: processar o vídeo enviado em muitas versões, e entregar essas versões com latência mínima a partir da borda.',
        blocks: [
          {
            type: 'p',
            text: 'O sistema tem dois caminhos independentes, com características opostas. A ingestão é rara, pesada e tolerante a atraso: alguém envia um arquivo grande e aceita esperar minutos pelo processamento. A entrega é frequente, sensível a latência e responsável por praticamente todo o custo de banda da operação.',
          },
          {
            type: 'h',
            text: 'Ingestão e transcodificação',
          },
          {
            type: 'p',
            text: 'O upload não deve passar pelo servidor de aplicação — um arquivo de vários gigabytes ocuparia recursos e não há motivo. O padrão é o cliente pedir uma URL assinada e enviar diretamente ao armazenamento de objetos, em partes, com retomada em caso de falha de rede.',
          },
          {
            type: 'p',
            text: 'A conclusão do upload dispara um pipeline assíncrono. O vídeo é dividido em segmentos de poucos segundos, e cada segmento é transcodificado independentemente para várias resoluções e taxas de bits. Como os segmentos não dependem uns dos outros, o trabalho é embaraçosamente paralelo: distribuindo entre muitos workers, um vídeo de uma hora é processado em minutos.',
          },
          {
            type: 'key',
            text: 'Segmentar é o que torna tudo possível: permite paralelizar a transcodificação, permite ao player trocar de qualidade no meio da reprodução, e permite que a CDN cacheie pedaços pequenos em vez de arquivos gigantescos.',
          },
          {
            type: 'p',
            text: 'O resultado é um manifesto — um arquivo de texto que lista as qualidades disponíveis e a URL de cada segmento de cada qualidade. É a partir dele que o player toma todas as decisões.',
          },
          {
            type: 'h',
            text: 'Entrega e bitrate adaptativo',
          },
          {
            type: 'p',
            text: 'A inteligência da reprodução mora no cliente, não no servidor. O player mede quanto tempo cada segmento levou para baixar e o quanto ainda tem em buffer; se a rede está folgada, pede o próximo segmento numa qualidade maior; se está apertada, cai para uma menor. Como todas as versões estão alinhadas nos mesmos limites de tempo, a troca é imperceptível.',
          },
          {
            type: 'p',
            text: 'Isso simplifica enormemente o servidor: ele apenas serve arquivos estáticos. E arquivos estáticos são exatamente o que uma CDN faz melhor — os segmentos são imutáveis, podem ter TTL longuíssimo e são servidos da borda mais próxima. Numa operação madura, mais de 95% da banda sai da CDN e a origem quase não é tocada.',
          },
          {
            type: 'p',
            text: 'Para os títulos mais populares, vale ir além do cache reativo e pré-posicionar o conteúdo nos pontos de presença antes do lançamento, evitando que o primeiro acesso de cada região precise buscar na origem — o pico de estreia é justamente o momento em que a origem não pode ser sobrecarregada.',
          },
          {
            type: 'table',
            head: ['Etapa', 'Característica', 'Decisão de projeto'],
            rows: [
              ['Upload', 'Raro, arquivo grande', 'Direto ao storage, em partes, retomável'],
              ['Transcodificação', 'Pesada, paralelizável', 'Fila + workers por segmento'],
              ['Armazenamento', 'Muitas versões do mesmo vídeo', 'Object storage, camadas por popularidade'],
              ['Entrega', 'Alto volume, sensível a latência', 'CDN com segmentos imutáveis'],
              ['Qualidade', 'Rede variável do usuário', 'Decisão no player (bitrate adaptativo)'],
            ],
          },
          {
            type: 'h',
            text: 'A conta que domina o desenho',
          },
          {
            type: 'p',
            text: 'Comece pela banda, porque ela dita tudo. Uma reprodução em 1080p consome algo em torno de 5 Mbps. Com 10 milhões de espectadores simultâneos no pico, são 50 Tbps de saída — número que nenhum data center próprio entrega e que explica por que a CDN não é uma otimização, é a arquitetura. Do lado do armazenamento, um filme de duas horas transcodificado em seis qualidades ocupa por volta de 20 GB; um catálogo de 100 mil títulos chega a 2 PB, o que empurra as versões pouco assistidas para camadas de armazenamento mais frias.',
          },
          {
            type: 'p',
            text: 'A escolha do tamanho do segmento é um trade-off que rende boa discussão. Segmentos curtos, de dois segundos, permitem o player reagir rápido a mudanças de rede e reduzem a latência inicial, ao custo de mais requisições, mais overhead de protocolo e mais arquivos para a CDN gerenciar. Segmentos de dez segundos invertem tudo: menos requisições, compressão marginalmente melhor, e uma reação lenta que faz o vídeo travar antes de o player conseguir baixar de qualidade. Para vídeo sob demanda, algo entre quatro e seis segundos é o meio-termo usual.',
          },
          {
            type: 'p',
            text: 'Transmissão ao vivo muda a natureza do problema e é a variação que o entrevistador costuma introduzir. Sem arquivo completo, a segmentação acontece em tempo real e a latência total passa a ser a soma do tempo de captura, transcodificação, propagação até a borda e buffer do player — facilmente entre vinte e trinta segundos com o protocolo tradicional. Reduzir isso exige segmentos parciais entregues em partes conforme são gerados, buffer menor no player e tolerância maior a interrupções. É o trade-off direto entre latência e estabilidade da reprodução.',
          },
          {
            type: 'p',
            text: 'Uma peça fácil de esquecer é a proteção de conteúdo: os segmentos são cifrados e a chave vem de um servidor de licenças separado, mediante autenticação. Isso permite manter os arquivos publicamente cacheáveis na CDN sem que sejam utilizáveis fora do player autorizado — a segurança fica no acesso à chave, não no acesso ao arquivo.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tratar o custo de banda como detalhe. Em streaming, a banda de saída costuma ser a maior linha da conta — maior que computação e armazenamento somados. Decisões que parecem técnicas (qual codec, quantas qualidades gerar, quanto pré-carregar no player) são principalmente decisões econômicas, e ignorá-las na entrevista deixa de fora o que mais importa nesse domínio.',
          },
        ],
        quiz: [
          {
            q: 'Por que dividir o vídeo em segmentos é a decisão central do desenho?',
            a: 'Porque habilita três coisas ao mesmo tempo: transcodificação paralela, já que segmentos são independentes; troca de qualidade durante a reprodução, porque as versões estão alinhadas nos mesmos limites; e cache eficiente na CDN, que lida com muitos arquivos pequenos e imutáveis em vez de um arquivo gigante.',
          },
          {
            q: 'Por que a decisão de qualidade fica no player e não no servidor?',
            a: 'Porque só o cliente conhece as condições reais da sua rede naquele instante — tempo de download dos últimos segmentos e ocupação do buffer. Deixar a decisão nele mantém o servidor servindo apenas arquivos estáticos, o que permite delegar praticamente toda a entrega à CDN.',
          },
          {
            q: 'Por que o upload não deve passar pelo servidor de aplicação?',
            a: 'Porque um arquivo de vários gigabytes ocuparia banda, memória e conexões do servidor sem nenhum ganho — ele apenas repassaria os bytes. Com URL assinada, o cliente envia direto ao armazenamento de objetos, em partes e com retomada, e o servidor só participa da autorização e da notificação de conclusão.',
          },
        ],
      },
    },
    {
      slug: 'ride-hailing',
      title: 'Projeto: aplicativo de caronas',
      summary:
        'Indexação geoespacial, pareamento em tempo real e atualização de localização.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'O desafio é buscar por proximidade num conjunto que se move constantemente: milhões de motoristas atualizando posição enquanto passageiros pedem o mais próximo.',
        blocks: [
          {
            type: 'p',
            text: 'Duas cargas muito diferentes convivem. Motoristas ativos enviam localização a cada poucos segundos — um volume de escrita altíssimo e contínuo. Passageiros pedem corrida ocasionalmente, mas cada pedido exige uma busca por proximidade e uma decisão rápida. O sistema precisa ser bom em ambas.',
          },
          {
            type: 'key',
            text: 'Buscar "os mais próximos" com coordenadas cruas é caro: exige calcular distância contra todos os candidatos. A solução é transformar duas dimensões em uma, de modo que proximidade geográfica vire proximidade numérica — e a busca vire uma consulta por intervalo.',
          },
          {
            type: 'h',
            text: 'Indexação geoespacial',
          },
          {
            type: 'p',
            text: 'A técnica mais comum é o geohash: o mapa é dividido recursivamente em quadrantes, e cada divisão acrescenta um caractere ao código da célula. Quanto mais caracteres, menor a área. A propriedade útil é que pontos próximos compartilham o prefixo — então buscar vizinhos vira buscar chaves com o mesmo prefixo, que qualquer índice ordenado resolve com eficiência.',
          },
          {
            type: 'p',
            text: 'Há uma armadilha conhecida: dois pontos podem estar fisicamente colados e ter prefixos diferentes se estiverem em lados opostos de uma fronteira de célula. Por isso a busca sempre inclui as células vizinhas, não apenas a própria — tipicamente as oito ao redor. Alternativas como as células do S2, que usam uma curva de preenchimento de espaço sobre a esfera, atacam o mesmo problema com distorção menor.',
          },
          {
            type: 'p',
            text: 'A precisão da célula deve variar com a densidade. No centro de uma cidade grande, uma célula pequena já contém motoristas suficientes; numa região esparsa, é preciso ampliar o raio progressivamente até encontrar candidatos. Fixar uma precisão única entrega buscas vazias numa área e listas gigantescas na outra.',
          },
          {
            type: 'h',
            text: 'Atualização de localização',
          },
          {
            type: 'p',
            text: 'Gravar cada atualização de posição num banco durável seria caro e inútil: a posição de dez segundos atrás não tem valor. O padrão é manter as posições atuais em memória, num armazenamento rápido com suporte a índice geoespacial e TTL — se um motorista para de atualizar, sua entrada expira sozinha e ele sai da busca sem nenhum processo de limpeza.',
          },
          {
            type: 'p',
            text: 'O histórico de trajeto, quando necessário para faturamento ou auditoria, segue por outro caminho: enviado em lote para um armazenamento de série temporal, fora do caminho crítico do pareamento. São dois problemas com requisitos opostos, e misturá-los prejudica os dois.',
          },
          {
            type: 'h',
            text: 'Pareamento',
          },
          {
            type: 'p',
            text: 'Encontrar candidatos próximos é só o começo. A escolha considera distância, tempo estimado de chegada — que depende do trânsito e não da distância em linha reta —, avaliação e aceitação prevista. E há uma corrida a resolver: o mesmo motorista pode ser oferecido a dois passageiros simultaneamente, então a atribuição precisa ser atômica, com o primeiro pedido a confirmar travando o motorista e o segundo recebendo outro candidato.',
          },
          {
            type: 'p',
            text: 'O sistema também é naturalmente particionável por geografia: corridas em cidades diferentes não interagem, o que permite operar cada região de forma independente e escalar horizontalmente com facilidade. É um dos raros domínios em que a chave de partição é evidente desde o início.',
          },
          {
            type: 'p',
            text: 'As proporções deixam a assimetria evidente. Com 1 milhão de motoristas ativos enviando posição a cada 4 segundos, são 250 mil escritas por segundo só de localização. Já os pedidos, mesmo com 10 milhões de viagens diárias, ficam em torno de 120 por segundo. A escrita de localização é mil vezes mais frequente que o evento que dá dinheiro — por isso ela nunca pode tocar um banco durável no caminho síncrono.',
          },
          {
            type: 'h',
            text: 'O ciclo de vida da corrida',
          },
          {
            type: 'p',
            text: 'A corrida em si é uma máquina de estados: solicitada, oferecida, aceita, a caminho, em viagem, concluída. Diferente das posições, esse estado precisa ser durável e consistente — perder que uma corrida foi aceita produz dois motoristas no mesmo endereço ou um passageiro esperando por ninguém. São dois subsistemas com requisitos opostos, um em memória com TTL e outro transacional, ligados apenas no momento da atribuição.',
          },
          {
            type: 'p',
            text: 'A oferta merece detalhe porque é onde as corridas se perdem. Oferecer a todos ao mesmo tempo maximiza a chance de aceite e cria a disputa de propósito; oferecer em série, com janela de dez a quinze segundos cada, evita o conflito mas soma esperas se vários recusarem. O intermediário é oferecer a um pequeno lote com reserva temporária de cada candidato — um lock de expiração curta.',
          },
          {
            type: 'p',
            text: 'Duas questões fecham o quadro. A precificação dinâmica é uma agregação em stream por célula, comparando pedidos e oferta em janelas curtas, com suavização para o preço não oscilar a cada minuto. E o pareamento não precisa ser instantâneo: acumular pedidos por alguns segundos e atribuir em lote produz pares melhores que decidir um a um.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Propor uma consulta com cálculo de distância sobre todos os motoristas ativos. Funciona no protótipo e é inviável com milhões de registros atualizando a cada segundo: cada busca varreria a base inteira. Sem índice espacial que transforme proximidade em consulta por intervalo, nada mais no desenho se sustenta.',
          },
        ],
        quiz: [
          {
            q: 'Como o geohash transforma busca por proximidade em consulta por intervalo?',
            a: 'Ele codifica a posição bidimensional numa string em que pontos geograficamente próximos compartilham o prefixo. Buscar vizinhos passa a ser buscar chaves com o mesmo prefixo, o que um índice ordenado resolve como consulta por intervalo — sem calcular distância contra todos os candidatos.',
          },
          {
            q: 'Por que a busca precisa incluir as células vizinhas?',
            a: 'Porque dois pontos podem estar fisicamente adjacentes e ter prefixos diferentes se ficam em lados opostos de uma fronteira de célula. Consultar apenas a própria célula perderia candidatos muito próximos, então incluem-se as células ao redor — tipicamente as oito adjacentes.',
          },
          {
            q: 'Por que posições atuais e histórico de trajeto devem ir para sistemas diferentes?',
            a: 'Porque têm requisitos opostos. A posição atual precisa de escrita e leitura rápidas em memória, expira em segundos e não exige durabilidade — a de dez segundos atrás é inútil. O histórico precisa de durabilidade e retenção longa, mas tolera latência e escrita em lote, fora do caminho crítico do pareamento.',
          },
        ],
      },
    },
    {
      slug: 'edicao-colaborativa',
      title: 'Projeto: edição colaborativa',
      summary:
        'Resolver edições simultâneas com transformação operacional ou CRDTs.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Quando várias pessoas editam o mesmo documento ao mesmo tempo, as edições chegam fora de ordem e se referem a estados diferentes. Convergir todos ao mesmo resultado é o problema central.',
        blocks: [
          {
            type: 'p',
            text: 'A dificuldade fica clara num exemplo mínimo. O documento contém "gato". A edita inserindo "s" na posição 4, resultando em "gatos". Simultaneamente, B insere "o" na posição 0, resultando em "ogato". As duas operações foram criadas sobre o mesmo estado original, mas cada uma chega ao outro lado depois que aquele já mudou. Aplicar a operação de A literalmente no documento de B insere na posição errada, e os dois divergem permanentemente.',
          },
          {
            type: 'key',
            text: 'O problema não é conflito no sentido do controle de versão — não há decisão a tomar sobre qual edição vence. As duas devem ser preservadas; o que falta é traduzir os índices de uma operação para o estado que o outro lado realmente tem.',
          },
          {
            type: 'h',
            text: 'Transformação operacional',
          },
          {
            type: 'p',
            text: 'A abordagem clássica ajusta a operação antes de aplicá-la. Ao receber a inserção de A na posição 4, o cliente de B verifica que já aplicou uma inserção de um caractere na posição 0 e desloca o índice de A para 5. O resultado é "ogatos" nos dois lados. É elegante e eficiente em banda, mas a lógica de transformação precisa cobrir todos os pares de tipos de operação, e a corretude é notoriamente difícil de provar — implementações reais levaram anos para acertar os casos de borda.',
          },
          {
            type: 'p',
            text: 'A transformação operacional normalmente depende de um servidor central que ordena as operações e serve de referência para todos. Isso simplifica muito o raciocínio e é perfeitamente adequado quando já existe um servidor no desenho — o que é o caso da maioria dos produtos.',
          },
          {
            type: 'h',
            text: 'CRDTs',
          },
          {
            type: 'p',
            text: 'A abordagem alternativa muda a estrutura de dados em vez da operação. Num CRDT de texto, cada caractere recebe um identificador único e imutável, e a posição é definida por ordem relativa entre identificadores, não por índice numérico. Como o identificador não muda quando outros caracteres são inseridos, não há nada a transformar: aplicar as operações em qualquer ordem leva ao mesmo resultado, por construção matemática.',
          },
          {
            type: 'p',
            text: 'Isso permite funcionamento genuinamente descentralizado e offline: dois usuários editam sem conexão por horas e, ao sincronizar, convergem sem servidor arbitrando. O custo é de metadados — cada caractere carrega seu identificador, e caracteres apagados precisam permanecer como marcadores para preservar a ordenação, o que faz o documento crescer além do texto visível e exige compactação periódica.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Transformação operacional', 'CRDT'],
            rows: [
              ['Precisa de servidor central', 'Normalmente sim', 'Não'],
              ['Metadados', 'Mínimos', 'Grandes (id por caractere)'],
              ['Complexidade', 'Na lógica de transformação', 'Na estrutura de dados'],
              ['Offline prolongado', 'Difícil', 'Natural'],
              ['Prova de corretude', 'Difícil', 'Por construção'],
            ],
          },
          {
            type: 'p',
            text: 'Além da convergência, o produto precisa de várias peças que não são o algoritmo: presença e cursores dos outros participantes (dado efêmero, que não entra no documento), histórico de versões para desfazer, e persistência — normalmente um snapshot periódico somado às operações posteriores, para não reproduzir a história inteira ao abrir o arquivo.',
          },
          {
            type: 'h',
            text: 'O desenho ao redor do algoritmo',
          },
          {
            type: 'p',
            text: 'A carga aqui é peculiar: alta frequência e granularidade minúscula. Cada tecla é uma operação, algo entre cinco e dez eventos por segundo por participante ativo, com poucas dezenas de bytes cada. Dez editores simultâneos geram cerca de cem operações por segundo a difundir para todos — trivial em bytes e exigente em latência, porque acima de cem ou duzentos milissegundos a colaboração parece travada. É um problema de latência e fan-out, não de throughput.',
          },
          {
            type: 'p',
            text: 'Daí decorre a partição que simplifica tudo: o documento é a unidade de escala, e todas as sessões de um mesmo documento vão para a mesma instância, que mantém o estado em memória, ordena as operações, difunde e persiste periodicamente. Como documentos são independentes, escalar é distribuí-los entre instâncias. O custo é o handoff quando uma instância cai: recarregar o último snapshot mais as operações posteriores antes de aceitar novas edições.',
          },
          {
            type: 'p',
            text: 'A latência percebida vem de aplicar a operação localmente antes de qualquer confirmação: o caractere aparece na hora e a reconciliação acontece por baixo. É o que torna o editor utilizável e também o que cria o efeito mais desagradável do domínio — o cursor pulando quando uma operação remota desloca o texto sob ele. Por isso a posição do cursor precisa ser transformada junto com as operações, nunca guardada como índice bruto.',
          },
          {
            type: 'p',
            text: 'O desfazer é mais sutil do que parece. Num editor colaborativo ele não pode reverter a última operação global — isso apagaria o que outra pessoa acabou de escrever. Precisa ser um desfazer por autor: reverter a última operação daquele usuário, transformada para o estado atual. Implementar isso exige uma pilha por participante e gerar a operação inversa no contexto presente, em vez de remover a antiga da história.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Propor bloqueio ou "última escrita vence". Travar o documento ou parágrafo destrói a experiência de colaboração — é o oposto do que o produto promete. E deixar a última escrita vencer descarta silenciosamente o trabalho de alguém que estava digitando ao mesmo tempo. Edição colaborativa exige convergência que preserve todas as intenções, não uma política de desempate.',
          },
        ],
        quiz: [
          {
            q: 'Por que aplicar literalmente uma operação recebida causa divergência?',
            a: 'Porque a operação carrega índices calculados sobre o estado que o autor via, e o destinatário já aplicou outras edições que deslocaram esses índices. Inserir na posição indicada coloca o texto no lugar errado, e como cada lado erra de forma diferente, os documentos divergem permanentemente.',
          },
          {
            q: 'Qual a diferença fundamental de abordagem entre transformação operacional e CRDT?',
            a: 'A transformação operacional ajusta a operação para o estado do destinatário, mantendo a estrutura de dados simples e concentrando a complexidade na lógica de transformação. O CRDT muda a estrutura de dados — identificadores imutáveis por caractere e ordem relativa — de modo que nenhuma transformação seja necessária e a convergência seja garantida por construção.',
          },
          {
            q: 'Qual o custo prático de usar CRDT para texto?',
            a: 'Metadados. Cada caractere carrega um identificador único, e os caracteres apagados precisam permanecer como marcadores para preservar a ordenação relativa. O documento cresce bem além do texto visível, o que exige compactação periódica e aumenta o custo de transmissão e armazenamento.',
          },
        ],
      },
    },
  ],
};

import type { ModuleSeed } from '../types';

export const continuar: ModuleSeed = {
  slug: 'para-continuar',
  title: 'Para continuar',
  goal: 'Saber onde ir depois desta trilha: como escolher a próxima referência, o que praticar e como manter o conhecimento vivo sem virar colecionador de links.',
  lessons: [
    {
      slug: 'ddia',
      title: 'Designing Data-Intensive Applications',
      kind: 'BOOK',
      summary:
        'O livro de referência sobre armazenamento, replicação, particionamento e processamento de dados.',
      sourceUrl: 'https://dataintensive.net/',
      content: {
        summary:
          'DDIA é a referência mais recomendada da área porque explica os princípios por trás das ferramentas, em vez de ensinar a usá-las — o que faz o conteúdo envelhecer devagar.',
        blocks: [
          {
            type: 'p',
            text: 'A diferença entre este livro e a maior parte do material técnico é o nível de abstração. Ele não ensina a configurar um banco específico; explica como bancos funcionam por dentro, por que fazem as escolhas que fazem, e o que cada escolha implica. Isso torna o conhecimento transferível: entendendo o que é um índice LSM e o que ele troca, você avalia qualquer ferramenta que use essa estrutura, inclusive as que ainda não existem.',
          },
          {
            type: 'key',
            text: 'A qualidade que faz o livro valer o tempo é a honestidade sobre trade-offs. Cada técnica é apresentada com o que custa, não apenas com o que resolve — que é exatamente a postura que se espera de quem projeta sistemas.',
          },
          {
            type: 'p',
            text: 'A organização segue três partes. A primeira trata de fundamentos de um nó só: modelos de dados, estruturas de armazenamento, codificação e evolução de esquema. A segunda entra em dados distribuídos: replicação, particionamento, transações, os limites dos sistemas distribuídos e os modelos de consistência. A terceira aborda dados derivados: processamento em lote, em stream, e como sistemas se integram.',
          },
          {
            type: 'p',
            text: 'Os capítulos sobre transações e sobre os problemas dos sistemas distribuídos são os que mais mudam a forma de pensar. O primeiro deixa claro que os níveis de isolamento com que quase todo código roda são bem mais fracos do que a intuição sugere. O segundo desmonta sistematicamente as suposições confortáveis: relógios não são confiáveis, a rede mente, e processos podem pausar por segundos sem aviso.',
          },
          {
            type: 'p',
            text: 'Uma forma prática de ler: não tente a leitura linear completa de primeira. Percorra os capítulos que tocam problemas que você já enfrentou — replicação se você convive com lag, particionamento se pensa em sharding — e volte depois para os demais. O livro funciona bem como referência consultável, e o conteúdo assenta melhor quando conecta a uma dor real.',
          },
          {
            type: 'h',
            text: 'Um plano de leitura que funciona',
          },
          {
            type: 'p',
            text: 'Se você quer um ponto de entrada concreto, comece pelo capítulo de replicação. Ele é autocontido, trata de um problema que qualquer sistema com mais de um banco já tem, e introduz o vocabulário de consistência de forma aplicada — leitura das próprias escritas, leituras monotônicas, o que o lag realmente causa. Depois dele, o capítulo sobre particionamento se encaixa naturalmente, e só então valem os dois mais densos: transações e os problemas dos sistemas distribuídos. Tentar começar por esses últimos, sem a base anterior, é a receita mais comum de abandono.',
          },
          {
            type: 'p',
            text: 'Um método que rende mais que grifar: ao terminar cada capítulo, escreva de memória três parágrafos sobre o problema tratado, a solução principal e o que ela custa. A dificuldade em produzir o terceiro parágrafo é o diagnóstico — se você não consegue enunciar o custo, ainda não entendeu a técnica, apenas reconheceu o nome. Guardar esses textos também cria uma referência sua, escrita no seu vocabulário, que costuma ser mais útil na hora de recordar do que voltar ao livro.',
          },
          {
            type: 'p',
            text: 'Os capítulos finais, sobre processamento em lote e em stream, são frequentemente pulados por quem não trabalha com dados, e é um erro. É neles que aparece a ideia de que estado é uma projeção de um fluxo de eventos, que reorganiza a forma de pensar integração entre serviços mesmo em sistemas modestos. Boa parte das arquiteturas orientadas a eventos que se vê hoje é aplicação direta desse raciocínio, e entendê-lo pela raiz evita adotá-lo como moda.',
          },
          {
            type: 'p',
            text: 'Vale uma nota sobre o que o livro não cobre, para calibrar a expectativa. Ele é sobre dados: armazenar, replicar, particionar, processar. Não trata de desenho de API, de decomposição em serviços, de estimativa de capacidade, de observabilidade ou da operação do dia a dia — assuntos que compõem boa parte de uma conversa de arquitetura. É a melhor referência de uma metade importante do território, e ler outras fontes para a outra metade não é sinal de que você aproveitou mal o livro.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Ler para colecionar vocabulário. Saber recitar o que é quórum ou isolamento serializável sem ter enfrentado o problema correspondente produz conhecimento frágil, que não sobrevive à primeira pergunta de acompanhamento. Vale mais implementar um exemplo pequeno de cada conceito importante do que terminar o livro rápido.',
          },
        ],
        quiz: [
          {
            q: 'Por que um livro sobre princípios envelhece melhor que um sobre ferramentas?',
            a: 'Porque ferramentas mudam de versão, de API e de moda, enquanto os trade-offs fundamentais — consistência contra latência, escrita contra leitura, coordenação contra escala — permanecem. Entendendo o princípio, avalia-se qualquer implementação que o utilize, inclusive as que ainda não existem.',
          },
          {
            q: 'Que postura o livro adota que vale copiar ao projetar sistemas?',
            a: 'Apresentar sempre o custo junto do benefício. Nenhuma técnica é vendida como solução universal: cada uma vem com o que ela troca. Essa é exatamente a forma de raciocinar que se espera em decisões de arquitetura e em entrevistas de system design.',
          },
        ],
      },
    },
    {
      slug: 'como-praticar',
      title: 'Como praticar system design',
      summary:
        'Ler não basta: como transformar leitura em capacidade real de projetar e defender decisões.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'System design se aprende praticando decisões sob restrição, não acumulando leitura. O que consolida é justificar escolhas, expor trade-offs e receber contestação.',
        blocks: [
          {
            type: 'p',
            text: 'Existe uma ilusão de competência específica desta área: ler sobre sharding, cache e filas produz a sensação confortável de entendimento, que evapora na primeira vez em que é preciso decidir com números concretos e defender a decisão. A leitura constrói vocabulário; a prática constrói julgamento, e só o segundo é avaliado — em entrevista ou em produção.',
          },
          {
            type: 'key',
            text: 'O exercício que mais rende é escrever a decisão. Um documento curto — problema, opções consideradas, escolha, motivo e o que ela custa — força a explicitar raciocínio que, enquanto fica na cabeça, parece mais sólido do que é.',
          },
          {
            type: 'h',
            text: 'Formatos que funcionam',
          },
          {
            type: 'list',
            items: [
              'Projetar sistemas conhecidos e comparar depois com relatos de engenharia públicos das empresas que os construíram — a diferença entre a sua solução e a real é a aula.',
              'Escrever ADRs (registros de decisão de arquitetura) nos seus próprios projetos, mesmo pequenos: o hábito de justificar por escrito é transferível.',
              'Ler post-mortems de incidentes públicos, que mostram como sistemas reais falham — quase sempre por interações entre partes, não por uma peça isolada.',
              'Implementar versões mínimas de conceitos: um rate limiter com token bucket, um consistent hashing com nós virtuais, um cache com stampede protection.',
              'Explicar em voz alta para alguém, ou gravando: a lacuna aparece exatamente onde a explicação trava.',
            ],
          },
          {
            type: 'p',
            text: 'Ao projetar um sistema como exercício, imponha restrições explícitas — orçamento, latência máxima, time de três pessoas. Sem restrição, todo projeto converge para a mesma arquitetura genérica e nada é aprendido, porque não houve escolha a fazer. A restrição é o que gera o trade-off, e o trade-off é o conteúdo.',
          },
          {
            type: 'p',
            text: 'Vale também praticar a defesa. Depois de decidir, ataque a própria solução: o que acontece se o cache cair inteiro? E se este serviço ficar dez vezes mais lento? E se a carga crescer cem vezes? Quase toda pergunta de aprofundamento numa entrevista é uma variação dessas, e são as mesmas perguntas que a produção acaba fazendo.',
          },
          {
            type: 'h',
            text: 'Uma rotina concreta',
          },
          {
            type: 'p',
            text: 'Se você quer algo executável em vez de conselho geral, aqui vai uma rotina semanal que cabe em duas horas. Escolha um sistema conhecido e defina três números antes de desenhar qualquer coisa: usuários ativos, operações por segundo no pico e volume de dados em um ano. Projete em quarenta minutos, escreva a decisão principal e o custo dela em dez, e gaste o resto do tempo procurando como uma empresa real resolveu o mesmo problema. A comparação é o exercício — não o desenho.',
          },
          {
            type: 'p',
            text: 'Sobre os números: aprenda a fazer estimativas de ordem de grandeza de cabeça, porque elas mudam decisões. Um milhão de usuários com dez ações por dia dá algo em torno de cem operações por segundo em média, e talvez cinco vezes isso no pico — um volume que uma única máquina bem configurada atende sem esforço. Perceber isso durante o exercício é o que impede a arquitetura genérica de quinze caixas. Errar por um fator de dois é irrelevante; errar por um fator de mil leva a construir a coisa errada.',
          },
          {
            type: 'p',
            text: 'Ao implementar as versões mínimas de conceitos, o valor está nos detalhes que a descrição esconde. Um rate limiter de token bucket vira interessante quando você precisa mantê-lo em várias instâncias e descobre que a operação precisa ser atômica. Um cache vira interessante no momento em que dois pedidos concorrentes causam uma repopulação simultânea. Um consumidor de fila vira interessante quando a mesma mensagem chega duas vezes. Escolha exercícios pequenos o bastante para terminar num fim de semana e observe exatamente onde eles doem.',
          },
          {
            type: 'p',
            text: 'Vale calibrar também a expectativa sobre tempo. Um exercício de projeto não precisa terminar com uma solução completa: terminar com duas opções bem descritas e o critério que decidiria entre elas já é um resultado melhor do que um diagrama pronto sem justificativa. Numa entrevista, aliás, é exatamente esse o comportamento avaliado — enunciar alternativas, explicitar o que separa uma da outra e escolher com base numa restrição declarada vale mais que chegar rápido a um desenho que ninguém consegue defender.',
          },
          {
            type: 'p',
            text: 'Para praticar a defesa sozinho, o formato mais eficiente é escrever a crítica como se fosse outra pessoa. Depois de terminar um desenho, abra um documento novo e ataque: liste os pontos únicos de falha, o componente cuja queda derruba tudo, a suposição de carga que se errada inviabiliza a solução, e a parte que ninguém do time saberia operar às três da manhã. Feito com honestidade, esse exercício encontra os mesmos problemas que um revisor experiente apontaria — e treina justamente o reflexo que se cobra numa entrevista.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Decorar arquiteturas de referência. Memorizar "o desenho do Twitter" produz uma resposta que desmorona na primeira pergunta sobre por que cada peça está ali. O que se leva de um bom exercício é o raciocínio — por que fan-out híbrido, sob quais números — e não o diagrama, que muda conforme os requisitos mudam.',
          },
        ],
        quiz: [
          {
            q: 'Por que escrever a decisão rende mais que apenas pensá-la?',
            a: 'Porque a escrita expõe lacunas que o raciocínio interno mascara. Ao precisar declarar as opções consideradas, o critério de escolha e o custo assumido, percebe-se onde a justificativa era vaga — e o texto ainda serve de referência quando a decisão for questionada depois.',
          },
          {
            q: 'Por que impor restrições explícitas ao exercício é essencial?',
            a: 'Porque sem restrição não há trade-off, e sem trade-off não há aprendizado: todo projeto converge para a mesma arquitetura genérica com todas as peças possíveis. Orçamento, latência máxima e tamanho de time forçam escolhas reais, que é onde o julgamento se desenvolve.',
          },
          {
            q: 'Por que decorar arquiteturas de referência é contraproducente?',
            a: 'Porque a resposta memorizada não sobrevive à pergunta "por que essa peça está aí?" nem à mudança de requisitos. O que transfere entre problemas é o raciocínio que levou à escolha e sob quais números ela vale — o diagrama é consequência, não conhecimento.',
          },
        ],
      },
    },
    {
      slug: 'fontes-que-valem',
      title: 'Fontes que valem acompanhar',
      kind: 'CHANNEL',
      summary:
        'Onde encontrar material de qualidade e como filtrar o excesso de conteúdo raso.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'A escassez hoje não é de conteúdo, é de atenção. O critério de seleção importa mais que a quantidade de fontes acompanhadas.',
        blocks: [
          {
            type: 'p',
            text: 'Há uma quantidade enorme de material de system design disponível, e a maior parte repete as mesmas ideias em profundidade decrescente. Acompanhar muitas fontes rasas dá a sensação de estar aprendendo e produz pouco resultado — o padrão de reconhecimento se forma com profundidade, não com repetição superficial.',
          },
          {
            type: 'key',
            text: 'O filtro mais útil: prefira fontes que mostrem números, contexto e o que deu errado. Conteúdo que apresenta apenas a solução final, limpa e sem custos, é propaganda ou simplificação — em nenhum dos casos ensina a decidir.',
          },
          {
            type: 'h',
            text: 'Categorias que valem o tempo',
          },
          {
            type: 'list',
            items: [
              'Blogs de engenharia das empresas: descrevem problemas reais com escala real, incluindo o que tentaram antes e por que não funcionou.',
              'Post-mortems públicos de incidentes: a melhor fonte sobre como sistemas realmente falham, e quase sempre por interações inesperadas entre componentes saudáveis.',
              'Papers, inclusive os antigos: densos, mas com o raciocínio completo e as premissas explícitas — algo que resumos de segunda mão sempre perdem.',
              'Documentação de projetos maduros: a seção de arquitetura de bancos e brokers costuma explicar decisões de projeto melhor que a maior parte dos artigos.',
              'Coletâneas curadas abertas, úteis como mapa para descobrir o que existe e escolher onde aprofundar.',
            ],
          },
          {
            type: 'p',
            text: 'Uma prática que multiplica o retorno: ao ler sobre uma solução, procure ativamente a crítica dela. Quase toda técnica popular tem detratores com argumentos técnicos sólidos, e ler os dois lados é o que constrói julgamento em vez de opinião adotada. Ferramentas raramente são boas ou ruins — são adequadas ou inadequadas a um contexto, e é o contexto que se precisa aprender a enxergar.',
          },
          {
            type: 'p',
            text: 'Vale também desconfiar de conteúdo que apresenta a arquitetura de uma empresa gigante como modelo a seguir. As decisões daquelas empresas fazem sentido para a escala, o time e as restrições delas; copiadas para um contexto cem vezes menor, tornam-se complexidade pura. A pergunta certa ao ler é sempre "sob quais condições isso vale?".',
          },
          {
            type: 'h',
            text: 'Como ler cada tipo de fonte',
          },
          {
            type: 'p',
            text: 'Cada categoria pede um modo de leitura diferente. Em um relato de engenharia, o trecho que interessa raramente é a arquitetura final: é o parágrafo que descreve a solução anterior e por que ela deixou de servir. Ele contém o número que motivou a mudança e o limite concreto que foi atingido — que é exatamente a informação necessária para julgar se o seu caso se parece com aquele. Se o texto não tem esse parágrafo, ele está descrevendo um resultado, não uma decisão, e vale menos do que aparenta.',
          },
          {
            type: 'p',
            text: 'Num post-mortem, o que ensina é a linha do tempo, não a causa raiz. Preste atenção em quanto tempo levou para alguém perceber, o que os indicadores mostravam enquanto o problema já acontecia, e qual ação de mitigação piorou a situação antes de melhorar. A causa raiz costuma ser específica demais para transferir; a demora na detecção e os mecanismos de amplificação — retentativas sem limite, cache esvaziando, fila crescendo — se repetem em todo lugar.',
          },
          {
            type: 'p',
            text: 'Papers pedem leitura fora de ordem. Comece pela introdução e pela seção de avaliação, que juntas dizem qual problema existia e quanto a solução melhorou; se as duas não convencerem, o resto não vale o tempo. Depois volte para o desenho. E procure sempre a seção de trabalhos relacionados: ela é o mapa do que existia antes, escrito por quem conhecia a área, e frequentemente é o parágrafo mais informativo do documento inteiro para quem está tentando situar a ideia.',
          },
          {
            type: 'p',
            text: 'A documentação de projetos maduros merece uma observação à parte, porque é a fonte mais subutilizada de todas. Bancos, brokers e sistemas de cache costumam manter páginas explicando o modelo de consistência, o comportamento sob falha e os limites conhecidos — escritas por quem implementou e, portanto, sem o otimismo dos textos de divulgação. Ler a seção de garantias da ferramenta que você já usa em produção rende quase sempre mais que ler sobre uma ferramenta que você talvez venha a usar.',
          },
          {
            type: 'p',
            text: 'Um critério prático de assinatura: mantenha poucas fontes e imponha um teste de utilidade. Se em três meses uma fonte não mudou nenhuma decisão sua nem lhe ensinou algo que você usou, remova-a — independentemente de ser respeitada. Vale mais acompanhar de perto os blogs de dois ou três projetos cuja tecnologia você realmente usa, onde cada nota técnica se aplica ao seu trabalho no mesmo mês, do que ler resumos semanais que cobrem tudo e não aprofundam nada.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Confundir consumo com aprendizado. Acompanhar dezenas de fontes, salvar artigos e assistir vídeos produz a sensação de progresso sem produzir capacidade. Uma fonte densa lida com atenção, seguida de um exercício de aplicação, vale mais que vinte lidas na diagonal.',
          },
        ],
        quiz: [
          {
            q: 'Qual o melhor filtro de qualidade para conteúdo técnico?',
            a: 'A presença de números, contexto e do que deu errado. Material que mostra apenas a solução final, sem custos nem alternativas descartadas, não permite avaliar quando aquilo se aplica — e portanto não ensina a decidir, apenas a repetir.',
          },
          {
            q: 'Por que procurar a crítica de uma solução é tão valioso?',
            a: 'Porque nenhuma técnica é universalmente boa: ler os argumentos contrários revela os contextos em que ela falha, que é justamente o conhecimento necessário para decidir se ela cabe no seu caso. Sem isso, adota-se opinião alheia em vez de desenvolver julgamento.',
          },
          {
            q: 'Por que copiar a arquitetura de uma empresa gigante costuma dar errado?',
            a: 'Porque aquelas decisões respondem a uma escala, um tamanho de time e restrições específicas que não são as suas. Reproduzidas num contexto ordens de grandeza menor, entregam complexidade e custo operacional sem o problema correspondente que as justificava.',
          },
        ],
      },
    },
    {
      slug: 'proximos-passos',
      title: 'Próximos passos',
      summary:
        'O que fazer depois desta trilha, e como escolher o próximo aprofundamento.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Terminar a trilha dá vocabulário e mapa. O aprofundamento seguinte deve ser escolhido pelo problema que você tem hoje, não por uma ordem canônica.',
        blocks: [
          {
            type: 'p',
            text: 'O objetivo desta trilha foi construir vocabulário e formar o padrão de reconhecimento: identificar que um problema é de coordenação, de particionamento ou de contrapressão, e saber quais ferramentas existem para cada caso. Isso é o suficiente para conduzir uma conversa de arquitetura e para saber o que pesquisar quando um problema novo aparece.',
          },
          {
            type: 'key',
            text: 'Não existe ordem canônica de aprofundamento. O critério mais eficiente é o problema que você tem agora — o conhecimento aplicado imediatamente é o único que fica.',
          },
          {
            type: 'h',
            text: 'Direções possíveis',
          },
          {
            type: 'table',
            head: ['Se o seu problema é…', 'Aprofunde em…'],
            rows: [
              ['Banco lento sob carga', 'Índices, planos de execução, isolamento e lock'],
              ['Dados que não cabem numa máquina', 'Particionamento, replicação e modelos de consistência'],
              ['Integração entre muitos serviços', 'Mensageria, event-driven, sagas e idempotência'],
              ['Sistema que cai de formas inesperadas', 'Confiabilidade, observabilidade e engenharia do caos'],
              ['Custo de infraestrutura alto', 'Cache, CDN, dimensionamento e perfil de carga'],
              ['Latência para usuários distantes', 'CDN, multi-região e replicação geográfica'],
            ],
          },
          {
            type: 'p',
            text: 'Uma sugestão de projeto que consolida boa parte da trilha: construir algo pequeno que exercite os conceitos de ponta a ponta. Um encurtador de URL com cache, rate limiting e métricas; um sistema de processamento assíncrono com fila, retentativa, fila morta e idempotência; ou um agregador de dados com CDC alimentando um índice de busca. O valor não está no produto, está nos problemas que aparecem sozinhos ao construir.',
          },
          {
            type: 'p',
            text: 'Vale insistir nesse ponto, porque é onde a maioria para. Ao implementar um cache de verdade, a pergunta "invalido ou atualizo?" deixa de ser abstrata no instante em que dois pedidos concorrentes produzem um valor errado que persiste. Ao escrever um consumidor de fila, a idempotência deixa de ser conselho quando a primeira reentrega duplica um registro. Esses momentos — em que o conceito lido vira um bug que você precisa entender — são o mecanismo real de aprendizado desta área, e nenhuma quantidade de leitura os substitui.',
          },
          {
            type: 'h',
            text: 'O que observar no trabalho',
          },
          {
            type: 'p',
            text: 'Se você já trabalha em um sistema em produção, ele é o melhor material de estudo disponível — e costuma ser ignorado. Algumas perguntas rendem muito quando aplicadas ao que você já mantém: quais são as consultas mais lentas e por quê? Onde estão os pontos únicos de falha que ninguém desenhou? O que acontece se o cache esvaziar agora? Quais operações não são idempotentes e são retentadas? Onde há dependências síncronas que poderiam ser assíncronas?',
          },
          {
            type: 'p',
            text: 'Cada uma dessas perguntas leva a uma investigação concreta, com dados reais e consequências reais — e, com frequência, a uma melhoria que vale mais que o exercício teórico equivalente. É também a forma mais rápida de descobrir que o sistema que você mantém já contém exemplos de quase todos os conceitos desta trilha, só que sem os nomes.',
          },
          {
            type: 'p',
            text: 'Por fim, uma expectativa calibrada sobre o ritmo. A parte de vocabulário — saber o que é sharding, quórum, contrapressão — se adquire em semanas. A parte de julgamento, que é decidir *quando* usar cada coisa e reconhecer complexidade desnecessária antes de construí-la, leva anos e depende de ter visto decisões chegarem ao fim. Isso não é motivo para desânimo: é a razão pela qual a experiência tem valor nesta área, e pela qual a leitura sozinha nunca fecha a lacuna.',
          },
          {
            type: 'p',
            text: 'Se o objetivo imediato é entrevista, o caminho mais direto é praticar em voz alta com restrição de tempo, cobrindo os problemas clássicos e, principalmente, treinando a defesa das escolhas sob contestação. Se o objetivo é o trabalho, o caminho é escrever decisões dos projetos reais e revisitá-las meses depois — comparar a previsão com o que de fato aconteceu é o feedback mais honesto que existe nesta área.',
          },
          {
            type: 'h',
            text: 'Um roteiro para os próximos três meses',
          },
          {
            type: 'p',
            text: 'Se você quer algo concreto em vez de uma direção genérica, um arranjo que funciona bem é dividir o tempo em três blocos de um mês. No primeiro, escolha um único tema desta trilha que toque um problema que você já tem e leia a fundo — capítulo do DDIA, documentação de arquitetura da ferramenta que você usa, um paper se houver. No segundo, construa algo pequeno que exercite esse tema e o coloque sob condições adversas: derrube a dependência, dispare tráfego concorrente, injete latência. No terceiro, escreva o que aprendeu em formato de decisão — problema, opções, escolha, custo — e mostre para alguém que possa contestar.',
          },
          {
            type: 'p',
            text: 'A parte que costuma ser pulada é a segunda, e é justamente a que converte leitura em capacidade. Ler sobre stampede de cache produz reconhecimento; ver mil requisições concorrentes derrubarem o próprio banco no instante em que uma chave expira produz memória duradoura. Ferramentas de carga simples e um contêiner que você pode matar bastam para reproduzir a maior parte dos fenômenos discutidos aqui, e o esforço de montar esse laboratório é medido em horas, não semanas.',
          },
          {
            type: 'h',
            text: 'Como saber que está progredindo',
          },
          {
            type: 'p',
            text: 'Vocabulário é fácil de medir e engana; julgamento é difícil de medir e é o que importa. Alguns sinais de progresso real: você começa a perguntar sobre requisitos não funcionais antes de propor solução; consegue nomear o custo de uma técnica no mesmo fôlego em que a sugere; percebe complexidade desnecessária em propostas alheias e consegue explicar por quê; e passa a discordar de conteúdo técnico popular com argumentos, em vez de aceitá-lo ou rejeitá-lo por reputação da fonte.',
          },
          {
            type: 'p',
            text: 'Um sinal mais desconfortável e igualmente válido: você olha uma decisão que tomou há um ano e consegue explicar por que ela estava errada, sem constrangimento. Isso indica que o critério evoluiu o bastante para julgar a própria versão anterior — o que só acontece depois de ver consequências, e é exatamente o que nenhuma quantidade de leitura entrega sozinha.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tratar system design como assunto que se conclui. A área evolui e, mais importante, o julgamento só amadurece com decisões tomadas, consequências vividas e revisões feitas. Vocabulário se adquire em semanas; critério leva anos de decisões observadas até o fim — inclusive as erradas, que costumam ensinar mais.',
          },
        ],
        quiz: [
          {
            q: 'Por que escolher o aprofundamento pelo problema atual é mais eficiente?',
            a: 'Porque conhecimento aplicado logo após ser adquirido se consolida, enquanto o estudado sem contexto de uso evapora. Além disso, o problema real fornece as restrições concretas que dão sentido aos trade-offs — sem elas, cada técnica parece igualmente boa.',
          },
          {
            q: 'Qual o valor de construir um projeto pequeno em vez de continuar lendo?',
            a: 'Que os problemas aparecem sozinhos e na ordem certa: invalidação de cache, retentativa duplicando efeito, condição de corrida, observabilidade insuficiente. Enfrentá-los concretamente forma julgamento de um jeito que nenhuma leitura reproduz.',
          },
          {
            q: 'Por que revisitar decisões antigas é um exercício valioso?',
            a: 'Porque compara a previsão com o resultado real, que é o único feedback honesto disponível nesta área. Descobrir que uma preocupação nunca se materializou, ou que um risco ignorado custou caro, calibra o julgamento para as próximas decisões — inclusive ensinando a reconhecer complexidade desnecessária.',
          },
        ],
      },
    },
  ],
};

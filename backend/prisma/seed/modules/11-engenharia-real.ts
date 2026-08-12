import type { ModuleSeed } from '../types';

export const engenhariaReal: ModuleSeed = {
  slug: 'engenharia-real',
  title: 'Engenharia real',
  goal: 'Ver como problemas concretos de escala foram resolvidos na prática, e extrair o princípio por trás de cada solução.',
  lessons: [
    {
      slug: 'como-empresas-escalam-o-banco',
      title: 'Como empresas escalam o banco de dados',
      summary:
        'Padrões recorrentes: réplicas de leitura, sharding por tenant, migração para armazenamento especializado.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'A trajetória de escala de um banco relacional segue quase sempre a mesma sequência de etapas, cada uma comprando tempo até que a próxima se torne inevitável.',
        blocks: [
          {
            type: 'p',
            text: 'Praticamente toda empresa que cresceu percorreu o mesmo caminho, na mesma ordem, e há uma razão: cada etapa é significativamente mais barata que a seguinte. Pular etapas é o erro mais comum e o mais caro.',
          },
          {
            type: 'p',
            text: 'A primeira etapa nem envolve arquitetura: é encontrar as consultas ruins. Uma consulta sem índice apropriado, um N+1 escondido no ORM, um `SELECT *` trazendo colunas gigantes que ninguém usa. É rotineiro um sistema "que precisa de sharding" na verdade precisar de três índices — e a diferença entre os dois diagnósticos é de meses de trabalho.',
          },
          {
            type: 'key',
            text: 'Antes de mudar a arquitetura, olhe o plano de execução das consultas mais lentas e mais frequentes. O ganho de um índice adequado costuma ser de ordens de grandeza, com uma tarde de trabalho e nenhum risco estrutural.',
          },
          {
            type: 'p',
            text: 'A segunda etapa é aliviar leitura: cache para o que é lido repetidamente e réplicas para distribuir o restante. Isso resolve a maioria absoluta dos sistemas, porque a maioria absoluta é dominada por leitura. Aqui aparece o cuidado já conhecido — leituras que seguem uma escrita do mesmo usuário precisam ir ao primário, ou o lag da replicação vira um bug intermitente.',
          },
          {
            type: 'p',
            text: 'A terceira é reduzir o volume ativo. Boa parte das tabelas grandes é composta por dados frios que ninguém consulta: pedidos de três anos atrás, logs, registros de auditoria. Movê-los para uma tabela histórica ou para armazenamento mais barato reduz o índice, melhora o cache e acelera tudo que restou. É uma das intervenções de melhor retorno e das menos lembradas.',
          },
          {
            type: 'p',
            text: 'A quarta é tirar do banco relacional aquilo que ele faz mal. Busca textual, séries temporais, filas de trabalho e blobs grandes costumam viver em tabelas por inércia e são exatamente as cargas que mais castigam o banco. Movê-las para um sistema especializado libera capacidade sem tocar no modelo de dados principal.',
          },
          {
            type: 'p',
            text: 'A quinta é separar por domínio: dividir verticalmente, dando a cada área o seu banco. Isso reduz a carga por instância e é a etapa que precede naturalmente a separação em serviços — com a vantagem de as fronteiras já terem sido validadas pelo uso.',
          },
          {
            type: 'p',
            text: 'Só então vem o sharding, que é a última etapa porque é a mais cara e a mais difícil de reverter. Quando chega, a chave de partição mais comum é o inquilino ou o usuário, porque as consultas naturalmente se limitam a um deles — o que mantém a maior parte das operações dentro de um único shard.',
          },
          {
            type: 'h',
            text: 'Os números que decidem a etapa',
          },
          {
            type: 'p',
            text: 'Cada transição tem um sinal mensurável que a justifica, e vale conhecê-los para não trocar de etapa por intuição. Consultas ruins aparecem como um punhado de comandos concentrando a maior parte do tempo acumulado — em sistemas com esse problema, é comum que cinco consultas respondam por mais da metade do tempo total de banco. O limite do cache e das réplicas aparece quando a taxa de acerto estaciona e o lag de replicação cresce em horário de pico. E a hora do sharding chega quando a escrita, sozinha, satura o primário: réplicas não ajudam em escrita, então esse teto é real.',
          },
          {
            type: 'p',
            text: 'Vale medir também o conjunto quente em relação à memória disponível. Enquanto índices e páginas mais acessadas cabem no buffer do banco, a latência é estável; quando o conjunto ativo passa a exceder a memória, a degradação é abrupta e não gradual, porque cada consulta passa a tocar disco. É por isso que arquivar dados frios rende de forma desproporcional ao volume removido: às vezes basta cortar 20% da tabela para o conjunto quente voltar a caber.',
          },
          {
            type: 'p',
            text: 'Os modos de falha também se repetem. Uma réplica que passa a servir leituras críticas sem que ninguém tenha planejado vira ponto único de falha disfarçado. Uma migração de esquema que trava a tabela derruba o serviço no meio do dia — daí a prática de alterações sempre compatíveis nos dois sentidos, aplicadas em passos separados de deploy. E um pool de conexões maior que a capacidade do banco piora tudo: mais conexões competindo aumentam a contenção e a latência sobe justamente quando se tentou aumentar a vazão.',
          },
          {
            type: 'p',
            text: 'O princípio generalizável é que escala não é uma decisão única, mas uma sequência de gargalos removidos um de cada vez. Cada etapa expõe o próximo limite, e a única forma de saber qual é ele é medir depois de cada mudança. Arquiteturas anunciadas antecipadamente — "vamos precisar de sharding" — apostam num gargalo que ainda não se manifestou, e a aposta erra com frequência porque o gargalo real quase sempre está numa camada mais barata de corrigir.',
          },
          {
            type: 'table',
            head: ['Etapa', 'Custo', 'Ganho típico'],
            rows: [
              ['Índices e consultas', 'Horas', 'Ordens de grandeza'],
              ['Cache e réplicas', 'Dias', 'Absorve leitura'],
              ['Arquivar dados frios', 'Dias', 'Índices menores, cache melhor'],
              ['Armazenamento especializado', 'Semanas', 'Tira carga hostil do banco'],
              ['Separação por domínio', 'Semanas', 'Divide a carga total'],
              ['Sharding', 'Meses', 'Escala escrita — sem teto'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Anunciar sharding como solução sem ter medido onde o tempo realmente vai. É a mudança mais cara disponível, amarra o sistema a uma chave escolhida no pior momento — quando menos se conhece o produto — e frequentemente é proposta para resolver um problema que um índice resolveria. Meça primeiro; particione quando as etapas baratas estiverem esgotadas.',
          },
        ],
        quiz: [
          {
            q: 'Por que arquivar dados frios melhora o desempenho de forma desproporcional?',
            a: 'Porque reduz o tamanho dos índices e das tabelas ativas, o que faz uma proporção maior dos dados quentes caber em memória. Com melhor aproveitamento do cache do banco, praticamente todas as consultas ficam mais rápidas — não apenas as que tocavam os dados removidos.',
          },
          {
            q: 'Por que sharding é sempre a última etapa?',
            a: 'Porque é a mudança mais cara e a mais difícil de reverter: quebra joins, transações multi-registro e unicidade global, e amarra o sistema a uma chave de partição cuja alteração posterior exige migrar todos os dados. Todas as etapas anteriores custam menos e resolvem a maioria dos casos.',
          },
          {
            q: 'Quais cargas costumam estar no banco relacional por inércia e deveriam sair?',
            a: 'Busca textual, séries temporais, filas de trabalho e blobs grandes. Todas são atendidas melhor por sistemas especializados e são justamente as que mais castigam o relacional — varreduras pesadas, escrita constante, tabelas que crescem sem limite. Movê-las libera capacidade sem alterar o modelo de dados principal.',
          },
        ],
      },
    },
    {
      slug: 'mensageria-em-escala',
      title: 'Mensageria em escala',
      summary:
        'O que acontece quando um sistema de mensagens precisa manter milhões de conexões simultâneas.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Manter milhões de conexões abertas inverte as premissas usuais de escala: o recurso escasso passa a ser memória por conexão, e o custo dominante passa a ser o fan-out de eventos.',
        blocks: [
          {
            type: 'p',
            text: 'Um serviço HTTP comum dimensiona por requisições por segundo, e conexões são efêmeras. Um serviço de mensagens em tempo real dimensiona por conexões simultâneas, a maioria delas ociosa na maior parte do tempo. São regimes completamente diferentes: um milhão de conexões paradas consome muita memória e quase nenhuma CPU.',
          },
          {
            type: 'key',
            text: 'Com conexões persistentes, o gargalo migra de CPU para memória e descritores de arquivo. Cada conexão custa buffers do kernel e estado da aplicação — e esse custo é pago mesmo quando nada trafega.',
          },
          {
            type: 'p',
            text: 'Isso muda as escolhas de implementação. Modelos com uma thread por conexão são inviáveis nessa escala: a memória de pilha por thread, multiplicada por um milhão, é proibitiva. O caminho é I/O assíncrono orientado a eventos, em que poucas threads acompanham muitas conexões ociosas. Também importa enxugar o estado por conexão — cada estrutura extra de alguns quilobytes, multiplicada por milhões, vira gigabytes.',
          },
          {
            type: 'h',
            text: 'O custo real está no fan-out',
          },
          {
            type: 'p',
            text: 'Manter conexões abertas é caro mas previsível. O que explode é a difusão: uma mensagem num canal com cem mil pessoas conectadas vira cem mil entregas. Numa comunidade grande, um único evento pode gerar milhões de envios em segundos — e eventos de baixo valor, como indicadores de presença ou de digitação, produzem esse volume continuamente.',
          },
          {
            type: 'p',
            text: 'As mitigações são todas variações de "não envie o que ninguém está olhando". Enviar atualizações apenas para quem está com aquele canal aberto na tela, e não para todos os membros. Agregar eventos numa janela curta e enviar um resumo em vez de cada mudança individual. Descartar completamente estados intermediários que envelhecem em milissegundos. E aplicar limites de taxa por canal, para que um canal ativo não consuma a capacidade dos outros.',
          },
          {
            type: 'p',
            text: 'A arquitetura interna que sustenta isso separa duas responsabilidades: um nível cuida apenas das conexões — aceita, mantém, envia bytes — e outro cuida da lógica de negócio e do roteamento. Entre eles, um pub/sub interno. Essa separação permite escalar o nível de conexão por memória e o nível de lógica por CPU, que crescem em ritmos diferentes.',
          },
          {
            type: 'h',
            text: 'Ordem de grandeza dos custos',
          },
          {
            type: 'p',
            text: 'Vale ter os números na cabeça, porque eles mudam o desenho. Uma conexão TCP ociosa custa alguns kilobytes de buffers no kernel, e o estado da aplicação por conexão costuma somar mais alguns — na faixa de 10 a 50 KB no total, dependendo do que se guarda. Com um milhão de conexões, isso são dezenas de gigabytes só para manter gente parada. Por isso o exercício de reduzir estado por conexão tem retorno tão alto: cortar 8 KB por conexão devolve 8 GB por milhão, e é uma otimização que raramente aparece em perfis de CPU.',
          },
          {
            type: 'p',
            text: 'O outro número importante é a taxa de reconexão sustentável. Aceitar uma conexão nova é muito mais caro que manter uma existente: envolve handshake TLS, autenticação, carregamento do estado do usuário e sincronização do que ele perdeu. Uma instância que segura duzentas mil conexões confortavelmente pode não conseguir aceitar mais que alguns milhares por segundo — o que significa que repovoar essa instância leva minutos, não segundos, e esse tempo é a janela real de degradação após qualquer perturbação.',
          },
          {
            type: 'p',
            text: 'O modo de falha característico é a tempestade de reconexão em cascata. Uma instância cai, seus clientes migram para as vizinhas, que ficam sobrecarregadas com o custo de aceitação e começam a responder devagar; clientes interpretam a lentidão como falha e reconectam de novo, agora em volume maior. Sem limite na taxa de aceitação, o sistema não converge sozinho — cada rodada de recuperação gera a carga que causa a rodada seguinte. Backoff exponencial com jitter no cliente e um teto de aceitação no servidor são o que quebra esse ciclo.',
          },
          {
            type: 'p',
            text: 'O princípio generalizável vai além de mensageria: sempre que o estado vive na conexão e não na requisição, a operação passa a ser dominada por transições — conectar, reconectar, migrar — e não pelo regime estacionário. Dimensionar apenas para o estado de repouso é o erro estrutural, porque o pior momento do sistema é justamente aquele em que ele precisa reconstruir o estado que mantinha implicitamente.',
          },
          {
            type: 'table',
            head: ['Dimensão', 'Serviço HTTP comum', 'Mensageria persistente'],
            rows: [
              ['Unidade de escala', 'Requisições por segundo', 'Conexões simultâneas'],
              ['Recurso escasso', 'CPU', 'Memória e descritores'],
              ['Deploy', 'Substitui instâncias livremente', 'Desconecta todos de uma vez'],
              ['Custo dominante', 'Processamento por requisição', 'Fan-out de eventos'],
              ['Estado', 'Nenhum', 'Conexão presa à instância'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Não planejar o deploy. Substituir uma instância que mantém duzentas mil conexões dispara duzentas mil reconexões simultâneas, cada uma pedindo sincronização de estado. Sem drenagem gradual, backoff com jitter no cliente e limite na taxa de aceitação, uma atualização de rotina derruba o cluster inteiro — e a tentativa de recuperação repete o pico.',
          },
        ],
        quiz: [
          {
            q: 'Por que o modelo de uma thread por conexão não funciona nessa escala?',
            a: 'Porque cada thread reserva memória de pilha e impõe custo de troca de contexto; multiplicado por milhões de conexões majoritariamente ociosas, o consumo é proibitivo. I/O assíncrono orientado a eventos permite que poucas threads acompanhem muitas conexões que passam quase todo o tempo sem tráfego.',
          },
          {
            q: 'Por que o fan-out costuma custar mais que manter as conexões?',
            a: 'Porque manter conexões ociosas tem custo previsível de memória, enquanto uma única mensagem num canal grande se multiplica em centenas de milhares de entregas. Eventos frequentes e de baixo valor, como presença e digitação, produzem esse volume continuamente e podem superar em muito o tráfego de mensagens reais.',
          },
          {
            q: 'Por que separar o nível de conexão do nível de lógica?',
            a: 'Porque eles escalam por recursos diferentes: o de conexão é limitado por memória e descritores, o de lógica por CPU. Separá-los permite dimensionar cada um conforme sua própria demanda e faz com que atualizações da lógica de negócio não precisem derrubar as conexões estabelecidas.',
          },
        ],
      },
    },
    {
      slug: 'entrega-de-midia',
      title: 'Entrega de mídia em escala global',
      summary:
        'Pré-posicionamento de conteúdo, cache hierárquico e o custo de banda como restrição de projeto.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Entregar mídia globalmente é um problema de economia de banda e de física da latência, resolvido aproximando o conteúdo do usuário antes que ele peça.',
        blocks: [
          {
            type: 'p',
            text: 'Em serviços de mídia, a banda de saída costuma ser a maior linha de custo — acima de computação e armazenamento somados. Isso inverte a lógica habitual de otimização: decisões que parecem técnicas, como qual codec usar ou quantas variantes de qualidade gerar, são principalmente decisões financeiras.',
          },
          {
            type: 'key',
            text: 'Cada ponto percentual na taxa de acerto da borda se traduz diretamente em banda que não sai da origem. É por isso que operações maduras perseguem taxas acima de 95% e tratam qualquer queda como incidente.',
          },
          {
            type: 'h',
            text: 'Hierarquia de cache',
          },
          {
            type: 'p',
            text: 'Uma CDM plana tem um defeito em escala: com centenas de pontos de presença, cada miss em cada ponto vira uma requisição à origem. Um conteúdo novo pode gerar centenas de buscas simultâneas do mesmo arquivo. A solução é uma camada intermediária — pontos de presença consultam um cache regional, que consulta a origem. Assim, o mesmo conteúdo é buscado uma vez por região e não uma vez por ponto.',
          },
          {
            type: 'p',
            text: 'Complementarmente, aplica-se coalescência de requisições na borda: se cinquenta usuários pedem o mesmo arquivo ainda não cacheado, apenas uma busca sobe e as outras aguardam o resultado. Sem isso, o momento de maior popularidade — exatamente quando o cache está frio — vira o de maior carga na origem.',
          },
          {
            type: 'h',
            text: 'Pré-posicionamento',
          },
          {
            type: 'p',
            text: 'Para conteúdo cuja popularidade é previsível, esperar o primeiro usuário pedir é desperdício. Um lançamento aguardado terá milhões de acessos nas primeiras horas, e todos os pontos de presença sofrerão miss ao mesmo tempo. Distribuir o conteúdo para a borda antes do lançamento — em horários de baixo tráfego, quando a banda é mais barata — elimina o pico e melhora a experiência do primeiro acesso.',
          },
          {
            type: 'p',
            text: 'A escolha do que pré-posicionar em cada região é um problema de previsão: catálogos populares variam por país, idioma e horário. Errar para mais desperdiça armazenamento e banda de distribuição; errar para menos devolve o pico que se queria evitar.',
          },
          {
            type: 'p',
            text: 'Há ainda a estratégia de aproximar fisicamente a infraestrutura: instalar servidores de cache dentro da rede dos provedores de acesso. O conteúdo passa a ser servido dentro da própria operadora, sem atravessar os pontos de troca de tráfego — o que reduz latência e beneficia economicamente os dois lados.',
          },
          {
            type: 'h',
            text: 'A economia por trás das decisões técnicas',
          },
          {
            type: 'p',
            text: 'Um exemplo torna a relação concreta. Um catálogo de vídeo costuma ser codificado em várias resoluções e taxas de bits, e cada variante multiplica o armazenamento e o trabalho de codificação — mas reduz banda, porque um celular numa rede ruim recebe a variante leve em vez de desperdiçar bytes numa qualidade que ele não consegue exibir. Como banda domina o custo, gastar mais em codificação e armazenamento para economizar transferência quase sempre compensa. Trocar de codec por um mais eficiente, com ganho de 20% a 30% em bytes para a mesma qualidade percebida, é uma das poucas otimizações que reduz a maior linha da fatura sem afetar o produto.',
          },
          {
            type: 'p',
            text: 'A distribuição de popularidade é o outro fator estrutural. O acesso a catálogos segue uma curva bastante desigual: uma fração pequena dos títulos responde pela maior parte das visualizações, e é ela que enche o cache de borda. Mas a cauda longa não desaparece — ela é responsável por uma parte relevante dos misses, e é onde o cache hierárquico paga por si. Dimensionar a borda pela cauda seria proibitivo; dimensioná-la pela cabeça e delegar o resto à camada regional é o desenho que equilibra custo e taxa de acerto.',
          },
          {
            type: 'p',
            text: 'Os modos de falha observados são consistentes. O primeiro é a queda de taxa de acerto causada por variação acidental na URL — parâmetros de rastreamento, ordem diferente de query string, cabeçalhos que entram na chave de cache sem necessidade. Cada variação fragmenta o mesmo conteúdo em entradas distintas e multiplica os misses silenciosamente. O segundo é a origem dimensionada apenas para o tráfego normal, que não sobrevive ao momento em que a borda esvazia — uma expiração mal configurada ou um purge amplo pode enviar à origem um volume que ela nunca viu.',
          },
          {
            type: 'p',
            text: 'O princípio generalizável é que em sistemas de entrega o cache não é otimização, é capacidade. Quando 95% do tráfego é servido pela borda, a origem foi dimensionada para 5% da demanda — e qualquer evento que reduza a taxa de acerto para 80% quadruplica sua carga instantaneamente. Por isso operações maduras tratam a taxa de acerto como métrica de disponibilidade, com alarme próprio, e não como indicador de eficiência.',
          },
          {
            type: 'table',
            head: ['Técnica', 'Problema que resolve'],
            rows: [
              ['Cache hierárquico', 'Centenas de misses simultâneos na origem'],
              ['Coalescência de requisições', 'Pico no momento em que o cache está frio'],
              ['Pré-posicionamento', 'Estreias com miss global simultâneo'],
              ['Servidores dentro do provedor', 'Latência e custo de trânsito'],
              ['URLs versionadas', 'Invalidação em centenas de pontos'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Depender de purge para atualizar conteúdo. A invalidação em centenas de pontos de presença é lenta, tem custo e limite de uso, e falha parcialmente com frequência. A prática correta é tornar cada versão do conteúdo imutável e endereçada por um nome derivado do próprio conteúdo — assim nunca existe entrada errada a remover, e o TTL pode ser praticamente infinito.',
          },
        ],
        quiz: [
          {
            q: 'Que problema o cache hierárquico resolve?',
            a: 'Evita que cada um dos centenas de pontos de presença busque o mesmo conteúdo diretamente na origem ao sofrer miss. Com uma camada regional intermediária, o conteúdo é buscado uma vez por região e distribuído internamente, reduzindo em uma ou duas ordens de grandeza a carga sobre a origem.',
          },
          {
            q: 'Por que pré-posicionar conteúdo antes de um lançamento?',
            a: 'Porque uma estreia gera miss simultâneo em todos os pontos de presença, concentrando na origem exatamente o maior pico de demanda. Distribuir antes, em horário de baixo tráfego, elimina esse pico, reduz custo de banda e melhora a latência do primeiro acesso de cada usuário.',
          },
          {
            q: 'Por que conteúdo imutável com nome versionado é melhor que purge?',
            a: 'Porque elimina a invalidação: uma versão nova tem nome novo, então não existe entrada obsoleta a remover em nenhum ponto de presença. O purge é lento para propagar, tem custo e limite, e falha parcialmente — enquanto o versionamento permite TTL praticamente infinito sem risco de servir conteúdo velho.',
          },
        ],
      },
    },
    {
      slug: 'pagamentos-e-idempotencia',
      title: 'Pagamentos: idempotência e conciliação',
      summary:
        'Por que sistemas de dinheiro são construídos sobre a suposição de que tudo será tentado de novo.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Sistemas financeiros partem do princípio de que qualquer operação pode ser repetida, qualquer resposta pode se perder e qualquer integração pode divergir — e projetam para detectar e corrigir isso.',
        blocks: [
          {
            type: 'p',
            text: 'Pagamento é o domínio em que o custo do erro é assimétrico e visível. Cobrar duas vezes gera reembolso, contestação e perda de confiança; deixar de cobrar gera prejuízo direto. E como sempre há um provedor externo no caminho, existe permanentemente a possibilidade de a resposta se perder e ninguém saber se a operação aconteceu.',
          },
          {
            type: 'key',
            text: 'A regra fundamental: o cliente escolhe uma chave de idempotência por *intenção* de pagamento, e a reutiliza em todas as tentativas. O servidor grava a chave junto do resultado, na mesma transação — e uma chave repetida devolve a resposta anterior sem executar nada.',
          },
          {
            type: 'p',
            text: 'A atomicidade entre o efeito e o registro da chave é o detalhe que separa uma implementação correta de uma aparentemente correta. Se a cobrança é registrada e a chave não, uma retentativa não encontra o registro e cobra de novo. Um índice único sobre a chave resolve também a corrida entre duas requisições simultâneas: a segunda falha na inserção e sabe que deve consultar o resultado em vez de executar.',
          },
          {
            type: 'h',
            text: 'Máquina de estados explícita',
          },
          {
            type: 'p',
            text: 'Um pagamento nunca é um booleano. Ele percorre estados — iniciado, autorizado, capturado, liquidado, estornado, falho — e cada transição precisa ser explícita, persistida e idempotente. Isso permite responder com precisão em que ponto uma operação parou e retomá-la corretamente após qualquer falha.',
          },
          {
            type: 'p',
            text: 'O estado mais importante e mais negligenciado é o indeterminado: a requisição foi enviada ao provedor e a resposta não chegou. Ele não é sucesso nem falha, e tratá-lo como qualquer um dos dois produz erro. O correto é registrá-lo como pendente de verificação e consultar ativamente o provedor até obter uma resposta definitiva.',
          },
          {
            type: 'h',
            text: 'Conciliação',
          },
          {
            type: 'p',
            text: 'Mesmo com tudo bem implementado, dois sistemas independentes divergem: webhooks se perdem, uma operação foi confirmada no provedor e não registrada localmente, um estorno foi processado por fora. Por isso todo sistema financeiro sério roda conciliação periódica — compara o extrato do provedor com os registros próprios e produz uma lista de divergências.',
          },
          {
            type: 'p',
            text: 'A conciliação não é apenas um controle contábil: é o mecanismo que detecta os bugs que a idempotência não cobriu. Uma divergência recorrente aponta para um caminho de código com falha, e frequentemente é a única forma de descobri-lo — porque o efeito é silencioso e só aparece na soma.',
          },
          {
            type: 'p',
            text: 'No registro dos valores, duas práticas são padrão. Armazenar em inteiros na menor unidade da moeda — centavos —, porque ponto flutuante acumula erro de arredondamento inaceitável em dinheiro. E manter um livro-razão apenas de inserções, em que nada é alterado ou apagado: um estorno é um novo lançamento em sentido contrário, e o saldo é sempre derivado da soma. Isso preserva a auditoria completa e torna qualquer estado passado reconstruível.',
          },
          {
            type: 'h',
            text: 'Detalhes que decidem a correção',
          },
          {
            type: 'p',
            text: 'A chave de idempotência precisa de escopo e de prazo. Escopo, porque a mesma chave enviada por dois clientes diferentes não pode colidir — na prática, ela é única por conta ou por comerciante, não globalmente. Prazo, porque guardar chaves para sempre faz a tabela crescer sem limite; provedores costumam manter a garantia por 24 horas ou alguns dias, e é preciso saber esse número, já que uma retentativa fora da janela deixa de ser protegida e volta a ser uma cobrança nova.',
          },
          {
            type: 'p',
            text: 'Há também o caso da chave repetida com corpo diferente: mesmo identificador, valor alterado. Tratar como repetição devolveria a resposta antiga para um pedido que não é o mesmo; executar cobraria duas vezes. A prática correta é guardar um resumo do corpo junto da chave e recusar a divergência com um erro claro — é quase sempre um bug do cliente, e falhar alto é melhor que escolher silenciosamente uma das interpretações erradas.',
          },
          {
            type: 'p',
            text: 'Os webhooks merecem o mesmo cuidado do lado de dentro. Provedores entregam ao menos uma vez, então notificações duplicadas são rotina, e chegam fora de ordem com frequência. Um consumidor que aplica cegamente cada evento pode regredir um pagamento de capturado para autorizado porque a notificação antiga chegou depois. A defesa é dupla: identificador único do evento para descartar repetições, e transições de estado que só avançam, ignorando eventos que representam um estado anterior ao atual.',
          },
          {
            type: 'p',
            text: 'O princípio generalizável ultrapassa pagamentos. Sempre que existe efeito externo irreversível atrás de uma rede não confiável, o desenho correto tem três peças: um identificador de intenção fornecido pelo cliente, um registro persistente do que já foi feito com esse identificador, e um processo de verificação que resolve os casos indeterminados depois. Emissão de nota fiscal, envio de e-mail transacional, provisionamento de recurso e disparo de mensagem seguem exatamente o mesmo padrão — o dinheiro apenas torna o custo do erro visível o bastante para que a disciplina seja aplicada.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Gerar a chave de idempotência dentro do laço de retentativa. Cada tentativa recebe uma chave nova, o servidor as vê como intenções distintas e executa todas — cobrando o cliente várias vezes justamente quando a proteção deveria agir. A chave pertence à intenção do usuário e precisa ser criada antes da primeira tentativa e reutilizada em todas.',
          },
        ],
        quiz: [
          {
            q: 'Por que a chave de idempotência precisa ser gravada na mesma transação que o efeito?',
            a: 'Porque se o efeito é registrado e a chave não, uma falha entre os dois passos faz a retentativa não encontrar o registro e executar de novo, duplicando a cobrança. Só a atomicidade garante que "efeito aplicado" e "chave conhecida" sejam sempre o mesmo fato.',
          },
          {
            q: 'Como tratar o estado indeterminado, em que a resposta do provedor não chegou?',
            a: 'Registrá-lo explicitamente como pendente de verificação — nem sucesso nem falha — e consultar ativamente o provedor até obter resposta definitiva. Assumir falha e reenviar pode cobrar duas vezes; assumir sucesso pode deixar de cobrar. Só a consulta ao provedor resolve a ambiguidade.',
          },
          {
            q: 'Por que a conciliação é necessária mesmo com idempotência bem implementada?',
            a: 'Porque dois sistemas independentes divergem por caminhos que a idempotência não cobre: webhooks perdidos, operações confirmadas no provedor e não registradas localmente, ações feitas fora do fluxo. A conciliação compara os dois lados periodicamente e é frequentemente a única forma de detectar esses erros, que são silenciosos e só aparecem na soma.',
          },
        ],
      },
    },
  ],
};

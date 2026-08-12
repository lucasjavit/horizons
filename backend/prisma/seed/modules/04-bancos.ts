import type { ModuleSeed } from '../types';

export const bancos: ModuleSeed = {
  slug: 'bancos-de-dados',
  title: 'Bancos de dados',
  goal: 'Escolher e escalar armazenamento com critério: entender o que ACID garante, quando NoSQL ajuda de verdade, como índices funcionam por dentro e o que replicação e sharding custam.',
  lessons: [
    {
      slug: 'acid-e-transacoes',
      title: 'ACID e transações',
      summary:
        'O que cada letra realmente promete, e por que o nível de isolamento padrão do seu banco provavelmente não é o que você imagina.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'ACID descreve as garantias de uma transação: atomicidade, consistência, isolamento e durabilidade. Isolamento é a letra mais mal compreendida e a que mais gera bugs sutis.',
        blocks: [
          {
            type: 'p',
            text: 'Atomicidade significa que a transação é indivisível: ou todos os seus efeitos acontecem, ou nenhum. Se algo falha no meio, tudo é desfeito. É o que permite escrever "debita de A, credita em B" sem inventar um estado intermediário em que o dinheiro sumiu.',
          },
          {
            type: 'p',
            text: 'Consistência, no contexto de ACID, é a mais fraca das quatro e a que mais confunde: significa apenas que a transação leva o banco de um estado válido a outro estado válido, respeitando as restrições declaradas (chaves estrangeiras, unicidade, checks). Não tem nada a ver com o "C" do teorema CAP, que fala de visibilidade das escritas entre réplicas. São palavras iguais para conceitos diferentes.',
          },
          {
            type: 'p',
            text: 'Durabilidade garante que, uma vez confirmado o commit, o dado sobrevive a queda de energia. Na prática, isso significa gravar em um log de escrita antecipada (write-ahead log) e forçar a descarga em disco antes de responder. Vale saber que muitos bancos permitem afrouxar isso — commit assíncrono — trocando durabilidade por throughput; é uma decisão legítima para dados descartáveis e desastrosa para dados financeiros.',
          },
          {
            type: 'h',
            text: 'Isolamento: onde moram os bugs',
          },
          {
            type: 'p',
            text: 'Isolamento define o quanto uma transação enxerga do trabalho em andamento de outra. O ideal — serializável — garante que o resultado seja equivalente a executar as transações uma após a outra. É caro, e por isso praticamente nenhum banco usa isso como padrão. O que os níveis mais fracos permitem é descrito por um catálogo de anomalias.',
          },
          {
            type: 'table',
            head: ['Nível', 'Dirty read', 'Non-repeatable read', 'Phantom read', 'Write skew'],
            rows: [
              ['Read uncommitted', 'Possível', 'Possível', 'Possível', 'Possível'],
              ['Read committed', 'Não', 'Possível', 'Possível', 'Possível'],
              ['Repeatable read', 'Não', 'Não', 'Depende do banco', 'Possível'],
              ['Snapshot isolation', 'Não', 'Não', 'Não', 'Possível'],
              ['Serializable', 'Não', 'Não', 'Não', 'Não'],
            ],
          },
          {
            type: 'p',
            text: 'Dirty read é ler dado de uma transação que ainda não commitou (e que pode ser desfeita). Non-repeatable read é ler a mesma linha duas vezes na mesma transação e receber valores diferentes. Phantom read é executar a mesma consulta por intervalo duas vezes e encontrar linhas novas. Write skew é o mais traiçoeiro: duas transações leem o mesmo conjunto, cada uma decide algo com base nele e escreve em linhas *diferentes* — nenhuma escreve por cima da outra, então nenhum mecanismo baseado em conflito de escrita detecta, e ainda assim a invariante do sistema é violada.',
          },
          {
            type: 'key',
            text: 'A maioria dos bancos usa read committed por padrão. Isso significa que a garantia com que a maior parte do código roda é bem mais fraca do que a intuição de "uma transação por vez" sugere.',
          },
          {
            type: 'p',
            text: 'O exemplo clássico de write skew: um plantão médico exige pelo menos um médico de sobreaviso. Dois médicos, simultaneamente, verificam "há dois de sobreaviso, posso sair" e cada um remove a si mesmo. Ambas as transações leram um estado válido, escreveram linhas diferentes e commitaram sem conflito — e o plantão ficou vazio. Nenhum nível abaixo de serializable impede isso.',
          },
          {
            type: 'p',
            text: 'As saídas práticas são três. A primeira é usar isolamento serializável na transação crítica — mais caro, mas correto, e no PostgreSQL o SSI faz isso abortando transações que teriam violado a serialização, o que exige lógica de retry no aplicativo. A segunda é bloqueio explícito (`SELECT ... FOR UPDATE`) sobre as linhas que fundamentam a decisão, forçando a materialização do conflito. A terceira é modelar a invariante como uma restrição que o banco consiga verificar — uma constraint de unicidade, um check, um contador com incremento atômico.',
          },
          {
            type: 'h',
            text: 'Controle pessimista e otimista',
          },
          {
            type: 'p',
            text: 'Há duas formas de proteger uma seção crítica no banco, e a escolha depende de quão provável é o conflito. O controle pessimista trava a linha na leitura (`SELECT ... FOR UPDATE`) e faz quem chegar depois esperar. É previsível e adequado quando a disputa é frequente — várias transações mexendo no mesmo registro o tempo todo —, mas serializa o acesso e abre espaço para deadlock quando transações travam recursos em ordens diferentes.',
          },
          {
            type: 'p',
            text: 'O controle otimista não trava nada: cada linha carrega um número de versão, e a atualização inclui a versão lida na condição. Se ninguém alterou o registro nesse intervalo, uma linha é afetada e a operação passa; se alguém alterou, zero linhas são afetadas e a aplicação sabe que precisa reler e tentar de novo. Não há espera nem deadlock, e o custo aparece só quando o conflito realmente ocorre — o que o torna ideal para disputa rara, como a edição de um cadastro por dois operadores.',
          },
          {
            type: 'code',
            lang: 'sql',
            code: `-- Otimista: a versão lida entra na condição.
UPDATE pedidos
   SET status = 'pago', versao = versao + 1
 WHERE id = 42 AND versao = 7;
-- 1 linha afetada → passou. 0 linhas → alguém alterou antes; releia e repita.`,
          },
          {
            type: 'p',
            text: 'Sobre deadlock, vale saber que o banco detecta o ciclo e aborta uma das transações com erro específico — não fica travado para sempre. Isso significa que a aplicação precisa tratar esse erro repetindo a operação, e não apenas propagá-lo como falha. A prevenção mais eficaz é adquirir os locks sempre na mesma ordem: se toda transação trava as contas em ordem crescente de identificador, o ciclo não se forma.',
          },
          {
            type: 'p',
            text: 'Um último ponto que produz incidentes com frequência: transações longas. Manter uma transação aberta enquanto se chama um serviço externo ou se espera entrada do usuário segura locks e impede a limpeza de versões antigas, o que faz as tabelas incharem e o desempenho degradar para todo mundo. A regra é abrir a transação o mais tarde possível, fechá-la o mais cedo possível, e nunca deixar uma chamada de rede dentro dela.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Ler, decidir no código da aplicação e escrever — sem lock e sem transação serializável. `SELECT saldo` → `if (saldo >= valor)` → `UPDATE saldo = saldo - valor` é uma corrida esperando para acontecer: entre o SELECT e o UPDATE, outra transação pode ter mudado tudo. A correção é fazer a verificação e a escrita numa operação atômica (`UPDATE ... WHERE saldo >= valor` e checar quantas linhas foram afetadas) ou travar a linha na leitura.',
          },
        ],
        quiz: [
          {
            q: 'Por que "consistência" em ACID e em CAP significam coisas diferentes?',
            a: 'Em ACID, consistência é preservação das restrições declaradas do banco (chaves, unicidade, checks) por cada transação — uma propriedade local e sem relação com distribuição. Em CAP, consistência é linearizabilidade: toda leitura vê a escrita confirmada mais recente, independentemente de qual réplica atendeu. Um sistema pode ser ACID em cada nó e eventualmente consistente entre nós.',
          },
          {
            q: 'O que é write skew e por que ele não é detectado por níveis abaixo de serializable?',
            a: 'É quando duas transações concorrentes leem o mesmo conjunto de dados, tomam decisões baseadas nele e escrevem em linhas diferentes. Como não há conflito de escrita sobre a mesma linha, mecanismos de detecção baseados em sobreposição de escrita não veem problema — mas a decisão de cada uma foi tomada sobre um estado que a outra invalidou, quebrando a invariante do conjunto.',
          },
          {
            q: 'Como corrigir um débito de saldo que hoje faz SELECT, verifica no código e depois UPDATE?',
            a: 'Tornar verificação e escrita atômicas: `UPDATE contas SET saldo = saldo - :valor WHERE id = :id AND saldo >= :valor`, checando o número de linhas afetadas para saber se passou. Alternativas: travar a linha com SELECT ... FOR UPDATE antes de decidir, ou rodar a transação em nível serializável com retry no aplicativo.',
          },
        ],
      },
    },
    {
      slug: 'sql-vs-nosql',
      title: 'SQL vs NoSQL',
      summary:
        'A escolha não é sobre escala: é sobre padrão de acesso, forma dos dados e quais garantias você quer que o banco imponha.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Bancos relacionais impõem esquema e oferecem consultas flexíveis com joins e transações. Bancos NoSQL abrem mão de parte disso em troca de modelos de dados específicos e distribuição mais simples.',
        blocks: [
          {
            type: 'p',
            text: 'O rótulo "NoSQL" agrupa famílias muito diferentes, e tratá-las como uma coisa só é o começo de toda má decisão nessa área. Bancos de documento guardam objetos aninhados sob uma chave. Wide-column organizam dados por chave de partição e chave de ordenação, ótimos para escrita massiva e leituras por intervalo. Chave-valor fazem uma coisa só, rápido. Grafos otimizam travessia de relacionamentos. Cada um foi feito para um padrão de acesso específico.',
          },
          {
            type: 'key',
            text: 'A pergunta não é "SQL ou NoSQL", e sim "quais consultas este sistema vai fazer com mais frequência?". Bancos relacionais deixam você decidir isso depois; a maioria dos NoSQL exige decidir antes, porque o modelo de dados é desenhado em função das consultas.',
          },
          {
            type: 'table',
            head: ['Critério', 'Relacional', 'Documento', 'Wide-column', 'Chave-valor'],
            rows: [
              ['Esquema', 'Rígido, validado', 'Flexível', 'Semi-rígido', 'Nenhum'],
              ['Consultas ad hoc', 'Excelente', 'Boa', 'Limitada', 'Só por chave'],
              ['Joins', 'Nativos', 'Manuais/limitados', 'Não', 'Não'],
              ['Transações multi-linha', 'Sim', 'Parcial', 'Limitada', 'Raramente'],
              ['Escrita em escala', 'Boa até um limite', 'Boa', 'Excelente', 'Excelente'],
              ['Melhor caso', 'Dados relacionados, regras de negócio', 'Agregados autocontidos', 'Séries temporais, eventos', 'Cache, sessão'],
            ],
          },
          {
            type: 'h',
            text: 'O que o esquema rígido dá em troca',
          },
          {
            type: 'p',
            text: '"Schemaless" não significa ausência de esquema — significa que o esquema mora no código da aplicação, espalhado por todos os lugares que leem aquele documento. Isso é liberdade real no início e dívida real depois: três anos e cinco versões de formato mais tarde, cada leitura precisa saber lidar com todas as variações históricas, e não há nada garantindo que uma delas não escapou.',
          },
          {
            type: 'p',
            text: 'O esquema no banco, em compensação, é uma verificação que roda sempre, independente de qual serviço ou script está escrevendo. Chave estrangeira que impede órfão, unicidade que impede duplicata, NOT NULL que impede o campo esquecido. Em um sistema com múltiplos escritores, isso vale muito — porque é a única camada por onde todos passam obrigatoriamente.',
          },
          {
            type: 'h',
            text: 'Modelagem orientada a acesso',
          },
          {
            type: 'p',
            text: 'Em bancos wide-column e de documento, a normalização costuma ser um erro. Se a tela mostra um pedido com seus itens, guarde o pedido com os itens dentro: uma leitura, uma partição, sem join. A denormalização duplica dados, e a duplicação exige atualizar em vários lugares — troca-se complexidade de leitura por complexidade de escrita. Vale quando as leituras são muito mais frequentes que as escritas, que é o caso comum.',
          },
          {
            type: 'p',
            text: 'Isso leva ao ponto mais importante da escolha: a chave de partição. Em bancos distribuídos por chave, ela determina onde o dado mora e, portanto, quais consultas são baratas e quais são inviáveis. Escolher errado significa varrer o cluster inteiro para responder perguntas que deveriam ser triviais — e mudá-la depois costuma exigir migração completa dos dados.',
          },
          {
            type: 'p',
            text: 'A consequência prática é que o processo de modelagem se inverte. Num relacional você desenha as entidades e depois descobre as consultas; num banco distribuído por chave você lista as consultas primeiro e só então desenha as tabelas que atendem cada uma. É comum a mesma informação aparecer em três tabelas, cada uma com a chave desenhada para uma pergunta. Isso não é redundância acidental: é o índice, materializado à mão, porque o banco não vai criá-lo por você.',
          },
          {
            type: 'p',
            text: 'Índices secundários existem nesses bancos, mas com um custo que precisa ser entendido. Um índice local vive dentro de cada partição e só refina consultas que já conhecem a chave de partição. Um índice global é uma estrutura própria, particionada por outra chave, e por isso é mantido de forma assíncrona: há uma janela em que ele ainda devolve o estado antigo. É uma consistência eventual que aparece dentro do próprio banco, e código que assume "gravei, logo o índice já sabe" produz bugs intermitentes exatamente como uma réplica atrasada.',
          },
          {
            type: 'p',
            text: 'Há ainda um limite físico que pega times de surpresa: a partição tem tamanho e vazão máximos. Modelar "todos os itens de um cliente sob a chave do cliente" funciona até aparecer o cliente com dez milhões de itens, que estoura o limite ou concentra tráfego suficiente para saturá-la sozinho. A saída é acrescentar granularidade à chave — o mês, um bucket numérico —, repartindo o grupo em partições menores ao preço de a consulta passar a atingir várias delas.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Escolher NoSQL "por causa da escala" quando o volume real cabe folgadamente num Postgres. Um banco relacional bem indexado, numa máquina razoável, atende dezenas de milhares de transações por segundo e terabytes de dados. Adotar um modelo sem joins e sem transações para um produto que ainda vai descobrir suas próprias consultas troca flexibilidade — o recurso mais valioso no início — por uma escala que talvez nunca chegue.',
          },
          {
            type: 'p',
            text: 'Vale registrar que a fronteira ficou porosa. Bancos relacionais modernos têm colunas JSON com índice, o que cobre boa parte do caso de uso de documento sem abrir mão de transações; e vários NoSQL adicionaram transações e linguagens de consulta parecidas com SQL. Na prática, hoje o mais comum é usar um relacional como fonte de verdade e acrescentar armazenamentos especializados — busca, cache, séries temporais — onde o padrão de acesso justifica.',
          },
        ],
        quiz: [
          {
            q: 'Por que "schemaless" não significa que não existe esquema?',
            a: 'Porque a aplicação sempre pressupõe uma estrutura ao ler os dados. Sem esquema no banco, essa estrutura fica implícita no código, replicada em cada ponto de leitura e sem validação central. O resultado é que versões antigas de documentos convivem indefinidamente e cada leitor precisa tratar todas as variações históricas.',
          },
          {
            q: 'Quando denormalizar é a decisão correta?',
            a: 'Quando as leituras são muito mais frequentes que as escritas e o padrão de acesso é conhecido e estável: guardar o agregado pronto evita joins e múltiplas idas ao banco. O custo é manter as cópias sincronizadas em cada escrita, o que só compensa se a proporção leitura/escrita for alta e a consulta for previsível.',
          },
          {
            q: 'Por que a chave de partição é a decisão mais cara de reverter num banco distribuído?',
            a: 'Porque ela determina fisicamente onde cada registro mora. Consultas alinhadas à chave atingem uma partição; as demais precisam varrer o cluster. Mudá-la depois exige reescrever e redistribuir todo o conjunto de dados, normalmente com migração online e escrita dupla durante a transição.',
          },
        ],
      },
    },
    {
      slug: 'indices',
      title: 'Índices',
      summary:
        'Como uma B-tree transforma varredura em busca logarítmica, por que índice demais é tão ruim quanto índice de menos, e o que é um índice coberto.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Um índice é uma estrutura de dados auxiliar que troca espaço e custo de escrita por velocidade de leitura. Entender como ele é percorrido explica quais consultas ele acelera e quais ignora.',
        blocks: [
          {
            type: 'p',
            text: 'Sem índice, encontrar uma linha exige varrer a tabela inteira: custo linear no número de registros. Com um índice B-tree, o banco navega uma árvore balanceada e chega à linha em poucos saltos — custo logarítmico. Numa tabela de dez milhões de linhas, a diferença é entre milhões de leituras e cerca de quatro.',
          },
          {
            type: 'p',
            text: 'A B-tree (na prática, B+tree) mantém as chaves ordenadas e os dados nas folhas, que são encadeadas entre si. Essa ordenação é o que torna o índice útil para mais do que igualdade: ele também serve para intervalos (`BETWEEN`, `>`, `<`), para prefixos (`LIKE \'abc%\'`) e para evitar ordenação — se a consulta pede `ORDER BY` na mesma ordem do índice, o banco lê as folhas em sequência e pula o passo de ordenar.',
          },
          {
            type: 'key',
            text: 'Índice não é grátis: cada INSERT, UPDATE e DELETE precisa atualizar todos os índices da tabela. Cinco índices significam cinco estruturas mantidas a cada escrita, além do espaço em disco e da memória que eles ocupam no cache.',
          },
          {
            type: 'h',
            text: 'Índices compostos e a regra do prefixo',
          },
          {
            type: 'p',
            text: 'Um índice sobre `(cidade, data, valor)` é ordenado primeiro por cidade, depois por data dentro da cidade, depois por valor. Isso significa que ele serve para consultas que filtram por cidade, ou por cidade e data, ou pelos três — mas não para uma consulta que filtre apenas por data. É a regra do prefixo mais à esquerda: você só pode usar o índice a partir do começo da lista de colunas.',
          },
          {
            type: 'code',
            lang: 'sql',
            code: `-- Índice: (cidade, data, valor)
WHERE cidade = 'SP'                          -- usa o índice
WHERE cidade = 'SP' AND data > '2026-01-01'  -- usa o índice
WHERE data > '2026-01-01'                    -- NÃO usa: pula o prefixo
WHERE cidade = 'SP' AND valor > 100          -- usa só a parte "cidade"`,
          },
          {
            type: 'p',
            text: 'Há também uma regra de ordenação de colunas dentro do índice composto: colunas usadas com igualdade vêm antes das usadas com intervalo. Assim que o índice encontra uma condição de intervalo, as colunas seguintes deixam de restringir a busca e passam apenas a estar disponíveis para leitura.',
          },
          {
            type: 'h',
            text: 'Índice coberto',
          },
          {
            type: 'p',
            text: 'Normalmente o índice leva o banco até um ponteiro para a linha, e é preciso um segundo acesso para buscar os dados da tabela. Se todas as colunas que a consulta precisa já estão no próprio índice, esse segundo acesso desaparece — é o index-only scan, ou índice coberto. Acrescentar uma coluna a um índice só para evitar a ida à tabela costuma ser uma das otimizações de maior retorno disponíveis.',
          },
          {
            type: 'p',
            text: 'Outra variante muito útil é o índice parcial: indexar apenas as linhas que interessam. Num sistema em que 99% dos pedidos estão finalizados e as consultas quentes buscam sempre os pendentes, um índice `WHERE status = \'pendente\'` é uma fração do tamanho, cabe em memória e é atualizado com muito menos frequência.',
          },
          {
            type: 'h',
            text: 'O que impede o uso de um índice',
          },
          {
            type: 'list',
            items: [
              'Aplicar função na coluna: `WHERE UPPER(email) = ?` inutiliza o índice sobre `email` — a menos que exista um índice sobre a expressão.',
              'Comparar tipos diferentes, forçando conversão implícita da coluna.',
              'Curinga no início do padrão: `LIKE \'%termo\'` não tem prefixo por onde começar.',
              'Baixa seletividade: se o filtro seleciona metade da tabela, varrer sequencialmente é mais rápido, e o planejador escolhe fazer isso.',
              'Estatísticas desatualizadas, que fazem o planejador estimar mal a seletividade e escolher o plano errado.',
            ],
          },
          {
            type: 'h',
            text: 'B-tree e LSM: duas formas de organizar',
          },
          {
            type: 'p',
            text: 'Vale conhecer a alternativa estrutural, porque ela explica o comportamento de boa parte dos bancos modernos. A B-tree atualiza as páginas no lugar: encontrar a posição e escrever ali significa uma escrita aleatória em disco, e a leitura é rápida e previsível porque a árvore está sempre ordenada. O índice LSM faz o oposto — acumula as escritas em memória e as descarrega periodicamente em arquivos imutáveis ordenados, que depois são fundidos em segundo plano.',
          },
          {
            type: 'p',
            text: 'A consequência prática é uma troca clara. O LSM absorve escrita muito melhor, porque tudo vira acréscimo sequencial em vez de atualização espalhada pelo disco. Em compensação, uma leitura pode precisar consultar vários arquivos até encontrar a versão atual da chave — daí o uso de filtros de Bloom para descartar rapidamente os arquivos que certamente não a contêm. E existe o custo da compactação, que consome I/O em segundo plano e pode causar picos de latência quando coincide com o horário de pico.',
          },
          {
            type: 'p',
            text: 'Os dois desperdiçam trabalho, mas de formas diferentes. A B-tree sofre amplificação de escrita porque alterar poucos bytes obriga a gravar a página inteira, e ainda registra a mudança no log de escrita antecipada. O LSM sofre amplificação de leitura e de espaço, porque o mesmo registro pode existir em várias versões até a compactação passar. Escolher entre eles é escolher qual desperdício o seu perfil de carga tolera melhor.',
          },
          {
            type: 'h',
            text: 'Ler o plano de execução',
          },
          {
            type: 'p',
            text: 'Todo raciocínio sobre índices vira especulação sem olhar o plano que o banco escolheu. O comando de explicação mostra a estratégia de acesso — varredura sequencial, busca por índice, index-only scan — e, na versão que executa de fato, também os tempos e as contagens reais. O sinal mais valioso ali é a discrepância entre linhas estimadas e linhas efetivamente retornadas: quando o planejador espera dez linhas e encontra cem mil, ele escolheu o plano com base numa premissa errada, e o problema costuma ser estatística desatualizada, não falta de índice.',
          },
          {
            type: 'p',
            text: 'Vale notar que varredura sequencial não é sinônimo de erro. Se o filtro seleciona uma fatia grande da tabela, ler tudo em sequência é mais rápido que saltar aleatoriamente pelo índice e depois buscar cada linha — o disco favorece leitura contígua. O planejador sabe disso e decide pelo custo estimado. Forçar o uso de índice nesse cenário costuma piorar o desempenho, e a intervenção correta é melhorar a estimativa, não sobrepor a decisão.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Criar um índice para cada coluna que aparece em algum WHERE. Isso multiplica o custo de escrita, ocupa memória que faria falta ao cache de dados e frequentemente não é usado — o planejador escolhe um índice por consulta na maioria dos casos. O caminho correto é olhar as consultas reais e lentas, ler o plano de execução (`EXPLAIN ANALYZE`) e criar índices compostos que sirvam a várias delas.',
          },
        ],
        quiz: [
          {
            q: 'Um índice sobre (a, b, c) ajuda numa consulta que filtra só por b e c? Por quê?',
            a: 'Não. A B-tree ordena primeiro por a; os valores de b só estão ordenados dentro de cada valor de a. Sem restringir a, não há um intervalo contíguo de folhas para percorrer, então o banco precisaria varrer o índice inteiro — normalmente mais caro que varrer a tabela. Vale a regra do prefixo mais à esquerda.',
          },
          {
            q: 'O que é um índice coberto e por que ele é tão eficaz?',
            a: 'É um índice que contém todas as colunas necessárias para responder a consulta, incluindo as do SELECT. Como o resultado sai inteiro do índice, o banco dispensa o acesso adicional à tabela para cada linha encontrada — eliminando, em consultas que retornam muitas linhas, a maior parte das leituras de disco.',
          },
          {
            q: 'Por que `WHERE UPPER(email) = ?` não usa o índice sobre email, e como resolver?',
            a: 'Porque o índice armazena os valores originais, não o resultado da função: o banco não tem como localizar por um valor transformado sem aplicar a função a cada linha. As soluções são criar um índice sobre a expressão `UPPER(email)`, normalizar o dado na escrita, ou usar uma coluna/collation case-insensitive.',
          },
        ],
      },
    },
    {
      slug: 'replicacao',
      title: 'Replicação',
      summary:
        'Cópias dos dados em vários nós: o que se ganha em leitura e disponibilidade, e o lag que aparece junto.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Replicação mantém cópias dos dados em nós diferentes, para tolerar falhas, distribuir leituras e aproximar dados dos usuários. O custo central é o atraso entre as cópias.',
        blocks: [
          {
            type: 'p',
            text: 'A topologia mais comum é líder-seguidor (primary-replica): um nó aceita escritas e propaga as mudanças para os demais, que servem leituras. É simples de raciocinar porque só existe um lugar onde a ordem das escritas é decidida — não há conflito possível.',
          },
          {
            type: 'p',
            text: 'A propagação pode ser síncrona ou assíncrona, e essa escolha é o trade-off principal. Na replicação síncrona, o líder só confirma o commit depois que a réplica confirmou ter recebido: nenhum dado se perde num failover, mas cada escrita paga a latência da réplica mais lenta, e se ela travar as escritas param. Na assíncrona, o líder confirma imediatamente e propaga depois: escritas rápidas e independentes da saúde das réplicas, ao custo de perder as últimas transações se o líder morrer antes de propagar.',
          },
          {
            type: 'p',
            text: 'O meio-termo prático é a replicação semissíncrona: exigir confirmação de *uma* réplica (ou de um quórum) em vez de todas. Garante que o dado existe em mais de um lugar sem ficar refém do nó mais lento.',
          },
          {
            type: 'key',
            text: 'Replicação assíncrona significa que réplicas de leitura estão sempre um pouco no passado. Qualquer fluxo que escreve e imediatamente lê pode não encontrar o que acabou de gravar.',
          },
          {
            type: 'h',
            text: 'Read-your-writes e como garanti-lo',
          },
          {
            type: 'p',
            text: 'O sintoma clássico do lag: o usuário edita o perfil, a tela recarrega lendo de uma réplica atrasada, e ele vê os dados antigos — concluindo que a alteração não foi salva. As soluções costumam ser combinadas: ler do líder por alguns segundos após uma escrita daquele usuário; guardar a posição do log no momento da escrita e exigir que a réplica tenha alcançado essa posição; ou ler do líder apenas nas telas que exibem dados que o próprio usuário acabou de modificar.',
          },
          {
            type: 'p',
            text: 'Há um segundo sintoma menos óbvio, o de leituras não monotônicas: o usuário atualiza a página duas vezes, cai em réplicas diferentes e vê o dado "andar para trás". A correção usual é rotear consistentemente cada usuário para a mesma réplica.',
          },
          {
            type: 'h',
            text: 'O que trafega entre os nós',
          },
          {
            type: 'p',
            text: 'Vale entender o que o líder envia. Na replicação física, ele transmite o próprio log de escrita antecipada — instruções em nível de bytes e páginas: "na página 4211, offset 96, escreva estes bytes". É eficiente e produz cópia idêntica, mas exige réplicas na mesma versão e arquitetura, e copia o cluster inteiro, sem escolher tabelas.',
          },
          {
            type: 'p',
            text: 'Na replicação lógica trafegam mudanças em nível de linha decodificadas do log: "na tabela pedidos, a linha 77 passou a ter status pago". É mais cara de aplicar, mas destrava o que a física não permite — replicar só algumas tabelas, replicar entre versões diferentes do banco e alimentar consumidores que não são bancos, como um índice de busca. É a base do padrão de captura de mudanças (CDC), em que a fila de eventos nasce do log e não de escritas duplicadas pela aplicação.',
          },
          {
            type: 'p',
            text: 'O failover é onde essas escolhas cobram a conta. A detecção depende de um timeout — curto demais promove réplicas por um pico de latência, longo demais deixa o sistema fora do ar à toa. O sucessor deveria ser a réplica mais adiantada, mas com replicação assíncrona ela também está atrás: tudo que o líder confirmou e não propagou se perde. A reconciliação é pior: o líder antigo volta trazendo escritas que o novo nunca viu, e descartá-las é perda silenciosa de dados confirmados. Por isso failover automático sério depende de quórum externo e de fencing — impedir fisicamente que o nó rebaixado escreva.',
          },
          {
            type: 'h',
            text: 'Multi-líder e sem líder',
          },
          {
            type: 'p',
            text: 'Multi-líder permite escrita em mais de um nó, o que é útil entre regiões geográficas ou para aplicações que funcionam offline. O preço é alto: escritas concorrentes no mesmo dado em líderes diferentes geram conflito, e alguém precisa resolvê-lo. As estratégias vão do simplório "a última escrita vence" (que descarta dados silenciosamente, já que relógios de máquinas diferentes não são confiáveis) a estruturas que convergem por construção, como CRDTs, passando por resolução manual pela aplicação.',
          },
          {
            type: 'p',
            text: 'Sistemas sem líder (estilo Dynamo) mandam cada escrita e cada leitura para várias réplicas e usam quóruns: se W réplicas confirmam a escrita, R confirmam a leitura e W + R > N, então a leitura necessariamente encontra pelo menos uma réplica com o valor mais recente. Isso permite ajustar o comportamento por operação — W alto favorece durabilidade, R baixo favorece latência de leitura.',
          },
          {
            type: 'table',
            head: ['Topologia', 'Conflitos', 'Latência de escrita', 'Complexidade'],
            rows: [
              ['Líder único, síncrona', 'Impossíveis', 'Alta (espera réplica)', 'Baixa'],
              ['Líder único, assíncrona', 'Impossíveis', 'Baixa', 'Baixa (mas há lag visível)'],
              ['Multi-líder', 'Frequentes', 'Baixa (líder local)', 'Alta'],
              ['Sem líder (quórum)', 'Possíveis, resolvidos na leitura', 'Média', 'Média-alta'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Mandar todas as leituras para réplicas para "aliviar o primário" sem separar quais leituras toleram atraso. O resultado é uma classe inteira de bugs intermitentes — o item some da lista logo após ser criado, o saldo não reflete a transferência recém-feita —, difíceis de reproduzir porque dependem do lag no instante exato. Leituras que sustentam decisões ou que seguem uma escrita do próprio usuário precisam ir ao líder.',
          },
        ],
        quiz: [
          {
            q: 'Quando replicação síncrona vale o custo?',
            a: 'Quando perder as últimas transações confirmadas é inaceitável — dados financeiros, registros regulatórios, transações irreversíveis. Em troca, cada escrita espera pelo menos uma réplica confirmar, e a indisponibilidade de réplicas pode travar as escritas. O arranjo usual é semissíncrono: exigir confirmação de uma réplica ou de um quórum, e não de todas.',
          },
          {
            q: 'Como garantir read-your-writes com réplicas assíncronas?',
            a: 'As opções: rotear ao líder as leituras do usuário durante uma janela após sua escrita; registrar a posição no log de replicação no momento da escrita e exigir que a réplica escolhida a tenha alcançado; ou marcar as telas que exibem dados recém-modificados pelo próprio usuário para lerem sempre do líder. As demais leituras seguem para réplicas normalmente.',
          },
          {
            q: 'Por que "a última escrita vence" é uma estratégia perigosa de resolução de conflito?',
            a: 'Porque depende de comparar relógios de máquinas distintas, que têm desvio entre si — o "último" pode ser o que tinha o relógio adiantado, não o que aconteceu depois. E porque descarta uma das escritas silenciosamente: o dado do perdedor desaparece sem que ninguém seja notificado.',
          },
        ],
      },
    },
    {
      slug: 'sharding',
      title: 'Sharding e particionamento',
      summary:
        'Dividir os dados entre máquinas: as estratégias de partição, o problema das hot partitions e por que joins ficam caros.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Sharding divide o conjunto de dados entre vários nós, cada um responsável por uma fatia. É o que permite escalar escrita horizontalmente — e é a mudança mais difícil de reverter.',
        blocks: [
          {
            type: 'p',
            text: 'Replicação copia os mesmos dados; sharding divide dados diferentes. Réplicas resolvem leitura e disponibilidade, mas não ajudam em escrita: todo INSERT ainda passa pelo líder. Quando o volume de escrita ou o tamanho do conjunto excede uma máquina, a única saída é particionar.',
          },
          {
            type: 'h',
            text: 'Estratégias de partição',
          },
          {
            type: 'p',
            text: 'Partição por intervalo (range) atribui faixas contíguas da chave a cada shard — clientes de A a F no shard 1, e assim por diante. A vantagem é que consultas por intervalo atingem poucos shards. A desvantagem é o desbalanceamento: se a chave é temporal, todas as escritas novas caem sempre no último shard, criando um hotspot permanente.',
          },
          {
            type: 'p',
            text: 'Partição por hash distribui uniformemente aplicando uma função de hash à chave. Resolve o desbalanceamento e mata a consulta por intervalo — chaves adjacentes vão parar em shards distintos. Usada com consistent hashing, permite adicionar e remover nós movendo pouca coisa.',
          },
          {
            type: 'p',
            text: 'A combinação das duas é o que bancos wide-column oferecem: uma chave composta em que a parte de partição é hasheada (distribui) e a parte de ordenação mantém os itens daquele grupo em sequência (permite intervalo local). É a modelagem que dá "todas as mensagens desta conversa, ordenadas por data" com uma única leitura em um único shard.',
          },
          {
            type: 'p',
            text: 'Há ainda a partição por diretório ou por inquilino: uma tabela de lookup diz onde cada entidade mora. Flexível — permite mover um cliente grande para um shard dedicado —, ao custo de manter esse diretório disponível, correto e fora do caminho crítico.',
          },
          {
            type: 'key',
            text: 'A escolha da chave de partição define tudo: quais consultas são baratas, quão uniforme fica a carga, e se transações conseguem ficar dentro de um único shard. É a decisão mais cara de reverter em toda a arquitetura de dados.',
          },
          {
            type: 'h',
            text: 'O que se perde',
          },
          {
            type: 'list',
            items: [
              'Joins entre shards: deixam de ser uma operação do banco e viram trabalho da aplicação — buscar de um lado, buscar do outro, combinar em memória.',
              'Transações distribuídas: garantir atomicidade entre shards exige protocolos como two-phase commit, que são lentos e travam recursos durante falhas.',
              'Unicidade global: uma constraint UNIQUE só vale dentro de um shard; garanti-la no conjunto exige um serviço de alocação à parte.',
              'Agregações: contar ou somar sobre tudo vira fan-out para todos os shards, com combinação posterior.',
              'Rebalanceamento: adicionar shards exige mover dados, geralmente com escrita dupla e migração online.',
            ],
          },
          {
            type: 'h',
            text: 'Hot partitions',
          },
          {
            type: 'p',
            text: 'Mesmo com hash uniforme, o tráfego pode não ser uniforme. Uma celebridade com dez milhões de seguidores, um produto em promoção, um inquilino corporativo que representa metade do volume — todos concentram acesso numa única partição, que satura enquanto as outras estão ociosas. É o problema mais comum em produção depois do sharding.',
          },
          {
            type: 'p',
            text: 'As respostas: acrescentar um sufixo aleatório à chave quente para dividi-la em N subpartições (e ler as N na consulta); replicar a partição quente em várias réplicas de leitura; colocar cache na frente para absorver a leitura repetida; ou tratar as entidades excepcionais com um caminho próprio, como fazem redes sociais ao processar contas muito grandes de forma diferente das demais.',
          },
          {
            type: 'h',
            text: 'Como migrar sem parar o sistema',
          },
          {
            type: 'p',
            text: 'Ninguém shardar um banco vazio: a migração acontece com o sistema em produção, e é a parte mais arriscada de todo o trabalho. O roteiro consolidado tem quatro fases. Primeiro, introduzir a camada de roteamento lendo e escrevendo apenas na origem, para validar que ela resolve corretamente a partição de cada chave. Depois, escrita dupla: toda gravação vai para os dois lados, enquanto um processo em segundo plano copia o histórico. Em seguida, uma fase de verificação que compara os dois conjuntos e mede a divergência. Só então a leitura migra, primeiro numa fração pequena do tráfego, e a origem antiga permanece disponível para reversão por um período.',
          },
          {
            type: 'p',
            text: 'O passo que costuma ser subestimado é a verificação. A escrita dupla parece garantir igualdade, mas falhas parciais existem: uma gravação que teve sucesso de um lado e falhou do outro deixa divergência silenciosa, e não há erro visível para denunciá-la. Um comparador que amostra continuamente os dois lados e reporta a taxa de divergência é o que transforma "acho que está igual" em um número. Sem ele, o corte de leitura é um salto no escuro.',
          },
          {
            type: 'p',
            text: 'Vale também decidir de antemão o número de partições lógicas, separando-o do número de máquinas. Criar mil partições lógicas distribuídas entre quatro servidores permite crescer para dez, vinte ou cem máquinas apenas movendo partições, sem nunca recalcular a função de hash nem redistribuir chaves individualmente. É bem mais barato mover blocos inteiros do que reembaralhar tudo — e evita o cenário em que cada expansão de capacidade vira um projeto.',
          },
          {
            type: 'h',
            text: 'O que fazer com as consultas que atravessam shards',
          },
          {
            type: 'p',
            text: 'Depois de particionar, consultas que não incluem a chave de partição precisam ser enviadas a todos os shards e ter os resultados combinados. Isso é aceitável quando é raro, e insustentável quando é o caminho principal — o custo cresce com o número de shards, a latência passa a ser a do mais lento, e uma consulta assim ocupa capacidade de todo o cluster ao mesmo tempo. Se uma consulta frequente não carrega a chave de partição, isso normalmente indica que a chave escolhida foi a errada.',
          },
          {
            type: 'p',
            text: 'A saída usual é manter uma tabela de mapeamento entre a chave alternativa e a de partição, ou uma projeção separada particionada pela outra dimensão — a mesma ideia de índice secundário global, com o custo de mantê-la sincronizada. Para agregações analíticas, o caminho correto quase nunca é o banco transacional: exportar para um armazenamento colunar resolve com folga o que no cluster particionado seria um fan-out caro e recorrente.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Shardar cedo demais. Sharding multiplica a complexidade de toda operação — migração de esquema, backup, consulta ad hoc, análise — e amarra a aplicação a uma chave escolhida quando menos se sabia sobre o produto. Antes dele existem caminhos bem menos custosos: índices adequados, réplicas de leitura, cache, arquivamento de dados frios, máquina maior, e mover tabelas volumosas para armazenamento especializado.',
          },
        ],
        quiz: [
          {
            q: 'Por que particionar por data é problemático em uma tabela de eventos?',
            a: 'Porque todas as escritas novas têm data recente e caem sempre na última partição, que vira um hotspot permanente enquanto as demais ficam ociosas — o cluster inteiro escala para escrita como se fosse uma máquina só. Consultas históricas por intervalo ficam eficientes, mas o gargalo de escrita normalmente é o que motivava o sharding.',
          },
          {
            q: 'Como uma chave composta (partição + ordenação) resolve o conflito entre hash e range?',
            a: 'A parte de partição é hasheada e distribui os grupos uniformemente pelo cluster; dentro de cada grupo, a parte de ordenação mantém os itens em sequência contígua. Assim se obtém distribuição uniforme entre grupos e consultas por intervalo eficientes dentro de um grupo — por exemplo, todas as mensagens de uma conversa ordenadas por data, em uma única partição.',
          },
          {
            q: 'Um inquilino representa 40% do tráfego e sua partição está saturada. Quais são as saídas?',
            a: 'Dividir a chave dele em subpartições com sufixo (lendo todas na consulta); dar a ele um shard dedicado via partição por diretório; adicionar réplicas de leitura só para essa partição; ou colocar cache na frente se o acesso for majoritariamente de leitura repetida. A escolha depende de a carga ser de leitura ou de escrita.',
          },
        ],
      },
    },
  ],
};

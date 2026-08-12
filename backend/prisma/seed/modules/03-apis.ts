import type { ModuleSeed } from '../types';

export const apis: ModuleSeed = {
  slug: 'apis',
  title: 'APIs',
  goal: 'Projetar interfaces entre sistemas que sobrevivem ao tempo: escolher o estilo certo, versionar sem quebrar clientes, e tratar retentativa e abuso como parte do contrato.',
  lessons: [
    {
      slug: 'rest-vs-graphql-vs-rpc',
      title: 'REST, GraphQL e RPC',
      summary:
        'Três formas de modelar a conversa entre cliente e servidor, com custos bem diferentes em cache, acoplamento e complexidade.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'REST modela recursos, RPC modela ações e GraphQL modela um grafo consultável. A escolha define quem controla o formato da resposta e onde a complexidade se acumula.',
        blocks: [
          {
            type: 'p',
            text: 'REST organiza a API em torno de substantivos — recursos identificados por URL — e usa os verbos HTTP para as operações: GET lê, POST cria, PUT substitui, PATCH altera parcialmente, DELETE remove. A grande vantagem é que ele reaproveita a infraestrutura da web: códigos de status já significam algo, cache HTTP funciona em GETs, proxies entendem o tráfego, e qualquer ferramenta sabe conversar com ele.',
          },
          {
            type: 'p',
            text: 'RPC faz o oposto: modela verbos. A API é uma lista de procedimentos — `criarPedido`, `cancelarAssinatura` —, e o transporte é detalhe. gRPC é a encarnação moderna: contrato definido em Protocol Buffers, serialização binária compacta, geração automática de clientes tipados, streaming bidirecional e HTTP/2 por baixo. É a escolha dominante para comunicação *entre serviços internos*, onde o desempenho importa e ambos os lados são controlados pelo mesmo time.',
          },
          {
            type: 'p',
            text: 'GraphQL ataca um problema específico de clientes: o servidor decide o formato da resposta e o cliente sofre com over-fetching (recebe campos que não usa) ou under-fetching (precisa fazer cinco chamadas para montar uma tela). Em GraphQL o cliente descreve exatamente a árvore de dados que quer, em uma única requisição. É poderoso quando há muitos clientes heterogêneos — web, iOS, Android, parceiros — evoluindo em ritmos diferentes.',
          },
          {
            type: 'key',
            text: 'A pergunta que separa os três: quem deve decidir o formato da resposta? Se o servidor, REST ou RPC. Se o cliente, GraphQL — e o preço é mover complexidade (cache, autorização por campo, custo de query) para dentro do servidor.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'REST', 'GraphQL', 'gRPC'],
            rows: [
              ['Modelo mental', 'Recursos', 'Grafo consultável', 'Procedimentos'],
              ['Cache HTTP', 'Nativo em GET', 'Difícil (tudo é POST)', 'Não se aplica'],
              ['Formato da resposta', 'Definido pelo servidor', 'Definido pelo cliente', 'Definido pelo contrato'],
              ['Payload', 'JSON, verboso', 'JSON, sob medida', 'Binário, compacto'],
              ['Suporte no navegador', 'Total', 'Total', 'Precisa de proxy (gRPC-Web)'],
              ['Melhor caso de uso', 'API pública, CRUD', 'Muitos clientes distintos', 'Serviço a serviço interno'],
            ],
          },
          {
            type: 'h',
            text: 'O que costuma dar errado em cada um',
          },
          {
            type: 'p',
            text: 'REST degrada quando o modelo de recursos não descreve bem a operação. "Publicar um artigo" não é criar nem substituir nada — vira um `POST /artigos/:id/publicacao` meio artificial ou um PATCH com campo de status que esconde uma máquina de estados inteira. Não é fatal, mas é sinal de que a operação era um verbo, e forçá-la a virar substantivo torna o contrato confuso.',
          },
          {
            type: 'p',
            text: 'GraphQL degrada com o problema N+1: uma query que pede 100 pedidos e o nome do cliente de cada um pode virar 101 consultas ao banco se cada resolver buscar sozinho. A solução padrão é o dataloader, que agrupa as buscas de um mesmo ciclo em uma consulta só. Há ainda a superfície de ataque: uma query profundamente aninhada pode ser cara o suficiente para derrubar o servidor, o que obriga a limitar profundidade e a atribuir custo estimado às queries.',
          },
          {
            type: 'p',
            text: 'gRPC degrada na fronteira externa: o navegador não fala gRPC nativamente, depurar payload binário exige ferramenta, e a geração de código acopla os dois lados a um mesmo ciclo de build. Internamente esses custos valem a pena; como API pública, raramente.',
          },
          {
            type: 'h',
            text: 'Como cada um evolui com o tempo',
          },
          {
            type: 'p',
            text: 'A diferença mais duradoura entre os três não aparece no primeiro dia, e sim no terceiro ano: como cada estilo lida com mudança de contrato. Em REST, a unidade de versionamento é o endpoint inteiro, e um campo removido quebra todo mundo de uma vez — daí a prática de manter duas gerações no ar. Em gRPC, o Protocol Buffers foi projetado para evoluir: cada campo tem um número, o leitor ignora campos desconhecidos e adicionar campo opcional é compatível nos dois sentidos. O que nunca se pode fazer é reciclar um número de campo para outro significado.',
          },
          {
            type: 'p',
            text: 'GraphQL tem o modelo de evolução mais interessante, porque o servidor sabe quais campos cada cliente realmente pede. Dá para depreciar campo a campo com `@deprecated`, medir no tráfego real quem ainda consome e remover quando o uso zerar — algo que REST só alcança com instrumentação extra. A contrapartida é que o esquema vira uma superfície pública enorme, e é comum descobrir que um campo aparentemente esquecido sustenta uma tela crítica de um cliente móvel de duas versões atrás.',
          },
          {
            type: 'p',
            text: 'Há ainda a questão de onde a autorização acontece. Em REST e RPC ela é natural no nível da operação: quem pode chamar este endpoint. Em GraphQL, uma única requisição atravessa dezenas de tipos vindos de fontes diferentes, e a autorização precisa descer ao nível do campo — o usuário vê o pedido, mas não o CPF do comprador, e vê o e-mail apenas se for o dono. Fazer isso de forma consistente em cada resolver é trabalhoso e fácil de furar, o que ajuda a explicar por que GraphQL é mais comum como camada interna de agregação do que como API exposta a terceiros.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Adotar GraphQL para resolver um problema que não se tem. Com um único cliente e telas estáveis, ele acrescenta camada de resolução, complica cache e autorização e não devolve benefício algum. GraphQL paga quando existem múltiplos consumidores com necessidades divergentes evoluindo mais rápido que o backend — não porque o REST "é antigo".',
          },
        ],
        quiz: [
          {
            q: 'Por que cache HTTP funciona naturalmente em REST e é difícil em GraphQL?',
            a: 'Porque em REST a URL identifica o recurso e o GET é seguro e idempotente, então proxies e CDNs podem cachear pela URL sem entender a semântica. Em GraphQL todas as queries costumam ir por POST no mesmo endpoint, com o que se pede no corpo: a URL não identifica nada, e o cache precisa ser implementado na aplicação, por entidade.',
          },
          {
            q: 'O que é o problema N+1 em GraphQL e como se resolve?',
            a: 'Ocorre quando um resolver de campo é executado uma vez por item de uma lista, disparando uma consulta por item (1 consulta para a lista + N para os filhos). A solução é o padrão dataloader: acumular as chaves solicitadas dentro de um mesmo tick e resolvê-las com uma única consulta em lote.',
          },
          {
            q: 'Por que gRPC é comum entre serviços internos e raro como API pública?',
            a: 'Internamente ele oferece serialização binária eficiente, contrato tipado com geração de clientes e streaming sobre HTTP/2, e ambos os lados são controlados pelo mesmo time. Publicamente esbarra na falta de suporte nativo em navegadores, na dificuldade de inspecionar payload binário e no acoplamento entre a evolução do contrato e os builds de terceiros.',
          },
        ],
      },
    },
    {
      slug: 'design-de-apis',
      title: 'Design de APIs que envelhecem bem',
      summary:
        'Nomes, status codes, paginação, erros e versionamento — as decisões que você não consegue desfazer depois que há clientes.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Uma API é um contrato público: cada detalhe exposto vira compromisso. Bom design é escolher o que prometer e projetar espaço para mudar o resto.',
        blocks: [
          {
            type: 'p',
            text: 'A primeira regra é a que mais se ignora: uma vez que existe um cliente que você não controla, tudo que a API expõe passa a ser imutável na prática. O nome do campo, o formato da data, a ordem padrão da listagem, o código de status devolvido em um caso de borda — se alguém depender, mudar quebra. Design de API é, em boa parte, decidir o que *não* prometer.',
          },
          {
            type: 'h',
            text: 'Status codes que significam algo',
          },
          {
            type: 'table',
            head: ['Código', 'Significado', 'Quando usar'],
            rows: [
              ['200 / 201', 'Sucesso / recurso criado', 'Operação concluída; 201 com Location do novo recurso'],
              ['202', 'Aceito, processamento assíncrono', 'Enfileirou o trabalho; devolva um id para consultar depois'],
              ['400', 'Requisição malformada', 'Erro de validação, campo ausente ou inválido'],
              ['401 / 403', 'Não autenticado / não autorizado', '401 = não sei quem você é; 403 = sei, e você não pode'],
              ['404', 'Não existe', 'Recurso ausente — ou existente e invisível para este usuário'],
              ['409', 'Conflito de estado', 'Edição concorrente, duplicidade, transição inválida'],
              ['422', 'Semanticamente inválido', 'Sintaxe correta, regra de negócio violada'],
              ['429', 'Excedeu o limite', 'Rate limit; sempre acompanhado de Retry-After'],
              ['5xx', 'Falha do servidor', 'Erro nosso — o cliente pode tentar de novo'],
            ],
          },
          {
            type: 'p',
            text: 'A distinção 4xx/5xx não é cosmética: ela informa ao cliente se vale a pena repetir a requisição. Um 4xx significa "não adianta tentar de novo com essa entrada"; um 5xx significa "o problema é meu, tente novamente com backoff". Devolver 500 para erro de validação faz clientes bem-comportados retentarem eternamente algo que nunca vai funcionar.',
          },
          {
            type: 'key',
            text: 'Erros são parte da API, não um detalhe. Devolva um corpo estruturado e estável — código legível por máquina, mensagem legível por humano e, quando aplicável, o campo problemático —, e não apenas uma string livre que vai mudar no próximo refactor.',
          },
          {
            type: 'code',
            lang: 'json',
            code: `{
  "error": {
    "code": "saldo_insuficiente",
    "message": "Saldo insuficiente para concluir a transferência.",
    "details": [{ "field": "valor", "max": 1520.30 }],
    "requestId": "req_8f2c1a"
  }
}`,
          },
          {
            type: 'p',
            text: 'O `requestId` na resposta de erro é um detalhe pequeno de enorme valor operacional: permite que o usuário reporte um problema e o time encontre exatamente aquela requisição nos logs, sem caçar por horário aproximado.',
          },
          {
            type: 'h',
            text: 'Paginação',
          },
          {
            type: 'p',
            text: 'Paginação por offset (`?page=3&limit=20`) é simples e permite pular para qualquer página, mas tem dois defeitos sérios em escala. O primeiro é de desempenho: `OFFSET 100000` obriga o banco a percorrer e descartar cem mil linhas. O segundo é de correção: se um item for inserido enquanto o usuário navega, tudo desloca e ele vê o mesmo registro duas vezes — ou pula um.',
          },
          {
            type: 'p',
            text: 'Paginação por cursor resolve os dois. Em vez de "pule N", o cliente diz "continue depois deste ponto", mandando de volta um cursor opaco que codifica a posição na ordenação (por exemplo, `createdAt` + `id` para desempate). A consulta vira `WHERE (createdAt, id) < (?, ?) ORDER BY ... LIMIT 20`, que usa índice e custa o mesmo na página 1 e na página 5.000. O preço é não poder saltar para uma página arbitrária — o que quase nenhum cliente realmente precisa.',
          },
          {
            type: 'p',
            text: 'Dois detalhes decidem se o cursor funciona de fato. O primeiro é o desempate: se a ordenação for apenas por `createdAt` e dois registros compartilharem o mesmo instante, a comparação não define uma ordem total e itens na fronteira entre páginas são pulados ou repetidos. Por isso o cursor precisa carregar sempre uma coluna única no fim — o id —, e a comparação precisa ser de tupla, não uma cadeia de ORs mal escrita. O segundo é o índice: a consulta só é barata se existir um índice composto exatamente em `(createdAt, id)`, na mesma direção da ordenação. Sem ele, o cursor apenas troca um problema de offset por uma varredura com filtro.',
          },
          {
            type: 'code',
            lang: 'sql',
            code: `-- Cursor decodificado em (createdAt, id). Índice: (created_at DESC, id DESC)
SELECT id, titulo, created_at
FROM pedidos
WHERE usuario_id = $1
  AND (created_at, id) < ($2, $3)   -- comparação de tupla: ordem total
ORDER BY created_at DESC, id DESC
LIMIT 21;                            -- pede 1 a mais para saber se há próxima página`,
          },
          {
            type: 'p',
            text: 'O `LIMIT 21` para uma página de 20 é um truque que vale conhecer: pedir um item além do tamanho da página revela se existe página seguinte sem custar um `COUNT(*)` sobre o conjunto inteiro. O item extra é descartado e vira apenas o booleano `hasNextPage`. Aliás, devolver o total de registros é caro e quase sempre desnecessário — contar exige varrer tudo, e o número fica obsoleto antes de chegar à tela. Se o produto precisa mesmo de um total, uma estimativa vinda das estatísticas do planejador costuma bastar.',
          },
          {
            type: 'p',
            text: 'Manter o cursor opaco — codificado em base64, documentado como "trate isto como string" — não é firula: é o que preserva a liberdade de mudar a ordenação, acrescentar um campo de desempate ou trocar a estratégia interna sem quebrar clientes. Assim que um cursor legível vaza a estrutura, alguém vai construí-lo à mão, e ele vira contrato público como qualquer outro campo.',
          },
          {
            type: 'h',
            text: 'Versionamento',
          },
          {
            type: 'p',
            text: 'Mudanças aditivas — um campo novo na resposta, um parâmetro opcional novo — são compatíveis, desde que os clientes ignorem campos desconhecidos (vale documentar essa expectativa). Mudanças que removem campo, renomeiam, alteram tipo, restringem valores aceitos ou mudam o padrão de um parâmetro são quebras e exigem versão nova.',
          },
          {
            type: 'p',
            text: 'Versionar na URL (`/v1/pedidos`) é o esquema mais comum: visível, fácil de rotear, fácil de testar. Versionar por header é mais elegante conceitualmente e bem mais difícil de depurar. Independentemente do esquema, o que realmente importa é ter uma política de depreciação: anunciar com antecedência, medir quem ainda usa a versão antiga, avisar esses clientes diretamente e só então desligar.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Devolver 200 com um erro no corpo. Isso quebra tudo que depende de semântica HTTP: clientes que checam status passam batido, proxies cacheiam a falha, monitoramento reporta 100% de sucesso durante um incidente e alertas nunca disparam. Se falhou, o status precisa dizer que falhou.',
          },
        ],
        quiz: [
          {
            q: 'Por que paginação por offset é problemática numa lista que recebe inserções constantes?',
            a: 'Porque o offset é posicional. Se um item novo entra no topo enquanto o usuário vai da página 1 para a 2, tudo desloca uma posição: o último item da página 1 reaparece na 2. Além disso, offsets grandes obrigam o banco a varrer e descartar todas as linhas anteriores, degradando com a profundidade.',
          },
          {
            q: 'Qual a diferença prática entre devolver 401 e 403?',
            a: '401 significa que a identidade não foi estabelecida — falta credencial ou ela expirou —, e o cliente deve autenticar e tentar de novo. 403 significa que a identidade é conhecida mas não tem permissão, e repetir com a mesma credencial nunca vai funcionar. A confusão entre os dois leva clientes a ciclos infinitos de renovação de token.',
          },
          {
            q: 'Quais mudanças em uma API são compatíveis e quais exigem nova versão?',
            a: 'Compatíveis: adicionar campo na resposta, adicionar parâmetro opcional, adicionar novo endpoint, aceitar valores novos onde antes se recusava. Quebram: remover ou renomear campo, mudar tipo, tornar obrigatório um parâmetro antes opcional, mudar o valor padrão de um parâmetro, restringir entradas antes aceitas e alterar o significado de um código de status.',
          },
        ],
      },
    },
    {
      slug: 'idempotencia',
      title: 'Idempotência',
      summary:
        'Como fazer com que repetir uma requisição não cause dano — a propriedade que torna retentativa segura.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Uma operação é idempotente quando executá-la várias vezes produz o mesmo efeito de executá-la uma vez. Sem isso, nenhuma retentativa é segura — e em rede, retentativa é inevitável.',
        blocks: [
          {
            type: 'p',
            text: 'O problema nasce de uma incerteza fundamental: quando um cliente envia uma requisição e não recebe resposta, ele não sabe o que aconteceu. A requisição pode ter se perdido antes de chegar; pode ter sido processada e a resposta ter se perdido na volta; pode estar sendo processada agora. Do lado do cliente, os três casos são indistinguíveis — e as ações corretas são opostas.',
          },
          {
            type: 'key',
            text: 'Em rede, a resposta é uma informação que pode se perder. Por isso todo sistema sério assume que qualquer requisição pode chegar mais de uma vez, e projeta as operações para que isso não cause dano.',
          },
          {
            type: 'p',
            text: 'Alguns verbos HTTP já são idempotentes por definição. GET não altera nada. PUT substitui o recurso por um estado dado — mandar duas vezes deixa o mesmo resultado. DELETE remove; a segunda chamada encontra o recurso já ausente e pode responder 204 ou 404, sem apagar nada além. POST é o problemático: "crie um pedido" repetido cria dois pedidos.',
          },
          {
            type: 'h',
            text: 'Chave de idempotência',
          },
          {
            type: 'p',
            text: 'A solução padrão é o cliente gerar um identificador único para a *intenção* — não para a tentativa — e enviá-lo em um header, normalmente `Idempotency-Key`. O servidor guarda essa chave junto ao resultado. Se a mesma chave chegar de novo, ele não executa nada: devolve a resposta que já havia produzido.',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `// A chave é gerada uma vez, na intenção, e reusada em todas as retentativas.
const chave = crypto.randomUUID()

async function cobrar() {
  return http.post('/pagamentos', corpo, {
    headers: { 'Idempotency-Key': chave },  // mesma chave em toda retentativa
  })
}`,
          },
          {
            type: 'p',
            text: 'Três detalhes decidem se essa implementação funciona de verdade. Primeiro, a chave precisa ser gravada na *mesma transação* que o efeito — se você grava o pagamento e depois grava a chave, uma falha entre os dois passos permite cobrança dupla. Segundo, é preciso lidar com a requisição concorrente: se a mesma chave chega duas vezes ao mesmo tempo, a segunda deve esperar ou receber 409, e não executar em paralelo; um índice único na chave faz o banco resolver essa corrida. Terceiro, a chave precisa expirar — guardá-las para sempre é um vazamento de armazenamento —, e a janela deve ser maior que o horizonte de retentativa do cliente, tipicamente 24 horas.',
          },
          {
            type: 'p',
            text: 'Vale ainda guardar o hash do corpo junto da chave. Se chegar a mesma chave com um corpo diferente, isso é um bug do cliente (reuso indevido) e deve virar erro explícito, não uma resposta antiga devolvida silenciosamente para uma requisição que pedia outra coisa.',
          },
          {
            type: 'table',
            head: ['Operação', 'Idempotente?', 'Como tornar segura'],
            rows: [
              ['GET /pedidos/1', 'Sim', 'Nada a fazer'],
              ['PUT /pedidos/1 {status:"pago"}', 'Sim', 'Nada a fazer'],
              ['POST /pedidos', 'Não', 'Idempotency-Key ou id gerado pelo cliente'],
              ['POST /saldo/incrementar {valor:10}', 'Não', 'Chave de idempotência — incremento relativo nunca é idempotente'],
              ['DELETE /pedidos/1', 'Sim', 'Responder sucesso mesmo se já não existir'],
            ],
          },
          {
            type: 'p',
            text: 'Repare no caso do incremento: operações relativas ("some 10") são inerentemente não idempotentes, enquanto as absolutas ("o valor agora é 150") são naturalmente idempotentes. Quando dá para modelar a operação como estado final em vez de delta, metade do problema desaparece de graça.',
          },
          {
            type: 'h',
            text: 'O registro por trás da chave',
          },
          {
            type: 'p',
            text: 'Vale pensar na chave não como um booleano ("já vi essa?"), mas como um registro com estado próprio: a chave, o estado do processamento (`em_andamento`, `concluído`, `falhou`), o hash do corpo e a resposta serializada. Só guardando a resposta se cumpre a promessa central da idempotência: a retentativa não deve apenas evitar o efeito duplicado, deve devolver o que a primeira devolveu, com o mesmo id.',
          },
          {
            type: 'p',
            text: 'A janela de retenção merece cálculo: precisa cobrir o horizonte máximo de retentativa de qualquer cliente. Se o SDK tenta por 15 minutos, mas um cliente de integração reprocessa uma fila parada uma vez por dia, a janela real de risco é de 24 horas — daí o padrão. Reter menos transforma retentativa tardia em cobrança duplicada.',
          },
          {
            type: 'p',
            text: 'A corrida entre requisições concorrentes é o detalhe que mais se erra. Duas retentativas chegam ao mesmo tempo em instâncias diferentes, ambas consultam a tabela de chaves, nenhuma encontra nada, ambas executam. Checar antes de escrever não resolve: verificação e inserção precisam ser uma só operação. O caminho robusto é começar pelo `INSERT` da chave com estado `em_andamento`, protegido por índice único — quem insere executa, e quem recebe violação de unicidade responde 409 ou aguarda e relê.',
          },
          {
            type: 'p',
            text: 'Isso cria um estado órfão que quase toda implementação esquece: a chave existe, o processo que a tomou morreu no meio, e as retentativas ficam presas esperando um trabalho que ninguém faz. A defesa é gravar o instante da tomada e permitir que, passado um limite bem maior que o pior tempo de execução observado, outra tentativa reivindique a chave. Isso reintroduz uma chance mínima de execução dupla — e por isso a idempotência de aplicação não substitui as proteções do domínio: uma constraint de unicidade sobre o identificador natural da operação é a última defesa.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Gerar a chave de idempotência a cada tentativa em vez de a cada intenção. Se o cliente cria um UUID novo dentro do loop de retry, cada retentativa tem chave distinta e o servidor executa todas — exatamente o problema que a chave existia para evitar. A chave pertence à ação que o usuário quis fazer, e sobrevive a todas as tentativas de realizá-la.',
          },
        ],
        quiz: [
          {
            q: 'Por que um cliente que recebe timeout não pode simplesmente assumir que a operação falhou?',
            a: 'Porque o timeout ocorre no cliente e não diz nada sobre o servidor. A requisição pode não ter chegado, pode ter sido executada com sucesso e a resposta se perdido, ou pode ainda estar em processamento. Assumir falha e reenviar sem proteção duplica o efeito nos dois últimos casos.',
          },
          {
            q: 'Por que gravar a chave de idempotência e o efeito da operação precisa ser atômico?',
            a: 'Porque se o efeito é gravado e a chave não (ou vice-versa), uma falha entre os dois passos quebra a garantia: uma retentativa não encontra a chave registrada e executa a operação de novo, duplicando o efeito. Os dois precisam entrar na mesma transação, ou a idempotência é só aparente.',
          },
          {
            q: 'Por que PUT é idempotente e POST normalmente não é?',
            a: 'PUT descreve o estado final desejado do recurso identificado pela URL: aplicá-lo repetidamente converge sempre para o mesmo estado. POST descreve uma ação de criação sem identificador prévio, então cada execução gera uma entidade nova. Operações relativas (incrementar, acrescentar) sofrem do mesmo problema pelo mesmo motivo.',
          },
        ],
      },
    },
    {
      slug: 'rate-limiting',
      title: 'Rate limiting',
      summary:
        'Os quatro algoritmos, onde aplicar o limite e por que ele é uma feature de proteção, não de punição.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Limitar a taxa de requisições protege o serviço de abuso, de clientes com bug e de picos que derrubariam todo mundo. Os algoritmos diferem em como tratam rajadas.',
        blocks: [
          {
            type: 'p',
            text: 'Rate limiting existe por três motivos distintos, que às vezes se confundem: proteger a capacidade do sistema (um cliente não pode consumir tudo), garantir isonomia entre clientes (nenhum inquilino prejudica os outros) e controlar custo (chamadas a serviços pagos). Cada motivo sugere um lugar e uma granularidade diferentes para o limite.',
          },
          {
            type: 'h',
            text: 'Os quatro algoritmos',
          },
          {
            type: 'p',
            text: 'Janela fixa (fixed window) é o mais simples: um contador por chave que zera a cada intervalo. Fácil de implementar com um INCR e um TTL, mas tem o problema da borda — um cliente pode fazer o limite inteiro nos últimos segundos de uma janela e o limite inteiro nos primeiros da seguinte, efetivamente dobrando a taxa permitida em um curto intervalo.',
          },
          {
            type: 'p',
            text: 'Janela deslizante com log (sliding window log) guarda o timestamp de cada requisição e conta quantas caem nos últimos N segundos. É exato e imune ao problema da borda, mas armazena um registro por requisição — caro em memória sob tráfego alto. A versão prática é a janela deslizante por contador, que interpola entre a janela atual e a anterior: aproximação boa o bastante com custo constante.',
          },
          {
            type: 'p',
            text: 'Token bucket é o mais usado na prática. Um balde de capacidade C recebe tokens a uma taxa R; cada requisição consome um token e é rejeitada se o balde está vazio. A propriedade valiosa é permitir rajadas: um cliente que ficou quieto acumula tokens e pode gastar de uma vez — exatamente o padrão de tráfego humano real, que vem em rajadas e não em fluxo constante.',
          },
          {
            type: 'p',
            text: 'Leaky bucket faz o inverso: as requisições entram numa fila que é drenada a taxa constante. Ele *suaviza* o tráfego em vez de permitir rajada, o que é ideal quando o consumidor a jusante não tolera picos — por exemplo, ao repassar chamadas a uma API de terceiro com limite rígido.',
          },
          {
            type: 'table',
            head: ['Algoritmo', 'Permite rajada?', 'Custo de memória', 'Precisão'],
            rows: [
              ['Janela fixa', 'Sim, na borda (indesejada)', 'Um contador por chave', 'Baixa'],
              ['Janela deslizante (log)', 'Não', 'Um registro por requisição', 'Exata'],
              ['Janela deslizante (contador)', 'Levemente', 'Dois contadores por chave', 'Boa'],
              ['Token bucket', 'Sim, controlada', 'Dois números por chave', 'Boa'],
              ['Leaky bucket', 'Não — suaviza', 'Fila por chave', 'Boa'],
            ],
          },
          {
            type: 'key',
            text: 'Token bucket é o padrão para APIs voltadas a clientes, porque tolera a rajada natural do uso real. Leaky bucket é o padrão quando você precisa proteger algo a jusante que exige ritmo constante.',
          },
          {
            type: 'h',
            text: 'Onde limitar e por qual chave',
          },
          {
            type: 'p',
            text: 'A chave define quem é limitado. Por IP é a única opção para tráfego anônimo, mas agrupa injustamente usuários atrás de NAT corporativo e é fácil de contornar com IPs rotativos. Por chave de API ou usuário autenticado é bem mais justo e é o padrão para APIs com credencial. Por endpoint permite proteger separadamente as rotas caras — buscar um relatório pode ter limite muito menor que ler um perfil. Na prática combinam-se várias camadas.',
          },
          {
            type: 'p',
            text: 'Num sistema distribuído, o contador precisa ser compartilhado, e aí surge o custo: consultar um Redis a cada requisição adiciona latência e cria uma dependência no caminho crítico. A alternativa comum é o limite aproximado local — cada instância recebe uma fração da cota e aplica localmente, com sincronização periódica. Perde-se exatidão e ganha-se latência e resiliência; para proteção de capacidade, a aproximação é quase sempre suficiente.',
          },
          {
            type: 'p',
            text: 'O contrato com o cliente também importa. Um bom rate limiter responde 429 e diz explicitamente quando tentar de novo (`Retry-After`), além de expor a cota em cabeçalhos de resposta (limite, restante, momento do reset). Isso permite que clientes bem-comportados se autorregulem antes de bater no muro — o que é melhor para os dois lados do que descobrir o limite por tentativa e erro.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Rate limiter que falha fechado. Se ele depende de um Redis e esse Redis fica indisponível, rejeitar todo o tráfego transforma um problema de infraestrutura auxiliar em queda total do produto. Para proteção contra abuso, o comportamento correto em caso de falha do limitador é geralmente permitir a passagem (fail open), com alarme — a menos que o limite exista para controlar custo com terceiros, caso em que fechar pode ser o certo.',
          },
        ],
        quiz: [
          {
            q: 'Descreva o problema da borda na janela fixa e por que ele importa.',
            a: 'Com limite de 100 por minuto, um cliente pode enviar 100 requisições nos últimos segundos de uma janela e 100 nos primeiros segundos da próxima: 200 em um intervalo curto, o dobro da taxa que o limite pretendia impor. Importa porque o pico é o que derruba o sistema, e é exatamente o pico que esse algoritmo deixa passar.',
          },
          {
            q: 'Por que token bucket é preferido a leaky bucket em APIs públicas?',
            a: 'Porque o uso real é irregular: um usuário fica inativo e de repente dispara várias chamadas ao abrir uma tela. O token bucket acumula tokens durante a inatividade e permite essa rajada sem prejudicar a média, enquanto o leaky bucket forçaria um ritmo constante e enfileiraria requisições que poderiam ser atendidas de imediato.',
          },
          {
            q: 'Quando faz sentido um rate limiter falhar aberto e quando faz sentido falhar fechado?',
            a: 'Falhar aberto quando o limite existe para proteger capacidade e conter abuso: derrubar todo o tráfego por causa da indisponibilidade do contador é pior que aceitar risco temporário de sobrecarga. Falhar fechado quando o limite controla algo com consequência externa irreversível, como custo por chamada em um serviço pago ou uma cota contratual com terceiro.',
          },
        ],
      },
    },
    {
      slug: 'websockets-e-webhooks',
      title: 'WebSockets, SSE e webhooks',
      summary:
        'Três maneiras de inverter o fluxo: quando o servidor precisa falar primeiro.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'HTTP é cliente-pergunta/servidor-responde. Quando o servidor precisa iniciar a comunicação, as opções são manter uma conexão aberta (WebSocket, SSE) ou chamar de volta um endereço do cliente (webhook).',
        blocks: [
          {
            type: 'p',
            text: 'O modelo de requisição-resposta funciona mal quando a informação nasce no servidor: uma mensagem nova no chat, o status de um pagamento, a posição de um entregador. A saída ingênua é polling — o cliente pergunta a cada N segundos. Funciona, é trivial, e desperdiça: com 10 mil clientes perguntando a cada 5 segundos, são 2 mil requisições por segundo cuja resposta é "nada mudou".',
          },
          {
            type: 'p',
            text: 'Long polling melhora isso: o cliente faz uma requisição e o servidor *segura* a resposta até haver novidade (ou até um timeout). Reduz drasticamente as requisições vazias, funciona em qualquer infraestrutura HTTP e não exige protocolo novo. O custo é manter uma conexão e uma thread/handler abertos por cliente, e uma nova conexão a cada mensagem entregue.',
          },
          {
            type: 'p',
            text: 'Server-Sent Events (SSE) é o meio-termo esquecido e frequentemente a melhor escolha: uma conexão HTTP que fica aberta e por onde o servidor envia eventos em texto, unidirecionalmente. Tem reconexão automática no navegador, funciona sobre HTTP comum (portanto passa por proxies sem configuração especial) e é simples de implementar. Se o cliente só precisa *receber* — notificações, atualizações de progresso, feed ao vivo —, SSE resolve com uma fração da complexidade de um WebSocket.',
          },
          {
            type: 'p',
            text: 'WebSocket é o canal full-duplex: uma conexão TCP persistente, iniciada por um upgrade de HTTP, por onde os dois lados enviam mensagens a qualquer momento com overhead mínimo por quadro. É a escolha certa quando há tráfego frequente nas duas direções — chat, jogos, edição colaborativa, tickers financeiros.',
          },
          {
            type: 'table',
            head: ['Técnica', 'Direção', 'Custo por cliente', 'Melhor caso'],
            rows: [
              ['Polling', 'Cliente → servidor', 'Baixo, mas requisições desperdiçadas', 'Atualização rara e latência tolerante'],
              ['Long polling', 'Servidor empurra (1 msg por conexão)', 'Uma conexão aberta', 'Infra que não suporta WebSocket'],
              ['SSE', 'Servidor → cliente', 'Uma conexão aberta', 'Notificações, progresso, feed'],
              ['WebSocket', 'Bidirecional', 'Uma conexão aberta com estado', 'Chat, jogos, colaboração'],
              ['Webhook', 'Servidor → servidor', 'Nenhuma conexão persistente', 'Integração entre backends'],
            ],
          },
          {
            type: 'key',
            text: 'Conexões persistentes transformam um serviço stateless em stateful: cada cliente está preso a uma instância específica. Isso muda deploy (derrubar uma instância desconecta seus clientes), balanceamento (não se pode redistribuir livremente) e escala (o limite passa a ser número de conexões, não requisições por segundo).',
          },
          {
            type: 'p',
            text: 'Essa consequência merece atenção. Para enviar uma mensagem a um usuário conectado a outra instância, é preciso uma camada de roteamento entre servidores — normalmente um pub/sub interno em que cada instância assina os canais dos clientes que atende. Some-se a isso a necessidade de heartbeat (para detectar conexões mortas que a rede não avisou que caíram), reconexão com backoff no cliente e recuperação do que se perdeu durante a desconexão.',
          },
          {
            type: 'h',
            text: 'Webhooks',
          },
          {
            type: 'p',
            text: 'Webhook inverte a integração entre backends: em vez de o cliente perguntar periodicamente, ele registra uma URL e o provedor faz um POST quando o evento acontece. É como serviços de pagamento avisam sobre uma cobrança confirmada. A elegância é não haver conexão persistente nenhuma — o custo se paga apenas quando há evento.',
          },
          {
            type: 'p',
            text: 'Quem *recebe* webhooks precisa tratar três realidades. A entrega é at-least-once: o mesmo evento chega mais de uma vez quando a confirmação se perde, então o handler precisa ser idempotente (use o id do evento). A ordem não é garantida: eventos podem chegar fora de sequência, então convém carregar um número de versão ou timestamp e descartar o que é mais velho que o estado atual. E a autenticidade precisa ser verificada: o endpoint é público, então o provedor assina o payload com HMAC e você deve validar a assinatura antes de processar qualquer coisa.',
          },
          {
            type: 'p',
            text: 'Quem *envia* webhooks tem o problema espelhado: o endpoint do cliente vai estar fora do ar às vezes. Isso exige retentativa com backoff exponencial, uma janela de tentativas com desistência, uma fila morta para o que falhou de vez, e um mecanismo para o cliente reprocessar eventos perdidos. Enviar webhook de forma síncrona dentro da transação de negócio é um erro comum: a lentidão do cliente vira lentidão sua.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Processar o webhook de forma síncrona no handler HTTP. Se você valida, grava, chama outros serviços e só então responde 200, qualquer lentidão sua faz o provedor considerar a entrega falha e reenviar — gerando processamento duplicado e mais carga. O padrão correto: validar a assinatura, enfileirar, responder 200 imediatamente e processar em background.',
          },
        ],
        quiz: [
          {
            q: 'Quando SSE é preferível a WebSocket?',
            a: 'Quando a comunicação é só do servidor para o cliente — notificações, progresso, feed ao vivo. SSE roda sobre HTTP comum, atravessa proxies sem configuração especial, tem reconexão automática no navegador e é muito mais simples de operar. WebSocket só se justifica quando há tráfego frequente também no sentido cliente → servidor.',
          },
          {
            q: 'Por que conexões persistentes complicam o deploy?',
            a: 'Porque cada conexão prende um cliente a uma instância específica. Derrubar uma instância desconecta todos os seus clientes de uma vez, gerando uma onda de reconexões simultâneas que pode sobrecarregar as instâncias restantes. Isso exige drenagem gradual, reconexão com backoff e jitter no cliente, e uma camada de pub/sub para rotear mensagens entre instâncias.',
          },
          {
            q: 'Quais três garantias um receptor de webhooks não pode assumir?',
            a: 'Não pode assumir entrega única (o mesmo evento chega repetido, então o processamento precisa ser idempotente pelo id do evento), não pode assumir ordem (eventos chegam fora de sequência, exigindo versão ou timestamp para descartar os obsoletos) e não pode assumir autenticidade (o endpoint é público, então a assinatura HMAC precisa ser validada antes de qualquer processamento).',
          },
        ],
      },
    },
  ],
};

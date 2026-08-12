import type { ModuleSeed } from '../types';

export const arquitetura: ModuleSeed = {
  slug: 'padroes-de-arquitetura',
  title: 'Padrões de arquitetura',
  goal: 'Reconhecer os grandes formatos de organização de sistemas, com seus custos reais, e escolher com base no time e no problema — não na moda.',
  lessons: [
    {
      slug: 'cliente-servidor-e-camadas',
      title: 'Cliente-servidor e arquitetura em camadas',
      summary:
        'O formato mais antigo e ainda o mais adequado para a maioria dos produtos.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'A separação em camadas organiza o sistema por responsabilidade, com dependências apontando sempre em uma direção. É o padrão base sobre o qual todos os outros são variações.',
        blocks: [
          {
            type: 'p',
            text: 'A arquitetura em camadas divide o sistema por tipo de responsabilidade: apresentação (recebe requisições e formata respostas), aplicação (orquestra casos de uso), domínio (regras de negócio) e infraestrutura (banco, filas, serviços externos). A regra que dá valor ao arranjo é a direção das dependências: as camadas de cima conhecem as de baixo, nunca o contrário.',
          },
          {
            type: 'key',
            text: 'O benefício não é a separação em si — é a direção única das dependências. Quando o domínio não conhece o banco nem o framework web, ele pode ser testado, entendido e alterado sem que nada disso esteja presente.',
          },
          {
            type: 'p',
            text: 'A inversão de dependência é o que torna isso possível na prática. O domínio declara a interface de que precisa (`RepositorioDePedidos`), e a infraestrutura fornece a implementação concreta. A seta de dependência em tempo de compilação aponta para dentro, mesmo que em tempo de execução o fluxo vá para fora. É a ideia por trás dos nomes arquitetura hexagonal, ports and adapters e clean architecture — variações do mesmo princípio.',
          },
          {
            type: 'h',
            text: 'Onde as camadas degeneram',
          },
          {
            type: 'p',
            text: 'O modo de falha mais comum é a camada anêmica: controllers que chamam services que chamam repositories, sem que nenhum deles contenha lógica de verdade — as regras acabam espalhadas entre validações no controller e condicionais no service. O resultado é a cerimônia da separação sem o benefício, com três arquivos para adicionar um campo.',
          },
          {
            type: 'p',
            text: 'O segundo modo é o vazamento. Se a entidade de domínio carrega anotações do ORM, se o objeto que sai do banco é o mesmo que vai para o JSON da resposta, então as camadas existem no diagrama e não no código: uma mudança de esquema atravessa tudo. Não é necessariamente errado — para um CRUD simples, esse acoplamento é um atalho legítimo —, mas convém saber que a separação foi abandonada, em vez de acreditar que ela protege algo.',
          },
          {
            type: 'h',
            text: 'Camadas técnicas ou módulos de domínio',
          },
          {
            type: 'p',
            text: 'Há uma decisão anterior à das camadas que determina mais o destino do código: qual é o critério de agrupamento no primeiro nível de diretórios. O arranjo por camada técnica coloca todos os controllers juntos, todos os services juntos, todos os repositories juntos. O arranjo por domínio coloca `pedidos/` ao lado de `pagamentos/` e `catalogo/`, cada um com suas próprias camadas internas. O primeiro parece mais organizado num diagrama; o segundo envelhece muito melhor.',
          },
          {
            type: 'p',
            text: 'A razão é que mudanças reais quase nunca respeitam a divisão técnica. Adicionar um campo a um pedido toca o controller, o service, o repositório e o modelo — quatro diretórios distantes no arranjo por camada, um único diretório no arranjo por domínio. Como a proximidade no sistema de arquivos é o que a maioria das pessoas usa para descobrir o que existe, agrupar por domínio faz com que tudo relacionado a uma mudança apareça junto. E é esse arranjo que torna a extração futura de um serviço um trabalho mecânico, em vez de uma arqueologia por quatro pastas.',
          },
          {
            type: 'h',
            text: 'Onde as fronteiras realmente pegam',
          },
          {
            type: 'p',
            text: 'Uma fronteira que existe apenas na convenção do time dura até a primeira semana de pressa. O que a torna real é ela ser verificável por uma máquina: um teste que falha quando `catalogo` importa algo de dentro de `pagamentos`, uma regra de linter sobre grafo de dependências, ou o mecanismo de visibilidade da própria linguagem — pacotes, módulos, `internal`. A diferença prática é que a violação vira um build vermelho em vez de um comentário de revisão que alguém deixa passar numa sexta-feira à noite.',
          },
          {
            type: 'h',
            text: 'Por que ainda é o padrão certo na maioria dos casos',
          },
          {
            type: 'p',
            text: 'Um monólito bem organizado em camadas — ou em módulos por domínio, que costuma envelhecer melhor — entrega a maior parte das vantagens que se atribuem a arquiteturas mais elaboradas, sem os custos. Chamadas de função em vez de rede: sem latência, sem falha parcial, sem serialização. Transações do banco cobrindo a operação inteira. Refatoração assistida pelo compilador. Depuração com um stack trace só. Deploy de um artefato.',
          },
          {
            type: 'table',
            head: ['Preocupação', 'Monólito em camadas', 'Sistema distribuído'],
            rows: [
              ['Chamada entre partes', 'Função — nanossegundos', 'Rede — milissegundos e pode falhar'],
              ['Transação', 'Uma, do banco', 'Saga ou consistência eventual'],
              ['Refatorar fronteira', 'Renomear com o compilador ajudando', 'Migração coordenada entre times'],
              ['Depurar', 'Um stack trace', 'Tracing distribuído'],
              ['Escalar uma parte específica', 'Escala tudo junto', 'Escala só o que precisa'],
            ],
          },
          {
            type: 'p',
            text: 'A vantagem real de distribuir aparece quando partes do sistema têm perfis de escala muito diferentes, ou quando o número de pessoas mexendo no mesmo código torna o acoplamento organizacional insuportável. Nenhum desses problemas é de arquitetura no início — são consequências de escala e de tamanho de time.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Tratar "monólito" como palavrão. A maior parte dos sistemas que se distribuíram cedo demais não ganhou escala — ganhou latência de rede, falhas parciais, consistência eventual e um pipeline de deploy complexo, para resolver problemas que ainda não tinham. Módulos bem definidos dentro de um processo são o pré-requisito de qualquer separação futura, e são muito mais baratos de acertar.',
          },
        ],
        quiz: [
          {
            q: 'Por que a direção das dependências importa mais que a existência das camadas?',
            a: 'Porque é o que permite alterar e testar o núcleo do sistema sem arrastar a infraestrutura junto. Se o domínio não conhece banco nem framework, ele roda em testes sem nada disso presente e sobrevive à troca de qualquer dessas peças. Camadas com dependências circulares dão a cerimônia da separação sem nenhum de seus benefícios.',
          },
          {
            q: 'O que caracteriza a "camada anêmica" e por que ela é um problema?',
            a: 'É quando controller, service e repository apenas repassam chamadas sem conter lógica real, e as regras de negócio acabam espalhadas entre validações e condicionais dispersas. O problema é pagar o custo da indireção — três arquivos para cada mudança simples — sem obter clareza sobre onde as regras vivem.',
          },
          {
            q: 'Quando distribuir o sistema passa a compensar?',
            a: 'Quando partes têm perfis de escala genuinamente diferentes e escalar tudo junto fica caro, ou quando há gente demais no mesmo código e a coordenação de deploys vira o gargalo. Ambos são problemas de escala e de tamanho de time, não de arquitetura — antes deles, distribuir adiciona custo sem benefício.',
          },
        ],
      },
    },
    {
      slug: 'monolito-e-microsservicos',
      title: 'Monólito e microsserviços',
      summary:
        'O que se ganha e o que se paga ao trocar chamadas de função por chamadas de rede.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Microsserviços trocam complexidade interna por complexidade operacional. O ganho é autonomia de times e escala independente; o custo é que toda chamada passa a poder falhar.',
        blocks: [
          {
            type: 'p',
            text: 'A definição útil de microsserviço não é sobre tamanho: é sobre a unidade de implantação. Um microsserviço é um componente que pode ser desenvolvido, testado, implantado e escalado independentemente dos demais, com seus próprios dados. Se dois serviços precisam ser implantados juntos para funcionar, eles são um monólito distribuído — a pior combinação possível, com o acoplamento do monólito e a latência da rede.',
          },
          {
            type: 'key',
            text: 'A razão predominante para adotar microsserviços é organizacional, não técnica. Eles permitem que times entreguem sem coordenar deploys entre si. Quando há um time só, a autonomia que se compra não tem para quem ser vendida.',
          },
          {
            type: 'h',
            text: 'O que muda quando a chamada vira rede',
          },
          {
            type: 'p',
            text: 'Uma chamada de função sempre retorna ou lança exceção, em nanossegundos, sem estados intermediários. Uma chamada de rede pode demorar, pode falhar, pode ter sucesso sem que você saiba — e isso exige timeout, retry com backoff, idempotência, circuit breaker e tracing em cada ponto de integração. Nada disso é opcional, e nada disso existia antes.',
          },
          {
            type: 'p',
            text: 'A transação é a perda mais dolorosa. No monólito, alterar pedido e estoque no mesmo commit é trivial. Com bancos separados, é preciso uma saga: uma sequência de passos locais em que cada um tem uma compensação para desfazer o efeito se um passo seguinte falhar. Não há rollback automático, o estado fica temporariamente inconsistente por construção, e cada compensação é código que precisa ser escrito, testado e monitorado.',
          },
          {
            type: 'p',
            text: 'Vale registrar que compensar nem sempre é possível: e-mail enviado não volta, cobrança estornada deixa rastro no extrato do cliente. Modelar sagas exige escolher a ordem dos passos de forma que os efeitos irreversíveis venham por último.',
          },
          {
            type: 'h',
            text: 'Versionar contratos entre serviços',
          },
          {
            type: 'p',
            text: 'A regra que evita a maior parte dos incidentes de integração é simples de enunciar e exige disciplina para manter: nenhum deploy pode quebrar quem já está no ar. Como serviços são implantados de forma independente, em qualquer instante convivem versões diferentes — e o cliente antigo precisa continuar funcionando contra o servidor novo. Isso significa que campos novos entram como opcionais, campos existentes nunca mudam de tipo nem de significado, e nada é removido antes de haver evidência de que ninguém mais usa.',
          },
          {
            type: 'p',
            text: 'Toda remoção vira, portanto, um procedimento de três etapas separadas por deploys: primeiro o servidor passa a aceitar o formato novo mantendo o antigo, depois todos os clientes migram, e só então o suporte ao antigo é retirado. Entre a segunda e a terceira etapa costumam se passar semanas, e a única forma de saber quando é seguro concluir é instrumentar o campo ou o endpoint obsoleto para contar quem ainda o usa. Sem essa métrica, a decisão de remover é um palpite, e o time acaba mantendo código morto para sempre por medo de derrubar alguém desconhecido.',
          },
          {
            type: 'h',
            text: 'Onde cortar',
          },
          {
            type: 'p',
            text: 'A fronteira certa acompanha o domínio, não a camada técnica. Separar "serviço de banco de dados" e "serviço de regras" só cria um monólito com latência. Separar "pedidos", "pagamentos" e "catálogo" — subdomínios com vocabulário e ritmo próprios — dá autonomia real. O teste prático é a frequência de mudanças conjuntas: se duas partes mudam sempre juntas, a fronteira está no lugar errado.',
          },
          {
            type: 'p',
            text: 'Cada serviço deve ser dono dos seus dados. Se dois serviços leem e escrevem na mesma tabela, eles estão acoplados pelo esquema e nenhum consegue evoluir sozinho — não são serviços independentes, são dois deploys do mesmo sistema. Compartilhar banco é o atalho que anula o benefício inteiro.',
          },
          {
            type: 'table',
            head: ['Dimensão', 'Monólito modular', 'Microsserviços'],
            rows: [
              ['Deploy', 'Um artefato, tudo junto', 'Independente por serviço'],
              ['Falha de uma parte', 'Contida no processo', 'Precisa de isolamento explícito'],
              ['Consistência', 'Transação do banco', 'Saga e consistência eventual'],
              ['Escala', 'Tudo junto', 'Por serviço'],
              ['Custo operacional', 'Um pipeline, um runtime', 'N pipelines, malha, observabilidade'],
              ['Melhor com', 'Um a poucos times', 'Muitos times autônomos'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Começar pelos microsserviços. No início do produto ninguém sabe onde ficam as fronteiras de domínio — elas só aparecem depois de meses de uso real. Fronteiras erradas em rede são caríssimas de corrigir: exigem migração de dados, coordenação entre repositórios e versionamento de contrato. Dentro de um processo, mover código entre módulos é uma refatoração de uma tarde.',
          },
          {
            type: 'p',
            text: 'O caminho que costuma dar certo é o inverso do hype: comece com um monólito modular, com fronteiras internas nítidas e sem acesso cruzado a tabelas. Quando um módulo específico justificar — por escala, por time dedicado ou por ritmo de mudança —, extraia aquele módulo. As fronteiras já estarão validadas pelo uso, e a extração vira um trabalho mecânico em vez de uma aposta.',
          },
        ],
        quiz: [
          {
            q: 'O que é um "monólito distribuído" e por que é o pior dos mundos?',
            a: 'É um conjunto de serviços separados fisicamente que precisam ser implantados em conjunto para funcionar, por dependerem de contratos ou tabelas compartilhadas. Reúne o acoplamento do monólito — nenhuma autonomia de deploy — com todos os custos da rede: latência, falha parcial, ausência de transação e complexidade operacional.',
          },
          {
            q: 'Por que compartilhar banco entre dois serviços anula o benefício da separação?',
            a: 'Porque o esquema vira contrato implícito entre eles: qualquer alteração de tabela exige coordenação, nenhum consegue evoluir seus dados sozinho e uma migração precisa ser sincronizada. A independência de deploy — a razão de existir dos microsserviços — desaparece, restando apenas a latência de rede.',
          },
          {
            q: 'Por que errar a fronteira é muito mais caro entre serviços do que dentro de um monólito?',
            a: 'Porque corrigir uma fronteira em rede exige migrar dados entre bancos, versionar contratos, coordenar deploys entre repositórios e frequentemente entre times. Dentro de um processo, mover código de um módulo para outro é uma refatoração assistida pelo compilador, feita em horas e revertível.',
          },
        ],
      },
    },
    {
      slug: 'event-driven',
      title: 'Arquitetura orientada a eventos',
      summary:
        'Serviços que reagem a fatos em vez de responder a comandos, e o custo de perder o fluxo explícito.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Em arquiteturas orientadas a eventos, componentes reagem a fatos publicados em vez de serem chamados diretamente. Ganha-se extensibilidade e perde-se a visibilidade do fluxo.',
        blocks: [
          {
            type: 'p',
            text: 'A mudança é de direção do conhecimento. Numa arquitetura de comandos, o serviço de pedidos sabe que precisa avisar o estoque, o faturamento e o e-mail — e essa lista cresce dentro dele. Numa arquitetura de eventos, ele publica `PedidoCriado` e não sabe quem escuta; cada interessado assina por conta própria. Adicionar um consumidor deixa de exigir mudança no produtor.',
          },
          {
            type: 'key',
            text: 'Orquestração e coreografia são as duas formas de conduzir um processo distribuído. Na orquestração, um componente central conhece os passos e os comanda. Na coreografia, cada serviço reage a eventos e ninguém detém o processo inteiro.',
          },
          {
            type: 'p',
            text: 'A coreografia é elegante e escala organizacionalmente, mas tem um custo que aparece tarde: o processo de negócio deixa de existir em qualquer lugar do código. Ninguém consegue abrir um arquivo e ler o fluxo de um pedido — ele está implícito na soma de quem assina o quê. Quando algo trava no meio, descobrir em que etapa parou exige reconstruir mentalmente a cadeia inteira.',
          },
          {
            type: 'p',
            text: 'A orquestração recupera essa clareza: um orquestrador declara os passos, trata falhas e compensações, e expõe o estado atual de cada instância do processo. O preço é um componente que conhece todos os outros — acoplamento concentrado, que muitos consideram aceitável justamente por ser explícito e localizado. Para processos de negócio longos e com regras de compensação, essa costuma ser a escolha mais sensata.',
          },
          {
            type: 'h',
            text: 'Quanta informação o evento carrega',
          },
          {
            type: 'p',
            text: 'Nem todo evento carrega a mesma quantidade de informação, e a escolha tem efeito direto no acoplamento. O evento de notificação leva o mínimo — um tipo e um identificador — e obriga cada consumidor a chamar de volta o produtor para saber o que aconteceu. É leve na fila e devolve o acoplamento síncrono pela porta dos fundos: cada publicação vira uma rajada de N chamadas ao produtor, exatamente no momento em que ele está ocupado.',
          },
          {
            type: 'p',
            text: 'No outro extremo, o evento de transferência de estado carrega uma cópia completa da entidade após a mudança: os consumidores ficam autônomos e podem manter réplicas locais, ao custo de mensagens grandes e de deixar o formato interno vazar para o contrato. O meio-termo que funciona na maioria dos casos é incluir os campos que a maioria dos consumidores precisa, mais o identificador para os casos raros que exigem detalhe. Vale sempre incluir também o momento em que o fato ocorreu e um número de versão da entidade — sem eles, um consumidor que receba eventos fora de ordem não tem como saber qual é o mais recente.',
          },
          {
            type: 'h',
            text: 'O que precisa existir antes de adotar',
          },
          {
            type: 'p',
            text: 'A opacidade que a coreografia produz é gerenciável, mas só com ferramenta construída de propósito. O mínimo viável são três coisas. Um catálogo de eventos, gerado a partir dos esquemas em vez de mantido à mão, respondendo quem publica o quê e quem assina o quê — sem ele, ninguém consegue avaliar o impacto de uma mudança. Tracing correlacionado que atravesse as fronteiras assíncronas, para que o caminho de um pedido seja reconstruível mesmo passando por cinco filas. E uma visão do estado de cada processo em andamento, que responda "onde está este pedido agora" sem exigir consulta a cinco bancos diferentes.',
          },
          {
            type: 'h',
            text: 'Event sourcing e CQRS',
          },
          {
            type: 'p',
            text: 'Event sourcing leva a ideia ao extremo do armazenamento: em vez de guardar o estado atual, guarda-se a sequência de eventos que o produziu, e o estado é derivado reproduzindo essa sequência. Ganha-se auditoria completa e a capacidade de responder perguntas históricas que ninguém previu — inclusive reconstruir o estado em qualquer instante do passado.',
          },
          {
            type: 'p',
            text: 'Os custos são reais e frequentemente subestimados. Consultar o estado atual exige reconstruí-lo ou manter projeções à parte. Eventos gravados são imutáveis, então mudar o formato exige versionamento e upcasting perpétuo — o código precisa entender todas as versões históricas para sempre. E remover dados pessoais de um log imutável, como exige a legislação de privacidade, é um problema de engenharia por si só.',
          },
          {
            type: 'p',
            text: 'CQRS separa o modelo de escrita do de leitura, permitindo que cada um seja otimizado para o seu uso — e frequentemente aparece junto com event sourcing, porque as projeções de leitura são construídas a partir dos eventos. Vale notar que os três conceitos são independentes: dá para usar eventos sem event sourcing, e CQRS sem nenhum dos dois.',
          },
          {
            type: 'table',
            head: ['Abordagem', 'Fluxo visível?', 'Acoplamento', 'Melhor para'],
            rows: [
              ['Comandos diretos', 'Sim, no código', 'Alto e explícito', 'Fluxos simples e estáveis'],
              ['Coreografia', 'Não — implícito', 'Baixo', 'Muitos consumidores independentes'],
              ['Orquestração', 'Sim, no orquestrador', 'Concentrado', 'Processos longos com compensação'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Adotar eventos em tudo e descobrir tarde demais que ninguém consegue responder "onde está este pedido?". Sem catálogo de eventos, tracing correlacionado e uma visão do estado de cada processo em andamento, o desacoplamento vira opacidade — e a depuração de um caso preso passa a exigir arqueologia em cinco serviços. Adote eventos onde a extensibilidade compensa, e mantenha explícito o que é fluxo crítico de negócio.',
          },
        ],
        quiz: [
          {
            q: 'Qual a diferença entre orquestração e coreografia?',
            a: 'Na orquestração, um componente central conhece a sequência de passos e comanda cada um, mantendo o processo visível e o estado consultável, ao custo de conhecer todos os serviços envolvidos. Na coreografia, cada serviço reage a eventos de forma autônoma e ninguém detém o processo inteiro — máximo desacoplamento, mínima visibilidade.',
          },
          {
            q: 'Quais são os custos práticos do event sourcing?',
            a: 'Consultar o estado atual exige reconstruí-lo a partir dos eventos ou manter projeções separadas e sincronizadas. Como os eventos são imutáveis, mudar o formato exige versionamento e código que entenda todas as versões históricas indefinidamente. E apagar dados pessoais de um log imutável, como a legislação de privacidade exige, é um problema de engenharia à parte.',
          },
          {
            q: 'Por que a coreografia pode dificultar a operação do sistema?',
            a: 'Porque o processo de negócio não existe explicitamente em lugar nenhum: é a soma emergente de quem assina quais eventos. Não há arquivo para ler o fluxo, nem estado central para consultar onde uma instância parou. Diagnosticar um caso travado exige reconstruir a cadeia percorrendo vários serviços.',
          },
        ],
      },
    },
    {
      slug: 'serverless',
      title: 'Serverless',
      summary:
        'Escala a zero, cobrança por execução e as restrições que vêm junto: cold start e estado.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Serverless entrega execução sob demanda com escala automática e cobrança por uso, em troca de restrições fortes sobre estado, duração e latência de inicialização.',
        blocks: [
          {
            type: 'p',
            text: 'O nome é enganoso — há servidores, você é que não os administra. O modelo entrega três coisas concretas: não há máquina para provisionar ou atualizar, a escala acompanha a demanda automaticamente inclusive até zero, e a cobrança é por execução em vez de por tempo de máquina ligada. Para cargas intermitentes, a economia é grande: um serviço chamado mil vezes por dia custa centavos, enquanto uma instância ociosa custa o mês inteiro.',
          },
          {
            type: 'key',
            text: 'Serverless brilha quando a carga é irregular ou imprevisível. Se o tráfego é constante e alto, uma instância reservada quase sempre sai mais barata — a cobrança por execução tem prêmio embutido pela elasticidade.',
          },
          {
            type: 'h',
            text: 'Cold start',
          },
          {
            type: 'p',
            text: 'A restrição mais conhecida: quando não há instância aquecida, a plataforma precisa provisionar o ambiente, carregar o código e inicializar o runtime antes de executar. Isso adiciona de dezenas de milissegundos a alguns segundos, dependendo da linguagem e do tamanho do pacote. Runtimes interpretados leves iniciam rápido; ambientes com muita inicialização em tempo de execução sofrem mais.',
          },
          {
            type: 'p',
            text: 'Existem mitigações — manter instâncias provisionadas, enxugar dependências, mover trabalho para fora do caminho de inicialização —, mas a mais importante é escolher bem onde aplicar. Um processamento em background não se importa com meio segundo a mais; um endpoint no caminho crítico de uma página, sim.',
          },
          {
            type: 'h',
            text: 'Ausência de estado e conexões',
          },
          {
            type: 'p',
            text: 'Cada invocação pode rodar num ambiente novo, então nada em memória sobrevive de forma confiável entre chamadas. Estado precisa viver fora — banco, cache, storage. Isso não é diferente de um serviço stateless bem projetado, mas serverless torna a restrição absoluta em vez de recomendada.',
          },
          {
            type: 'p',
            text: 'Um problema menos óbvio e mais frequente é o de conexões com o banco. Um serviço tradicional mantém um pool de vinte conexões; mil execuções simultâneas de uma função podem tentar abrir mil conexões e esgotar o limite do banco. É por isso que existem proxies de conexão gerenciados e bancos com API HTTP — a arquitetura serverless conflita diretamente com o modelo de pool que os bancos relacionais assumem.',
          },
          {
            type: 'h',
            text: 'O modelo de concorrência',
          },
          {
            type: 'p',
            text: 'A diferença mais estrutural em relação a um servidor comum é que a maioria das plataformas de funções processa *uma requisição por instância de cada vez*. Um servidor tradicional com dez threads atende dez requisições simultâneas no mesmo processo, compartilhando cache em memória e pool de conexões. Em serverless, cem requisições simultâneas significam cem ambientes de execução, cada um com sua própria memória e suas próprias conexões. Escalar deixa de ser uma questão de threads e passa a ser de número de cópias.',
          },
          {
            type: 'p',
            text: 'Isso reordena o raciocínio sobre custo e desempenho. Como a cobrança é por duração multiplicada pela memória alocada, e o poder de CPU costuma crescer junto com a memória, dobrar a memória de uma função limitada por CPU pode reduzir a duração pela metade e sair pelo mesmo preço — com metade da latência. Vale medir em vez de supor: a configuração mais barata quase nunca é a de menor memória. E como o ambiente é reaproveitado entre invocações quando há tráfego, tudo que for inicializado fora do handler — clientes, configuração, conexões — é pago uma vez e aproveitado nas chamadas seguintes.',
          },
          {
            type: 'h',
            text: 'Limites de execução',
          },
          {
            type: 'p',
            text: 'Toda plataforma impõe um teto de duração — tipicamente entre alguns minutos e um quarto de hora —, além de limites de tamanho do pacote, de espaço em disco temporário e de tamanho da resposta. Esses tetos não são detalhes de configuração: eles determinam o que pode ser escrito como função. Um processamento que leva vinte minutos precisa ser reestruturado em passos encadeados por fila, com estado externo entre eles, ou simplesmente não pertence a esse modelo. Quando a função é invocada de forma assíncrona, a plataforma normalmente repete a execução automaticamente em caso de erro — o que reforça, mais uma vez, que o handler precisa ser idempotente por construção.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Serverless', 'Contêiner/instância'],
            rows: [
              ['Escala a zero', 'Sim', 'Não (paga ocioso)'],
              ['Latência de partida', 'Cold start', 'Sempre quente'],
              ['Duração máxima', 'Limitada (minutos)', 'Ilimitada'],
              ['Estado em memória', 'Não confiável', 'Possível'],
              ['Conexões ao banco', 'Problema — precisa de proxy', 'Pool tradicional'],
              ['Melhor caso', 'Carga irregular, glue code, eventos', 'Tráfego constante, processos longos'],
            ],
          },
          {
            type: 'p',
            text: 'Os casos onde serverless é claramente a escolha certa: reagir a eventos de infraestrutura (arquivo enviado, mensagem publicada), tarefas agendadas, webhooks, processamento em lote com paralelismo alto e picos súbitos, e as funções de cola que ligam serviços gerenciados. Nesses cenários, provisionar uma máquina permanente para trabalho esporádico é desperdício puro.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Subestimar o custo em alta escala e o acoplamento ao provedor. A cobrança por execução é ótima com tráfego baixo e pode ficar bem mais cara que instâncias reservadas com tráfego constante — vale refazer a conta quando o volume crescer. E como o código costuma se apoiar em serviços específicos da plataforma para filas, autenticação e estado, migrar depois é um projeto, não uma configuração.',
          },
        ],
        quiz: [
          {
            q: 'Por que serverless pode ficar mais caro que instâncias em tráfego alto e constante?',
            a: 'Porque a cobrança por execução embute um prêmio pela elasticidade e pelo gerenciamento. Esse prêmio compensa quando há longos períodos ociosos que não seriam pagos, mas com tráfego constante a máquina reservada é usada quase o tempo todo e seu custo por unidade de trabalho fica menor.',
          },
          {
            q: 'Por que conexões de banco são um problema específico em serverless?',
            a: 'Porque o modelo de pool pressupõe poucos processos de longa duração compartilhando conexões. Em serverless, muitas execuções simultâneas e efêmeras tentam abrir conexões próprias e esgotam o limite do banco. A solução são proxies de conexão gerenciados que multiplexam, ou bancos que aceitam acesso via HTTP sem conexão persistente.',
          },
          {
            q: 'Em que cenários serverless é claramente a escolha certa?',
            a: 'Cargas irregulares ou esporádicas — reagir a eventos de infraestrutura, tarefas agendadas, webhooks, processamento em lote com picos súbitos e funções de cola entre serviços gerenciados. Nesses casos manter uma máquina permanente ociosa é desperdício, e o cold start raramente afeta a experiência do usuário.',
          },
        ],
      },
    },
    {
      slug: 'peer-to-peer',
      title: 'Peer-to-peer',
      summary:
        'Sistemas sem servidor central: como nós se descobrem e distribuem dados entre si.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Em P2P, cada participante é ao mesmo tempo cliente e servidor. A capacidade cresce com o número de participantes, em vez de ser consumida por eles.',
        blocks: [
          {
            type: 'p',
            text: 'A inversão econômica é o que torna o modelo interessante. No modelo cliente-servidor, cada usuário novo consome recursos do servidor — mais usuários significam mais custo. Em P2P, cada participante contribui com banda, armazenamento e processamento, então mais usuários significam *mais* capacidade. É por isso que uma rede P2P distribui um arquivo popular melhor do que um servidor único jamais conseguiria.',
          },
          {
            type: 'key',
            text: 'Em P2P a capacidade cresce com a demanda, porque quem demanda também oferta. O preço é abrir mão do ponto central que garantia coordenação, consistência e confiança.',
          },
          {
            type: 'h',
            text: 'Descoberta de pares',
          },
          {
            type: 'p',
            text: 'Sem servidor central, o primeiro problema é entrar na rede: como um nó novo encontra alguém para falar? Soluções puras não existem — sempre há algum ponto de entrada. Redes usam nós semente com endereços conhecidos, listas distribuídas por outros meios, ou um rastreador central que conhece quem tem o quê (a abordagem híbrida do BitTorrent original).',
          },
          {
            type: 'p',
            text: 'Depois de entrar, a organização mais elegante é a tabela hash distribuída (DHT). Cada nó e cada chave recebem um identificador no mesmo espaço, e cada nó fica responsável pelas chaves próximas ao seu id — a mesma ideia do consistent hashing, aplicada sem coordenador. O truque é o roteamento: cada nó mantém contato com um número pequeno de outros, escolhidos de forma que cada salto reduza a distância até o destino pela metade. Assim se localiza qualquer chave em cerca de log N saltos, mesmo com milhões de nós e sem que ninguém conheça a rede inteira.',
          },
          {
            type: 'p',
            text: 'Duas propriedades tornam a DHT operável na prática. A primeira é a replicação: cada chave é guardada não por um nó, mas pelos k nós mais próximos do seu identificador — tipicamente vinte. Como qualquer par pode desaparecer sem aviso, um único responsável significaria perda de dados a cada saída. A segunda é a manutenção contínua das tabelas de roteamento, já que os contatos envelhecem e precisam ser verificados e substituídos. Numa rede pública, a rotatividade é a condição normal, e o protocolo é desenhado assumindo que boa parte dos pares conhecidos há uma hora já não existe.',
          },
          {
            type: 'h',
            text: 'Como o dado é dividido',
          },
          {
            type: 'p',
            text: 'Distribuir arquivos exige antes fatiá-los. Um arquivo é dividido em blocos de tamanho fixo, e cada bloco tem seu próprio hash — o que permite baixar pedaços de pares diferentes ao mesmo tempo e verificar cada um assim que chega, sem esperar o download terminar para descobrir que veio corrompido. Os hashes dos blocos são organizados numa árvore de Merkle, cuja raiz identifica o arquivo inteiro: com ela é possível provar que um bloco específico pertence ao conjunto sem baixar todos os outros.',
          },
          {
            type: 'h',
            text: 'Os problemas que o servidor resolvia de graça',
          },
          {
            type: 'p',
            text: 'Confiança é o maior deles. Sem autoridade central, qualquer par pode mentir: enviar dados corrompidos, alegar ter conteúdo que não tem, ou fingir ser muitos nós ao mesmo tempo para ganhar influência desproporcional — o ataque Sybil. A defesa padrão para integridade é o endereçamento por conteúdo: o identificador do dado é o hash do próprio dado, então quem recebe verifica localmente e detecta qualquer adulteração sem confiar na fonte.',
          },
          {
            type: 'p',
            text: 'Há também o parasitismo: participantes que só baixam e nunca compartilham degradam a rede para todos. A resposta clássica é um mecanismo de reciprocidade — priorizar o envio para quem está enviando de volta —, que alinha o incentivo individual ao coletivo sem precisar de árbitro.',
          },
          {
            type: 'p',
            text: 'Por fim, a conectividade prática: a maioria dos usuários está atrás de NAT e não aceita conexões de entrada. Isso exige técnicas de perfuração de NAT coordenadas por servidores auxiliares e, quando falham, retransmissão por um intermediário — o que reintroduz infraestrutura central justamente onde se queria evitá-la.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Cliente-servidor', 'P2P'],
            rows: [
              ['Capacidade com mais usuários', 'Diminui (consome)', 'Aumenta (contribui)'],
              ['Ponto único de falha', 'O servidor', 'Nenhum'],
              ['Confiança', 'Centralizada no servidor', 'Verificação criptográfica por conteúdo'],
              ['Consistência', 'Simples de garantir', 'Difícil — eventual na melhor hipótese'],
              ['Conectividade', 'Trivial', 'NAT traversal e relays'],
            ],
          },
          {
            type: 'p',
            text: 'Na prática, os sistemas P2P bem-sucedidos são híbridos: usam componentes centrais para descoberta, sinalização e identidade, e distribuem apenas o tráfego pesado, que é onde o modelo realmente ganha. Chamadas de vídeo em grupo, distribuição de arquivos grandes e sincronização entre dispositivos do mesmo usuário são os casos onde isso compensa.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Escolher P2P para fugir do custo de servidor sem considerar o que se perde. Sem ponto central, some a capacidade de garantir consistência, aplicar regras de negócio, moderar conteúdo, autenticar de forma simples e depurar problemas. Para a maioria dos produtos, o servidor não é um custo a eliminar — é a peça que torna quase tudo tratável.',
          },
        ],
        quiz: [
          {
            q: 'Por que a capacidade de uma rede P2P cresce com o número de participantes?',
            a: 'Porque cada participante é simultaneamente consumidor e provedor: contribui com banda, armazenamento e processamento ao mesmo tempo em que consome. No modelo cliente-servidor, cada usuário novo apenas consome recursos finitos do servidor; em P2P, ele adiciona à capacidade total disponível.',
          },
          {
            q: 'Como uma DHT localiza uma chave sem que nenhum nó conheça a rede inteira?',
            a: 'Cada nó mantém contato com um número pequeno de outros, escolhidos de forma que cada salto reduza aproximadamente pela metade a distância até o identificador procurado no espaço de hash. A busca é encaminhada de vizinho em vizinho, chegando ao responsável em cerca de log N saltos mesmo com milhões de nós.',
          },
          {
            q: 'Como o endereçamento por conteúdo resolve a falta de confiança entre pares?',
            a: 'O identificador do dado é o hash do próprio conteúdo, então quem recebe recalcula o hash e compara. Se não bater, o dado foi adulterado ou corrompido e é descartado. Isso torna desnecessário confiar na fonte: a verificação é local, criptográfica e não depende de nenhuma autoridade central.',
          },
        ],
      },
    },
  ],
};

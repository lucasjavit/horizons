import type { ModuleSeed } from '../types';

export const assincrono: ModuleSeed = {
  slug: 'comunicacao-assincrona',
  title: 'Comunicação assíncrona',
  goal: 'Desacoplar serviços no tempo: entender quando responder depois é melhor que responder agora, e como filas e eventos mudam as garantias do sistema.',
  lessons: [
    {
      slug: 'filas-de-mensagens',
      title: 'Filas de mensagens',
      summary:
        'Como uma fila absorve picos, desacopla produtor de consumidor e transforma indisponibilidade em atraso.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Uma fila coloca um buffer durável entre quem produz trabalho e quem o executa, trocando resposta imediata por resiliência e absorção de picos.',
        blocks: [
          {
            type: 'p',
            text: 'Numa chamada síncrona, o cliente espera o trabalho terminar. Isso acopla os dois lados em três dimensões ao mesmo tempo: no tempo (ambos precisam estar no ar simultaneamente), na capacidade (o produtor não pode gerar mais do que o consumidor aguenta) e na disponibilidade (se o consumidor cai, o produtor falha junto). Uma fila quebra os três acoplamentos de uma vez.',
          },
          {
            type: 'p',
            text: 'O padrão é simples: o produtor grava uma mensagem na fila e recebe confirmação de que ela foi *aceita*, não de que foi processada. Um consumidor pega a mensagem quando puder, executa o trabalho e confirma. Se o consumidor está fora do ar, as mensagens se acumulam; quando ele volta, drena a fila no seu ritmo.',
          },
          {
            type: 'key',
            text: 'A fila converte um problema de disponibilidade em um problema de latência. Sem ela, o consumidor cair significa requisições falhando. Com ela, significa apenas que o trabalho vai demorar mais — desde que a fila tenha espaço e alguém esteja olhando o tamanho dela.',
          },
          {
            type: 'h',
            text: 'Absorção de picos',
          },
          {
            type: 'p',
            text: 'O benefício mais concreto é o nivelamento de carga. Se o sistema recebe 5.000 pedidos num minuto de promoção mas só processa 500 por minuto, a chamada síncrona simplesmente falha para 90% das pessoas. Com fila, todos os 5.000 são aceitos e processados ao longo dos dez minutos seguintes. A capacidade não mudou — mudou o que acontece com o excesso: em vez de virar erro, vira espera.',
          },
          {
            type: 'p',
            text: 'Isso só funciona se o pico for transitório. Se a taxa de chegada for maior que a de processamento de forma sustentada, a fila cresce sem limite e o atraso vai a infinito — a fila não criou capacidade, só adiou a percepção do problema. Por isso a métrica que realmente importa não é o tamanho da fila, e sim a *idade da mensagem mais antiga*: ela diz há quanto tempo alguém está esperando, e cresce de forma inequívoca quando o consumo não acompanha.',
          },
          {
            type: 'h',
            text: 'Confirmação e reentrega',
          },
          {
            type: 'p',
            text: 'Quando um consumidor pega uma mensagem, ela não é apagada: fica invisível para os outros consumidores por um tempo (visibility timeout). Se o consumidor confirma o processamento, a mensagem é removida. Se ele morre antes de confirmar, o tempo expira e a mensagem volta a ficar visível para outro consumidor pegar. É isso que garante que nada se perca quando um worker cai no meio do trabalho.',
          },
          {
            type: 'p',
            text: 'A consequência direta é que a entrega é *pelo menos uma vez*: uma mensagem cujo processamento demorou mais que o timeout será entregue de novo, mesmo tendo sido concluída. Todo consumidor precisa ser idempotente — normalmente registrando o id da mensagem já processada, ou modelando a operação para que repeti-la não cause dano.',
          },
          {
            type: 'p',
            text: 'Mensagens que falham repetidamente precisam de saída. Depois de N tentativas, elas vão para uma *dead letter queue*: uma fila separada onde ficam para inspeção humana, sem bloquear o processamento das demais. Sem DLQ, uma única mensagem malformada pode ser reentregue eternamente, consumindo capacidade e poluindo os logs — o chamado poison message.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Chamada síncrona', 'Fila'],
            rows: [
              ['Cliente sabe o resultado', 'Sim, na hora', 'Não — precisa consultar depois'],
              ['Consumidor fora do ar', 'Requisição falha', 'Mensagem espera'],
              ['Pico de carga', 'Erros ou timeout', 'Absorvido como atraso'],
              ['Complexidade', 'Baixa', 'Alta — estado, retry, DLQ, monitoramento'],
              ['Depuração', 'Stack trace direto', 'Precisa de correlação entre serviços'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Não monitorar a idade da mensagem mais antiga. O tamanho da fila engana: pode estar pequeno porque tudo flui bem, ou porque o produtor parou de produzir. Já uma mensagem de vinte minutos de idade é sempre um sinal claro de que o consumo não acompanha. Sem esse alarme, descobre-se o problema pelo cliente reclamando que o pedido nunca foi confirmado.',
          },
          {
            type: 'p',
            text: 'Há também um custo de experiência que não pode ser ignorado: como o cliente não recebe mais o resultado na resposta, a interface precisa mudar. O padrão é responder 202 com um identificador, e oferecer uma forma de acompanhar — consulta de status, notificação, webhook. Trocar síncrono por assíncrono sem resolver isso apenas transfere a confusão para o usuário.',
          },
        ],
        quiz: [
          {
            q: 'Por que a idade da mensagem mais antiga é uma métrica melhor que o tamanho da fila?',
            a: 'Porque o tamanho é ambíguo: uma fila pequena pode significar processamento saudável ou produtor parado. A idade da mensagem mais antiga mede diretamente o que importa — há quanto tempo alguém espera — e cresce de forma monotônica sempre que o consumo não acompanha a produção, sem depender do volume de entrada.',
          },
          {
            q: 'Por que consumidores de fila precisam ser idempotentes?',
            a: 'Porque a entrega é pelo menos uma vez. Se um consumidor processa a mensagem mas morre antes de confirmar, ou demora mais que o visibility timeout, a mensagem volta à fila e é entregue de novo. Sem idempotência, isso duplica o efeito — cobra duas vezes, envia dois e-mails, cria dois registros.',
          },
          {
            q: 'Uma fila resolve o caso em que a taxa de chegada supera a de processamento de forma permanente?',
            a: 'Não. Ela absorve picos transitórios, mas se a produção excede o consumo de forma sustentada, a fila cresce indefinidamente e o atraso tende ao infinito. A fila não cria capacidade — só adia a percepção do déficit. A solução é aumentar consumidores, otimizar o processamento ou aplicar contrapressão no produtor.',
          },
        ],
      },
    },
    {
      slug: 'pub-sub',
      title: 'Publish/Subscribe',
      summary:
        'Um evento, muitos interessados: o modelo que permite adicionar consumidores sem tocar em quem publica.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'Em pub/sub, o produtor publica um evento sem saber quem vai consumi-lo. Cada assinante recebe sua própria cópia, o que permite adicionar novos consumidores sem alterar o produtor.',
        blocks: [
          {
            type: 'p',
            text: 'A diferença entre fila e pub/sub é quem recebe a mensagem. Numa fila, cada mensagem é entregue a *um* consumidor — os workers dividem o trabalho entre si. Em pub/sub, cada mensagem é entregue a *todos* os assinantes — cada um recebe uma cópia e faz algo diferente com ela.',
          },
          {
            type: 'p',
            text: 'Isso muda o modelo mental de integração. Em vez de "o serviço de pedidos chama o de e-mail, depois o de estoque, depois o de faturamento", o serviço de pedidos publica o fato `PedidoCriado` e segue em frente. Quem se interessa assina. Adicionar um serviço de antifraude amanhã não exige mudar uma linha do serviço de pedidos.',
          },
          {
            type: 'key',
            text: 'A inversão essencial: o produtor deixa de conhecer os consumidores. Isso torna o sistema extensível — mas também torna impossível saber, olhando o código do produtor, o que acontece quando ele publica.',
          },
          {
            type: 'h',
            text: 'Eventos são fatos, não comandos',
          },
          {
            type: 'p',
            text: 'Vale um cuidado de nomenclatura que tem consequência real de acoplamento. Um evento descreve algo que *aconteceu*, no passado: `PagamentoConfirmado`, `UsuarioCadastrado`. Um comando descreve algo que *deve acontecer*: `EnviarEmail`, `CobrarCartao`. Publicar comandos disfarçados de evento recria o acoplamento que o pub/sub pretendia eliminar — o produtor volta a decidir o que os outros devem fazer.',
          },
          {
            type: 'p',
            text: 'Um bom evento também carrega dados suficientes para o consumidor agir sem precisar chamar de volta o produtor. Se o evento traz só um id e todos os assinantes precisam buscar os detalhes, o acoplamento síncrono voltou pela porta dos fundos — e com ele um pico de chamadas ao produtor a cada publicação. O contraponto é que eventos gordos ficam desatualizados e crescem: o equilíbrio usual é incluir os campos que a maioria dos consumidores precisa e aceitar que casos raros façam a chamada extra.',
          },
          {
            type: 'h',
            text: 'Tópicos, grupos e ordenação',
          },
          {
            type: 'p',
            text: 'Sistemas modernos combinam os dois modelos. Em log distribuído (estilo Kafka), as mensagens vão para um tópico dividido em partições. Cada *grupo de consumidores* recebe todas as mensagens do tópico — isso é pub/sub. Dentro de um grupo, cada partição é atribuída a um consumidor só — isso é fila. Assim se obtém múltiplos interessados independentes e, ao mesmo tempo, paralelismo dentro de cada interessado.',
          },
          {
            type: 'p',
            text: 'A ordenação, quando existe, é garantida apenas dentro de uma partição. Como a partição é escolhida pelo hash de uma chave, eventos da mesma entidade — mesmo `pedidoId`, por exemplo — caem na mesma partição e chegam em ordem. Eventos de entidades diferentes não têm ordem relativa garantida. Escolher a chave de partição é, portanto, escolher qual ordenação o sistema promete.',
          },
          {
            type: 'h',
            text: 'Retenção e replay',
          },
          {
            type: 'p',
            text: 'Um broker de fila tradicional apaga a mensagem assim que ela é confirmada — o que faz sentido quando há um consumidor só. Num log distribuído, a mensagem permanece pelo período de retenção configurado (sete dias é o padrão comum), independentemente de quantos já a leram. Cada grupo mantém apenas um marcador de posição, o *offset*, indicando até onde processou. A consequência prática é enorme: reprocessar é mover esse marcador para trás.',
          },
          {
            type: 'h',
            text: 'Versionar o esquema do evento',
          },
          {
            type: 'p',
            text: 'Como o produtor não conhece os assinantes, a evolução do formato precisa ser governada por regras, não por combinação entre times. A convenção que funciona é compatibilidade retroativa por adição: campos novos são sempre opcionais e vêm com valor padrão, campos existentes nunca mudam de tipo nem de significado, e remover um campo exige primeiro deixá-lo de escrever, esperar todos migrarem e só então tirá-lo do esquema. Cada consumidor precisa ignorar silenciosamente o que não conhece — o contrário transforma qualquer adição inofensiva numa quebra em cascata.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Fila', 'Pub/Sub'],
            rows: [
              ['Quem recebe cada mensagem', 'Um consumidor', 'Todos os assinantes'],
              ['Objetivo', 'Distribuir trabalho', 'Distribuir informação'],
              ['Novo consumidor', 'Divide a carga existente', 'Recebe cópia própria'],
              ['Acoplamento', 'Produtor sabe o que será feito', 'Produtor não sabe quem escuta'],
              ['Semântica típica', 'Comando ("faça isto")', 'Evento ("isto aconteceu")'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Perder a visibilidade do fluxo. Com pub/sub, ninguém consegue responder "o que acontece quando um pedido é criado?" lendo o código — a resposta está espalhada por N serviços que assinam o evento. Sem catálogo de eventos, contrato versionado e tracing distribuído, o desacoplamento vira desconhecimento, e um consumidor quebrado passa despercebido até alguém reclamar.',
          },
          {
            type: 'p',
            text: 'Vale lembrar que o esquema do evento é um contrato público, como o de uma API. Adicionar campo é seguro se os consumidores ignoram o que não conhecem; remover ou renomear quebra todos eles de uma vez, e você provavelmente não sabe quem são. Registro de esquemas com verificação de compatibilidade existe exatamente para transformar essa quebra em erro de build em vez de incidente.',
          },
        ],
        quiz: [
          {
            q: 'Qual a diferença essencial entre fila e pub/sub?',
            a: 'Na fila, cada mensagem vai para um único consumidor — o objetivo é dividir trabalho entre workers. Em pub/sub, cada mensagem vai para todos os assinantes — o objetivo é distribuir informação para interessados independentes. Adicionar um consumidor numa fila divide a carga existente; num tópico pub/sub, cria um novo fluxo completo.',
          },
          {
            q: 'Por que publicar comandos como se fossem eventos recria acoplamento?',
            a: 'Porque um comando (`EnviarEmail`) determina o que o consumidor deve fazer, então o produtor continua conhecendo e decidindo a lógica alheia — só que agora indiretamente. Um evento (`PedidoCriado`) apenas relata um fato e deixa cada assinante decidir se e como reagir, que é o que permite adicionar consumidores sem alterar o produtor.',
          },
          {
            q: 'Como um log particionado consegue ser fila e pub/sub ao mesmo tempo?',
            a: 'Cada grupo de consumidores recebe todas as mensagens do tópico, o que é comportamento pub/sub entre grupos. Dentro de um grupo, cada partição é atribuída a um único consumidor, o que é comportamento de fila e dá paralelismo. Assim há vários interessados independentes, cada um escalando internamente.',
          },
        ],
      },
    },
    {
      slug: 'garantias-de-entrega',
      title: 'At-most-once, at-least-once e exactly-once',
      summary:
        'Por que "exatamente uma vez" é quase sempre at-least-once somado a idempotência.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'As três garantias de entrega diferem no que se prefere arriscar: perder uma mensagem ou processá-la duas vezes. Exactly-once não é entregue pela rede — é construído no consumidor.',
        blocks: [
          {
            type: 'p',
            text: 'A escolha nasce de uma pergunta simples: quando confirmar? Se o consumidor confirma a mensagem *antes* de processá-la, e então morre, a mensagem já foi removida e o trabalho nunca acontece — isso é at-most-once: no máximo uma vez, possivelmente nenhuma. Se confirma *depois* de processar, e morre entre o processamento e a confirmação, a mensagem volta para a fila e o trabalho acontece de novo — isso é at-least-once.',
          },
          {
            type: 'key',
            text: 'Não existe ponto seguro para confirmar. Confirmar antes arrisca perder; confirmar depois arrisca duplicar. Como toda escolha binária sob falha parcial, o que se decide é qual erro é mais barato.',
          },
          {
            type: 'p',
            text: 'Na prática, at-least-once é o padrão da esmagadora maioria dos sistemas, porque perder trabalho costuma ser pior que repeti-lo. At-most-once é aceitável apenas quando a mensagem é descartável e o volume alto: métricas de telemetria, batidas de heartbeat, eventos de analytics onde perder 0,1% não muda nenhuma conclusão.',
          },
          {
            type: 'h',
            text: 'Por que exactly-once é enganoso',
          },
          {
            type: 'p',
            text: 'Entrega exatamente uma vez, no sentido literal de a mensagem trafegar uma única vez pela rede e ser processada uma única vez, é impossível num sistema distribuído sujeito a falhas. O emissor nunca consegue distinguir "a mensagem se perdeu" de "a confirmação se perdeu", então ou ele reenvia (podendo duplicar) ou não reenvia (podendo perder). Não há terceira opção.',
          },
          {
            type: 'p',
            text: 'O que os sistemas chamam de exactly-once é, na verdade, *efeito* exatamente uma vez: a mensagem pode chegar várias vezes, mas o resultado observável é o mesmo de uma única execução. Isso se constrói de duas maneiras. A primeira é deduplicação: o consumidor guarda os ids já processados e descarta repetições — e o registro do id precisa ser atômico com o efeito, ou a garantia é ilusória. A segunda é idempotência natural: modelar a operação de forma que repeti-la não mude nada, como definir um estado absoluto em vez de aplicar um incremento.',
          },
          {
            type: 'p',
            text: 'Alguns sistemas de streaming oferecem exactly-once dentro de suas próprias fronteiras, usando escrita transacional que liga o consumo, o processamento e a produção do resultado num único commit atômico. É real e útil, mas vale entender o limite: a garantia vale enquanto tudo permanece dentro daquele sistema. No instante em que o efeito sai para o mundo externo — cobrar um cartão, enviar um e-mail —, volta a ser at-least-once, e a idempotência precisa existir do outro lado.',
          },
          {
            type: 'h',
            text: 'A mecânica da deduplicação',
          },
          {
            type: 'p',
            text: 'Deduplicar exige três decisões que costumam ser tomadas por omissão e cobram caro depois. A primeira é qual chave usar. O id gerado pelo broker parece o candidato natural, mas ele muda quando o produtor reenvia a mesma mensagem após um timeout — e é exatamente essa duplicata que se quer barrar. A chave confiável é de negócio e vem do produtor: o id do pedido, o id da tentativa de pagamento, um identificador de idempotência que o cliente escolheu. Ela sobrevive a reenvios, a trocas de broker e a replays.',
          },
          {
            type: 'p',
            text: 'A segunda é onde guardar o registro. Se o consumidor grava o efeito no banco e depois anota o id numa tabela separada, existe uma janela entre as duas escritas em que um crash deixa o efeito aplicado sem a marca — e a reentrega o aplica de novo. A forma correta é gravar o id na mesma transação do efeito, ou usar o próprio banco como registro através de uma restrição de unicidade sobre a chave, deixando que a segunda inserção falhe naturalmente e seja descartada como duplicata conhecida.',
          },
          {
            type: 'p',
            text: 'A terceira é por quanto tempo lembrar. A tabela de ids processados cresce indefinidamente se ninguém a limpa, e num fluxo de milhares de mensagens por segundo isso vira um problema de armazenamento em semanas. Define-se então uma janela de deduplicação — algo entre horas e alguns dias — e apagam-se registros mais antigos. O detalhe que morde: essa janela precisa ser maior que o pior atraso possível de reentrega, incluindo o tempo máximo em que uma mensagem pode ficar parada numa dead letter queue antes de ser reprocessada manualmente. Uma janela de uma hora com DLQ reprocessada no dia seguinte simplesmente não deduplica nada.',
          },
          {
            type: 'table',
            head: ['Garantia', 'Quando confirma', 'Risco', 'Uso típico'],
            rows: [
              ['At-most-once', 'Antes de processar', 'Perder mensagens', 'Métricas, telemetria, logs'],
              ['At-least-once', 'Depois de processar', 'Processar em duplicidade', 'Padrão para quase tudo'],
              ['Efeito exactly-once', 'Depois, com dedup atômica', 'Complexidade e estado extra', 'Pagamentos, contabilidade'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Confiar no rótulo "exactly-once" do broker e escrever um consumidor sem idempotência. A garantia do broker cobre o trajeto dentro dele; o efeito colateral que seu código produz — a linha gravada, o e-mail enviado, a cobrança feita — está fora dessa fronteira. Se o consumidor não é idempotente, uma reentrega vai duplicar o efeito, por mais que a documentação prometa o contrário.',
          },
          {
            type: 'p',
            text: 'A regra prática que sobrevive a qualquer tecnologia: assuma at-least-once e torne o consumidor idempotente. Isso vale independentemente do broker, continua valendo quando você trocar de broker, e transforma reentrega de um bug em um não-evento.',
          },
        ],
        quiz: [
          {
            q: 'Por que não existe um momento seguro para confirmar uma mensagem?',
            a: 'Porque confirmar antes de processar arrisca perder o trabalho se o consumidor morrer em seguida, e confirmar depois arrisca reprocessar se ele morrer entre o processamento e a confirmação. A falha pode ocorrer em qualquer instante entre os dois passos, e não há como torná-los atômicos com um sistema externo.',
          },
          {
            q: 'O que realmente significa "exactly-once" na prática?',
            a: 'Significa efeito exatamente uma vez, não entrega exatamente uma vez. A mensagem pode chegar várias vezes; o que se garante é que o resultado observável é idêntico ao de uma execução única, seja por deduplicação de ids gravada atomicamente com o efeito, seja por a operação ser naturalmente idempotente.',
          },
          {
            q: 'Por que a garantia exactly-once de um sistema de streaming não cobre um e-mail enviado pelo consumidor?',
            a: 'Porque a garantia é transacional dentro das fronteiras daquele sistema — ela liga consumo, processamento e escrita do resultado num commit atômico interno. Um e-mail é um efeito externo, que não participa dessa transação e não pode ser desfeito por um rollback. Uma vez fora, a semântica volta a ser at-least-once.',
          },
        ],
      },
    },
    {
      slug: 'change-data-capture',
      title: 'Change Data Capture (CDC)',
      summary:
        'Transformar o log de transações do banco em stream de eventos, sem dupla escrita.',
      sourceUrl: 'https://www.algomaster.io/learn/system-design',
      content: {
        summary:
          'CDC lê o log de transações do banco e transforma cada mudança em um evento. Isso resolve o problema da dupla escrita, em que gravar no banco e publicar um evento podem divergir.',
        blocks: [
          {
            type: 'p',
            text: 'O problema que o CDC resolve aparece assim que um serviço precisa gravar no banco e avisar alguém. O código natural é gravar e depois publicar. Mas essas duas operações vão para sistemas diferentes e não compartilham transação: se o processo morre entre elas, o banco tem o dado e ninguém foi avisado. Invertendo a ordem, publica-se um evento sobre algo que nunca foi gravado. É o problema da dupla escrita, e não existe ordenação das duas chamadas que o resolva.',
          },
          {
            type: 'key',
            text: 'Sempre que uma operação precisa alterar dois sistemas e não há transação comum, existe uma janela em que eles divergem. A saída é fazer uma única escrita atômica e derivar a segunda dela.',
          },
          {
            type: 'h',
            text: 'Como o CDC funciona',
          },
          {
            type: 'p',
            text: 'Todo banco relacional mantém um log de escrita antecipada — o registro ordenado e durável de tudo que foi alterado, usado para recuperação e replicação. O CDC se conecta a esse log como se fosse mais uma réplica, lê cada alteração confirmada e a converte em um evento: qual tabela, qual operação, valores antes e depois.',
          },
          {
            type: 'p',
            text: 'A propriedade valiosa é que o evento passa a ser *derivado* do commit, e não paralelo a ele. Se a transação commitou, a mudança está no log e o evento será produzido — talvez com atraso, nunca com divergência. Se a transação abortou, nada aparece no log e nenhum evento é gerado. O acordo entre banco e stream deixa de depender do código da aplicação.',
          },
          {
            type: 'p',
            text: 'Isso também significa que a aplicação não precisa saber que o CDC existe: ela grava normalmente. Uma alternativa vinda de um script de manutenção ou de outro serviço também gera evento, o que é uma vantagem real sobre publicar explicitamente no código.',
          },
          {
            type: 'h',
            text: 'O padrão outbox',
          },
          {
            type: 'p',
            text: 'Nem sempre se quer expor mudanças de tabela como contrato público — o esquema interno viraria API, e renomear uma coluna quebraria consumidores. O padrão transactional outbox resolve isso: na mesma transação que altera os dados de negócio, a aplicação insere uma linha numa tabela `outbox` com o evento já no formato de contrato. Por ser a mesma transação, ou os dois acontecem ou nenhum. Um processo separado — via CDC ou por polling da tabela — lê a outbox e publica no broker.',
          },
          {
            type: 'code',
            lang: 'sql',
            code: `BEGIN;
  UPDATE pedidos SET status = 'pago' WHERE id = 42;
  INSERT INTO outbox (tipo, payload)
    VALUES ('PedidoPago', '{"pedidoId":42,"valor":150.00}');
COMMIT;
-- Atômico: ou o pedido muda e o evento existe, ou nada acontece.`,
          },
          {
            type: 'p',
            text: 'O publicador da outbox é at-least-once — ele pode publicar e morrer antes de marcar a linha como enviada, republicando depois. Como sempre, a idempotência mora no consumidor.',
          },
          {
            type: 'table',
            head: ['Abordagem', 'Atomicidade', 'Contrato exposto', 'Custo'],
            rows: [
              ['Dupla escrita no código', 'Nenhuma — pode divergir', 'Controlado', 'Baixo, mas incorreto'],
              ['CDC direto nas tabelas', 'Garantida', 'Esquema interno vaza', 'Conector + operação'],
              ['Outbox + CDC/polling', 'Garantida', 'Controlado pela aplicação', 'Tabela extra e limpeza'],
            ],
          },
          {
            type: 'h',
            text: 'A ordem dos eventos',
          },
          {
            type: 'p',
            text: 'A ordem é a outra propriedade que o CDC preserva e que vale entender bem. Os eventos saem na sequência exata do commit, o que permite reconstruir o estado de forma fiel — mas essa garantia se mantém apenas dentro de uma partição do tópico de destino. Particionando pela chave primária, todas as mudanças de uma mesma linha ficam ordenadas entre si, que é o que importa na prática; mudanças de linhas diferentes, ou de tabelas diferentes, chegam sem ordem relativa. Um consumidor que assume "o pedido sempre chega antes do item do pedido" vai quebrar sob carga.',
          },
          {
            type: 'h',
            text: 'O que custa em operação',
          },
          {
            type: 'p',
            text: 'CDC não é gratuito do lado do banco. O log de transações precisa ser retido até que o conector o tenha lido, então um consumidor parado faz o log crescer sem parar — e um disco cheio de log derruba o banco inteiro, transformando um problema de integração num incidente de produção. Monitorar o atraso de replicação do conector é, portanto, tão crítico quanto monitorar a fila de mensagens. Vale ainda lembrar que o log registra alterações físicas de linha: um `UPDATE` sem `WHERE` numa tabela de dez milhões de registros gera dez milhões de eventos, e uma migração de esquema mal planejada pode inundar o broker em minutos.',
          },
          {
            type: 'p',
            text: 'Além da integração entre serviços, o CDC é a base de vários usos comuns: manter um índice de busca sincronizado com o banco, alimentar um data warehouse quase em tempo real, invalidar cache de forma confiável e fazer migrações com escrita dupla durante a transição.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Expor o esquema das tabelas como contrato de eventos. No dia em que alguém renomear uma coluna ou normalizar uma tabela — uma refatoração interna, aparentemente inofensiva —, todos os consumidores quebram, e o time do banco não tem como saber quem eles são. Publique eventos com formato próprio e estável, via outbox ou via uma camada de transformação, mantendo o esquema interno livre para evoluir.',
          },
        ],
        quiz: [
          {
            q: 'Por que a dupla escrita não pode ser corrigida invertendo a ordem das operações?',
            a: 'Porque a falha pode ocorrer entre as duas operações em qualquer ordem. Gravando primeiro, um crash deixa o dado sem evento; publicando primeiro, um crash deixa o evento sem dado. Como banco e broker não compartilham transação, sempre existe uma janela de divergência — a solução é fazer uma única escrita atômica e derivar a outra dela.',
          },
          {
            q: 'Como o padrão outbox garante atomicidade entre dado e evento?',
            a: 'Porque o evento é inserido numa tabela do próprio banco, dentro da mesma transação que altera os dados de negócio. Sendo a mesma transação, ou ambos são confirmados ou ambos são desfeitos. Um processo separado lê a tabela outbox depois e publica no broker, o que é at-least-once e exige consumidor idempotente.',
          },
          {
            q: 'Qual a vantagem da outbox sobre fazer CDC diretamente nas tabelas de negócio?',
            a: 'A outbox permite que o evento tenha formato próprio e estável, desacoplado do esquema interno. Com CDC direto, o layout das tabelas vira contrato público e qualquer refatoração — renomear coluna, normalizar — quebra consumidores desconhecidos. O custo da outbox é uma tabela extra e a rotina de limpeza das linhas já publicadas.',
          },
        ],
      },
    },
  ],
};

import type { ModuleSeed } from '../types';

export const distribuidos: ModuleSeed = {
  slug: 'sistemas-distribuidos',
  title: 'Sistemas distribuídos',
  goal: 'Lidar com o que só existe quando há mais de uma máquina: detectar falhas, chegar a acordo, coordenar acesso e enxergar o que está acontecendo.',
  lessons: [
    {
      slug: 'heartbeats-e-deteccao-de-falhas',
      title: 'Heartbeats e detecção de falhas',
      summary:
        'Como distinguir um nó morto de um nó lento — e por que essa distinção é impossível de fazer com certeza.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Detectores de falha usam sinais periódicos para inferir se um nó está vivo. Numa rede assíncrona, essa inferência nunca é certeza — só um palpite com prazo.',
        blocks: [
          {
            type: 'p',
            text: 'O mecanismo é simples: cada nó envia periodicamente um sinal de vida, e quem observa marca como suspeito quem parou de sinalizar por mais que um limite. A dificuldade não está no mecanismo, está na inferência. Quando um heartbeat não chega, existem várias explicações possíveis — o nó morreu, o nó está vivo mas travado numa pausa longa de coleta de lixo, a rede descartou o pacote, ou o nó está saudável e apenas lento. De fora, todas são idênticas.',
          },
          {
            type: 'key',
            text: 'Numa rede assíncrona não é possível distinguir com certeza um nó que falhou de um nó que está apenas lento. Todo detector de falhas escolhe entre errar rápido (marcar vivos como mortos) ou errar devagar (demorar a notar mortos de verdade).',
          },
          {
            type: 'p',
            text: 'Esse trade-off aparece direto no valor do timeout. Um limite curto detecta falhas em segundos, mas produz falsos positivos: um pico de latência ou uma pausa de GC derruba um nó saudável da rotação, e a remoção desnecessária pode desencadear failover, rebalanceamento e migração de dados — trabalho caro causado por nada. Um limite longo evita falsos positivos ao custo de manter tráfego indo para um nó morto durante todo o intervalo.',
          },
          {
            type: 'p',
            text: 'Um refinamento útil é o detector de falhas *phi accrual*, que abandona a resposta binária. Em vez de "vivo ou morto", ele acompanha a distribuição histórica dos intervalos entre heartbeats e produz um número — o nível de suspeita — que cresce conforme o silêncio se torna estatisticamente improvável. Isso adapta o limite às condições reais da rede e permite que diferentes partes do sistema ajam com níveis distintos de confiança.',
          },
          {
            type: 'h',
            text: 'Quem observa quem',
          },
          {
            type: 'p',
            text: 'A topologia de observação também importa. Um monitor central é simples, mas concentra a decisão e vira ponto único. Todos observando todos dá redundância, mas o número de mensagens cresce com o quadrado dos nós. A solução comum em clusters grandes é observação em anel — cada nó vigia alguns vizinhos — ou propagação por gossip, em que suspeitas se espalham por contágio e se tornam consenso local sem coordenador.',
          },
          {
            type: 'p',
            text: 'Vale ainda separar suspeita de sentença. Muitos sistemas usam dois estágios: primeiro o nó fica *suspeito* e outro nó é solicitado a confirmar (sondagem indireta); só depois de confirmação independente ele é declarado morto. Isso filtra a maior parte dos falsos positivos causados por um problema pontual de rede entre dois pontos específicos.',
          },
          {
            type: 'h',
            text: 'Calibrando o intervalo e o limite',
          },
          {
            type: 'p',
            text: 'Vale separar dois parâmetros que costumam ser confundidos: o intervalo entre heartbeats e o limite para declarar falha. O intervalo define a resolução temporal e o custo de tráfego — um sinal por segundo num cluster de mil nós já gera mil mensagens por segundo só de manutenção. O limite é normalmente expresso como um múltiplo do intervalo: exigir três batidas perdidas antes de suspeitar tolera a perda ocasional de um pacote sem alongar demais a detecção. Com intervalo de um segundo e limite de três, detecta-se em torno de três segundos; para detectar em trezentos milissegundos seria preciso sinalizar dez vezes por segundo, multiplicando o tráfego por dez.',
          },
          {
            type: 'p',
            text: 'A regra prática é dimensionar o limite pela cauda da distribuição de latência, não pela média. Se o percentil 99,9 do tempo de entrega é de 200ms mas uma pausa de coleta de lixo ocasional dura 1,5 segundo, um limite calibrado em 500ms vai gerar falsos positivos toda vez que o coletor rodar. O número que interessa é a maior interrupção plausível do processo — pausa de GC, checkpoint de disco, congelamento por sobrecarga do host —, e não o tempo típico de rede.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Ajustar o timeout para ser agressivo sem considerar o custo do falso positivo. Se declarar um nó morto dispara eleição de líder, rebalanceamento de partições ou migração de dados, um pico de latência de dois segundos pode custar minutos de instabilidade — e, pior, a carga extra do rebalanceamento aumenta a latência geral, causando novos falsos positivos. É assim que um soluço de rede vira um incidente que se retroalimenta.',
          },
          {
            type: 'p',
            text: 'Por fim, um detalhe operacional que engana muita gente: um heartbeat que só prova que o processo responde não prova que ele funciona. Um nó com o pool de conexões esgotado ou com o disco cheio pode continuar enviando sinais alegremente enquanto falha em 100% do trabalho real. O sinal de vida deve refletir a capacidade de servir, não a de responder.',
          },
        ],
        quiz: [
          {
            q: 'Por que é impossível distinguir com certeza um nó morto de um nó lento?',
            a: 'Porque numa rede assíncrona não há limite superior garantido para o tempo de entrega de uma mensagem nem para o tempo de processamento. A ausência de resposta é compatível tanto com falha quanto com lentidão arbitrária, e nenhuma observação externa separa os dois casos — só a passagem do tempo, que é justamente o que não se pode limitar.',
          },
          {
            q: 'Qual a vantagem de um detector phi accrual sobre um timeout fixo?',
            a: 'Ele produz um nível contínuo de suspeita baseado na distribuição histórica dos intervalos, em vez de uma decisão binária com limite arbitrário. Isso adapta automaticamente a sensibilidade às condições reais da rede e permite que componentes diferentes ajam em níveis distintos de confiança, em vez de compartilhar um único limite mal calibrado.',
          },
          {
            q: 'Por que um timeout agressivo pode causar um incidente que se retroalimenta?',
            a: 'Porque declarar um nó morto costuma disparar trabalho pesado — eleição, rebalanceamento, migração de dados. Esse trabalho consome recursos e aumenta a latência do cluster, o que provoca novos falsos positivos, que disparam mais rebalanceamento. Um pico momentâneo de rede vira instabilidade sustentada.',
          },
        ],
      },
    },
    {
      slug: 'service-discovery',
      title: 'Service discovery',
      summary:
        'Como um serviço encontra o endereço de outro num ambiente onde instâncias nascem e morrem o tempo todo.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Service discovery mantém um registro atualizado de quais instâncias de cada serviço estão vivas e onde, para que os chamadores não precisem de endereços fixos.',
        blocks: [
          {
            type: 'p',
            text: 'Em infraestrutura estática, endereços iam num arquivo de configuração e pronto. Com autoescalamento, contêineres e implantações contínuas, instâncias surgem e desaparecem a todo momento, com IPs novos a cada vez. Configuração estática deixa de funcionar: no momento em que alguém a lê, ela já está errada.',
          },
          {
            type: 'p',
            text: 'A solução é um registro central. Cada instância se anuncia ao subir, informando serviço, endereço e metadados; renova esse anúncio periodicamente; e é removida quando para de renovar ou quando desliga de forma limpa. Quem quer chamar consulta o registro e recebe a lista atual de instâncias saudáveis.',
          },
          {
            type: 'key',
            text: 'O registro sozinho não basta: uma entrada só é útil se refletir a saúde real. Registro sem verificação de saúde é uma lista de endereços que um dia funcionaram.',
          },
          {
            type: 'h',
            text: 'Descoberta do lado do cliente e do lado do servidor',
          },
          {
            type: 'p',
            text: 'Na descoberta do lado do cliente, quem chama consulta o registro, recebe a lista de instâncias e escolhe uma — o balanceamento acontece dentro do próprio cliente. É eficiente porque não há salto extra na rede e permite estratégias sofisticadas de escolha. O custo é que essa lógica precisa existir em cada linguagem e serviço do ecossistema.',
          },
          {
            type: 'p',
            text: 'Na descoberta do lado do servidor, o chamador simplesmente fala com um endereço estável — um balanceador ou um nome DNS interno — e a infraestrutura resolve o resto. O cliente fica trivial, ao custo de um salto adicional e de um componente a operar. É o modelo do Kubernetes, onde um Service dá nome estável a um conjunto mutável de pods.',
          },
          {
            type: 'p',
            text: 'O service mesh é a terceira via, hoje comum: um proxy sidecar ao lado de cada instância faz a descoberta e o balanceamento em nome da aplicação. O cliente conversa com o proxy local como se fosse o destino, e ganha de graça repetição, circuit breaker, mTLS e métricas — sem uma linha de código. O preço é operar mais uma camada e pagar um pouco de latência por salto.',
          },
          {
            type: 'table',
            head: ['Modelo', 'Onde decide', 'Vantagem', 'Custo'],
            rows: [
              ['Cliente', 'Na aplicação chamadora', 'Sem salto extra; escolha sofisticada', 'Biblioteca em cada linguagem'],
              ['Servidor', 'Em um LB ou DNS interno', 'Cliente trivial', 'Salto extra e componente a operar'],
              ['Service mesh', 'Em um proxy sidecar', 'Recursos avançados sem código', 'Complexidade operacional'],
            ],
          },
          {
            type: 'h',
            text: 'Verificação de saúde na prática',
          },
          {
            type: 'p',
            text: 'Existem dois modelos de verificação, e a diferença entre eles é quem toma a iniciativa. No modelo de renovação, a instância envia periodicamente um sinal ao registro dizendo que continua viva, e a entrada expira se o sinal parar — é o que escala melhor, porque o custo se distribui entre as instâncias, mas depende da honestidade de quem se anuncia. No modelo de sondagem, o registro chama um endpoint de cada instância em intervalos fixos e decide por conta própria; é mais confiável e mais caro, já que o número de sondagens cresce com o tamanho da frota.',
          },
          {
            type: 'p',
            text: 'Mais importante que o modelo é o que a verificação de fato verifica. Um endpoint que devolve `200 OK` de um handler estático só prova que o processo aceita conexões — uma instância com o pool do banco esgotado, o disco cheio ou uma dependência crítica fora do ar continuará passando alegremente enquanto falha em todas as requisições reais. Daí a distinção entre dois tipos de sonda: a de vivacidade pergunta "este processo precisa ser reiniciado?" e deve ser deliberadamente burra; a de prontidão pergunta "esta instância pode receber tráfego agora?" e deve checar as dependências essenciais.',
          },
          {
            type: 'h',
            text: 'Quanto tempo leva uma mudança a se propagar',
          },
          {
            type: 'p',
            text: 'A janela em que os chamadores enxergam informação errada é a soma de várias parcelas, e vale calculá-la explicitamente: o intervalo entre verificações, o número de falhas exigido para marcar a instância como ruim, o tempo até o registro propagar a mudança e o TTL do cache local de cada cliente. Verificações a cada dez segundos, três falhas para condenar e cache de trinta segundos dão quase um minuto de tráfego indo para uma instância morta — o que se traduz em erros reais para usuários reais.',
          },
          {
            type: 'p',
            text: 'Há também um trade-off de consistência escondido no registro. Um registro fortemente consistente garante uma visão única e correta, mas fica indisponível durante partições — e ficar sem descoberta é catastrófico, porque nada mais consegue se falar. Um registro AP continua respondendo com informação possivelmente desatualizada, e o chamador lida com instâncias que já morreram tentando outra. Para descoberta, quase sempre se prefere a segunda opção: uma lista levemente velha é muito melhor que lista nenhuma.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Cachear o resultado da descoberta indefinidamente. É tentador guardar a lista de instâncias para evitar consultas, mas sem TTL nem invalidação o cliente continua chamando endereços mortos por muito tempo depois de eles terem sumido. A regra é cachear com validade curta, sempre combinar com repetição em outra instância diante de falha de conexão, e nunca tratar a lista como estável.',
          },
        ],
        quiz: [
          {
            q: 'Por que um registro de serviços costuma preferir disponibilidade a consistência forte?',
            a: 'Porque se o registro fica indisponível durante uma partição, nenhum serviço consegue localizar outro e o sistema inteiro para — uma falha muito pior que a de chamar uma instância que acabou de morrer. Com informação levemente desatualizada, o chamador apenas tenta outra instância e segue. Lista velha é melhor que lista nenhuma.',
          },
          {
            q: 'Qual a diferença prática entre descoberta no cliente e no servidor?',
            a: 'No cliente, a aplicação consulta o registro e escolhe a instância, evitando um salto de rede mas exigindo a lógica implementada em cada linguagem usada. No servidor, o cliente chama um endereço estável e um balanceador ou DNS interno resolve, o que simplifica o cliente ao custo de um salto extra e de um componente adicional a operar.',
          },
          {
            q: 'O que um service mesh acrescenta à descoberta?',
            a: 'Um proxy sidecar ao lado de cada instância assume descoberta e balanceamento, e junto entrega repetição, circuit breaker, mTLS e métricas uniformes sem alterar o código da aplicação. O custo é operar uma camada a mais de infraestrutura e aceitar a latência adicional de cada salto pelo proxy.',
          },
        ],
      },
    },
    {
      slug: 'consenso',
      title: 'Consenso: Raft e Paxos',
      summary:
        'Como um grupo de máquinas concorda sobre um valor mesmo com falhas e mensagens perdidas.',
      sourceUrl: 'https://raft.github.io/raft.pdf',
      content: {
        summary:
          'Consenso é o problema de fazer um grupo de nós concordar sobre um valor de forma que a decisão seja única e definitiva, mesmo com falhas e mensagens perdidas.',
        blocks: [
          {
            type: 'p',
            text: 'Consenso parece um problema acadêmico até você perceber quantas coisas dependem dele. Quem é o líder do cluster? Qual nó é o dono desta partição? Qual é a configuração atual? Qual foi a ordem das transações? Todas essas perguntas exigem uma resposta única, com a qual todo mundo concorda e que não muda depois — que é exatamente a definição de consenso.',
          },
          {
            type: 'p',
            text: 'Um protocolo de consenso precisa garantir três propriedades: só um valor é decidido, o valor decidido foi proposto por alguém, e todo nó correto acaba aprendendo a decisão. Fazer isso com máquinas confiáveis é trivial; o desafio é manter tudo válido quando nós caem, mensagens se perdem e a rede particiona.',
          },
          {
            type: 'key',
            text: 'A ideia central de todos os protocolos práticos é a maioria: qualquer decisão exige o voto de mais da metade dos nós. Como dois grupos majoritários de um mesmo conjunto sempre têm ao menos um nó em comum, é impossível existirem duas decisões conflitantes — o nó compartilhado impede.',
          },
          {
            type: 'p',
            text: 'É por isso que clusters de consenso têm números ímpares de nós. Com cinco nós a maioria é três, então o sistema tolera duas falhas. Com seis nós a maioria é quatro, e ainda se toleram apenas duas falhas — o sexto nó adiciona custo de coordenação sem aumentar a tolerância.',
          },
          {
            type: 'h',
            text: 'Raft',
          },
          {
            type: 'p',
            text: 'Paxos é o protocolo original e é notoriamente difícil de entender e de implementar corretamente. Raft foi desenhado com um objetivo explícito de ser compreensível, e por isso é o que a maioria dos sistemas novos adota. Ele decompõe o problema em três partes: eleição de líder, replicação de log e segurança.',
          },
          {
            type: 'p',
            text: 'Cada nó está em um de três estados: seguidor, candidato ou líder. Um seguidor que fica sem notícias do líder por um tempo aleatório vira candidato, incrementa o número do mandato e pede votos. Se receber votos da maioria, torna-se líder e passa a enviar batidas periódicas para manter a autoridade. O tempo de espera é aleatório de propósito: sem isso, todos os seguidores virariam candidatos ao mesmo tempo, dividiriam os votos e nenhuma eleição terminaria.',
          },
          {
            type: 'p',
            text: 'Com um líder eleito, tudo fica simples: todas as escritas passam por ele, que as anexa ao próprio log e as replica. Quando a maioria confirma ter gravado uma entrada, ela é considerada *committed* e pode ser aplicada — a partir daí ela é permanente, porque qualquer líder futuro precisará dos votos de uma maioria que necessariamente inclui alguém que a possui.',
          },
          {
            type: 'p',
            text: 'O detalhe que garante a segurança é uma restrição na votação: um nó só concede voto a um candidato cujo log seja pelo menos tão atualizado quanto o seu. Isso impede que um nó atrasado se torne líder e sobrescreva entradas já confirmadas — a regra que faz o mandato número N+1 sempre conter tudo que foi decidido até N.',
          },
          {
            type: 'table',
            head: ['Nós no cluster', 'Maioria', 'Falhas toleradas'],
            rows: [
              ['3', '2', '1'],
              ['4', '3', '1'],
              ['5', '3', '2'],
              ['6', '4', '2'],
              ['7', '4', '3'],
            ],
          },
          {
            type: 'p',
            text: 'Vale registrar o custo: consenso é caro. Cada escrita exige pelo menos um round-trip até a maioria dos nós, então a latência é a do nó mediano — e se os nós estão em regiões diferentes, cada operação paga a distância geográfica. Por isso o padrão comum é usar consenso apenas para metadados críticos (quem é o líder, qual a configuração, quem é dono de qual partição) e deixar o tráfego de dados fora dele.',
          },
          {
            type: 'h',
            text: 'O log cresce e precisa ser podado',
          },
          {
            type: 'p',
            text: 'Um detalhe que o resumo do algoritmo esconde: o log de entradas cresce indefinidamente, e reproduzi-lo desde o início a cada reinício se torna inviável em semanas de operação. A solução é o snapshot — gravar periodicamente o estado resultante da aplicação das entradas e descartar o prefixo já incorporado. Isso introduz um caso novo: um seguidor que ficou tempo demais fora do ar pode precisar de entradas que o líder já descartou, e nesse caso ele recebe o snapshot inteiro em vez do trecho de log faltante.',
          },
          {
            type: 'p',
            text: 'Mudar a composição do cluster é o outro ponto notoriamente traiçoeiro. Trocar de "três nós" para "cinco nós" de uma só vez cria um intervalo em que dois subconjuntos diferentes podem cada um se considerar maioria — dois na configuração antiga, três na nova —, o que permite eleger dois líderes simultâneos e corromper o estado. Por isso as mudanças de composição são feitas um nó de cada vez, garantindo que quaisquer duas maiorias consecutivas sempre se sobreponham.',
          },
          {
            type: 'h',
            text: 'Leitura também precisa de cuidado',
          },
          {
            type: 'p',
            text: 'É tentador servir leituras direto do líder sem coordenação, já que ele tem o log mais completo. O problema é que um líder pode ter sido deposto sem saber: isolado por uma partição de rede, ele continua acreditando ser o líder enquanto o resto do cluster já elegeu outro e aceitou escritas novas. Servir leituras nesse estado devolve dados obsoletos com aparência de autoridade.',
          },
          {
            type: 'p',
            text: 'As correções conhecidas são duas. A mais direta é confirmar a liderança com uma troca de mensagens com a maioria antes de responder, o que custa um round-trip por leitura. A mais eficiente é a concessão por tempo: o líder considera-se válido por um intervalo após a última confirmação da maioria e responde localmente dentro dele — barato, mas apoiado na premissa de que os relógios não divergem além de um limite conhecido, que é exatamente o tipo de suposição que sistemas distribuídos costumam violar.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Implementar consenso à mão. É um dos problemas mais sutis da computação distribuída: implementações escritas por especialistas passaram anos com bugs em casos de borda envolvendo mudança de configuração, snapshots e reinícios parciais. Use uma biblioteca ou serviço testado em produção — etcd, ZooKeeper, uma implementação madura de Raft — e reserve seu esforço para o problema do seu produto.',
          },
        ],
        quiz: [
          {
            q: 'Por que exigir maioria impede decisões conflitantes?',
            a: 'Porque quaisquer dois subconjuntos majoritários de um mesmo conjunto necessariamente se sobrepõem em pelo menos um nó. Esse nó comum não pode ter votado em duas decisões conflitantes no mesmo mandato, o que torna impossível que dois valores diferentes sejam decididos simultaneamente.',
          },
          {
            q: 'Por que clusters de consenso usam número ímpar de nós?',
            a: 'Porque a tolerância a falhas depende de manter a maioria, e um nó par extra não aumenta essa tolerância. Com cinco nós a maioria é três e toleram-se duas falhas; com seis a maioria é quatro e ainda se toleram duas. O nó adicional só acrescenta custo de coordenação e latência sem ganho de disponibilidade.',
          },
          {
            q: 'Por que o tempo de espera antes de virar candidato é aleatório no Raft?',
            a: 'Para evitar que todos os seguidores iniciem eleição no mesmo instante ao perder o líder. Se isso ocorresse, os votos se dividiriam, nenhum candidato alcançaria a maioria e a eleição se repetiria indefinidamente. A aleatoriedade faz um nó tipicamente começar antes dos outros e vencer a eleição na primeira rodada.',
          },
        ],
      },
    },
    {
      slug: 'distributed-locking',
      title: 'Locking distribuído',
      summary:
        'Garantir exclusão mútua entre processos em máquinas diferentes, e os perigos de lock com expiração.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Um lock distribuído impede que dois processos em máquinas diferentes executem a mesma seção crítica ao mesmo tempo — e é notoriamente difícil de fazer corretamente.',
        blocks: [
          {
            type: 'p',
            text: 'A necessidade aparece o tempo todo: só uma instância deve rodar aquele job noturno, só um processo deve gerar aquele relatório, só um worker deve processar aquele arquivo. Num único processo, isso é um mutex. Entre máquinas, é preciso um árbitro externo — normalmente Redis, etcd, ZooKeeper ou o próprio banco.',
          },
          {
            type: 'p',
            text: 'A implementação ingênua funciona quase sempre, que é justamente o perigo. Escreve-se uma chave se ela não existir (`SET chave valor NX PX 30000`), faz-se o trabalho, apaga-se a chave. O TTL existe porque, sem ele, um processo que morra segurando o lock o deixaria travado para sempre. Mas é exatamente o TTL que introduz o problema fundamental.',
          },
          {
            type: 'key',
            text: 'Um lock com expiração não garante exclusão mútua. Se o processo A demora mais que o TTL — por uma pausa de GC, uma lentidão de disco ou uma requisição travada —, o lock expira, B o adquire legitimamente, e agora A e B estão os dois na seção crítica. Pior: A não tem como saber disso.',
          },
          {
            type: 'p',
            text: 'Não adianta A verificar se ainda é dono do lock antes de agir: entre a verificação e a ação existe uma janela onde a expiração pode ocorrer. Não há como tornar "checar o lock" e "executar a operação" atômicos quando os dois estão em sistemas diferentes.',
          },
          {
            type: 'h',
            text: 'Adquirir e liberar sem se enganar',
          },
          {
            type: 'p',
            text: 'Há um detalhe na aquisição que quase todo mundo erra na primeira versão: o valor gravado na chave não pode ser arbitrário. Cada processo deve escrever um identificador único e próprio — um UUID gerado na hora —, porque é ele que permite provar a posse no momento da liberação. Sem isso, a liberação vira um `DELETE chave` incondicional, e o cenário ruim é direto: A adquire o lock, sofre uma pausa longa, o TTL expira, B adquire legitimamente, A acorda e apaga a chave. A apagou o lock de B, e agora um terceiro processo pode entrar enquanto B ainda trabalha.',
          },
          {
            type: 'p',
            text: 'A liberação correta é, portanto, condicional: apagar a chave apenas se o valor ainda for o meu. E isso precisa ser atômico — ler o valor, comparar na aplicação e então apagar deixa uma janela entre a comparação e a exclusão em que o lock pode expirar e trocar de dono. Em Redis, o padrão é um script Lua que faz leitura e exclusão numa única execução; em um banco relacional, um `DELETE FROM locks WHERE chave = ? AND dono = ?` resolve pela atomicidade da própria instrução.',
          },
          {
            type: 'h',
            text: 'Fencing token',
          },
          {
            type: 'p',
            text: 'A solução correta desloca a verificação para o recurso protegido. Cada concessão de lock vem acompanhada de um número que só cresce — o fencing token. Ao escrever no recurso, o processo apresenta seu token, e o recurso rejeita qualquer escrita cujo token seja menor que o último que ele já aceitou.',
          },
          {
            type: 'code',
            lang: 'ts',
            code: `// A adquire o lock com token 33 e trava numa pausa longa de GC.
// O TTL expira; B adquire o lock e recebe o token 34.
// B escreve com token 34 → aceito (34 > último visto).
// A acorda e escreve com token 33 → REJEITADO (33 < 34).`,
          },
          {
            type: 'p',
            text: 'Repare no que mudou: o lock deixou de ser a garantia e passou a ser apenas uma otimização para evitar trabalho concorrente. A correção passa a vir do recurso, que se recusa a aceitar escritas obsoletas. Essa é a única forma de tornar exclusão mútua realmente segura — e ela exige cooperação do recurso, que nem sempre existe.',
          },
          {
            type: 'h',
            text: 'Quando o lock não é necessário',
          },
          {
            type: 'p',
            text: 'Antes de implementar locking distribuído, vale checar se ele pode ser evitado, porque quase sempre pode. Se o objetivo é impedir duplicidade, uma restrição de unicidade no banco resolve de forma atômica e sem coordenação externa. Se é atualizar um valor sob concorrência, uma operação atômica condicional (`UPDATE ... WHERE versao = ?`) resolve com controle otimista. Se é garantir um consumidor por item, particionar o trabalho por chave elimina a concorrência por construção.',
          },
          {
            type: 'table',
            head: ['Objetivo', 'Alternativa ao lock'],
            rows: [
              ['Evitar registro duplicado', 'Constraint UNIQUE no banco'],
              ['Atualizar sem sobrescrever', 'Optimistic locking com coluna de versão'],
              ['Um worker por item', 'Particionar a fila por chave'],
              ['Rodar job em uma instância só', 'Eleição de líder (lock de longa duração, não por operação)'],
              ['Seção crítica real e inevitável', 'Lock com fencing token'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Confiar num lock com TTL para proteger uma operação não idempotente e sem fencing. A implementação vai funcionar em todos os testes e na maior parte da produção — e vai falhar silenciosamente no dia em que uma pausa de GC ultrapassar o TTL, duplicando exatamente a operação que o lock existia para proteger. Falhas assim são raras, não deixam rastro e costumam ser descobertas por divergência contábil semanas depois.',
          },
        ],
        quiz: [
          {
            q: 'Por que um lock com TTL não garante exclusão mútua?',
            a: 'Porque o processo que segura o lock pode ser interrompido por tempo maior que o TTL — pausa de GC, lentidão de disco, requisição travada. O lock expira, outro processo o adquire legitimamente, e ambos passam a executar a seção crítica. O primeiro não tem como perceber que perdeu o lock, e verificar antes de agir não resolve porque há janela entre a checagem e a ação.',
          },
          {
            q: 'Como o fencing token torna a exclusão mútua segura?',
            a: 'Cada concessão do lock vem com um número monotonicamente crescente, apresentado ao recurso em cada escrita. O recurso rejeita escritas com token menor que o último aceito, de modo que um processo que perdeu o lock e voltou de uma pausa tem sua escrita recusada. A correção passa a residir no recurso, não no lock.',
          },
          {
            q: 'Cite duas alternativas que eliminam a necessidade de lock distribuído.',
            a: 'Uma restrição de unicidade no banco resolve prevenção de duplicidade de forma atômica e sem coordenação externa. Controle otimista com coluna de versão (`UPDATE ... WHERE versao = ?`) resolve atualização concorrente sem lock. Particionar o trabalho por chave também elimina a concorrência por construção, garantindo um consumidor por item.',
          },
        ],
      },
    },
    {
      slug: 'gossip',
      title: 'Protocolos de gossip',
      summary:
        'Propagar informação por contágio: robusto, escalável e sem coordenador central.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Em gossip, cada nó troca informação periodicamente com alguns pares escolhidos ao acaso. A informação se espalha exponencialmente, sem coordenador e com alta tolerância a falhas.',
        blocks: [
          {
            type: 'p',
            text: 'O nome vem da analogia com fofoca, e ela é precisa. Cada nó, a intervalos regulares, escolhe alguns pares aleatórios e troca o que sabe com eles. Não há coordenador, não há topologia fixa e ninguém tem a visão completa. Ainda assim, uma informação nova alcança todos os nós — e rápido.',
          },
          {
            type: 'p',
            text: 'A velocidade é a parte contraintuitiva. Como cada nó que recebe a informação passa a espalhá-la também, o número de nós informados dobra a cada rodada. Isso significa que a propagação completa leva um número de rodadas proporcional ao logaritmo do tamanho do cluster: informar dez mil nós custa em torno de catorze rodadas, não dez mil.',
          },
          {
            type: 'key',
            text: 'Gossip troca garantia por robustez. Ele não promete quando todos saberão, mas garante que a informação chega mesmo com nós caindo, mensagens se perdendo e a topologia mudando — porque não depende de nenhum caminho específico.',
          },
          {
            type: 'h',
            text: 'Por que é tão resiliente',
          },
          {
            type: 'p',
            text: 'Protocolos com coordenador ou topologia fixa têm caminhos críticos: se o coordenador cai ou um enlace se rompe, a propagação para. Em gossip, cada rodada usa pares diferentes, escolhidos aleatoriamente. Perder um nó ou uma mensagem apenas remove um dos incontáveis caminhos possíveis; a informação segue por outro. Essa redundância probabilística é o que torna o protocolo praticamente indestrutível.',
          },
          {
            type: 'p',
            text: 'O custo é a redundância de mensagens: um nó recebe a mesma informação várias vezes, por caminhos diferentes. É desperdício de banda em troca de tolerância — um bom negócio em clusters grandes, onde as alternativas são frágeis ou caras.',
          },
          {
            type: 'h',
            text: 'Os parâmetros que governam o comportamento',
          },
          {
            type: 'p',
            text: 'Um protocolo de gossip tem basicamente dois botões. O primeiro é o intervalo entre rodadas — normalmente algo entre 100ms e um segundo —, que define a unidade de tempo da propagação. O segundo é o fan-out, o número de pares contatados por rodada: com fan-out 1 a difusão é mais lenta e mais barata; com fan-out 3 ou 4 a cobertura acelera bastante e a tolerância a mensagens perdidas melhora, ao custo proporcional de tráfego. Multiplicando intervalo por log do número de nós obtém-se uma estimativa direta do tempo de convergência: com rodadas de 200ms e mil nós, algo em torno de dois segundos.',
          },
          {
            type: 'p',
            text: 'Um cuidado que aparece em clusters grandes é o tamanho da carga trocada. Se cada rodada envia o estado completo da lista de membros, o tráfego cresce com o quadrado do número de nós e o gossip passa a ser a maior fonte de tráfego do cluster. As técnicas usuais são enviar apenas o delta desde a última troca com aquele par, limitar quantas vezes cada atualização é retransmitida — depois de algumas rodadas, é quase certo que todos já a receberam — e trocar primeiro um resumo compacto, buscando o conteúdo completo só do que estiver realmente desatualizado.',
          },
          {
            type: 'h',
            text: 'Onde se usa',
          },
          {
            type: 'p',
            text: 'Gossip é o mecanismo por trás de várias funções em sistemas distribuídos de larga escala: propagar a lista de membros do cluster (quem entrou, quem saiu), disseminar suspeitas de falha detectadas localmente, distribuir mudanças de configuração e sincronizar metadados como a atribuição de partições. Bancos como Cassandra e sistemas de descoberta em malha usam gossip justamente porque nenhum deles pode depender de um nó central.',
          },
          {
            type: 'p',
            text: 'Vale mencionar o protocolo SWIM, que combina gossip com detecção de falhas de forma elegante. Cada nó sonda um par aleatório periodicamente; se não obtém resposta, pede que outros nós sondem indiretamente antes de declarar suspeita. As informações de membros e suspeitas viajam de carona nas próprias mensagens de sondagem, o que dá detecção rápida e propagação eficiente sem tráfego dedicado.',
          },
          {
            type: 'p',
            text: 'A propriedade que amarra tudo é a consistência eventual: se as atualizações pararem, todos os nós convergem para o mesmo estado. Para que isso valha, as informações trocadas precisam ser reconciliáveis — normalmente com número de versão por nó, para que a informação mais nova sobre cada um sempre vença, independentemente da ordem em que chegou.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Usar gossip para dados que exigem acordo, não apenas difusão. Ele é excelente para espalhar informação que converge — quem está vivo, qual a configuração —, mas não decide nada: não elege líder de forma segura nem garante que uma escrita foi aceita por uma maioria. Para decisões únicas e definitivas, o instrumento é consenso, não gossip.',
          },
        ],
        quiz: [
          {
            q: 'Por que a propagação em gossip é logarítmica no tamanho do cluster?',
            a: 'Porque cada nó informado passa a informar outros, dobrando o número de nós que conhecem a informação a cada rodada. Esse crescimento exponencial significa que o número de rodadas necessárias para cobrir N nós é proporcional a log N — informar dez mil nós custa cerca de catorze rodadas.',
          },
          {
            q: 'O que torna o gossip tão tolerante a falhas comparado a uma topologia fixa?',
            a: 'A escolha aleatória de pares a cada rodada cria uma redundância enorme de caminhos. Não existe enlace ou nó crítico cuja perda interrompa a propagação: perder um deles apenas elimina uma das muitas rotas possíveis, e a informação chega por outra. O custo é receber a mesma informação várias vezes.',
          },
          {
            q: 'Por que gossip não substitui consenso?',
            a: 'Porque gossip difunde informação, mas não decide. Ele garante que todos eventualmente saibam o que foi propagado, sem garantir que exista uma decisão única e definitiva sobre um valor disputado. Eleger líder com segurança ou confirmar que uma escrita foi aceita por maioria exige um protocolo de consenso.',
          },
        ],
      },
    },
    {
      slug: 'circuit-breaker',
      title: 'Circuit breaker',
      summary:
        'Parar de chamar quem já demonstrou estar quebrado, para não desperdiçar recurso nem propagar a falha.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Um circuit breaker monitora as falhas de uma dependência e, ao ultrapassar um limite, passa a rejeitar as chamadas imediatamente em vez de esperar o timeout.',
        blocks: [
          {
            type: 'p',
            text: 'A analogia é com o disjuntor elétrico: quando a corrente passa do limite, ele abre o circuito e interrompe o fluxo, protegendo a instalação. Em software, quando uma dependência começa a falhar de forma consistente, continuar chamando é pior que desistir — cada chamada ocupa uma thread, uma conexão e alguns segundos de timeout, recursos que fazem falta para o tráfego que ainda poderia ser atendido.',
          },
          {
            type: 'key',
            text: 'O circuit breaker existe menos para proteger a dependência e mais para proteger *quem chama*. Sem ele, a lentidão de um serviço secundário consome as threads do serviço principal e derruba tudo — inclusive as funcionalidades que nem dependiam do serviço quebrado.',
          },
          {
            type: 'p',
            text: 'É esse mecanismo de contágio que transforma uma falha pequena em incidente grande. O serviço de recomendações fica lento; cada requisição da home fica presa esperando; as threads da home acabam; a home para de responder por completo, mesmo para usuários que só queriam ver o catálogo. O circuit breaker corta essa cadeia no primeiro elo.',
          },
          {
            type: 'h',
            text: 'Os três estados',
          },
          {
            type: 'p',
            text: 'Fechado é a operação normal: as chamadas passam e o breaker apenas contabiliza sucessos e falhas. Quando a taxa de falha ultrapassa o limite numa janela recente, ele vai para aberto: as chamadas são rejeitadas imediatamente, sem tentar a rede, e o chamador recebe erro ou um valor alternativo na hora. Depois de um intervalo de espera, ele passa a semiaberto: deixa passar um número pequeno de chamadas de teste. Se elas têm sucesso, volta a fechado; se falham, retorna a aberto e o relógio recomeça.',
          },
          {
            type: 'p',
            text: 'O estado semiaberto é a parte engenhosa. Sem ele, seria preciso escolher entre reabrir tudo de uma vez — despejando a carga inteira sobre um serviço que talvez ainda esteja frágil e derrubando-o de novo — ou depender de intervenção humana para religar. As chamadas de teste sondam a recuperação com risco mínimo.',
          },
          {
            type: 'table',
            head: ['Estado', 'Comportamento', 'Transição'],
            rows: [
              ['Fechado', 'Chamadas passam; falhas são contadas', '→ Aberto ao exceder o limite'],
              ['Aberto', 'Chamadas rejeitadas na hora, sem rede', '→ Semiaberto após o intervalo'],
              ['Semiaberto', 'Poucas chamadas de teste passam', '→ Fechado se OK; → Aberto se falha'],
            ],
          },
          {
            type: 'h',
            text: 'O que fazer com o circuito aberto',
          },
          {
            type: 'p',
            text: 'Um circuit breaker sem plano de contingência apenas troca uma falha lenta por uma falha rápida — o que já ajuda, mas está longe do ideal. O valor real aparece quando existe uma alternativa: servir do cache mesmo vencido, devolver um resultado genérico no lugar do personalizado, enfileirar a operação para depois, ou simplesmente omitir aquele trecho da tela. Falhar rápido dá ao sistema a oportunidade de degradar com elegância em vez de travar.',
          },
          {
            type: 'p',
            text: 'A calibragem exige cuidado. Um breaker sensível demais abre com oscilações normais e tira do ar uma dependência saudável; tolerante demais não abre a tempo de evitar a exaustão de recursos. O limite deve considerar volume mínimo — cinco falhas em cinco chamadas não é o mesmo que cinquenta falhas em mil — e ser expresso como proporção numa janela deslizante, não como contagem absoluta.',
          },
          {
            type: 'h',
            text: 'Como a janela é medida',
          },
          {
            type: 'p',
            text: 'A frase "taxa de falha numa janela recente" esconde uma escolha de implementação com consequências visíveis. Uma janela por contagem considera as últimas N chamadas — cem, por exemplo — e é estável independentemente do volume, mas num serviço de baixo tráfego essas cem chamadas podem cobrir meia hora, e o breaker acaba reagindo a falhas que já foram resolvidas. Uma janela por tempo considera tudo que ocorreu nos últimos T segundos, o que reflete melhor o estado atual, mas fica ruidosa quando poucas chamadas caem dentro dela.',
          },
          {
            type: 'p',
            text: 'Daí a importância do volume mínimo, que é o parâmetro mais frequentemente esquecido. Sem ele, duas falhas em duas chamadas dão 100% de taxa de erro e abrem o circuito — quando, na verdade, não há evidência estatística nenhuma. Exigir um mínimo de vinte ou cinquenta chamadas na janela antes de sequer avaliar o limite evita que ruído de baixo volume derrube uma dependência saudável. A configuração completa tem, portanto, quatro números: tamanho da janela, volume mínimo, percentual de falha e tempo em aberto.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Contar timeouts e erros de negócio no mesmo balde. Um 404 ou um 422 são respostas corretas de um serviço saudável; se eles alimentam o contador, um pico de requisições inválidas abre o circuito e derruba uma dependência que está perfeitamente bem. Só falhas de infraestrutura — timeout, conexão recusada, 5xx — devem contar.',
          },
        ],
        quiz: [
          {
            q: 'Por que o circuit breaker protege principalmente quem chama?',
            a: 'Porque cada chamada a uma dependência lenta ocupa thread, conexão e o tempo inteiro do timeout no serviço chamador. Sem o breaker, esses recursos se esgotam e o chamador para de atender inclusive as requisições que não dependem do serviço quebrado — a falha de um componente secundário derruba o principal.',
          },
          {
            q: 'Qual o papel do estado semiaberto?',
            a: 'Testar a recuperação com risco controlado. Ele libera um número pequeno de chamadas: se têm sucesso, o circuito fecha e o tráfego volta ao normal; se falham, ele reabre. Sem esse estágio, seria preciso despejar a carga inteira de uma vez sobre um serviço possivelmente ainda frágil, derrubando-o de novo.',
          },
          {
            q: 'Por que erros de negócio não devem contar para abrir o circuito?',
            a: 'Porque um 404 ou um 422 são respostas corretas de um serviço saudável — indicam problema na requisição, não na dependência. Contá-los faz com que um pico de requisições inválidas abra o circuito e corte o acesso a um serviço que está funcionando perfeitamente. Só falhas de infraestrutura devem alimentar o contador.',
          },
        ],
      },
    },
    {
      slug: 'disaster-recovery',
      title: 'Disaster recovery: RPO e RTO',
      summary:
        'Quanto dado você aceita perder e quanto tempo aceita ficar fora — as duas metas que definem a estratégia.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'RPO define quanto dado se aceita perder; RTO define quanto tempo se aceita ficar indisponível. Juntos, esses dois números determinam a arquitetura e o custo da recuperação.',
        blocks: [
          {
            type: 'p',
            text: 'RPO (Recovery Point Objective) responde "até que ponto no passado podemos voltar?". Um RPO de uma hora significa que, num desastre, aceita-se perder até uma hora de dados. Ele determina a frequência de backup e o tipo de replicação: RPO zero exige replicação síncrona, porque qualquer propagação assíncrona implica uma janela de perda.',
          },
          {
            type: 'p',
            text: 'RTO (Recovery Time Objective) responde "em quanto tempo voltamos a operar?". Um RTO de quinze minutos significa que o serviço precisa estar de pé nesse prazo. Ele determina o grau de automação e o quanto de infraestrutura fica pronta de antemão — restaurar de um backup frio leva horas, e nenhuma pressa manual muda isso.',
          },
          {
            type: 'key',
            text: 'Os dois números são independentes e ambos custam dinheiro. Reduzi-los a zero é tecnicamente possível e economicamente absurdo para a maioria dos sistemas; a decisão certa é definir quanto cada minuto de indisponibilidade e cada hora de dado perdido realmente custam ao negócio.',
          },
          {
            type: 'table',
            head: ['Estratégia', 'RTO típico', 'RPO típico', 'Custo'],
            rows: [
              ['Backup frio (restaurar do zero)', 'Horas a dias', 'Horas', 'Mínimo'],
              ['Pilot light (núcleo mínimo ligado)', 'Dezenas de minutos', 'Minutos', 'Baixo'],
              ['Warm standby (réplica reduzida)', 'Minutos', 'Segundos', 'Médio'],
              ['Multi-região ativo-ativo', 'Quase zero', 'Quase zero', 'Alto'],
            ],
          },
          {
            type: 'h',
            text: 'Backup não é o que você pensa',
          },
          {
            type: 'p',
            text: 'Replicação não é backup. Uma réplica reflete o primário fielmente — inclusive o `DELETE` acidental, que chega ao secundário em milissegundos. Réplicas protegem contra falha de hardware; backups protegem contra erro humano e corrupção lógica, porque contêm um estado de um ponto anterior no tempo.',
          },
          {
            type: 'p',
            text: 'Daí a formulação clássica: três cópias dos dados, em dois tipos de mídia ou sistemas distintos, com pelo menos uma fora do local principal. E, hoje, com pelo menos uma imutável — porque ransomware moderno procura e apaga backups acessíveis antes de criptografar o sistema. Um backup que a aplicação comprometida consegue apagar não é backup.',
          },
          {
            type: 'p',
            text: 'Também vale distinguir a granularidade da recuperação. Restaurar um snapshot devolve o estado de um instante específico; point-in-time recovery, combinando snapshot com o log de transações, permite voltar a qualquer momento — inclusive ao segundo anterior a um comando destrutivo. Para erro humano, essa segunda capacidade é o que realmente salva.',
          },
          {
            type: 'p',
            text: 'Os tipos de backup diferem no que copiam e no que custa restaurar. O completo copia tudo e restaura sozinho, mas ocupa muito espaço e demora a gerar. O incremental copia apenas o que mudou desde o último backup de qualquer tipo — é o mais rápido de produzir e o mais lento de restaurar, porque exige aplicar a cadeia inteira em ordem, e um único elo corrompido invalida tudo que vem depois. O diferencial copia o que mudou desde o último completo, ficando maior a cada dia mas exigindo só duas peças na restauração. O arranjo comum é um completo semanal com incrementais diários, dimensionado de modo que a cadeia mais longa ainda caiba dentro do RTO.',
          },
          {
            type: 'p',
            text: 'Há ainda a distinção entre backup físico e lógico, que muda o que é possível recuperar. O físico copia os arquivos de dados do banco e restaura rápido, mas devolve tudo ou nada e costuma exigir a mesma versão do mecanismo. O lógico exporta comandos ou registros, o que permite restaurar uma única tabela e migrar entre versões, ao custo de um tempo de importação que em bases grandes se mede em horas. Quem só tem backup físico não consegue atender o pedido mais comum do dia a dia, que é recuperar uma tabela específica sem derrubar o resto.',
          },
          {
            type: 'h',
            text: 'O ensaio cronometrado',
          },
          {
            type: 'p',
            text: 'Um teste de restauração que vale alguma coisa tem regras claras. Restaura-se em infraestrutura limpa, nunca sobre o ambiente existente, para que nada de pé disfarce uma dependência ausente. O cronômetro começa no momento da decisão e só para quando a aplicação está servindo tráfego de verdade — não quando o comando de restauração termina, porque migrações, aquecimento de cache e reconfiguração de DNS costumam consumir mais tempo que a cópia dos dados. Ao final, compara-se o número obtido com o RTO declarado e se verifica a integridade por amostragem: contagens de registros, somas de valores, os últimos lançamentos gravados antes do corte.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Ter backup e nunca testar a restauração. É a falha mais comum e mais dolorosa: descobre-se no pior momento que o backup estava vazio há meses, que faltava uma tabela essencial, que ninguém tem a chave de descriptografia ou que restaurar leva doze horas quando o RTO prometido era de uma. Backup não testado é uma hipótese; só a restauração ensaiada é um plano.',
          },
          {
            type: 'p',
            text: 'Por isso o exercício de recuperação deve ser periódico e cronometrado, com o tempo real medido e comparado ao RTO declarado. O mesmo vale para o failover entre regiões: se ele nunca foi acionado de verdade, é bem provável que não funcione — o script tem um bug, a réplica está atrasada, o DNS demora a propagar, ou ninguém tem permissão para executar o procedimento às três da manhã.',
          },
        ],
        quiz: [
          {
            q: 'Qual a diferença entre RPO e RTO?',
            a: 'RPO é quanto dado se aceita perder, medido como uma janela de tempo para trás a partir do desastre — determina a frequência de backup e o tipo de replicação. RTO é quanto tempo se aceita ficar indisponível — determina o grau de automação e a infraestrutura mantida pronta. São independentes: dá para ter RPO de segundos e RTO de horas, ou o contrário.',
          },
          {
            q: 'Por que replicação não substitui backup?',
            a: 'Porque a réplica reproduz fielmente tudo que acontece no primário, inclusive exclusões acidentais e corrupção lógica, que chegam ao secundário em milissegundos. Replicação protege contra falha de hardware; backup protege contra erro humano e corrupção porque preserva um estado de um ponto anterior no tempo.',
          },
          {
            q: 'Por que ao menos uma cópia de backup deve ser imutável?',
            a: 'Porque ataques de ransomware modernos procuram e destroem backups acessíveis antes de criptografar os dados principais, e credenciais comprometidas da aplicação frequentemente alcançam o repositório de backup. Uma cópia imutável — que não pode ser apagada nem sobrescrita durante um período de retenção — é o que garante a existência de um ponto de recuperação.',
          },
        ],
      },
    },
    {
      slug: 'tracing-distribuido',
      title: 'Tracing distribuído',
      summary:
        'Seguir uma requisição por dezenas de serviços para descobrir onde o tempo foi parar.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Tracing distribuído propaga um identificador por toda a cadeia de chamadas, permitindo reconstruir o caminho completo de uma requisição e ver onde o tempo foi gasto.',
        blocks: [
          {
            type: 'p',
            text: 'Num monólito, um stack trace conta a história inteira: quem chamou quem, e quanto demorou. Distribuindo o sistema, essa história se fragmenta em dezenas de processos, cada um com seus próprios logs, sem noção do contexto maior. A pergunta "por que essa requisição levou três segundos?" fica sem resposta, porque cada serviço só enxerga a própria fatia — e nenhum deles parece lento isoladamente.',
          },
          {
            type: 'p',
            text: 'O tracing resolve isso com uma ideia simples. Na borda do sistema, atribui-se um `trace_id` único à requisição. Esse identificador é propagado em cada chamada subsequente, via cabeçalhos HTTP ou metadados de mensagem. Cada unidade de trabalho registra um *span*: um intervalo com nome, início, duração, o id do span pai e atributos relevantes. Juntando todos os spans que compartilham o mesmo trace, reconstrói-se a árvore completa da requisição.',
          },
          {
            type: 'key',
            text: 'A propagação do contexto é a parte crítica e a que sempre quebra. Se um único serviço na cadeia não repassa os cabeçalhos, o trace se rompe ali e tudo depois dele fica órfão — justamente a região onde o problema costuma estar.',
          },
          {
            type: 'p',
            text: 'A visualização resultante — uma cascata de barras — responde perguntas que nenhum log responde. Quais chamadas foram sequenciais e poderiam ser paralelas? Onde estão os 200ms que ninguém explica? Aquele serviço foi chamado quantas vezes, mesmo? É comum descobrir assim um N+1 escondido entre serviços: uma barra pai longa acompanhada de cinquenta barrinhas idênticas embaixo.',
          },
          {
            type: 'h',
            text: 'Amostragem',
          },
          {
            type: 'p',
            text: 'Registrar cada span de cada requisição gera um volume de dados que rivaliza com o tráfego real e custa caro para armazenar. Por isso se usa amostragem. Na amostragem inicial, decide-se no começo da requisição — por exemplo, 1% dos traces — e a decisão é propagada, para que todos os serviços concordem e o trace saia completo ou não exista. É barata, mas descarta cegamente: o trace interessante, aquele que falhou, provavelmente não foi sorteado.',
          },
          {
            type: 'p',
            text: 'A amostragem final decide depois que a requisição terminou, quando já se sabe se ela foi lenta ou deu erro. Isso permite guardar 100% dos traces com falha e dos que passaram de um limite de latência, junto de uma pequena amostra dos normais para comparação. É muito mais útil e mais caro, porque exige reter todos os spans em memória até a decisão.',
          },
          {
            type: 'h',
            text: 'Onde a propagação se rompe',
          },
          {
            type: 'p',
            text: 'A propagação se rompe em lugares previsíveis, e conhecê-los economiza horas. Fronteiras assíncronas são as piores: ao publicar numa fila, o contexto precisa ser copiado explicitamente para os cabeçalhos da mensagem e recuperado do outro lado, porque nada o carrega automaticamente. Pools de threads e execuções em segundo plano perdem o contexto quando ele está preso a uma variável de escopo local. Clientes HTTP escritos à mão, sem a instrumentação da biblioteca padrão, simplesmente não enviam o cabeçalho. E qualquer proxy ou gateway que filtre cabeçalhos desconhecidos corta a cadeia sem avisar ninguém.',
          },
          {
            type: 'h',
            text: 'Atributos e cardinalidade',
          },
          {
            type: 'p',
            text: 'Aqui existe uma inversão em relação a métricas que costuma ser mal compreendida. Numa métrica, cada combinação de rótulos cria uma série temporal separada, e colocar o id do usuário como rótulo gera milhões delas, derrubando o sistema de monitoramento. Num trace, atributos de alta cardinalidade são precisamente o que dá valor: `usuario.id`, `pedido.id`, `tenant`, a região, a versão do build. É o que permite sair de "a latência subiu" para "subiu apenas para os clientes deste plano, nesta região, desde o deploy de ontem" — uma pergunta que nenhuma métrica agregada responde.',
          },
          {
            type: 'table',
            head: ['Sinal', 'Responde', 'Custo'],
            rows: [
              ['Métrica', 'Quantos e quão rápido, agregado', 'Baixo — números pré-agregados'],
              ['Log', 'O que aconteceu neste ponto', 'Médio — cresce com o tráfego'],
              ['Trace', 'Por onde passou e onde demorou', 'Alto — exige amostragem'],
            ],
          },
          {
            type: 'p',
            text: 'Os três sinais se complementam e ficam muito mais fortes quando correlacionados. A prática que mais rende com menos esforço é incluir o `trace_id` em cada linha de log: a partir de um trace lento, chega-se instantaneamente a todos os logs daquela requisição específica, em todos os serviços, sem caçar por horário aproximado. Devolver esse mesmo id ao cliente na resposta de erro fecha o ciclo — o usuário reporta o id e o time vai direto ao ponto.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Instrumentar só as bordas. Um trace com dois spans — "requisição recebida" e "requisição concluída" — confirma que demorou três segundos e não diz nada sobre onde. O valor está na granularidade: consultas ao banco, chamadas a serviços, acessos a cache e trechos de processamento pesado precisam ter spans próprios, ou o trace vira um relógio caro.',
          },
        ],
        quiz: [
          {
            q: 'O que acontece quando um serviço no meio da cadeia não propaga o contexto de trace?',
            a: 'O trace se rompe naquele ponto: tudo que acontece depois gera spans órfãos, sem ligação com a requisição original, ou inicia um trace novo e desconexo. Como o serviço que não propaga costuma ser justamente o menos instrumentado, a parte perdida é frequentemente onde o problema está.',
          },
          {
            q: 'Qual a vantagem da amostragem final sobre a inicial?',
            a: 'A decisão é tomada depois que a requisição terminou, quando já se sabe se ela falhou ou foi lenta. Isso permite reter 100% dos traces problemáticos — exatamente os que interessam — junto de uma amostra dos normais. A amostragem inicial sorteia às cegas e quase sempre descarta o trace que você precisaria ver.',
          },
          {
            q: 'Por que incluir o trace_id nos logs é tão valioso?',
            a: 'Porque correlaciona os dois sinais: a partir de um trace lento chega-se imediatamente a todas as linhas de log daquela requisição específica, em todos os serviços, sem filtrar por horário aproximado e sem adivinhar quais entradas pertencem a qual requisição. Devolver o id ao cliente em respostas de erro estende essa rastreabilidade até o suporte.',
          },
        ],
      },
    },
  ],
};

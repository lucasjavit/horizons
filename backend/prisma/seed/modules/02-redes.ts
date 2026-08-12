import type { ModuleSeed } from '../types';

export const redes: ModuleSeed = {
  slug: 'fundamentos-de-rede',
  title: 'Fundamentos de rede',
  goal: 'Entender o caminho que um byte percorre entre o navegador e o servidor, e saber decidir sobre DNS, proxies, protocolos de transporte e balanceamento com base em como a rede realmente funciona.',
  lessons: [
    {
      slug: 'camadas-de-rede',
      title: 'Camadas: do cabo ao HTTP',
      summary:
        'O modelo OSI, o modelo TCP/IP real e por que a abstração em camadas importa para quem projeta sistemas.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Redes são organizadas em camadas: cada uma resolve um problema e entrega uma abstração para a de cima. Saber em que camada cada componente atua explica o que ele pode e o que não pode fazer.',
        blocks: [
          {
            type: 'p',
            text: 'O modelo OSI descreve sete camadas — física, enlace, rede, transporte, sessão, apresentação e aplicação. É um modelo didático: a internet real implementa quatro camadas do modelo TCP/IP (enlace, internet, transporte e aplicação). Ainda assim vale conhecer a numeração do OSI, porque o jargão da indústria a usa o tempo todo: "load balancer L4", "regra L7", "switch L2".',
          },
          {
            type: 'p',
            text: 'A ideia central da estratificação é que cada camada só conversa com a camada equivalente do outro lado, usando os serviços da camada de baixo. O navegador fala HTTP com o servidor como se houvesse um canal direto; abaixo, o TCP finge que existe um fluxo confiável de bytes; abaixo dele, o IP entrega pacotes individuais sem garantia nenhuma; abaixo, Ethernet ou Wi-Fi move quadros entre dois pontos fisicamente conectados. Cada camada mente um pouquinho para a de cima — e é exatamente essa mentira útil que torna a internet construível.',
          },
          {
            type: 'table',
            head: ['Camada', 'Unidade', 'Endereço', 'Exemplos'],
            rows: [
              ['L2 — Enlace', 'Quadro', 'MAC', 'Ethernet, Wi-Fi, switch'],
              ['L3 — Rede', 'Pacote', 'IP', 'IPv4/IPv6, roteador, BGP'],
              ['L4 — Transporte', 'Segmento', 'IP + porta', 'TCP, UDP, QUIC'],
              ['L7 — Aplicação', 'Mensagem', 'URL, hostname', 'HTTP, gRPC, DNS, TLS(-ish)'],
            ],
          },
          {
            type: 'key',
            text: 'A camada em que um componente atua define o que ele consegue enxergar. Um balanceador L4 só vê IP e porta — é rápido e cego ao conteúdo. Um balanceador L7 lê a requisição HTTP inteira, e por isso pode rotear por caminho, cabeçalho ou cookie, ao custo de terminar a conexão e processar mais.',
          },
          {
            type: 'h',
            text: 'O que acontece ao abrir uma página',
          },
          {
            type: 'p',
            text: 'Vale percorrer o caminho completo uma vez, porque cada etapa é um lugar onde a latência nasce e onde algo pode quebrar. Primeiro, resolução DNS: transformar o nome em um endereço IP, possivelmente com várias consultas em cadeia. Depois, o handshake TCP — três mensagens (SYN, SYN-ACK, ACK) antes de qualquer byte útil, o que custa um round-trip inteiro. Em seguida o handshake TLS, mais um ou dois round-trips para negociar cifra e validar o certificado. Só então a requisição HTTP é enviada, o servidor processa e responde.',
          },
          {
            type: 'p',
            text: 'Somando: numa conexão intercontinental de 150ms de RTT, o usuário espera facilmente meio segundo antes do primeiro byte útil, sem que o servidor tenha demorado nada. É por isso que existem CDNs (aproximar o ponto de terminação), keep-alive (reaproveitar a conexão), TLS 1.3 (reduzir para um round-trip) e QUIC (juntar transporte e criptografia em um único handshake). Toda essa engenharia serve para atacar round-trips, não processamento.',
          },
          {
            type: 'h',
            text: 'Encapsulamento e o tamanho do pacote',
          },
          {
            type: 'p',
            text: 'Na descida, cada camada embrulha o dado da camada acima com seu próprio cabeçalho — a mensagem HTTP vira payload do segmento TCP, que vira payload do pacote IP, que vira payload do quadro Ethernet. Na subida do outro lado, cada camada desembrulha o seu e entrega o miolo para cima. Esse empilhamento tem custo: entre 20 e 60 bytes de cabeçalho IP, mais 20 ou mais de TCP, mais o quadro. Para uma requisição de 30 bytes, o overhead supera o conteúdo, o que explica por que protocolos de métrica e telemetria preferem agrupar amostras em lotes maiores.',
          },
          {
            type: 'p',
            text: 'O tamanho máximo do quadro em cada enlace é o MTU, tipicamente 1500 bytes em Ethernet. Quando um pacote maior precisa atravessar um enlace com MTU menor, ele é fragmentado ou descartado, e é aí que nasce uma classe de falha particularmente traiçoeira: o handshake funciona, conexões pequenas funcionam, e requisições grandes travam sem erro claro. A causa costuma ser um túnel (VPN, encapsulamento de rede virtual) que reduziu o MTU efetivo enquanto as mensagens ICMP que avisariam disso estão bloqueadas por firewall — o chamado buraco negro de PMTU.',
          },
          {
            type: 'h',
            text: 'Diagnosticar por camada',
          },
          {
            type: 'p',
            text: 'A utilidade prática do modelo aparece na hora de investigar. Um sintoma de "o serviço não responde" tem causas completamente diferentes conforme a camada, e testar de baixo para cima elimina metade das hipóteses rapidamente. Se o `ping` chega, L3 está de pé e o problema não é rota. Se a porta aceita conexão mas nada responde, o transporte funciona e a suspeita vira aplicação ou TLS. Se o handshake TLS falha, o assunto é certificado, cadeia ou SNI — e não firewall.',
          },
          {
            type: 'p',
            text: 'Duas assinaturas valem memorizar porque se confundem. Conexão recusada de imediato significa que o pacote chegou ao host e alguém respondeu ativamente que não há ninguém escutando naquela porta — o serviço está fora, mas a rede está boa. Já um timeout silencioso significa que o pacote sumiu sem resposta, o que aponta para firewall descartando, rota errada ou host inexistente. Erro rápido é problema de aplicação; silêncio é problema de rede.',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Ignorar o custo de estabelecer conexão. Um serviço que abre uma conexão TCP+TLS nova a cada chamada interna paga dois ou três round-trips por requisição — muitas vezes mais que o próprio trabalho. Pools de conexão e keep-alive não são detalhe de tuning: costumam ser a maior otimização de latência disponível em arquiteturas de microsserviços.',
          },
        ],
        quiz: [
          {
            q: 'Por que um load balancer L7 consegue rotear por caminho de URL e um L4 não?',
            a: 'Porque o caminho da URL é informação da camada de aplicação, presente no corpo da requisição HTTP. O L4 decide olhando apenas cabeçalhos de IP e porta, sem abrir o payload — o que o torna mais rápido e agnóstico a protocolo, mas incapaz de tomar decisões baseadas em conteúdo. Para ler HTTP, o L7 precisa terminar a conexão TCP e o TLS.',
          },
          {
            q: 'Um serviço interno na mesma região tem RTT de 1ms, mas cada chamada leva 5ms mesmo sem processamento. O que provavelmente está acontecendo?',
            a: 'Provavelmente a conexão está sendo aberta do zero a cada chamada: handshake TCP (1 RTT) mais handshake TLS (1–2 RTTs) já explicam vários milissegundos antes de qualquer byte de aplicação. A correção é usar pool de conexões com keep-alive, reaproveitando conexões já estabelecidas.',
          },
        ],
      },
    },
    {
      slug: 'dns',
      title: 'DNS',
      summary:
        'Como um nome vira endereço, por que o TTL é uma decisão de arquitetura e como o DNS é usado (e mal usado) para balanceamento.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'O DNS é um banco de dados distribuído e hierárquico que traduz nomes em endereços. Sua semântica de cache por TTL faz dele um mecanismo poderoso de roteamento — e uma fonte notória de incidentes.',
        blocks: [
          {
            type: 'p',
            text: 'Quando um cliente precisa resolver `api.exemplo.com`, ele pergunta a um resolver recursivo (do provedor, da empresa ou público). Se o resolver não tem a resposta em cache, ele percorre a hierarquia: pergunta a um servidor raiz quem cuida de `.com`, pergunta ao servidor de `.com` quem cuida de `exemplo.com`, e finalmente pergunta ao servidor autoritativo daquele domínio pelo registro de `api`. A resposta volta com um TTL, e todo mundo no caminho pode guardá-la por esse tempo.',
          },
          {
            type: 'p',
            text: 'Os tipos de registro que aparecem no dia a dia são poucos: A (nome → IPv4), AAAA (nome → IPv6), CNAME (nome → outro nome), MX (servidores de e-mail), TXT (verificações e políticas) e NS (delegação de zona). Vale lembrar uma restrição prática: um CNAME não pode coexistir com outros registros no mesmo nome, e por isso não se usa CNAME no domínio raiz — daí a existência de extensões proprietárias como ALIAS ou ANAME nos provedores de DNS.',
          },
          {
            type: 'key',
            text: 'O TTL é o botão que controla o trade-off entre velocidade de mudança e carga/latência: TTL alto significa menos consultas e respostas mais rápidas, mas mudanças que demoram a propagar; TTL baixo dá agilidade de failover ao custo de mais tráfego DNS.',
          },
          {
            type: 'h',
            text: 'Recursivo e autoritativo: dois papéis distintos',
          },
          {
            type: 'p',
            text: 'Vale separar bem os dois lados, porque quem opera um serviço lida com eles de formas opostas. O resolver recursivo trabalha para o cliente: aceita a pergunta, faz a caçada pela hierarquia e devolve a resposta final, mantendo um cache enorme para não repetir o trabalho. O servidor autoritativo trabalha para o dono do domínio: não pergunta nada a ninguém, apenas responde sobre as zonas que administra. Quando você configura um registro no painel do provedor, está mexendo no autoritativo; quando reclama que "a mudança não propagou", está falando do cache dos milhares de recursivos espalhados pelo mundo.',
          },
          {
            type: 'p',
            text: 'Um detalhe que morde em produção é a resolução negativa. Quando um nome não existe, a resposta NXDOMAIN também é cacheada — e por um tempo que não vem do registro consultado, e sim do campo de TTL mínimo do registro SOA da zona. Criar um subdomínio depois que alguém já tentou acessá-lo faz o erro persistir por minutos ou horas mesmo com o registro já publicado. Por isso a ordem correta ao lançar algo é publicar o registro antes de divulgar o endereço, nunca o contrário.',
          },
          {
            type: 'h',
            text: 'Anycast: um endereço, muitos lugares',
          },
          {
            type: 'p',
            text: 'A infraestrutura de DNS moderna depende de anycast, e entender o mecanismo ajuda em muito mais do que DNS. A ideia é anunciar o mesmo endereço IP a partir de dezenas de localidades físicas simultaneamente, deixando o roteamento da própria internet (BGP) escolher a instância mais próxima de cada cliente em termos de topologia de rede. Não há decisão de software envolvida: o pacote simplesmente chega ao datacenter cujo anúncio parecia mais curto para o roteador do caminho.',
          },
          {
            type: 'p',
            text: 'O ganho é triplo — latência baixa porque a resposta vem de perto, resiliência porque retirar o anúncio de um site desvia o tráfego em segundos sem depender de TTL, e absorção de ataques volumétricos porque o tráfego malicioso se dilui entre todos os pontos em vez de concentrar em um. É assim que os treze servidores raiz do DNS, que são treze *endereços* e não treze máquinas, sustentam centenas de instâncias mundo afora. A limitação é que anycast funciona bem para trocas curtas e sem estado; para conexões longas, uma mudança de rota no meio do caminho pode levar os pacotes a outra instância, que não conhece aquela conexão.',
          },
          {
            type: 'h',
            text: 'DNS como ferramenta de roteamento',
          },
          {
            type: 'p',
            text: 'Como o servidor autoritativo pode responder coisas diferentes para clientes diferentes, o DNS vira uma camada de balanceamento global. Round-robin devolve IPs alternados para espalhar carga de forma grosseira. Roteamento por geografia ou latência devolve o endereço da região mais próxima do resolver. Failover baseado em health check remove o IP de uma região que caiu. É assim que quase toda estratégia multi-região começa.',
          },
          {
            type: 'p',
            text: 'A limitação é que o DNS não sabe nada sobre o estado real de cada conexão e não pode reagir depressa: entre a decisão de tirar um IP do ar e o último cliente parar de usá-lo existe o TTL — e clientes que ignoram TTL, o que é comum. Navegadores, sistemas operacionais e até bibliotecas de JVM já foram famosos por cachear resoluções por tempo indeterminado.',
          },
          {
            type: 'table',
            head: ['TTL', 'Efeito bom', 'Efeito ruim'],
            rows: [
              ['60s ou menos', 'Failover rápido, migrações ágeis', 'Muito tráfego de DNS; latência extra em cada resolução fria'],
              ['300–900s', 'Equilíbrio usado pela maioria', 'Janela de minutos numa troca de emergência'],
              ['1 dia ou mais', 'Carga mínima, resolução quase sempre em cache', 'Mudar de endereço vira operação de dias'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Descobrir na hora do incidente que o TTL era de 24 horas. A hora de baixar o TTL é *antes* da migração — reduza para 60s com um ou dois dias de antecedência, faça a troca, depois volte ao valor normal. Baixar o TTL durante o incidente não ajuda: os resolvers ainda estão segurando o valor antigo, com o TTL antigo.',
          },
          {
            type: 'p',
            text: 'Vale registrar também que o DNS é um SPOF global clássico. Ele fica fora do caminho de dados, então é fácil esquecê-lo nos diagramas, mas se a resolução falha nada mais importa — nenhum cliente chega ao sistema. Daí as práticas de usar mais de um provedor autoritativo, monitorar a expiração do domínio com a mesma seriedade de um certificado TLS, e testar o comportamento da aplicação quando a resolução falha em vez de assumir que ela sempre funciona.',
          },
        ],
        quiz: [
          {
            q: 'Você precisa migrar um serviço para outro IP na próxima terça. Qual é a sequência correta de mudanças de TTL?',
            a: 'Alguns dias antes, baixar o TTL para algo como 60s e esperar o TTL antigo expirar por completo — só então os resolvers estarão respeitando o valor curto. Na terça, trocar o registro; a propagação leva cerca de um minuto. Depois de confirmar a estabilidade, restaurar o TTL para o valor normal, para não pagar tráfego e latência de resolução permanentemente.',
          },
          {
            q: 'Por que balanceamento por DNS não substitui um load balancer?',
            a: 'Porque o DNS decide antes da conexão existir e não enxerga o estado dela: não sabe quantas requisições cada servidor está atendendo, não pode retirar tráfego instantaneamente (o TTL e os caches dos clientes atrasam), e distribui por resolver, não por usuário. Serve para distribuição grosseira e roteamento geográfico; o balanceamento fino continua sendo trabalho de um LB na frente dos servidores.',
          },
        ],
      },
    },
    {
      slug: 'proxy-e-reverse-proxy',
      title: 'Proxy vs reverse proxy',
      summary:
        'Dois componentes com o mesmo mecanismo e propósitos opostos: um protege o cliente, o outro protege o servidor.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Proxy direto age em nome do cliente e é configurado por ele; reverse proxy age em nome do servidor e é transparente para quem chama. A diferença é de quem está do lado escondido.',
        blocks: [
          {
            type: 'p',
            text: 'Um proxy (forward proxy) fica entre o cliente e a internet. O cliente sabe que ele existe — precisa configurá-lo — e todas as requisições passam por ele. É o componente que empresas usam para filtrar acesso, registrar navegação e aplicar políticas, e que ferramentas de privacidade usam para esconder o IP de origem. O servidor de destino vê o proxy como se fosse o cliente.',
          },
          {
            type: 'p',
            text: 'Um reverse proxy fica na frente de um conjunto de servidores. O cliente não sabe que ele existe: acredita estar falando diretamente com a aplicação. É ele quem recebe a conexão, decide para qual backend encaminhar e devolve a resposta. É o componente mais onipresente de qualquer arquitetura web séria — nginx, Envoy, HAProxy, Traefik e os balanceadores gerenciados de nuvem são todos reverse proxies.',
          },
          {
            type: 'key',
            text: 'Regra prática: se o cliente configurou, é forward proxy. Se o dono do servidor instalou e o cliente nem sabe, é reverse proxy.',
          },
          {
            type: 'h',
            text: 'O que um reverse proxy resolve',
          },
          {
            type: 'list',
            items: [
              'Balanceamento de carga entre réplicas do backend, com health check para tirar as instâncias doentes.',
              'Terminação TLS: centraliza certificados e tira o custo de criptografia da aplicação.',
              'Cache de respostas estáticas ou semi-estáticas, aliviando o backend.',
              'Compressão (gzip, brotli) sem código na aplicação.',
              'Rate limiting e bloqueio de tráfego abusivo antes de chegar ao serviço.',
              'Roteamento por caminho ou hostname: `/api` para um serviço, `/` para o frontend, sem expor portas diferentes.',
              'Ponto único para observabilidade: logs de acesso e métricas de latência de todo o tráfego.',
            ],
          },
          {
            type: 'p',
            text: 'É importante notar que essas responsabilidades se sobrepõem às de um API gateway. A distinção é mais de escopo do que de tecnologia: o reverse proxy opera no nível do tráfego HTTP (rotear, cachear, proteger), enquanto o gateway acrescenta preocupações de produto de API — autenticação, quotas por cliente, versionamento, agregação de chamadas. Na prática, muitos gateways são reverse proxies com plugins.',
          },
          {
            type: 'h',
            text: 'Buffering, timeouts e o que o proxy faz com a conexão',
          },
          {
            type: 'p',
            text: 'Um efeito pouco comentado do reverse proxy é o desacoplamento entre a conexão do cliente e a do backend. Como ele termina a conexão de fora e abre outra para dentro, pode absorver clientes lentos: recebe a requisição inteira em seu próprio buffer e só então repassa ao backend, que responde depressa e libera a thread. Sem isso, um cliente em rede móvel ruim enviando um upload de 5MB ocupa um worker da aplicação por trinta segundos. É a defesa natural contra ataques do tipo Slowloris, que derrubam servidores mantendo centenas de conexões abertas enviando um byte por vez.',
          },
          {
            type: 'p',
            text: 'Esse mesmo buffering, porém, atrapalha quando a resposta é um fluxo. Streaming de eventos (SSE), respostas de LLM token a token e downloads longos precisam que o proxy repasse os bytes conforme chegam; com buffer de resposta ligado, o cliente não vê nada até o fim e a funcionalidade simplesmente parece travada. Toda configuração de nginx e Envoy tem uma chave para desligar o buffering por rota, e é um dos ajustes mais esquecidos em produção.',
          },
          {
            type: 'p',
            text: 'Timeouts também passam a existir em duas camadas, e desalinhá-los produz erros confusos. Se o proxy corta em 30 segundos e a aplicação em 60, o usuário recebe 504 enquanto o backend segue trabalhando numa requisição que ninguém mais está esperando — inclusive gravando efeitos colaterais. A regra é que o timeout de quem está na frente seja igual ou ligeiramente maior que o de quem está atrás, e que o cancelamento se propague, para que a aplicação abandone o trabalho quando o cliente desiste.',
          },
          {
            type: 'p',
            text: 'Um segundo cuidado é com a identidade do host. O reverse proxy recebe a requisição para `loja.exemplo.com` e a encaminha para um backend que atende em `10.0.1.7:8080`; se ele reescrever o cabeçalho `Host` com o endereço interno, a aplicação passa a gerar links absolutos e redirecionamentos apontando para um endereço que o usuário não alcança. O mesmo vale para o esquema: atrás de uma terminação TLS, o backend recebe HTTP puro e conclui que a conexão é insegura, gerando redirecionamentos para `https` que voltam ao proxy e viram um laço infinito. Daí a existência dos cabeçalhos `X-Forwarded-Proto` e `X-Forwarded-Host`, que precisam ser enviados pelo proxy e lidos pela aplicação.',
          },
          {
            type: 'p',
            text: 'Há ainda um caso limítrofe que confunde muita gente: o proxy transparente. Ele intercepta o tráfego no caminho, sem configuração no cliente e sem ser o destino nominal da conexão — comum em redes corporativas e provedores. Age em nome do cliente, como um forward proxy, mas é invisível como um reverse proxy, e por isso costuma ser a causa oculta de comportamentos estranhos: cabeçalhos reescritos, conexões WebSocket derrubadas por inatividade, respostas servidas de um cache que ninguém sabia que existia.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'Forward proxy', 'Reverse proxy'],
            rows: [
              ['Age em nome de', 'Cliente', 'Servidor'],
              ['Quem configura', 'O cliente', 'O operador do serviço'],
              ['Esconde', 'A identidade do cliente', 'A topologia do backend'],
              ['Uso típico', 'Filtro corporativo, privacidade, cache de saída', 'Balanceamento, TLS, cache, rate limit'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Esquecer que, atrás de um reverse proxy, o IP visto pela aplicação é o do proxy — não o do usuário. Rate limiting, geolocalização e logs de auditoria passam a operar sobre um punhado de IPs internos. A correção é propagar o IP original (`X-Forwarded-For` ou o header `Forwarded`) e configurar a aplicação para confiar nele — mas *só* quando vier de um proxy confiável, porque esse header é trivialmente forjável por um cliente malicioso.',
          },
        ],
        quiz: [
          {
            q: 'Um sistema de rate limiting por IP passou a bloquear usuários legítimos em massa após a introdução de um load balancer. Qual a causa provável?',
            a: 'A aplicação está lendo o IP da conexão, que agora é o do load balancer, e não o do usuário. Todos os usuários aparecem como o mesmo punhado de IPs e estouram o limite coletivamente. A correção é ler o IP original do cabeçalho X-Forwarded-For, confiando nele apenas quando a conexão vem de um proxy conhecido.',
          },
          {
            q: 'Por que terminar TLS no reverse proxy costuma ser vantajoso?',
            a: 'Centraliza a gestão de certificados (renovação em um lugar em vez de em cada instância), tira o custo de CPU da criptografia da aplicação, permite inspecionar e rotear por conteúdo HTTP, e habilita cache e compressão. O contraponto é que o tráfego entre proxy e backend passa a ser interno — em ambientes de confiança zero, ele é recriptografado no segundo salto.',
          },
        ],
      },
    },
    {
      slug: 'tcp-vs-udp',
      title: 'TCP vs UDP',
      summary:
        'Confiabilidade tem preço: quando vale a pena abrir mão de garantias de entrega.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'TCP entrega um fluxo ordenado e confiável ao custo de handshake, retransmissões e controle de congestionamento. UDP entrega datagramas sem garantia nenhuma, e por isso é mais rápido e mais flexível.',
        blocks: [
          {
            type: 'p',
            text: 'TCP oferece quatro garantias que a camada IP não dá: entrega confiável (o que se perde é retransmitido), ordenação (os bytes chegam na sequência enviada), controle de fluxo (o emissor não afoga o receptor lento) e controle de congestionamento (o emissor recua quando a rede está saturada). Para isso mantém estado dos dois lados, numera bytes, confirma recebimentos e estabelece a conexão com o handshake de três vias.',
          },
          {
            type: 'p',
            text: 'UDP não oferece nada disso. Envia datagramas e esquece: pacotes podem se perder, chegar fora de ordem ou duplicados, e ninguém avisa. Em troca, não há handshake (o primeiro pacote já carrega dados), não há estado de conexão a manter, não há retransmissão atrasando o que veio depois, e o cabeçalho é minúsculo.',
          },
          {
            type: 'key',
            text: 'A pergunta que decide: um dado atrasado ainda tem valor? Se sim, use TCP. Se um pacote que chega tarde já é inútil — o quadro de vídeo daquele instante, a posição do jogador dois segundos atrás —, retransmiti-lo só atrapalha, e UDP é a escolha certa.',
          },
          {
            type: 'h',
            text: 'O handshake e o custo de começar',
          },
          {
            type: 'p',
            text: 'O handshake de três vias existe para que os dois lados combinem números de sequência iniciais e confirmem que há um caminho de ida e volta funcionando. O cliente manda SYN com seu número inicial, o servidor responde SYN-ACK com o dele, o cliente confirma com ACK — e só aí os dados podem seguir. O custo é um round-trip completo antes do primeiro byte útil, o que numa conexão intercontinental de 150ms significa 150ms gastos em pura formalidade. Sobre isso ainda vem o TLS, e é essa soma que torna pool de conexões e keep-alive tão determinantes de latência.',
          },
          {
            type: 'p',
            text: 'O encerramento é assimétrico e tem uma consequência operacional conhecida. Cada lado fecha sua direção separadamente (FIN e ACK dos dois lados), e quem fecha primeiro fica em TIME_WAIT por volta de um a dois minutos, segurando a porta para que segmentos atrasados de uma conexão morta não sejam confundidos com uma nova. Em servidores que abrem muitas conexões de saída de vida curta, esse estado acumula às dezenas de milhares e chega a esgotar portas efêmeras — outro argumento a favor de reaproveitar conexões em vez de abrir uma por chamada.',
          },
          {
            type: 'h',
            text: 'Controle de congestionamento',
          },
          {
            type: 'p',
            text: 'A parte mais sofisticada do TCP é descobrir sozinho a que velocidade pode transmitir, já que ninguém informa a capacidade do caminho. A conexão começa em slow start, com uma janela de poucos pacotes que dobra a cada round-trip — crescimento exponencial que na prática significa que transferências curtas terminam antes de atingir a velocidade real do link. É por isso que baixar dez arquivos de 100KB é bem mais lento que baixar um de 1MB: cada conexão nova recomeça devagar, e a maior parte da transferência acontece na fase de aquecimento.',
          },
          {
            type: 'p',
            text: 'Quando detecta perda, o algoritmo interpreta o evento como sinal de congestionamento e recua. O TCP clássico (Reno, Cubic) trata perda como o único sinal disponível, o que cria um problema em redes modernas: buffers grandes em roteadores absorvem o excesso sem descartar nada, então o emissor continua acelerando enquanto a latência sobe — o fenômeno conhecido como bufferbloat, em que a fila cresce a centenas de milissegundos sem nenhuma perda para avisar. Algoritmos mais novos como o BBR mudam o critério: em vez de esperar perda, estimam a largura de banda e o RTT mínimo do caminho e transmitem no ponto em que a fila ainda não se formou, entregando throughput alto com latência baixa.',
          },
          {
            type: 'p',
            text: 'A consequência prática disso é que "a rede está lenta" raramente é uma frase precisa. Em links de alta latência, o throughput de uma única conexão TCP é limitado pela janela dividida pelo RTT — e não pela banda contratada. Um link de 1Gbps com 200ms de RTT e janela de 64KB entrega pouco mais de 2,5Mbps por conexão, por mais larga que seja a tubulação. As saídas são aumentar a janela (window scaling), paralelizar em várias conexões, ou aproximar o servidor do usuário para encurtar o RTT — que é, de novo, o argumento das CDNs.',
          },
          {
            type: 'h',
            text: 'Head-of-line blocking',
          },
          {
            type: 'p',
            text: 'O efeito mais importante e menos óbvio do TCP é o bloqueio de cabeça de fila. Como o protocolo garante ordem, um único segmento perdido segura todos os que chegaram depois dele — eles já estão no buffer do receptor, mas não podem ser entregues à aplicação até que o faltante seja retransmitido. Numa chamada de vídeo isso vira um congelamento; numa página com HTTP/2, uma imagem perdida pode atrasar todo o restante multiplexado na mesma conexão.',
          },
          {
            type: 'p',
            text: 'É exatamente esse problema que o QUIC ataca. QUIC roda sobre UDP e reimplementa confiabilidade, ordenação e criptografia em espaço de usuário, mas por *stream* independente: a perda em um stream não bloqueia os outros. Como bônus, funde o handshake de transporte com o de TLS, reduzindo o custo de conexão a um round-trip (ou zero, ao reconectar). HTTP/3 é HTTP sobre QUIC — ou seja, a web moderna está migrando para UDP na base, sem abrir mão de confiabilidade.',
          },
          {
            type: 'table',
            head: ['Aspecto', 'TCP', 'UDP'],
            rows: [
              ['Conexão', 'Handshake de 3 vias antes dos dados', 'Sem conexão — envia direto'],
              ['Perda de pacote', 'Retransmite automaticamente', 'Perdido é perdido'],
              ['Ordem', 'Garantida', 'Não garantida'],
              ['Head-of-line blocking', 'Sim', 'Não'],
              ['Overhead de cabeçalho', '20 bytes ou mais', '8 bytes'],
              ['Multicast/broadcast', 'Não suporta', 'Suporta'],
              ['Usos típicos', 'HTTP, bancos, e-mail, transferência', 'DNS, VoIP, jogos, streaming, QUIC, métricas'],
            ],
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Escolher UDP "porque é mais rápido" e reimplementar, mal, tudo que o TCP já faz. Times acabam adicionando confirmação, retransmissão e ordenação sob pressão de bugs, e chegam a um TCP artesanal com falhas sutis — especialmente na parte mais difícil, o controle de congestionamento, cuja ausência transforma a aplicação em uma vizinha abusiva na rede. Se você precisa de entrega garantida, use TCP ou QUIC, que já resolveram isso.',
          },
        ],
        quiz: [
          {
            q: 'Por que uma chamada de vídeo prefere perder pacotes a esperar retransmissão?',
            a: 'Porque o áudio ou quadro correspondente àquele instante já passou: retransmiti-lo entrega um dado que não pode mais ser exibido no lugar certo e, pior, atrasa tudo que veio depois por causa da ordenação. É preferível um artefato momentâneo à conversa inteira travando — daí o uso de UDP com correção de erro na própria aplicação.',
          },
          {
            q: 'Como o QUIC consegue confiabilidade sem herdar o head-of-line blocking do TCP?',
            a: 'Porque implementa a confiabilidade por stream, em espaço de usuário sobre UDP. Cada stream tem sua própria sequência e retransmissão, então a perda de um pacote de um stream não impede a entrega dos demais. O sistema operacional só vê datagramas UDP independentes, sem ordem global a preservar.',
          },
          {
            q: 'Por que o DNS tradicionalmente usa UDP, e quando ele recorre ao TCP?',
            a: 'Porque a consulta e a resposta cabem em um datagrama pequeno e o custo de um handshake seria maior que a própria troca; se a resposta se perde, o cliente simplesmente pergunta de novo. Recorre ao TCP quando a resposta é grande demais para o limite do datagrama (respostas truncadas, transferências de zona, DNSSEC).',
          },
        ],
      },
    },
    {
      slug: 'load-balancing',
      title: 'Load balancing',
      summary:
        'Algoritmos de distribuição, health checks e o problema do estado de sessão.',
      sourceUrl: 'https://github.com/ashishps1/awesome-system-design-resources',
      content: {
        summary:
          'Um load balancer distribui requisições entre réplicas, detecta instâncias doentes e é o que torna o escalonamento horizontal invisível para o cliente.',
        blocks: [
          {
            type: 'p',
            text: 'Distribuir carga parece trivial até você olhar de perto. O balanceador precisa decidir para onde mandar cada requisição, descobrir sozinho quais backends estão saudáveis, não derrubar conexões em andamento quando um backend sai, e fazer tudo isso sem virar o gargalo nem o novo ponto único de falha.',
          },
          {
            type: 'h',
            text: 'Algoritmos',
          },
          {
            type: 'table',
            head: ['Algoritmo', 'Como decide', 'Quando usar'],
            rows: [
              ['Round robin', 'Alterna sequencialmente', 'Backends homogêneos e requisições de custo parecido'],
              ['Weighted round robin', 'Alterna respeitando pesos', 'Máquinas de capacidades diferentes'],
              ['Least connections', 'Manda para quem tem menos conexões ativas', 'Requisições de duração muito variável'],
              ['Least response time', 'Combina conexões ativas e latência observada', 'Quando a saúde do backend varia com o tempo'],
              ['IP hash / consistent hash', 'Deriva o destino de um hash da chave', 'Afinidade de sessão ou de cache'],
              ['Power of two choices', 'Sorteia dois e escolhe o menos carregado', 'Ótimo equilíbrio entre simplicidade e balanceamento'],
            ],
          },
          {
            type: 'p',
            text: 'O "power of two choices" merece destaque por ser contraintuitivo: sortear dois backends e mandar para o menos carregado dá resultado dramaticamente melhor que sortear um só, e quase tão bom quanto consultar todos. É a escolha padrão de balanceadores modernos porque não exige estado global nem coordenação entre proxies.',
          },
          {
            type: 'key',
            text: 'Round robin puro assume que todas as requisições custam o mesmo. Quando algumas são 100× mais caras — um relatório pesado no meio de chamadas triviais —, ele concentra trabalho em réplicas azaradas. Least connections é o padrão mais seguro nesse cenário.',
          },
          {
            type: 'h',
            text: 'Health checks',
          },
          {
            type: 'p',
            text: 'Um balanceador só é útil se sabe quem está vivo. Health checks passivos observam as respostas reais e removem quem começa a errar; ativos batem periodicamente em um endpoint de saúde. Vale distinguir dois tipos de sonda: *liveness* pergunta "o processo está vivo?" e, se falhar, o certo é reiniciar; *readiness* pergunta "ele está pronto para receber tráfego agora?" e, se falhar, o certo é apenas tirá-lo da rotação temporariamente — durante um warm-up ou um pico de carga, por exemplo.',
          },
          {
            type: 'p',
            text: 'O endpoint de saúde deve verificar o que realmente importa (consegue falar com o banco? o cache responde?) sem ser caro nem cascatear: se o `/health` de A chama o `/health` de B, uma falha em B derruba A do balanceamento mesmo que A pudesse operar degradado, e o incidente se espalha por toda a malha.',
          },
          {
            type: 'p',
            text: 'Least response time, quando bem implementado, não usa a última latência medida nem a média de todo o histórico — usa uma média móvel exponencialmente ponderada (EWMA), que dá peso decrescente às amostras conforme envelhecem. Assim a métrica reage rápido a uma réplica que começou a degradar sem oscilar a cada requisição atípica. O parâmetro que importa é a meia-vida: curta demais e o balanceador persegue ruído, mandando rajadas para quem por acaso respondeu rápido; longa demais e ele demora a perceber que um backend afundou.',
          },
          {
            type: 'h',
            text: 'Balanceamento em camadas',
          },
          {
            type: 'p',
            text: 'Em sistemas grandes o balanceamento acontece em três níveis encadeados. O DNS ou o anycast escolhe a região; um balanceador L4 na borda distribui as conexões entre um pool de proxies; um proxy L7 decide, requisição a requisição, qual instância atende. Cada nível resolve o que o anterior não consegue: o DNS não enxerga carga, o L4 não enxerga conteúdo, e o L7 não enxerga geografia.',
          },
          {
            type: 'p',
            text: 'Um efeito contraintuitivo aparece quando muitos proxies decidem em paralelo com informação incompleta. Se dez balanceadores usam "least connections" e todos veem a mesma réplica recém-adicionada como a mais vaga, todos mandam tráfego para ela ao mesmo tempo e a derrubam — o rebanho que corre junto porque cada um raciocinou certo isoladamente. Power of two choices atenua isso ao introduzir aleatoriedade na escolha, e é por essa razão, mais do que pela simplicidade, que virou padrão.',
          },
          {
            type: 'h',
            text: 'Estado de sessão',
          },
          {
            type: 'p',
            text: 'Se a aplicação guarda estado em memória, requisições do mesmo usuário precisam voltar para a mesma instância — a chamada sticky session, implementada por cookie ou hash do IP. Funciona, mas cobra caro: o balanceamento fica desigual, escalar não alivia quem já está sobrecarregado, e perder uma instância significa perder as sessões dela. A saída melhor é quase sempre tornar a aplicação stateless, movendo a sessão para um cache compartilhado (Redis) ou para um token assinado no cliente (JWT).',
          },
          {
            type: 'warn',
            title: 'O erro clássico',
            text: 'Health check que só confirma que o processo responde. Um serviço com o pool de conexões do banco esgotado responde 200 em `/health` e erro em 100% do tráfego real — e o balanceador continua mandando requisições para ele. Por outro lado, health check que verifica dependências demais causa remoção em cascata. O equilíbrio: verificar as dependências críticas próprias, com timeout curto, sem propagar a saúde de terceiros.',
          },
          {
            type: 'p',
            text: 'Por fim, o balanceador não pode ser o novo SPOF. Na nuvem isso é resolvido pelo serviço gerenciado, que já roda redundante; on-premise, o padrão é um par com IP virtual e failover, ou vários balanceadores anunciados por DNS/anycast. Vale também garantir *connection draining*: ao remover um backend, parar de mandar requisições novas mas deixar as em andamento terminarem, em vez de cortar conexões no meio.',
          },
          {
            type: 'p',
            text: 'O draining merece detalhe porque é onde a maioria dos deploys "sem downtime" vaza erro. A sequência correta não pode ser invertida: a instância primeiro passa a falhar o readiness, o balanceador a retira da rotação, espera-se o esvaziamento, e só então o processo recebe o sinal de término. Quem mata o processo primeiro e confia no health check para perceber depois derruba todas as requisições da janela entre a morte e a detecção — que, com sonda a cada cinco segundos e três falhas para remover, chega a quinze segundos de erros.',
          },
          {
            type: 'p',
            text: 'Conexões de vida longa complicam o quadro: WebSockets, gRPC com streams e SSE podem durar horas, e esperar todas terminarem inviabiliza o deploy. O padrão é o encerramento negociado — enviar um aviso de fechamento (o GOAWAY do HTTP/2) e deixar o cliente reabrir a conexão numa instância nova. Isso pressupõe que ele reconecte com backoff e jitter; sem isso, um deploy vira uma reconexão simultânea de todos os clientes, tão nociva quanto a queda que se queria evitar.',
          },
        ],
        quiz: [
          {
            q: 'Quando least connections é claramente melhor que round robin?',
            a: 'Quando a duração das requisições varia muito. Round robin distribui contagem, não trabalho: uma réplica que recebeu três relatórios pesados continuará recebendo sua fatia igual de tráfego, enquanto outra está ociosa. Least connections aproxima a distribuição de trabalho em andamento, e não de requisições emitidas.',
          },
          {
            q: 'Qual a diferença prática entre uma sonda de liveness e uma de readiness?',
            a: 'Liveness responde "o processo está funcional?"; se falhar, a ação correta é reiniciar a instância. Readiness responde "ele pode receber tráfego agora?"; se falhar, basta removê-lo da rotação temporariamente, sem reiniciar — útil durante warm-up, carga de cache ou sobrecarga momentânea. Confundir as duas leva a reinícios desnecessários em picos de tráfego.',
          },
          {
            q: 'Por que sticky sessions atrapalham o escalonamento?',
            a: 'Porque prendem usuários a instâncias específicas: adicionar réplicas não alivia quem já está sobrecarregado, já que as sessões existentes continuam presas; a distribuição fica desigual conforme os usuários variam de atividade; e a perda de uma instância derruba as sessões dela. Externalizar o estado (cache compartilhado ou token no cliente) resolve as três coisas.',
          },
        ],
      },
    },
  ],
};

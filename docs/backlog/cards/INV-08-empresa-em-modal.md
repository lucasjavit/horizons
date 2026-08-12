# INV-08 · Cadastrar empresa numa modal e reusar num select

**Estado:** feito (12/08/2026)
**Tamanho:** M
**Pedido do stakeholder (12/08/2026):** o "adicionar empresa" vira um
formulário em modal à parte; depois a empresa cadastrada pode ser escolhida
num select.

## Por quê

Hoje os dados do emissor ("From") são digitados direto no formulário, toda
vez. Quem emite invoice todo mês redigita nome, endereço, e-mail e tax ID
sempre — e é sempre a mesma empresa.

Tirar isso do fluxo principal também limpa a tela: o "From" deixa de ser
quatro campos e vira uma linha de seleção.

## O que

- Um select no lugar do bloco "From", listando as empresas salvas
- Um botão "Add company" que abre uma modal com o formulário
- Ao salvar, a empresa entra na lista e é selecionada
- Dá para editar e apagar uma empresa salva

## Critério de aceite

- [x] Sem nenhuma empresa salva, o select mostra que está vazio e o caminho
      para cadastrar fica óbvio
- [x] "Add company" abre a modal com os campos: nome, endereço, e-mail, tax ID
- [x] Salvar fecha a modal, adiciona à lista e já seleciona a nova empresa
- [x] Escolher uma empresa preenche o "From" da invoice
- [x] Dá para editar uma empresa salva
- [x] Dá para apagar, com confirmação
- [x] As empresas persistem no navegador, como o rascunho

## Acessibilidade (não é opcional aqui)

- [x] A modal tem `role="dialog"` e `aria-modal="true"`
- [x] O foco vai para dentro da modal ao abrir, e volta ao botão ao fechar
- [x] O foco fica preso dentro da modal enquanto ela está aberta
- [x] `Esc` fecha
- [x] Clicar fora fecha, mas não perde o que foi digitado sem avisar
- [x] O fundo não rola enquanto a modal está aberta

## Casos de borda

- Empresa com o mesmo nome de outra: permitido, nome não é chave
- Apagar a empresa que está selecionada na invoice: o "From" volta a vazio
- Empresa com endereço de 10 linhas
- `localStorage` bloqueado: a modal ainda funciona, só não persiste

## Fora de escopo

- Empresas por conta (depende de login — ver INV-10)
- Logo da empresa no PDF
- Importar de CSV

## Observações

Isto é o gêmeo do "Bill To" (clientes salvos, INV-10) do lado do emissor. A
diferença: empresa é quase sempre **uma só**, enquanto clientes são vários.
Vale reaproveitar o mesmo componente de modal quando o INV-10 for feito.

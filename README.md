# App Kiton Campo

App de campo da Kiton Engenharia Integrada: registro de saídas (veículo, ferramentas e EPC), retornos, conferência e fechamento do mês.
Os dados ficam na planilha **App Kiton Campo | Base de Dados**, no Google Drive da Kiton.

## Como funciona

- `index.html`: tela do app, publicada no GitHub Pages.
- `apps-script/Code.gs`: ponte entre a tela e a planilha, publicada como App da Web na conta Google da Kiton.
- `config.js`: endereço do App da Web (termina em `/exec`).

## Publicar o Apps Script (uma vez)

1. Abra a planilha **App Kiton Campo | Base de Dados** com a conta da Kiton.
2. Menu **Extensões › Apps Script**.
3. Apague o conteúdo do arquivo `Código.gs`, cole o conteúdo de `apps-script/Code.gs` e salve.
4. Na barra de cima, escolha a função `testarConfiguracao` e clique em **Executar**. Autorize o acesso quando o Google pedir (Avançado › Acessar projeto).
5. Clique em **Implantar › Nova implantação**, tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie o endereço que termina em `/exec` e coloque em `config.js`.

Ao alterar o `Code.gs` depois: **Implantar › Gerenciar implantações › editar › Nova versão**. O endereço continua o mesmo.

## Regras

- Login por nome e PIN de 6 dígitos. O PIN padrão é 123456 e o app obriga a troca no primeiro acesso.
- O celular fica conectado por 90 dias. Trocar ou redefinir o PIN desconecta os aparelhos.
- A localização é gravada só na saída e no retorno. Sem permissão ou sem GPS, o registro é salvo como "sem localização".
- Somente serão ressarcidos os valores referentes às saídas registradas neste controle.

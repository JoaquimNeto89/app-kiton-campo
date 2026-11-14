# Testes do Kiton Hub (simulação local)

Simulação do servidor (Apps Script) e do app sem tocar na planilha real.

- `lib.js`: imita a planilha, o Drive, o e-mail e a agenda; roda o `apps-script/Code.gs` real.
- `aprsetup.js`: colunas de treinamentos e tipos de APR para os testes.
- `t*.js`: testes do servidor (`node t7.js`).
- `ui*.js`: testes de tela com Playwright (`NODE_PATH=$(npm root -g) node ui13.js`), geram capturas.

Os caminhos usam `/home/claude/app-kiton-campo`; ajuste se clonar em outro lugar.

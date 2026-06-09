# 🚀 Gale

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind v4](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Gale** é um orquestrador visual de pipelines local e ultra-rápido para o **GitHub Actions**. Ele fornece uma interface de usuário desktop rica e moderna que encapsula a engine do `act` (`nektos/act`) para ajudar desenvolvedores a depurar, visualizar e rodar workflows complexos do GitHub Actions em suas próprias máquinas sem a necessidade de commits constantes ou espera de filas de CI.

---

## ✨ Principais Funcionalidades

*   **📂 Seletor Visual de Workspace**: Aponte para qualquer repositório local contendo a pasta `.github/workflows` e o Gale mapeará instantaneamente todos os seus fluxos.
*   **🛠️ Execução de Jobs Individuais ou Workflows Completos**: Execute jobs de forma isolada ou dispare um workflow inteiro em sequência.
*   **📐 Resolução Automática de Dependências**: Ordena topologicamente a fila de jobs com base no campo `needs`, garantindo que os pré-requisitos executem corretamente e tratando falhas de dependência em tempo real.
*   **⚡ Streaming de Logs em Tempo Real**: Visualize a saída padrão (`stdout`/`stderr`) de cada etapa de execução linha a linha em um console virtual integrado de alta fidelidade.
*   **🔑 Gerenciador de Segredos Locais (Secrets)**: Insira segredos sensíveis manualmente ou importe de forma rápida arquivos `.env`. Todos os segredos são salvos de forma criptografada/local e nunca são compartilhados ou enviados a servidores remotos.
*   **🔄 Watcher de Alterações**: Detecta automaticamente edições nos arquivos YAML dos workflows e recarrega a árvore de execução no painel instantaneamente.
*   **🔍 Verificador Integrado de Dependências**: Valida se o Docker Engine e o `act` estão configurados e funcionais na máquina local antes de rodar os pipelines.

---

## 🏗️ Arquitetura do Sistema

O Gale foi construído seguindo os princípios de **Clean Architecture** em Rust no backend e **Feature-Sliced Design** no frontend React. Toda a lógica de negócio do domínio é isolada das APIs do sistema operacional, do Tauri e do motor de execução `act`.

> 💡 Leia o documento detalhado de [Arquitetura](file:///d:/Projects/gale/ARCHITECTURE.md) para compreender a estrutura de código, fluxos assíncronos e o uso do Tauri IPC.

---

## ⚙️ Pré-requisitos do Sistema

Para rodar a aplicação localmente e executar os pipelines, você precisa ter:

1.  **Docker** ativo e rodando.
2.  A ferramenta de linha de comando **[act CLI (nektos/act)](https://github.com/nektos/act)** instalada e acessível em seu PATH global.

---

## 🛠️ Como Iniciar o Projeto Localmente

1.  **Instale as dependências de desenvolvimento do projeto:**
    ```bash
    pnpm install
    ```

2.  **Execute o servidor de desenvolvimento (Vite + Tauri Dev App):**
    ```bash
    pnpm tauri dev
    ```

3.  **Compilar para Produção (Gerar executável nativo):**
    ```bash
    pnpm tauri build
    ```

---

## 🤝 Contribuições

Gale é um projeto de código aberto, e contribuições são super bem-vindas! Se você deseja corrigir um bug, propor novos recursos ou melhorar a documentação:

1.  Consulte o nosso [Guia de Contribuição](file:///d:/Projects/gale/CONTRIBUTING.md) para entender os padrões de commit, fluxos de branchs e boas práticas de codificação em Rust e React.
2.  Sinta-se à vontade para abrir uma issue para debater novas ideias.

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Consulte o arquivo `LICENSE` no repositório para obter mais detalhes.

# Guia de Contribuição - Gale

Obrigado pelo seu interesse em contribuir para o Gale! Este projeto é de código aberto e valoriza muito a colaboração da comunidade.

Este documento fornece instruções detalhadas para configurar seu ambiente de desenvolvimento local e submeter suas contribuições de forma eficiente.

---

## 🛠️ Pré-requisitos de Desenvolvimento

Para compilar e desenvolver o Gale localmente, você precisará das seguintes ferramentas instaladas:

1.  **Node.js** (v18 ou superior) e **pnpm** (gerenciador de pacotes recomendado).
2.  **Rust Toolchain** (rustup, cargo).
3.  **Docker Desktop** (ou Docker Engine rodando em sua máquina).
4.  **act** CLI (Engine do local pipeline do GitHub Actions).
    *   *Nota: O Gale verifica essas dependências em tempo de execução para garantir o funcionamento adequado.*

---

## 🚀 Configuração do Ambiente Local

Siga o passo a passo para rodar o projeto em modo de desenvolvimento:

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Gildofj/gale.git
    cd gale
    ```

2.  **Instale as dependências do Frontend:**
    ```bash
    pnpm install
    ```

3.  **Execute o projeto em modo de desenvolvimento:**
    ```bash
    pnpm tauri dev
    ```
    *Este comando iniciará o Vite para o frontend React e compilará o core em Rust utilizando as ferramentas de desenvolvimento do Tauri.*

---

## 📐 Diretrizes de Código

Para manter a consistência e a alta qualidade do projeto, siga as regras abaixo:

### 🦀 Backend (Rust)
*   **Clean Architecture**: Respeite os limites das camadas. Não adicione dependências de infraestrutura ou Tauri diretamente em `domain` ou `application`.
*   **Formatador**: Execute `cargo fmt` antes de enviar suas modificações.
*   **Linters**: Verifique avisos do compilador e execute `cargo clippy` para garantir as melhores práticas do ecossistema Rust.
*   **Gerenciamento de Erros**: Evite o uso de `.unwrap()` e `.expect()` no código produtivo. Use tratamento explícito de erros com o tipo `Result` e propague-os adequadamente.

### 💻 Frontend (TypeScript + React)
*   **Tipagem estrita**: Não utilize `any`. Declare tipos e interfaces completas para todas as variáveis e retornos de funções.
*   **CSS / Estilização**: O Gale utiliza TailwindCSS v4. Não adicione estilos inline complexos ou utilitários redundantes. Mantenha os componentes consistentes com o design system atual.

---

## 📥 Fluxo de Trabalho para Envio de Código

1.  **Crie uma nova Branch** a partir da branch principal (`main`):
    ```bash
    git checkout -b feature/minha-melhoria
    ```
2.  **Faça suas alterações** seguindo as diretrizes do projeto.
3.  **Valide localmente**: Certifique-se de que a aplicação compila sem erros tanto no frontend (`pnpm build`) quanto no backend (`cargo check` dentro de `src-tauri`).
4.  **Realize o commit** das suas alterações de forma descritiva e limpa.
5.  **Envie o Pull Request**: Abra um PR detalhando suas alterações, o problema que resolve e como foi testado.

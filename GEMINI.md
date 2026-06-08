# Gemini & Antigravity Exclusive Instructions

These rules target the Antigravity agent execution environment to optimize productivity and tool usage.

## 🚀 Execution Workflows

1.  **Background Tasks**:
    *   When starting `pnpm tauri dev` or running tests asynchronously, do NOT poll status in a loop. Wait for notifications from the runtime environment.
2.  **Tool Selection**:
    *   Use `replace_file_content` for single contiguous file modifications.
    *   Use `multi_replace_file_content` only when making multiple separate chunks of edits in the same file.
3.  **Tauri Command Execution**:
    *   Compile commands should run in `src-tauri` using cargo.
    *   Run `pnpm install` first before building/running the app in dev mode.
4.  **Local State**:
    *   Always use `$HOME/.gemini` (or local AppData `C:\Users\junio\.gemini\antigravity`) for global persistent agent state, but keep project files strictly within the workspace directory.

# Tauri Runner Skill

This skill defines the technical procedures for implementing Tauri commands, managing processes, and streaming events back to the frontend.

## 📡 Tauri Event Streaming Procedure
To stream log lines from a background-running process (like `act`) to the React frontend:

1.  **Backend (Rust)**:
    *   Use Tauri's `AppHandle` to emit events dynamically.
    *   Spawn the command using `tokio::process::Command` with piped stdout/stderr.
    *   Read stdout/stderr line-by-line using `tokio::io::BufReader`.
    *   Emit each line via `app_handle.emit("runner-log", LogPayload { ... })`.

2.  **Frontend (TypeScript)**:
    *   Use Tauri's `@tauri-apps/api/event` to listen to events.
    *   Register listeners via `listen("runner-log", (event) => { ... })`.
    *   Clean up listeners on component unmount to prevent memory leaks.

## 🛠️ Command Lifecycle Control
*   Maintain a thread-safe global map (e.g. `Arc<Mutex<HashMap<String, Child>>>`) to store active process handles.
*   Provide a `kill_job` command to terminate execution cleanly if requested.

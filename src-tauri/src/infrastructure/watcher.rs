use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, State};

pub struct WatcherState {
    pub cancel_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            cancel_tx: Mutex::new(None),
        }
    }
}

pub async fn start_watching_workflows(
    repo_path: String,
    state: State<'_, WatcherState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // 1. Cancel existing task
    let mut cancel_tx_lock = state.cancel_tx.lock().unwrap();
    if let Some(tx) = cancel_tx_lock.take() {
        let _ = tx.send(());
    }

    // 2. If path is empty, just stop watching
    if repo_path.is_empty() {
        return Ok(());
    }

    // 3. Start a new tokio task for watching
    let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
    *cancel_tx_lock = Some(tx);

    let app_clone = app_handle.clone();
    let path_clone = repo_path.clone();

    tokio::spawn(async move {
        let mut last_state: Option<HashMap<PathBuf, SystemTime>> = None;
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));

        loop {
            tokio::select! {
                _ = &mut rx => {
                    break;
                }
                _ = interval.tick() => {
                    let mut current_state = HashMap::new();
                    let mut workflows_dir = PathBuf::from(&path_clone);
                    workflows_dir.push(".github");
                    workflows_dir.push("workflows");

                    if workflows_dir.exists() {
                        if let Ok(entries) = std::fs::read_dir(&workflows_dir) {
                            for entry in entries {
                                if let Ok(entry) = entry {
                                    let path = entry.path();
                                    if path.is_file() {
                                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                                        if ext == "yml" || ext == "yaml" {
                                            if let Ok(metadata) = entry.metadata() {
                                                if let Ok(modified) = metadata.modified() {
                                                    current_state.insert(path, modified);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if let Some(ref last) = last_state {
                        if last != &current_state {
                            let _ = app_clone.emit("workflows-changed", ());
                        }
                    }
                    last_state = Some(current_state);
                }
            }
        }
    });

    Ok(())
}

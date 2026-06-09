use tauri::{AppHandle, Emitter};
use crate::domain::pipeline::{Workflow, LogLine};
use crate::application::use_cases::{ListWorkflowsUseCase, RunJobUseCase, CheckDependenciesUseCase};
use crate::infrastructure::github::GithubActionsEngine;
use crate::infrastructure::fs_provider::LocalFilesystemProvider;
use crate::infrastructure::act::ActRunnerService;

#[tauri::command]
pub fn list_workflows_cmd(repo_path: String) -> Result<Vec<Workflow>, String> {
    let repo_provider = LocalFilesystemProvider;
    let github_engine = GithubActionsEngine;
    let engines: Vec<&dyn crate::domain::pipeline::PipelineEngine> = vec![&github_engine];

    let use_case = ListWorkflowsUseCase {
        repo_provider: &repo_provider,
        engines,
    };

    use_case.execute(&repo_path)
}

#[tauri::command]
pub async fn run_job_cmd(
    repo_path: String,
    workflow_file: String,
    job_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let runner = ActRunnerService;
    let use_case = RunJobUseCase { runner: &runner };

    let handle_clone = app_handle.clone();
    let callback = Box::new(move |log_line: LogLine| {
        let _ = handle_clone.emit("runner-log", log_line);
    });

    use_case.execute(&repo_path, &workflow_file, &job_id, callback).await
}

#[tauri::command]
pub fn check_dependencies_cmd() -> (bool, bool) {
    let use_case = CheckDependenciesUseCase;
    use_case.execute()
}

#[tauri::command]
pub fn stop_job_cmd() -> Result<(), String> {
    crate::infrastructure::act::stop_active_process()
}

#[tauri::command]
pub fn select_directory_cmd() -> Option<String> {
    let dir = rfd::FileDialog::new()
        .pick_folder();
    
    dir.map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn start_watching_workflows(
    repo_path: String,
    state: tauri::State<'_, crate::infrastructure::watcher::WatcherState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    crate::infrastructure::watcher::start_watching_workflows(repo_path, state, app_handle).await
}

use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

fn get_secrets_file_path(app_handle: &AppHandle, repo_path: &str) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let mut hasher = DefaultHasher::new();
    repo_path.hash(&mut hasher);
    let hash = format!("{:x}", hasher.finish());

    let mut path = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    // Ensure the secrets folder exists
    path.push("secrets");
    let _ = std::fs::create_dir_all(&path);
    
    path.push(format!("{}.secrets", hash));
    Ok(path)
}

#[tauri::command]
pub fn load_secrets_cmd(app_handle: AppHandle, repo_path: String) -> Result<HashMap<String, String>, String> {
    let file_path = get_secrets_file_path(&app_handle, &repo_path)?;
    if !file_path.exists() {
        return Ok(HashMap::new());
    }

    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read secrets: {}", e))?;

    let mut secrets = HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() == 2 {
            secrets.insert(parts[0].trim().to_string(), parts[1].trim().to_string());
        }
    }

    Ok(secrets)
}

#[tauri::command]
pub fn save_secrets_cmd(
    app_handle: AppHandle,
    repo_path: String,
    secrets: HashMap<String, String>,
) -> Result<(), String> {
    use std::io::Write;
    let file_path = get_secrets_file_path(&app_handle, &repo_path)?;
    let mut file = std::fs::File::create(file_path)
        .map_err(|e| format!("Failed to create secrets file: {}", e))?;

    for (k, v) in secrets {
        writeln!(file, "{}={}", k.trim(), v.trim())
            .map_err(|e| format!("Failed to write secret: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn import_secrets_from_env_cmd(
    app_handle: AppHandle,
    repo_path: String,
) -> Result<HashMap<String, String>, String> {
    use std::io::BufRead;

    // 1. Pick file starting at repo_path
    let file_opt = rfd::FileDialog::new()
        .set_directory(&repo_path)
        .add_filter("Environment File", &["env"])
        .add_filter("All Files", &["*"])
        .pick_file();

    let file_path = match file_opt {
        Some(p) => p,
        None => return Err("No file selected".to_string()),
    };

    // 2. Read and parse chosen .env file
    let file = std::fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open .env file: {}", e))?;
    let reader = std::io::BufReader::new(file);

    let mut imported_secrets = HashMap::new();
    for line_res in reader.lines() {
        let line = line_res.map_err(|e| format!("Failed to read line: {}", e))?;
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = trimmed.splitn(2, '=').collect();
        if parts.len() == 2 {
            let key = parts[0].trim().to_string();
            let mut val = parts[1].trim().to_string();
            
            // Strip wrapping quotes
            if (val.starts_with('"') && val.ends_with('"')) || (val.starts_with('\'') && val.ends_with('\'')) {
                if val.len() >= 2 {
                    val = val[1..val.len()-1].to_string();
                }
            }
            
            imported_secrets.insert(key.to_uppercase(), val); // Ensure keys are uppercase
        }
    }

    // 3. Load existing secrets
    let mut current_secrets = load_secrets_cmd(app_handle.clone(), repo_path.clone())?;

    // 4. Merge (overwrite current keys with imported keys)
    for (k, v) in imported_secrets {
        current_secrets.insert(k, v);
    }

    // 5. Save and return merged list
    save_secrets_cmd(app_handle, repo_path, current_secrets.clone())?;

    Ok(current_secrets)
}



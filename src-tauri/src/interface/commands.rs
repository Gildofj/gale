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
pub fn select_directory_cmd() -> Option<String> {
    let dir = rfd::FileDialog::new()
        .pick_folder();
    
    dir.map(|p| p.to_string_lossy().into_owned())
}

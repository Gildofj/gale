use crate::domain::pipeline::{PipelineEngine, RepositoryProvider, RunnerService, Workflow, LogLine};
use std::process::Command;

pub struct ListWorkflowsUseCase<'a> {
    pub repo_provider: &'a dyn RepositoryProvider,
    pub engines: Vec<&'a dyn PipelineEngine>,
}

impl<'a> ListWorkflowsUseCase<'a> {
    pub fn execute(&self, repo_path: &str) -> Result<Vec<Workflow>, String> {
        let files = self.repo_provider.list_workflows(repo_path)?;
        let mut workflows = Vec::new();

        for (file_path, file_content) in files {
            let matched_engine = self.engines.iter().find(|e| e.matches_extension(&file_path));
            if let Some(engine) = matched_engine {
                if let Ok(workflow) = engine.parse_workflow(&file_content, &file_path) {
                    workflows.push(workflow);
                }
            }
        }

        Ok(workflows)
    }
}

pub struct RunJobUseCase<'a> {
    pub runner: &'a dyn RunnerService,
}

impl<'a> RunJobUseCase<'a> {
    pub async fn execute(
        &self,
        repo_path: &str,
        workflow_file: &str,
        job_id: &str,
        log_callback: Box<dyn Fn(LogLine) + Send + Sync + 'static>,
    ) -> Result<(), String> {
        self.runner.execute_job(repo_path, workflow_file, job_id, log_callback).await
    }
}

pub struct CheckDependenciesUseCase;

impl CheckDependenciesUseCase {
    pub fn execute(&self) -> (bool, bool) {
        let docker_ok = check_binary("docker", &["--version"]);
        let act_ok = check_binary("act", &["--version"]);
        (docker_ok, act_ok)
    }
}

fn check_binary(bin: &str, args: &[&str]) -> bool {
    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("powershell");
    #[cfg(target_os = "windows")]
    cmd.args(&["-NoProfile", "-Command", &format!("Get-Command {}", bin)]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("which");
    #[cfg(not(target_os = "windows"))]
    cmd.arg(bin);

    if let Ok(status) = cmd.status() {
        if status.success() {
            return true;
        }
    }

    let mut direct_cmd = Command::new(bin);
    direct_cmd.args(args);
    if let Ok(status) = direct_cmd.status() {
        status.success()
    } else {
        false
    }
}

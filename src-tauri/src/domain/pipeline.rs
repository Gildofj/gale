use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    pub name: Option<String>,
    pub run: Option<String>,
    pub uses: Option<String>,
}

use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixConfig {
    pub id: String,
    pub name: String,
    pub values: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub name: Option<String>,
    pub steps: Vec<Step>,
    pub needs: Option<Vec<String>>,
    pub matrix_configs: Option<Vec<MatrixConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub file_path: String,
    pub name: String,
    pub events: Vec<String>,
    pub jobs: Vec<Job>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    pub job_id: String,
    pub step_name: String,
    pub message: String,
    pub stream: String, // "stdout" or "stderr"
    pub timestamp: u64, // Epoch millis
}

pub trait PipelineEngine: Send + Sync {
    fn parse_workflow(&self, file_content: &str, file_path: &str) -> Result<Workflow, String>;
    fn matches_extension(&self, filename: &str) -> bool;
}

pub trait RepositoryProvider: Send + Sync {
    fn list_workflows(&self, repo_path: &str) -> Result<Vec<(String, String)>, String>; // Returns Vec<(file_path, file_content)>
}

#[async_trait::async_trait]
pub trait RunnerService: Send + Sync {
    async fn execute_job(
        &self,
        repo_path: &str,
        workflow_file: &str,
        job_id: &str,
        log_callback: Box<dyn Fn(LogLine) + Send + Sync + 'static>,
    ) -> Result<(), String>;
}

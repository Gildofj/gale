use std::fs;
use std::path::PathBuf;
use crate::domain::pipeline::RepositoryProvider;

pub struct LocalFilesystemProvider;

impl RepositoryProvider for LocalFilesystemProvider {
    fn list_workflows(&self, repo_path: &str) -> Result<Vec<(String, String)>, String> {
        let mut workflows_dir = PathBuf::from(repo_path);
        workflows_dir.push(".github");
        workflows_dir.push("workflows");

        if !workflows_dir.exists() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();
        let entries = fs::read_dir(&workflows_dir)
            .map_err(|e| format!("Failed to read workflows directory: {}", e))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if ext == "yml" || ext == "yaml" {
                        let content = fs::read_to_string(&path)
                            .map_err(|e| format!("Failed to read file {:?}: {}", path, e))?;
                        let file_path = path.to_string_lossy().to_string();
                        results.push((file_path, content));
                    }
                }
            }
        }

        Ok(results)
    }
}

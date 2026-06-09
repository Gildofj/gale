use indexmap::IndexMap;
use serde::Deserialize;
use serde_json::Value;
use crate::domain::pipeline::{Job, PipelineEngine, Step, Workflow};

#[derive(Debug, Deserialize)]
struct GithubWorkflowYaml {
    name: Option<String>,
    on: Value,
    jobs: IndexMap<String, GithubJobYaml>,
}

#[derive(Debug, Deserialize)]
struct GithubJobYaml {
    name: Option<String>,
    steps: Option<Vec<GithubStepYaml>>,
    needs: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct GithubStepYaml {
    name: Option<String>,
    run: Option<String>,
    uses: Option<String>,
}

pub struct GithubActionsEngine;

impl PipelineEngine for GithubActionsEngine {
    fn matches_extension(&self, filename: &str) -> bool {
        filename.ends_with(".yml") || filename.ends_with(".yaml")
    }

    fn parse_workflow(&self, file_content: &str, file_path: &str) -> Result<Workflow, String> {
        let yaml_val: GithubWorkflowYaml = serde_yaml::from_str(file_content)
            .map_err(|e| format!("Failed to parse YAML: {}", e))?;

        // Parse events
        let mut events = Vec::new();
        match yaml_val.on {
            Value::String(s) => events.push(s),
            Value::Array(arr) => {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        events.push(s.to_string());
                    }
                }
            }
            Value::Object(obj) => {
                for key in obj.keys() {
                    events.push(key.clone());
                }
            }
            _ => events.push("unknown".to_string()),
        }

        // Parse jobs
        let mut jobs = Vec::new();
        for (job_id, job_yaml) in yaml_val.jobs {
            let steps = job_yaml.steps.unwrap_or_default().into_iter().map(|s| Step {
                name: s.name,
                run: s.run,
                uses: s.uses,
            }).collect();

            let needs = match job_yaml.needs {
                Some(Value::String(s)) => Some(vec![s]),
                Some(Value::Array(arr)) => {
                    let mut list = Vec::new();
                    for item in arr {
                        if let Some(s) = item.as_str() {
                            list.push(s.to_string());
                        }
                    }
                    Some(list)
                }
                _ => None,
            };

            jobs.push(Job {
                id: job_id,
                name: job_yaml.name,
                steps,
                needs,
            });
        }

        // Get filename as fallback name
        let name = yaml_val.name.unwrap_or_else(|| {
            std::path::Path::new(file_path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned()
        });

        Ok(Workflow {
            file_path: file_path.to_string(),
            name,
            events,
            jobs,
        })
    }
}

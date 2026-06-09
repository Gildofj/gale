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
    strategy: Option<GithubStrategyYaml>,
}

#[derive(Debug, Deserialize)]
struct GithubStrategyYaml {
    matrix: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct GithubStepYaml {
    name: Option<String>,
    run: Option<String>,
    uses: Option<String>,
}

fn json_val_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => "".to_string(),
    }
}

fn cartesian_product(lists: &[(String, Vec<String>)]) -> Vec<IndexMap<String, String>> {
    if lists.is_empty() {
        return vec![IndexMap::new()];
    }
    let mut result = Vec::new();
    let (key, values) = &lists[0];
    let sub_product = cartesian_product(&lists[1..]);
    for val in values {
        for sub in &sub_product {
            let mut map = sub.clone();
            map.insert(key.clone(), val.clone());
            result.push(map);
        }
    }
    result
}

fn evaluate_template(template: &str, variables: &IndexMap<String, String>) -> String {
    let mut result = template.to_string();
    for (k, v) in variables {
        let placeholder_with_spaces = format!("${{{{ matrix.{} }}}}", k);
        let placeholder_no_spaces = format!("${{{{matrix.{}}}}}", k);
        result = result.replace(&placeholder_with_spaces, v);
        result = result.replace(&placeholder_no_spaces, v);
    }
    result
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
            let steps: Vec<Step> = job_yaml.steps.unwrap_or_default().into_iter().map(|s| Step {
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

            // Parse strategy matrix
            let mut matrix_combinations = Vec::new();
            if let Some(strategy) = job_yaml.strategy {
                if let Some(matrix_val) = strategy.matrix {
                    let mut std_keys = Vec::new();
                    if let Some(matrix_map) = matrix_val.as_object() {
                        for (k, v) in matrix_map {
                            if k != "include" && k != "exclude" {
                                let mut vals = Vec::new();
                                if let Some(arr) = v.as_array() {
                                    for item in arr {
                                        vals.push(json_val_to_string(item));
                                    }
                                } else {
                                    vals.push(json_val_to_string(v));
                                }
                                std_keys.push((k.clone(), vals));
                            }
                        }
                    }

                    let mut combs = if std_keys.is_empty() {
                        Vec::new()
                    } else {
                        cartesian_product(&std_keys)
                    };

                    // Process exclude
                    if let Some(exclude_val) = matrix_val.get("exclude") {
                        if let Some(exclude_arr) = exclude_val.as_array() {
                            combs.retain(|comb| {
                                for item in exclude_arr {
                                    if let Some(item_map) = item.as_object() {
                                        let mut matches = true;
                                        for (k, v) in item_map {
                                            if comb.get(k) != Some(&json_val_to_string(v)) {
                                                matches = false;
                                                break;
                                            }
                                        }
                                        if matches {
                                            return false;
                                        }
                                    }
                                }
                                true
                            });
                        }
                    }

                    // Process include
                    if let Some(include_val) = matrix_val.get("include") {
                        if let Some(include_arr) = include_val.as_array() {
                            for item in include_arr {
                                if let Some(item_map) = item.as_object() {
                                    let mut matched_any = false;
                                    for comb in &mut combs {
                                        let mut matches = true;
                                        for (k, v) in item_map {
                                            if comb.contains_key(k) {
                                                if comb.get(k) != Some(&json_val_to_string(v)) {
                                                    matches = false;
                                                    break;
                                                }
                                            }
                                        }
                                        if matches {
                                            matched_any = true;
                                            for (k, v) in item_map {
                                                comb.insert(k.clone(), json_val_to_string(v));
                                            }
                                        }
                                    }
                                    if !matched_any {
                                        let mut new_comb = IndexMap::new();
                                        for (k, v) in item_map {
                                            new_comb.insert(k.clone(), json_val_to_string(v));
                                        }
                                        combs.push(new_comb);
                                    }
                                }
                            }
                        }
                    }

                    matrix_combinations = combs;
                }
            }

            let mut matrix_configs = None;
            if !matrix_combinations.is_empty() {
                use crate::domain::pipeline::MatrixConfig;
                let mut configs = Vec::new();
                for (idx, comb) in matrix_combinations.into_iter().enumerate() {
                    let instance_idx = idx + 1;
                    let expanded_id = format!("{}-{}", job_id, instance_idx);

                    let evaluated_name = if let Some(ref name_template) = job_yaml.name {
                        evaluate_template(name_template, &comb)
                    } else {
                        let vals: Vec<String> = comb.values()
                            .filter(|v| !v.trim().is_empty())
                            .map(|v| v.replace("--target ", ""))
                            .collect();
                        format!("{} ({})", job_id, vals.join(", "))
                    };

                    let hash_map_vals: std::collections::HashMap<String, String> = comb.into_iter().collect();

                    configs.push(MatrixConfig {
                        id: expanded_id,
                        name: evaluated_name,
                        values: hash_map_vals,
                    });
                }
                matrix_configs = Some(configs);
            }

            jobs.push(Job {
                id: job_id,
                name: job_yaml.name,
                steps,
                needs,
                matrix_configs,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_workflow_matrix() {
        let engine = GithubActionsEngine;
        let content = r#"
name: Test Matrix
on: push
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [18, 20]
        exclude:
          - os: macos-latest
            node: 20
        include:
          - os: windows-latest
            node: 22
    steps:
      - name: Run echo
        run: echo "Hello"
"#;
        let workflow = engine.parse_workflow(content, "test.yml").unwrap();
        assert_eq!(workflow.jobs.len(), 1);
        
        let base_job = &workflow.jobs[0];
        assert_eq!(base_job.id, "test");
        let configs = base_job.matrix_configs.as_ref().unwrap();
        assert_eq!(configs.len(), 4);
        
        let config1 = &configs[0];
        assert_eq!(config1.id, "test-1");
        assert_eq!(config1.name, "test (ubuntu-latest, 18)");
        assert_eq!(config1.values.get("os").unwrap(), "ubuntu-latest");
        assert_eq!(config1.values.get("node").unwrap(), "18");

        let config4 = &configs[3];
        assert_eq!(config4.id, "test-4");
        assert_eq!(config4.name, "test (22, windows-latest)");
        assert_eq!(config4.values.get("os").unwrap(), "windows-latest");
        assert_eq!(config4.values.get("node").unwrap(), "22");
    }

    #[test]
    fn test_publish_workflow_matrix_names() {
        let engine = GithubActionsEngine;
        let content = r#"
name: Publish
on: push
jobs:
  publish-tauri:
    strategy:
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''
    steps:
      - name: Echo
        run: echo "Publish"
"#;
        let workflow = engine.parse_workflow(content, "publish.yml").unwrap();
        assert_eq!(workflow.jobs.len(), 1);

        let job = &workflow.jobs[0];
        assert_eq!(job.id, "publish-tauri");
        let configs = job.matrix_configs.as_ref().unwrap();
        assert_eq!(configs.len(), 4);

        // macos aarch64 name: publish-tauri (aarch64-apple-darwin, macos-latest)
        assert_eq!(configs[0].name, "publish-tauri (aarch64-apple-darwin, macos-latest)");
        // macos x86_64 name: publish-tauri (x86_64-apple-darwin, macos-latest)
        assert_eq!(configs[1].name, "publish-tauri (x86_64-apple-darwin, macos-latest)");
        // ubuntu name: publish-tauri (ubuntu-22.04)
        assert_eq!(configs[2].name, "publish-tauri (ubuntu-22.04)");
        // windows name: publish-tauri (windows-latest)
        assert_eq!(configs[3].name, "publish-tauri (windows-latest)");
    }
}

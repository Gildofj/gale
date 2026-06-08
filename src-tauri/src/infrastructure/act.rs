use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use crate::domain::pipeline::{LogLine, RunnerService};

pub struct ActRunnerService;

#[async_trait::async_trait]
impl RunnerService for ActRunnerService {
    async fn execute_job(
        &self,
        repo_path: &str,
        workflow_file: &str,
        job_id: &str,
        log_callback: Box<dyn Fn(LogLine) + Send + Sync + 'static>,
    ) -> Result<(), String> {
        let relative_path = if let Some(idx) = workflow_file.rfind(".github") {
            &workflow_file[idx..]
        } else {
            workflow_file
        };

        // Determine terminal launcher command
        #[cfg(target_os = "windows")]
        let mut cmd = Command::new("powershell");
        #[cfg(target_os = "windows")]
        cmd.args(&["-NoProfile", "-Command", &format!("act -W {} -j {}", relative_path, job_id)]);

        #[cfg(not(target_os = "windows"))]
        let mut cmd = Command::new("act");
        #[cfg(not(target_os = "windows"))]
        cmd.args(&["-W", relative_path, "-j", job_id]);

        cmd.current_dir(repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            format!(
                "Failed to spawn 'act'. Is Docker running and 'act' installed? Error: {}",
                e
            )
        })?;

        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let log_cb_1 = std::sync::Arc::new(log_callback);
        let log_cb_2 = log_cb_1.clone();
        let job_id_str1 = job_id.to_string();
        let job_id_str2 = job_id.to_string();

        let stdout_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let (step_name, clean_msg) = parse_act_line(&line);
                let timestamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                log_cb_1(LogLine {
                    job_id: job_id_str1.clone(),
                    step_name,
                    message: clean_msg,
                    stream: "stdout".to_string(),
                    timestamp,
                });
            }
        });

        let stderr_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let (step_name, clean_msg) = parse_act_line(&line);
                let timestamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                log_cb_2(LogLine {
                    job_id: job_id_str2.clone(),
                    step_name,
                    message: clean_msg,
                    stream: "stderr".to_string(),
                    timestamp,
                });
            }
        });

        let status = child.wait().await.map_err(|e| format!("Failed to wait for act process: {}", e))?;
        let _ = stdout_handle.await;
        let _ = stderr_handle.await;

        if status.success() {
            Ok(())
        } else {
            Err(format!("act run completed with exit code: {:?}", status.code()))
        }
    }
}

fn parse_act_line(line: &str) -> (String, String) {
    let parts: Vec<&str> = line.splitn(2, '|').collect();
    if parts.len() == 2 {
        let prefix = parts[0].trim();
        let msg = parts[1];
        let step = if prefix.contains('*') {
            prefix.split('*').nth(1).unwrap_or("setup").trim().to_string()
        } else if prefix.contains('x') {
            prefix.split('x').nth(1).unwrap_or("failure").trim().to_string()
        } else {
            "run".to_string()
        };
        return (step, msg.to_string());
    }

    if line.contains(" * ") {
        let parts: Vec<&str> = line.split(" * ").collect();
        if parts.len() >= 2 {
            let step = parts[1].replace("Run ", "").trim().to_string();
            return (step, line.to_string());
        }
    }

    ("system".to_string(), line.to_string())
}

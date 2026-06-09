use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::{Mutex, OnceLock};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use crate::domain::pipeline::{LogLine, RunnerService};

static ACTIVE_PID: OnceLock<Mutex<Option<u32>>> = OnceLock::new();
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

pub fn init_app_handle(handle: tauri::AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

fn get_secrets_file_path(repo_path: &str) -> Option<std::path::PathBuf> {
    let handle = APP_HANDLE.get()?;
    let mut hasher = DefaultHasher::new();
    repo_path.hash(&mut hasher);
    let hash = format!("{:x}", hasher.finish());

    let mut path = handle.path().app_data_dir().ok()?;
    path.push("secrets");
    path.push(format!("{}.secrets", hash));
    
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

pub fn get_active_pid() -> &'static Mutex<Option<u32>> {
    ACTIVE_PID.get_or_init(|| Mutex::new(None))
}

pub fn stop_active_process() -> Result<(), String> {
    let pid = {
        if let Ok(active) = get_active_pid().lock() {
            active.clone()
        } else {
            None
        }
    };

    if let Some(pid) = pid {
        #[cfg(target_os = "windows")]
        {
            let mut kill_cmd = std::process::Command::new("taskkill");
            kill_cmd.args(&["/F", "/T", "/PID", &pid.to_string()]);
            let _ = kill_cmd.status();
        }

        #[cfg(not(target_os = "windows"))]
        {
            let mut kill_cmd = std::process::Command::new("kill");
            kill_cmd.args(&["-9", &pid.to_string()]);
            let _ = kill_cmd.status();
        }

        if let Ok(mut active) = get_active_pid().lock() {
            *active = None;
        }

        Ok(())
    } else {
        Err("No active job process to stop".to_string())
    }
}


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

        let secrets_file = get_secrets_file_path(repo_path);

        #[cfg(target_os = "windows")]
        let mut cmd = Command::new("powershell");
        #[cfg(target_os = "windows")]
        {
            let mut act_args = format!("act -W {} -j {} --reuse", relative_path, job_id);
            if let Some(ref path) = secrets_file {
                act_args.push_str(&format!(" --secret-file \"{}\"", path.to_string_lossy()));
            }
            cmd.args(&["-NoProfile", "-Command", &act_args]);
        }

        #[cfg(not(target_os = "windows"))]
        let mut cmd = Command::new("act");
        #[cfg(not(target_os = "windows"))]
        {
            cmd.args(&["-W", relative_path, "-j", job_id, "--reuse"]);
            if let Some(ref path) = secrets_file {
                cmd.args(&["--secret-file", &path.to_string_lossy()]);
            }
        }

        cmd.current_dir(repo_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            format!(
                "Failed to spawn 'act'. Is Docker running and 'act' installed? Error: {}",
                e
            )
        })?;

        let pid = child.id();
        println!("[BACKEND] Spawned act process with PID: {:?}", pid);
        if let Some(pid) = pid {
            if let Ok(mut active) = get_active_pid().lock() {
                *active = Some(pid);
            }
        }

        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let log_cb_1 = std::sync::Arc::new(log_callback);
        let log_cb_2 = log_cb_1.clone();
        let job_id_str1 = job_id.to_string();
        let job_id_str2 = job_id.to_string();

        let stdout_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                println!("[BACKEND stdout] {}", line);
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
                println!("[BACKEND stderr] {}", line);
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

        let status = child.wait().await;
        println!("[BACKEND] Child wait result: {:?}", status);

        if let Ok(mut active) = get_active_pid().lock() {
            *active = None;
        }

        // Abort reader tasks to prevent grandchild pipe leaks from hanging the command
        stdout_handle.abort();
        stderr_handle.abort();

        let status = status.map_err(|e| format!("Failed to wait for act process: {}", e))?;

        if status.success() {
            println!("[BACKEND] Job completed successfully");
            Ok(())
        } else {
            println!("[BACKEND] Job failed with exit status: {:?}", status.code());
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

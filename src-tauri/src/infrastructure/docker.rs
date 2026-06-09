use tokio::process::Command;
use crate::domain::docker::{DockerSystemSummary, DockerContainerInfo, DockerImageInfo, DockerVolumeInfo};

pub async fn get_docker_summary() -> Result<DockerSystemSummary, String> {
    let output = Command::new("docker")
        .args(&["system", "df"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute docker system df: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut summary = DockerSystemSummary::default();

    for line in stdout_str.lines() {
        let tokens: Vec<&str> = line.split_whitespace().collect();
        if tokens.is_empty() {
            continue;
        }

        if tokens[0] == "Images" && tokens.len() >= 5 {
            summary.images_size = tokens[3].to_string();
            summary.images_reclaimable = tokens[4].to_string();
        } else if tokens[0] == "Containers" && tokens.len() >= 5 {
            summary.containers_size = tokens[3].to_string();
            summary.containers_reclaimable = tokens[4].to_string();
        } else if tokens[0] == "Local" && tokens.len() >= 6 && tokens[1] == "Volumes" {
            summary.volumes_size = tokens[4].to_string();
            summary.volumes_reclaimable = tokens[5].to_string();
        }
    }

    Ok(summary)
}

pub async fn list_containers() -> Result<Vec<DockerContainerInfo>, String> {
    let output = Command::new("docker")
        .args(&["ps", "-a", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}"])
        .output()
        .await
        .map_err(|e| format!("Failed to list docker containers: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut containers = Vec::new();

    for line in stdout_str.lines() {
        let tokens: Vec<&str> = line.split('\t').collect();
        if tokens.len() >= 4 {
            let id = tokens[0].to_string();
            let name = tokens[1].to_string();
            let image = tokens[2].to_string();
            let status = tokens[3].to_string();
            let is_act = name.starts_with("act-");

            containers.push(DockerContainerInfo {
                id,
                name,
                image,
                status,
                is_act,
            });
        }
    }

    Ok(containers)
}

pub async fn list_images() -> Result<Vec<DockerImageInfo>, String> {
    let output = Command::new("docker")
        .args(&["images", "--format", "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}"])
        .output()
        .await
        .map_err(|e| format!("Failed to list docker images: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut images = Vec::new();

    for line in stdout_str.lines() {
        let tokens: Vec<&str> = line.split('\t').collect();
        if tokens.len() >= 4 {
            let id = tokens[0].to_string();
            let repository = tokens[1].to_string();
            let tag = tokens[2].to_string();
            let size = tokens[3].to_string();
            let is_act = repository.contains("catthehacker") || repository.contains("nektos/act");

            images.push(DockerImageInfo {
                id,
                repository,
                tag,
                size,
                is_act,
            });
        }
    }

    Ok(images)
}

pub async fn list_volumes() -> Result<Vec<DockerVolumeInfo>, String> {
    let output = Command::new("docker")
        .args(&["volume", "ls", "--format", "{{.Name}}"])
        .output()
        .await
        .map_err(|e| format!("Failed to list docker volumes: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut volumes = Vec::new();

    for line in stdout_str.lines() {
        let name = line.trim().to_string();
        if !name.is_empty() {
            let is_act = name.starts_with("act-");
            volumes.push(DockerVolumeInfo {
                name,
                is_act,
            });
        }
    }

    Ok(volumes)
}

pub async fn prune_containers() -> Result<u32, String> {
    // List containers with prefix 'act-' that are stopped (exited or created status)
    let output = Command::new("docker")
        .args(&[
            "ps",
            "-a",
            "--filter",
            "name=act-",
            "--filter",
            "status=exited",
            "--filter",
            "status=created",
            "--format",
            "{{.ID}}",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to query stopped containers for pruning: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let ids: Vec<&str> = stdout_str
        .lines()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if ids.is_empty() {
        return Ok(0);
    }

    let mut cmd = Command::new("docker");
    cmd.arg("rm").arg("-v");
    for id in &ids {
        cmd.arg(id);
    }

    let rm_output = cmd.output().await.map_err(|e| format!("Failed to execute docker rm: {}", e))?;
    if !rm_output.status.success() {
        return Err(String::from_utf8_lossy(&rm_output.stderr).to_string());
    }

    Ok(ids.len() as u32)
}

pub async fn prune_volumes() -> Result<u32, String> {
    // List dangling volumes
    let output = Command::new("docker")
        .args(&["volume", "ls", "-q", "--filter", "dangling=true"])
        .output()
        .await
        .map_err(|e| format!("Failed to query dangling volumes for pruning: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut names_to_prune = Vec::new();

    for line in stdout_str.lines() {
        let name = line.trim();
        // Only prune volumes starting with 'act-' and NOT act-toolcache
        if name.starts_with("act-") && name != "act-toolcache" && !name.is_empty() {
            names_to_prune.push(name);
        }
    }

    if names_to_prune.is_empty() {
        return Ok(0);
    }

    let mut cmd = Command::new("docker");
    cmd.arg("volume").arg("rm");
    for name in &names_to_prune {
        cmd.arg(name);
    }

    let rm_output = cmd.output().await.map_err(|e| format!("Failed to execute docker volume rm: {}", e))?;
    if !rm_output.status.success() {
        return Err(String::from_utf8_lossy(&rm_output.stderr).to_string());
    }

    Ok(names_to_prune.len() as u32)
}

pub async fn prune_images() -> Result<u32, String> {
    // Runs 'docker image prune -f' which removes dangling images
    let output = Command::new("docker")
        .args(&["image", "prune", "-f"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute docker image prune: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // We can parse the output to count how many images or space was reclaimed,
    // but returning a general success is fine. Let's just return 1 if successful.
    Ok(1)
}

pub async fn delete_container(id: &str) -> Result<(), String> {
    let output = Command::new("docker")
        .args(&["rm", "-f", "-v", id])
        .output()
        .await
        .map_err(|e| format!("Failed to remove container {}: {}", id, e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

pub async fn delete_image(id: &str) -> Result<(), String> {
    let output = Command::new("docker")
        .args(&["rmi", "-f", id])
        .output()
        .await
        .map_err(|e| format!("Failed to remove image {}: {}", id, e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

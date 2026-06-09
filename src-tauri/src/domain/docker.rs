use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DockerSystemSummary {
    pub images_size: String,
    pub images_reclaimable: String,
    pub containers_size: String,
    pub containers_reclaimable: String,
    pub volumes_size: String,
    pub volumes_reclaimable: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub is_act: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub is_act: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerVolumeInfo {
    pub name: String,
    pub is_act: bool,
}

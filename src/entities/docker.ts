export interface DockerSystemSummary {
  images_size: string;
  images_reclaimable: string;
  containers_size: string;
  containers_reclaimable: string;
  volumes_size: string;
  volumes_reclaimable: string;
}

export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  is_act: boolean;
}

export interface DockerImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  is_act: boolean;
}

export interface DockerVolumeInfo {
  name: string;
  is_act: boolean;
}

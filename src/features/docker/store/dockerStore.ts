import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { DockerSystemSummary, DockerContainerInfo, DockerImageInfo, DockerVolumeInfo } from "../../../entities/docker";

interface DockerState {
  isModalOpen: boolean;
  summary: DockerSystemSummary | null;
  containers: DockerContainerInfo[];
  images: DockerImageInfo[];
  volumes: DockerVolumeInfo[];
  loading: boolean;
  autoPruneOnStartup: boolean;
  autoPruneOnWorkspaceSwitch: boolean;

  setModalOpen: (open: boolean) => void;
  fetchStats: () => Promise<void>;
  pruneContainers: () => Promise<number>;
  pruneVolumes: () => Promise<number>;
  pruneImages: () => Promise<void>;
  deleteContainer: (id: string) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  toggleSetting: (key: "autoPruneOnStartup" | "autoPruneOnWorkspaceSwitch") => void;
  autoCleanOnStartup: () => Promise<void>;
  autoCleanOnWorkspaceSwitch: () => Promise<void>;
}

const getLocalStorageBool = (key: string, defaultValue: boolean): boolean => {
  const val = localStorage.getItem(key);
  return val !== null ? val === "true" : defaultValue;
};

export const useDockerStore = create<DockerState>((set, get) => ({
  isModalOpen: false,
  summary: null,
  containers: [],
  images: [],
  volumes: [],
  loading: false,
  autoPruneOnStartup: getLocalStorageBool("gale_auto_prune_startup", true),
  autoPruneOnWorkspaceSwitch: getLocalStorageBool("gale_auto_prune_workspace_switch", true),

  setModalOpen: (open) => {
    set({ isModalOpen: open });
    if (open) {
      get().fetchStats();
    }
  },

  fetchStats: async () => {
    set({ loading: true });
    try {
      const summary = await invoke<DockerSystemSummary>("get_docker_summary_cmd");
      const containers = await invoke<DockerContainerInfo[]>("list_docker_containers_cmd");
      const images = await invoke<DockerImageInfo[]>("list_docker_images_cmd");
      const volumes = await invoke<DockerVolumeInfo[]>("list_docker_volumes_cmd");

      set({ summary, containers, images, volumes });
    } catch (err) {
      console.error("Failed to fetch Docker stats:", err);
    } finally {
      set({ loading: false });
    }
  },

  pruneContainers: async () => {
    try {
      const count = await invoke<number>("prune_docker_containers_cmd");
      await get().fetchStats();
      return count;
    } catch (err) {
      console.error("Failed to prune docker containers:", err);
      return 0;
    }
  },

  pruneVolumes: async () => {
    try {
      const count = await invoke<number>("prune_docker_volumes_cmd");
      await get().fetchStats();
      return count;
    } catch (err) {
      console.error("Failed to prune docker volumes:", err);
      return 0;
    }
  },

  pruneImages: async () => {
    try {
      await invoke("prune_docker_images_cmd");
      await get().fetchStats();
    } catch (err) {
      console.error("Failed to prune docker images:", err);
    }
  },

  deleteContainer: async (id) => {
    try {
      await invoke("delete_docker_container_cmd", { id });
      await get().fetchStats();
    } catch (err) {
      console.error(`Failed to delete container ${id}:`, err);
    }
  },

  deleteImage: async (id) => {
    try {
      await invoke("delete_docker_image_cmd", { id });
      await get().fetchStats();
    } catch (err) {
      console.error(`Failed to delete image ${id}:`, err);
    }
  },

  toggleSetting: (key) => {
    const nextVal = !get()[key];
    set({ [key]: nextVal } as any);
    const lsKey = key === "autoPruneOnStartup" ? "gale_auto_prune_startup" : "gale_auto_prune_workspace_switch";
    localStorage.setItem(lsKey, String(nextVal));
  },

  autoCleanOnStartup: async () => {
    if (!get().autoPruneOnStartup) return;
    console.log("[DOCKER STORE] Performing startup auto-cleanup...");
    try {
      const prunedContainers = await invoke<number>("prune_docker_containers_cmd");
      const prunedVolumes = await invoke<number>("prune_docker_volumes_cmd");
      if (prunedContainers > 0 || prunedVolumes > 0) {
        console.log(`[DOCKER STORE] Startup cleanup: Pruned ${prunedContainers} containers and ${prunedVolumes} volumes.`);
      }
    } catch (err) {
      console.error("Startup Docker auto-cleanup failed:", err);
    }
  },

  autoCleanOnWorkspaceSwitch: async () => {
    if (!get().autoPruneOnWorkspaceSwitch) return;
    console.log("[DOCKER STORE] Performing workspace switch auto-cleanup...");
    try {
      const prunedContainers = await invoke<number>("prune_docker_containers_cmd");
      const prunedVolumes = await invoke<number>("prune_docker_volumes_cmd");
      if (prunedContainers > 0 || prunedVolumes > 0) {
        console.log(`[DOCKER STORE] Workspace switch cleanup: Pruned ${prunedContainers} containers and ${prunedVolumes} volumes.`);
      }
    } catch (err) {
      console.error("Workspace switch Docker auto-cleanup failed:", err);
    }
  }
}));

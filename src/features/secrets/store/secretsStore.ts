import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface SecretsState {
  secrets: Record<string, string>;
  newSecretKey: string;
  newSecretValue: string;
  isSecretsModalOpen: boolean;
  
  // Setters simples
  setNewSecretKey: (key: string) => void;
  setNewSecretValue: (val: string) => void;
  setSecretsModalOpen: (isOpen: boolean) => void;
  
  // Ações assíncronas com Tauri
  loadSecrets: (repoPath: string) => Promise<void>;
  addSecret: (repoPath: string) => Promise<void>;
  removeSecret: (repoPath: string, key: string) => Promise<void>;
  importFromEnv: (repoPath: string) => Promise<void>;
  clearSecrets: () => void;
}

export const useSecretsStore = create<SecretsState>((set, get) => ({
  secrets: {},
  newSecretKey: "",
  newSecretValue: "",
  isSecretsModalOpen: false,

  setNewSecretKey: (key) => set({ newSecretKey: key.toUpperCase() }),
  setNewSecretValue: (val) => set({ newSecretValue: val }),
  setSecretsModalOpen: (isOpen) => set({ isSecretsModalOpen: isOpen }),

  loadSecrets: async (repoPath) => {
    if (!repoPath) {
      set({ secrets: {} });
      return;
    }
    try {
      const data = await invoke<Record<string, string>>("load_secrets_cmd", { repoPath });
      set({ secrets: data });
    } catch (err) {
      console.error("Failed to load secrets:", err);
    }
  },

  addSecret: async (repoPath) => {
    const { newSecretKey, newSecretValue, secrets } = get();
    if (!newSecretKey.trim() || !newSecretValue.trim() || !repoPath) return;
    
    const key = newSecretKey.trim().toUpperCase();
    const updated = { ...secrets, [key]: newSecretValue.trim() };
    
    try {
      await invoke("save_secrets_cmd", { repoPath, secrets: updated });
      set({ secrets: updated, newSecretKey: "", newSecretValue: "" });
    } catch (err) {
      console.error("Failed to save secret:", err);
    }
  },

  removeSecret: async (repoPath, key) => {
    if (!repoPath) return;
    const { secrets } = get();
    const updated = { ...secrets };
    delete updated[key];

    try {
      await invoke("save_secrets_cmd", { repoPath, secrets: updated });
      set({ secrets: updated });
    } catch (err) {
      console.error("Failed to delete secret:", err);
    }
  },

  importFromEnv: async (repoPath) => {
    if (!repoPath) return;
    try {
      const merged = await invoke<Record<string, string>>("import_secrets_from_env_cmd", { repoPath });
      set({ secrets: merged });
    } catch (err) {
      if (err !== "No file selected") {
        console.error("Failed to import from .env:", err);
      }
    }
  },

  clearSecrets: () => set({ secrets: {}, newSecretKey: "", newSecretValue: "" }),
}));

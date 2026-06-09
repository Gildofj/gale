import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Workflow, Job, LogLine } from "../../../entities/pipeline";
import { useDockerStore } from "../../docker/store/dockerStore";

interface WorkflowState {
  repoPath: string;
  workflows: Workflow[];
  activeWorkflow: Workflow | null;
  activeJob: Job | null;
  logs: Record<string, LogLine[]>;
  runningJobId: string | null;
  jobStatuses: Record<string, "pending" | "running" | "success" | "error">;
  isWorkflowRunning: boolean;
  abortWorkflow: boolean;
  activeTab: "graph" | "logs";
  
  // Dependências de ambiente
  dockerInstalled: boolean;
  actInstalled: boolean;
  checkingDeps: boolean;
  
  // Listeners de Tauri
  unlisteners: UnlistenFn[];

  // Setters simples
  setActiveWorkflow: (wf: Workflow | null) => void;
  setActiveJob: (job: Job | null) => void;
  setActiveTab: (tab: "graph" | "logs") => void;
  setRepoPath: (path: string) => void;
  clearLogs: () => void;
  
  // Ações complexas
  checkDependencies: () => Promise<void>;
  selectDirectory: () => Promise<void>;
  loadWorkflows: (path: string) => Promise<void>;
  reloadWorkflows: (path: string) => Promise<void>;
  initListeners: () => Promise<void>;
  cleanupListeners: () => void;
  
  // Execução de Pipelines
  runSingleJob: (job: Job) => Promise<boolean>;
  runJob: () => Promise<void>;
  runWorkflow: () => Promise<void>;
  stopJob: () => Promise<void>;
  stopWorkflow: () => Promise<void>;
}

// Helpers para ordenamento topológico e dependências
const getTopologicallySortedJobs = (jobs: Job[]): Job[] => {
  const sorted: Job[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (jobId: string) => {
    if (visiting.has(jobId)) return; // Ciclo
    if (!visited.has(jobId)) {
      visiting.add(jobId);
      const job = jobs.find((j) => j.id === jobId);
      if (job && job.needs) {
        for (const depId of job.needs) {
          visit(depId);
        }
      }
      visiting.delete(jobId);
      visited.add(jobId);
      if (job) {
        sorted.push(job);
      }
    }
  };

  for (const job of jobs) {
    visit(job.id);
  }
  return sorted;
};

export const areDependenciesMet = (job: Job, statuses: Record<string, string>): boolean => {
  if (!job.needs || job.needs.length === 0) return true;
  return job.needs.every((depId) => statuses[depId] === "success");
};

const updateBaseJobStatuses = (
  statuses: Record<string, "pending" | "running" | "success" | "error">,
  jobs: Job[]
): Record<string, "pending" | "running" | "success" | "error"> => {
  const nextStatuses = { ...statuses };
  for (const job of jobs) {
    if (job.matrix_configs && job.matrix_configs.length > 0) {
      const configStatuses = job.matrix_configs.map((cfg) => nextStatuses[cfg.id] || "pending");
      if (configStatuses.includes("error")) {
        nextStatuses[job.id] = "error";
      } else if (configStatuses.includes("running")) {
        nextStatuses[job.id] = "running";
      } else if (configStatuses.every((s) => s === "success")) {
        nextStatuses[job.id] = "success";
      } else {
        nextStatuses[job.id] = "pending";
      }
    }
  }
  return nextStatuses;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  repoPath: "",
  workflows: [],
  activeWorkflow: null,
  activeJob: null,
  logs: {},
  runningJobId: null,
  jobStatuses: {},
  isWorkflowRunning: false,
  abortWorkflow: false,
  activeTab: "graph",
  
  dockerInstalled: false,
  actInstalled: false,
  checkingDeps: true,
  unlisteners: [],

  setActiveWorkflow: (wf) => {
    set({ activeWorkflow: wf });
    if (wf && wf.jobs.length > 0) {
      set({ activeJob: wf.jobs[0] });
    } else {
      set({ activeJob: null });
    }
    set({ logs: {} });
  },

  setActiveJob: (job) => set({ activeJob: job }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setRepoPath: (path) => set({ repoPath: path }),
  clearLogs: () => set({ logs: {} }),

  checkDependencies: async () => {
    set({ checkingDeps: true });
    try {
      const [dockerOk, actOk] = await invoke<[boolean, boolean]>("check_dependencies_cmd");
      set({ dockerInstalled: dockerOk, actInstalled: actOk });
    } catch (err) {
      console.error("Dependency check failed:", err);
    } finally {
      set({ checkingDeps: false });
    }
  },

  selectDirectory: async () => {
    try {
      const selected = await invoke<string | null>("select_directory_cmd");
      if (selected) {
        set({ repoPath: selected });
        await get().loadWorkflows(selected);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  },

  loadWorkflows: async (path) => {
    try {
      const list = await invoke<Workflow[]>("list_workflows_cmd", { repoPath: path });
      set({ workflows: list });
      
      if (list.length > 0) {
        const firstWorkflow = list[0];
        set({
          activeWorkflow: firstWorkflow,
          activeJob: firstWorkflow.jobs.length > 0 ? firstWorkflow.jobs[0] : null,
        });
      } else {
        set({ activeWorkflow: null, activeJob: null });
      }
      set({ logs: {}, runningJobId: null, jobStatuses: {} });
      
      // Auto clean stopped Docker resources of other/inactive workspaces
      useDockerStore.getState().autoCleanOnWorkspaceSwitch();
    } catch (err) {
      console.error("Failed to list workflows:", err);
    }
  },

  reloadWorkflows: async (path) => {
    try {
      const list = await invoke<Workflow[]>("list_workflows_cmd", { repoPath: path });
      set({ workflows: list });

      const { activeWorkflow, activeJob } = get();

      const stillActiveWorkflow = list.find(wf => wf.file_path === activeWorkflow?.file_path);
      if (stillActiveWorkflow) {
        set({ activeWorkflow: stillActiveWorkflow });
        const stillActiveJob = stillActiveWorkflow.jobs.find(j => j.id === activeJob?.id);
        if (stillActiveJob) {
          set({ activeJob: stillActiveJob });
        } else if (stillActiveWorkflow.jobs.length > 0) {
          set({ activeJob: stillActiveWorkflow.jobs[0] });
        } else {
          set({ activeJob: null });
        }
      } else if (list.length > 0) {
        const firstWorkflow = list[0];
        set({
          activeWorkflow: firstWorkflow,
          activeJob: firstWorkflow.jobs.length > 0 ? firstWorkflow.jobs[0] : null,
        });
      } else {
        set({ activeWorkflow: null, activeJob: null });
      }
    } catch (err) {
      console.error("Failed to reload workflows:", err);
    }
  },

  initListeners: async () => {
    // Evita duplicar se já houver listeners rodando
    get().cleanupListeners();

    const cleanupWorkflows = await listen("workflows-changed", () => {
      const { repoPath } = get();
      console.log("[ZUSTAND] workflows-changed event received");
      if (repoPath) {
        get().reloadWorkflows(repoPath);
      }
    });

    const cleanupLogs = await listen<LogLine>("runner-log", (event) => {
      console.log("[ZUSTAND] runner-log event received:", event.payload);
      const jobId = event.payload.job_id;
      const msg = event.payload.message;
      set((state) => {
        const previousLogs = state.logs[jobId] || [];
        const nextState: Partial<WorkflowState> = {
          logs: {
            ...state.logs,
            [jobId]: [...previousLogs, event.payload],
          },
        };

        const currentStatuses = { ...state.jobStatuses };
        let statusChanged = false;

        if (msg.includes("🏁  Job succeeded")) {
          currentStatuses[jobId] = "success";
          statusChanged = true;
        } else if (msg.includes("🏁  Job failed")) {
          currentStatuses[jobId] = "error";
          statusChanged = true;
        } else if (
          currentStatuses[jobId] !== "running" &&
          currentStatuses[jobId] !== "success" &&
          currentStatuses[jobId] !== "error"
        ) {
          currentStatuses[jobId] = "running";
          statusChanged = true;
        }

        if (statusChanged) {
          nextState.jobStatuses = updateBaseJobStatuses(currentStatuses, state.activeWorkflow?.jobs || []);
        }

        return nextState;
      });
    });

    // Inicia watcher inicial do Tauri para o repositório se já estiver definido
    const { repoPath } = get();
    await invoke("start_watching_workflows", { repoPath });

    set({ unlisteners: [cleanupWorkflows, cleanupLogs] });
  },

  cleanupListeners: () => {
    const { unlisteners } = get();
    unlisteners.forEach((unlisten) => unlisten());
    set({ unlisteners: [] });
  },

  runSingleJob: async (job: Job) => {
    set({ runningJobId: job.id });
    const baseId = job.id;
    
    set((state) => {
      const updatedStatuses = { ...state.jobStatuses };
      const updatedLogs = { ...state.logs };
      
      if (job.matrix_configs && job.matrix_configs.length > 0) {
        job.matrix_configs.forEach((cfg) => {
          updatedStatuses[cfg.id] = "running";
          updatedLogs[cfg.id] = [
            {
              job_id: cfg.id,
              step_name: "client-system",
              message: `Starting local run for execution: ${cfg.name}...`,
              stream: "stdout",
              timestamp: Date.now(),
            },
          ];
        });
        updatedStatuses[job.id] = "running";
      } else {
        updatedStatuses[job.id] = "running";
        updatedLogs[job.id] = [
          {
            job_id: job.id,
            step_name: "client-system",
            message: `Starting local run for job: ${job.id}...`,
            stream: "stdout",
            timestamp: Date.now(),
          },
        ];
      }
      
      return {
        jobStatuses: updatedStatuses,
        logs: updatedLogs,
      };
    });

    try {
      const { repoPath, activeWorkflow } = get();
      await invoke("run_job_cmd", {
        repoPath,
        workflowFile: activeWorkflow!.file_path,
        jobId: baseId,
      });

      set((state) => {
        const updatedStatuses = { ...state.jobStatuses };
        const updatedLogs = { ...state.logs };
        const activeWorkflow = state.activeWorkflow;
        if (job.matrix_configs && job.matrix_configs.length > 0) {
          job.matrix_configs.forEach((cfg) => {
            const currentStatus = updatedStatuses[cfg.id];
            if (currentStatus === "running" || currentStatus === "pending") {
              updatedStatuses[cfg.id] = "success";
            }
            updatedLogs[cfg.id] = [
              ...(updatedLogs[cfg.id] || []),
              {
                job_id: cfg.id,
                step_name: "client-system",
                message: "Execution completed successfully!",
                stream: "stdout",
                timestamp: Date.now(),
              },
            ];
          });
        } else {
          updatedStatuses[job.id] = "success";
          updatedLogs[job.id] = [
            ...(updatedLogs[job.id] || []),
            {
              job_id: job.id,
              step_name: "client-system",
              message: "Job completed successfully!",
              stream: "stdout",
              timestamp: Date.now(),
            },
          ];
        }
        
        const nextStatuses = updateBaseJobStatuses(updatedStatuses, activeWorkflow?.jobs || []);
        return {
          jobStatuses: nextStatuses,
          logs: updatedLogs,
        };
      });
      return true;
    } catch (err) {
      set((state) => {
        const updatedStatuses = { ...state.jobStatuses };
        const updatedLogs = { ...state.logs };
        const activeWorkflow = state.activeWorkflow;
        if (job.matrix_configs && job.matrix_configs.length > 0) {
          job.matrix_configs.forEach((cfg) => {
            const currentStatus = updatedStatuses[cfg.id];
            if (currentStatus === "running" || currentStatus === "pending") {
              updatedStatuses[cfg.id] = "error";
            }
            updatedLogs[cfg.id] = [
              ...(updatedLogs[cfg.id] || []),
              {
                job_id: cfg.id,
                step_name: "client-system",
                message: `Execution failed/cancelled: ${err}`,
                stream: "stderr",
                timestamp: Date.now(),
              },
            ];
          });
        } else {
          updatedStatuses[job.id] = "error";
          updatedLogs[job.id] = [
            ...(updatedLogs[job.id] || []),
            {
              job_id: job.id,
              step_name: "client-system",
              message: `Job failed/cancelled: ${err}`,
              stream: "stderr",
              timestamp: Date.now(),
            },
          ];
        }
        
        const nextStatuses = updateBaseJobStatuses(updatedStatuses, activeWorkflow?.jobs || []);
        return {
          jobStatuses: nextStatuses,
          logs: updatedLogs,
        };
      });
      return false;
    } finally {
      set({ runningJobId: null });
    }
  },

  runJob: async () => {
    const { repoPath, activeWorkflow, activeJob, runningJobId, isWorkflowRunning, jobStatuses } = get();
    if (!repoPath || !activeWorkflow || !activeJob || runningJobId !== null || isWorkflowRunning) return;
    if (!areDependenciesMet(activeJob, jobStatuses)) return;
    
    await get().runSingleJob(activeJob);
  },

  runWorkflow: async () => {
    const { repoPath, activeWorkflow, runningJobId, isWorkflowRunning, logs } = get();
    if (!repoPath || !activeWorkflow || runningJobId !== null || isWorkflowRunning) return;

    set({ isWorkflowRunning: true, abortWorkflow: false });

    // Reset status e logs dos jobs do workflow ativo
    const initialStatuses: Record<string, "pending" | "running" | "success" | "error"> = {};
    const initialLogs = { ...logs };
    for (const job of activeWorkflow.jobs) {
      initialStatuses[job.id] = "pending";
      initialLogs[job.id] = [];
      if (job.matrix_configs) {
        for (const cfg of job.matrix_configs) {
          initialStatuses[cfg.id] = "pending";
          initialLogs[cfg.id] = [];
        }
      }
    }
    set({ jobStatuses: initialStatuses, logs: initialLogs });

    const sortedJobs = getTopologicallySortedJobs(activeWorkflow.jobs);

    for (const job of sortedJobs) {
      const { abortWorkflow, jobStatuses: currentStatuses } = get();
      if (abortWorkflow) {
        break;
      }

      // If the job has already completed (e.g. as part of a matrix run), skip it!
      if (currentStatuses[job.id] === "success" || currentStatuses[job.id] === "error") {
        continue;
      }

      // Valida se pré-requisitos tiveram sucesso
      const needs = job.needs || [];
      const dependenciesMet = needs.every((depId) => currentStatuses[depId] === "success");

      if (!dependenciesMet && needs.length > 0) {
        // Pula o job se suas dependências falharam
        set((state) => ({
          jobStatuses: { ...state.jobStatuses, [job.id]: "error" },
          logs: {
            ...state.logs,
            [job.id]: [
              {
                job_id: job.id,
                step_name: "client-system",
                message: `Skipped: Prerequisites (${needs.join(", ")}) did not complete successfully.`,
                stream: "stderr",
                timestamp: Date.now(),
              },
            ],
          },
        }));
        continue;
      }

      set({ activeJob: job });
      const success = await get().runSingleJob(job);

      if (!success) {
        // Interrompe execução se houver erro
        break;
      }
    }

    set({ isWorkflowRunning: false });
  },

  stopJob: async () => {
    try {
      await invoke("stop_job_cmd");
    } catch (err) {
      console.error("Failed to stop job:", err);
    }
  },

  stopWorkflow: async () => {
    set({ abortWorkflow: true });
    await get().stopJob();
    set({ isWorkflowRunning: false });
  },
}));

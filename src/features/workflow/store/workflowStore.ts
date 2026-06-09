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
  
  // Dependências de ambiente
  dockerInstalled: boolean;
  actInstalled: boolean;
  checkingDeps: boolean;

  // Listeners de Tauri
  unlisteners: UnlistenFn[];

  // Setters simples
  setActiveWorkflow: (wf: Workflow | null) => void;
  setActiveJob: (job: Job | null) => void;
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
      set((state) => {
        const previousLogs = state.logs[jobId] || [];
        return {
          logs: {
            ...state.logs,
            [jobId]: [...previousLogs, event.payload],
          },
        };
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

  runSingleJob: async (job) => {
    set({ runningJobId: job.id });
    set((state) => ({
      jobStatuses: { ...state.jobStatuses, [job.id]: "running" },
      logs: {
        ...state.logs,
        [job.id]: [
          {
            job_id: job.id,
            step_name: "client-system",
            message: `Starting local run for job: ${job.id}...`,
            stream: "stdout",
            timestamp: Date.now(),
          },
        ],
      },
    }));

    try {
      const { repoPath, activeWorkflow } = get();
      await invoke("run_job_cmd", {
        repoPath,
        workflowFile: activeWorkflow!.file_path,
        jobId: job.id,
      });

      set((state) => ({
        jobStatuses: { ...state.jobStatuses, [job.id]: "success" },
        logs: {
          ...state.logs,
          [job.id]: [
            ...(state.logs[job.id] || []),
            {
              job_id: job.id,
              step_name: "client-system",
              message: "Job completed successfully!",
              stream: "stdout",
              timestamp: Date.now(),
            },
          ],
        },
      }));
      return true;
    } catch (err) {
      set((state) => ({
        jobStatuses: { ...state.jobStatuses, [job.id]: "error" },
        logs: {
          ...state.logs,
          [job.id]: [
            ...(state.logs[job.id] || []),
            {
              job_id: job.id,
              step_name: "client-system",
              message: `Job failed/cancelled: ${err}`,
              stream: "stderr",
              timestamp: Date.now(),
            },
          ],
        },
      }));
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
    }
    set({ jobStatuses: initialStatuses, logs: initialLogs });

    const sortedJobs = getTopologicallySortedJobs(activeWorkflow.jobs);

    for (const job of sortedJobs) {
      const { abortWorkflow, jobStatuses: currentStatuses } = get();
      if (abortWorkflow) {
        break;
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

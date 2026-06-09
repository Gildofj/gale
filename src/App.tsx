import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./index.css";

interface Step {
  name: string | null;
  run: string | null;
  uses: string | null;
}

interface Job {
  id: string;
  name: string | null;
  steps: Step[];
  needs: string[] | null;
}

interface Workflow {
  file_path: string;
  name: string;
  events: string[];
  jobs: Job[];
}

interface LogLine {
  job_id: string;
  step_name: string;
  message: string;
  stream: string;
  timestamp: number;
}

export default function App() {
  const [repoPath, setRepoPath] = useState<string>("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<Record<string, LogLine[]>>({});
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [jobStatuses, setJobStatuses] = useState<Record<string, "pending" | "running" | "success" | "error">>({});
  const isRunning = runningJobId !== null;
  const [isWorkflowRunning, setIsWorkflowRunning] = useState<boolean>(false);
  const abortWorkflowRef = useRef<boolean>(false);

  // Secrets Management state
  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState<boolean>(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [newSecretKey, setNewSecretKey] = useState<string>("");
  const [newSecretValue, setNewSecretValue] = useState<string>("");

  // Load secrets when repoPath changes
  useEffect(() => {
    if (repoPath) {
      invoke<Record<string, string>>("load_secrets_cmd", { repoPath })
        .then((data) => setSecrets(data))
        .catch((err) => console.error("Failed to load secrets:", err));
    } else {
      setSecrets({});
    }
  }, [repoPath]);
  
  // Dependency status
  const [dockerInstalled, setDockerInstalled] = useState<boolean>(false);
  const [actInstalled, setActInstalled] = useState<boolean>(false);
  const [checkingDeps, setCheckingDeps] = useState<boolean>(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const activeWorkflowRef = useRef<Workflow | null>(null);
  const activeJobRef = useRef<Job | null>(null);

  useEffect(() => {
    activeWorkflowRef.current = activeWorkflow;
  }, [activeWorkflow]);

  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);

  // Start/stop watcher when repoPath changes
  useEffect(() => {
    invoke("start_watching_workflows", { repoPath })
      .catch((err) => console.error("Failed to start/stop watching workflows:", err));
  }, [repoPath]);

  // Listen to workflows-changed event
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    listen("workflows-changed", () => {
      console.log("[FRONTEND] workflows-changed event received");
      if (repoPath) {
        reloadWorkflows(repoPath);
      }
    }).then((fn) => {
      if (!active) {
        fn();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      active = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, [repoPath]);

  // Check dependencies on startup
  useEffect(() => {
    checkDependencies();
  }, []);

  // Set up listener for real-time runner logs
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    listen<LogLine>("runner-log", (event) => {
      console.log("[FRONTEND] runner-log event received:", event.payload);
      setLogs((prev) => {
        const jobId = event.payload.job_id;
        return {
          ...prev,
          [jobId]: [...(prev[jobId] || []), event.payload],
        };
      });
    }).then((fn) => {
      if (!active) {
        fn();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      active = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  // Scroll logs to bottom when new logs arrive
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, activeJob]);

  const activeJobLogs = activeJob ? logs[activeJob.id] || [] : [];

  const checkDependencies = async () => {
    setCheckingDeps(true);
    try {
      const [dockerOk, actOk] = await invoke<[boolean, boolean]>("check_dependencies_cmd");
      setDockerInstalled(dockerOk);
      setActInstalled(actOk);
    } catch (err) {
      console.error("Dependency check failed:", err);
    } finally {
      setCheckingDeps(false);
    }
  };

  const selectDirectory = async () => {
    try {
      const selected = await invoke<string | null>("select_directory_cmd");
      if (selected) {
        setRepoPath(selected);
        loadWorkflows(selected);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  };

  const loadWorkflows = async (path: string) => {
    try {
      const list = await invoke<Workflow[]>("list_workflows_cmd", { repoPath: path });
      setWorkflows(list);
      if (list.length > 0) {
        setActiveWorkflow(list[0]);
        if (list[0].jobs.length > 0) {
          setActiveJob(list[0].jobs[0]);
        } else {
          setActiveJob(null);
        }
      } else {
        setActiveWorkflow(null);
        setActiveJob(null);
      }
      setLogs({});
      setRunningJobId(null);
      setJobStatuses({});
    } catch (err) {
      console.error("Failed to list workflows:", err);
    }
  };

  const reloadWorkflows = async (path: string) => {
    try {
      const list = await invoke<Workflow[]>("list_workflows_cmd", { repoPath: path });
      setWorkflows(list);

      const currentActiveWorkflow = activeWorkflowRef.current;
      const currentActiveJob = activeJobRef.current;

      const stillActiveWorkflow = list.find(wf => wf.file_path === currentActiveWorkflow?.file_path);
      if (stillActiveWorkflow) {
        setActiveWorkflow(stillActiveWorkflow);
        const stillActiveJob = stillActiveWorkflow.jobs.find(j => j.id === currentActiveJob?.id);
        if (stillActiveJob) {
          setActiveJob(stillActiveJob);
        } else if (stillActiveWorkflow.jobs.length > 0) {
          setActiveJob(stillActiveWorkflow.jobs[0]);
        } else {
          setActiveJob(null);
        }
      } else if (list.length > 0) {
        setActiveWorkflow(list[0]);
        if (list[0].jobs.length > 0) {
          setActiveJob(list[0].jobs[0]);
        } else {
          setActiveJob(null);
        }
      } else {
        setActiveWorkflow(null);
        setActiveJob(null);
      }
    } catch (err) {
      console.error("Failed to reload workflows:", err);
    }
  };


  const getTopologicallySortedJobs = (jobs: Job[]): Job[] => {
    const sorted: Job[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (jobId: string) => {
      if (visiting.has(jobId)) return; // Cycle guard
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

  const areDependenciesMet = (job: Job, statuses: Record<string, string>): boolean => {
    if (!job.needs || job.needs.length === 0) return true;
    return job.needs.every((depId) => statuses[depId] === "success");
  };

  const runSingleJob = async (job: Job): Promise<boolean> => {
    setRunningJobId(job.id);
    setJobStatuses((prev) => ({ ...prev, [job.id]: "running" }));
    setLogs((prev) => ({
      ...prev,
      [job.id]: [
        {
          job_id: job.id,
          step_name: "client-system",
          message: `Starting local run for job: ${job.id}...`,
          stream: "stdout",
          timestamp: Date.now(),
        },
      ],
    }));

    try {
      await invoke("run_job_cmd", {
        repoPath,
        workflowFile: activeWorkflow!.file_path,
        jobId: job.id,
      });

      setJobStatuses((prev) => ({ ...prev, [job.id]: "success" }));
      setLogs((prev) => {
        const jobId = job.id;
        return {
          ...prev,
          [jobId]: [
            ...(prev[jobId] || []),
            {
              job_id: jobId,
              step_name: "client-system",
              message: "Job completed successfully!",
              stream: "stdout",
              timestamp: Date.now(),
            },
          ],
        };
      });
      return true;
    } catch (err) {
      setJobStatuses((prev) => ({ ...prev, [job.id]: "error" }));
      setLogs((prev) => {
        const jobId = job.id;
        return {
          ...prev,
          [jobId]: [
            ...(prev[jobId] || []),
            {
              job_id: jobId,
              step_name: "client-system",
              message: `Job failed/cancelled: ${err}`,
              stream: "stderr",
              timestamp: Date.now(),
            },
          ],
        };
      });
      return false;
    } finally {
      setRunningJobId(null);
    }
  };

  const runJob = async () => {
    if (!repoPath || !activeWorkflow || !activeJob || isRunning || isWorkflowRunning) return;
    if (!areDependenciesMet(activeJob, jobStatuses)) return;
    await runSingleJob(activeJob);
  };

  const runWorkflow = async () => {
    if (!repoPath || !activeWorkflow || isRunning || isWorkflowRunning) return;

    setIsWorkflowRunning(true);
    abortWorkflowRef.current = false;

    // Reset status and logs of all jobs in the active workflow
    const initialStatuses: Record<string, "pending" | "running" | "success" | "error"> = {};
    const initialLogs: Record<string, LogLine[]> = { ...logs };
    for (const job of activeWorkflow.jobs) {
      initialStatuses[job.id] = "pending";
      initialLogs[job.id] = [];
    }
    setJobStatuses(initialStatuses);
    setLogs(initialLogs);

    const sortedJobs = getTopologicallySortedJobs(activeWorkflow.jobs);
    let currentStatuses = { ...initialStatuses };

    for (const job of sortedJobs) {
      if (abortWorkflowRef.current) {
        break;
      }

      // Check if needs are met
      const needs = job.needs || [];
      const dependenciesMet = needs.every((depId) => currentStatuses[depId] === "success");

      if (!dependenciesMet && needs.length > 0) {
        // If dependencies failed, skip this job
        setJobStatuses((prev) => {
          const updated = { ...prev, [job.id]: "error" as const };
          currentStatuses = updated;
          return updated;
        });
        setLogs((prev) => ({
          ...prev,
          [job.id]: [
            {
              job_id: job.id,
              step_name: "client-system",
              message: `Skipped: Prerequisites (${needs.join(", ")}) did not complete successfully.`,
              stream: "stderr",
              timestamp: Date.now(),
            },
          ],
        }));
        continue;
      }

      setActiveJob(job);
      const success = await runSingleJob(job);
      currentStatuses[job.id] = success ? "success" : "error";

      if (!success) {
        // Stop sequential execution on first error
        break;
      }
    }

    setIsWorkflowRunning(false);
  };

  const stopJob = async () => {
    try {
      await invoke("stop_job_cmd");
    } catch (err) {
      console.error("Failed to stop job:", err);
    }
  };

  const stopWorkflow = async () => {
    abortWorkflowRef.current = true;
    await stopJob();
    setIsWorkflowRunning(false);
  };

  const addSecret = async () => {
    if (!newSecretKey.trim() || !newSecretValue.trim() || !repoPath) return;
    const key = newSecretKey.trim().toUpperCase();
    const updated = { ...secrets, [key]: newSecretValue.trim() };
    
    try {
      await invoke("save_secrets_cmd", { repoPath, secrets: updated });
      setSecrets(updated);
      setNewSecretKey("");
      setNewSecretValue("");
    } catch (err) {
      console.error("Failed to save secret:", err);
    }
  };

  const removeSecret = async (key: string) => {
    if (!repoPath) return;
    const updated = { ...secrets };
    delete updated[key];

    try {
      await invoke("save_secrets_cmd", { repoPath, secrets: updated });
      setSecrets(updated);
    } catch (err) {
      console.error("Failed to delete secret:", err);
    }
  };

  const importFromEnv = async () => {
    if (!repoPath) return;
    try {
      const merged = await invoke<Record<string, string>>("import_secrets_from_env_cmd", { repoPath });
      setSecrets(merged);
    } catch (err) {
      if (err !== "No file selected") {
        console.error("Failed to import from .env:", err);
      }
    }
  };

  const getRelativeName = (path: string) => {
    const idx = path.lastIndexOf("/");
    const idxBack = path.lastIndexOf("\\");
    const divider = idx > idxBack ? idx : idxBack;
    return divider !== -1 ? path.substring(divider + 1) : path;
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-brand-bg text-brand-text font-sans overflow-hidden">
      {/* Dependency Status Banner */}
      <div className="flex justify-between items-center py-2 px-4 bg-brand-panel border-b border-brand-border text-xs">
        <div>
          <span className="font-semibold text-brand-primary">Local Pipeline Orchestrator</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5 font-medium" title={dockerInstalled ? "Docker is running" : "Docker not found"}>
            <span className={`w-2 h-2 rounded-full ${dockerInstalled ? "bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.7)]" : "bg-brand-danger shadow-[0_0_8px_rgba(239,68,68,0.7)]"}`}></span>
            <span>Docker</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium" title={actInstalled ? "Act CLI is installed" : "Act CLI not found"}>
            <span className={`w-2 h-2 rounded-full ${actInstalled ? "bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.7)]" : "bg-brand-danger shadow-[0_0_8px_rgba(239,68,68,0.7)]"}`}></span>
            <span>act CLI</span>
          </div>
          <button 
            className="py-0.5 px-2 text-[10px] border border-brand-border bg-transparent hover:bg-brand-panel-header rounded font-medium text-brand-text cursor-pointer transition-colors duration-150 disabled:opacity-50" 
            onClick={checkDependencies} 
            disabled={checkingDeps}
          >
            {checkingDeps ? "Checking..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Workspace picking header */}
      <div className="flex items-center gap-3 p-4 bg-brand-panel border-b border-brand-border">
        <button 
          className="py-2 px-4 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-md font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 shadow-sm cursor-pointer active:translate-y-0" 
          onClick={selectDirectory}
        >
          Select Repository Folder
        </button>
        <div className="flex-1 py-2 px-3 bg-brand-console border border-brand-border rounded-md font-mono text-xs text-brand-muted truncate select-text" title={repoPath}>
          {repoPath || "No workspace folder selected (Choose a folder containing .github/workflows/)"}
        </div>
        {repoPath && (
          <button
            className="py-2 px-4 border border-brand-border hover:bg-brand-panel-header text-brand-text rounded-md font-medium text-sm cursor-pointer transition-colors duration-150 flex items-center gap-1.5"
            onClick={() => setIsSecretsModalOpen(true)}
          >
            <span>🔑</span>
            <span>Manage Secrets ({Object.keys(secrets).length})</span>
          </button>
        )}
      </div>

      {/* Main Workspace split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[300px] bg-brand-panel border-r border-brand-border flex flex-col overflow-y-auto select-none custom-scrollbar">
          <div className="py-3 px-4 text-[10px] uppercase tracking-wider text-brand-muted font-bold border-b border-brand-border">Workflows</div>
          {workflows.length === 0 ? (
            <div className="p-4 text-brand-muted text-xs italic">
              No local workflows found.
            </div>
          ) : (
            workflows.map((wf) => (
              <div
                key={wf.file_path}
                className={`py-3 px-4 border-b border-brand-border cursor-pointer transition-all duration-150 ${activeWorkflow?.file_path === wf.file_path ? "bg-brand-primary-light border-l-4 border-brand-primary" : "hover:bg-brand-primary/5"}`}
                onClick={() => {
                  setActiveWorkflow(wf);
                  if (wf.jobs.length > 0) {
                    setActiveJob(wf.jobs[0]);
                  } else {
                    setActiveJob(null);
                  }
                  setLogs({});
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="font-semibold text-sm truncate max-w-[170px]">{wf.name}</div>
                  <div className="text-[9px] py-0.5 px-1.5 bg-brand-panel-header rounded text-brand-muted font-medium truncate max-w-[90px]">{wf.events.join(", ")}</div>
                </div>
                <div className="text-[10px] text-brand-muted font-mono truncate">{getRelativeName(wf.file_path)}</div>
              </div>
            ))
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-brand-bg overflow-hidden">
          {activeWorkflow ? (
            <>
              {/* Job list selection panel */}
              <div className="p-4 bg-brand-panel border-b border-brand-border flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    Select Workflow Job
                  </div>
                  <div>
                    <button
                      className={`py-1.5 px-4 text-xs text-white rounded-md font-semibold cursor-pointer transition-all duration-150 active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none ${isWorkflowRunning ? "bg-brand-danger hover:bg-brand-danger/90" : "bg-brand-primary hover:bg-brand-primary-hover"}`}
                      onClick={isWorkflowRunning ? stopWorkflow : runWorkflow}
                      disabled={isRunning && !isWorkflowRunning}
                    >
                      {isWorkflowRunning ? "Stop Workflow Run" : "Run Entire Workflow"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {activeWorkflow.jobs.map((job) => {
                    const status = jobStatuses[job.id] || "pending";
                    const depsMet = areDependenciesMet(job, jobStatuses);
                    return (
                      <div
                        key={job.id}
                        className={`p-3 bg-brand-bg border rounded-lg min-w-[170px] cursor-pointer transition-all duration-200 hover:border-brand-primary hover:-translate-y-0.5 ${activeJob?.id === job.id ? "border-brand-primary bg-brand-primary-light" : "border-brand-border"} ${!depsMet ? "opacity-75 border-dashed border-brand-warning/40" : ""}`}
                        onClick={() => {
                          setActiveJob(job);
                        }}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-xs text-brand-text truncate mr-2">{job.name || job.id}</span>
                          {status === "running" && (
                            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" title="Running..." />
                          )}
                          {status === "success" && (
                            <span className="w-2 h-2 rounded-full bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.7)]" title="Success" />
                          )}
                          {status === "error" && (
                            <span className="w-2 h-2 rounded-full bg-brand-danger shadow-[0_0_8px_rgba(239,68,68,0.7)]" title="Error" />
                          )}
                          {status === "pending" && (
                            <span className="w-2 h-2 rounded-full bg-brand-dark" title="Pending" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-[10px] text-brand-muted">{job.steps.length} Steps</div>
                          {job.needs && job.needs.length > 0 && (
                            <div className="text-[9px] text-brand-warning truncate font-medium animate-pulse" title={`Needs: ${job.needs.join(", ")}`}>
                              {depsMet ? "✓" : "🔒"} Needs: {job.needs.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Console logs */}
              <div className="flex-1 flex flex-col bg-brand-console font-mono overflow-hidden">
                {activeJob && !areDependenciesMet(activeJob, jobStatuses) && (
                  <div className="bg-brand-warning-light border-b border-brand-warning/20 px-4 py-2 text-xs text-brand-warning flex items-center gap-2">
                    <span>⚠️</span>
                    <span>This job requires the following jobs to succeed first: <strong>{activeJob.needs?.join(", ")}</strong></span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2.5 px-4 bg-black/20 border-b border-brand-border text-xs">
                  <div className="flex items-center gap-2 font-semibold text-brand-text">
                    {runningJobId === activeJob?.id && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                    )}
                    <span>Terminal Logs: {activeJob?.name || activeJob?.id || "None"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={`py-1 px-3 text-xs text-white rounded font-medium cursor-pointer transition-all duration-150 active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none ${runningJobId === activeJob?.id ? "bg-brand-danger hover:bg-brand-danger/90" : "bg-brand-success hover:bg-brand-success/90"}`}
                      onClick={runningJobId === activeJob?.id ? stopJob : runJob}
                      disabled={!activeJob || isWorkflowRunning || (isRunning && runningJobId !== activeJob?.id) || !areDependenciesMet(activeJob, jobStatuses)}
                    >
                      {runningJobId === activeJob?.id ? "Stop Job" : "Run Job"}
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto text-[11px] leading-relaxed flex flex-col gap-1 select-text custom-scrollbar">
                  {activeJobLogs.length === 0 ? (
                    <div className="text-brand-dark italic">
                      Click "Run Job" to execute this job locally.
                    </div>
                  ) : (
                    activeJobLogs.map((log, index) => (
                      <div key={index} className="flex gap-3 py-0.5 px-1 rounded hover:bg-white/5">
                        <div className="text-brand-dark min-w-[70px] select-none">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-brand-primary min-w-[95px] font-semibold select-none truncate max-w-[120px]">
                          [{log.step_name}]
                        </div>
                        <div className={`flex-1 whitespace-pre-wrap break-all ${log.stream === "stderr" ? "text-brand-danger" : "text-brand-text"}`}>
                          {log.message}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-10 bg-brand-bg gap-4">
              <div className="text-5xl">🚀</div>
              <div className="text-2xl font-bold text-brand-text">Local Pipeline Orchestrator</div>
              <div className="text-brand-muted max-w-[480px] text-sm leading-relaxed">
                To get started, select a local repository directory containing a GitHub Actions workflows directory (`.github/workflows/`). 
                Make sure Docker is active and the `act` CLI is installed to execute jobs locally.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secrets Management Modal */}
      {isSecretsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[450px] bg-brand-panel border border-brand-border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-4 py-3 bg-brand-panel-header border-b border-brand-border">
              <span className="font-semibold text-sm text-brand-text">🔑 Local Secrets</span>
              <button 
                className="text-brand-muted hover:text-brand-text text-sm cursor-pointer"
                onClick={() => setIsSecretsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <p className="text-xs text-brand-muted leading-relaxed">
                Add local secrets for this repository. They are stored securely in your app data folder and never exposed to any database.
              </p>
              
              <div className="flex justify-between items-center bg-brand-primary-light border border-brand-primary/20 rounded-md p-3">
                <span className="text-xs text-brand-text font-medium">Have a local .env file?</span>
                <button
                  className="py-1 px-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-semibold rounded cursor-pointer transition-colors duration-150"
                  onClick={importFromEnv}
                >
                  Import .env File
                </button>
              </div>
              
              {/* Secrets List */}
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {Object.keys(secrets).length === 0 ? (
                  <div className="text-center text-xs text-brand-dark italic py-4">
                    No secrets configured for this repository yet.
                  </div>
                ) : (
                  Object.keys(secrets).map((key) => (
                    <div key={key} className="flex justify-between items-center p-2 bg-brand-bg border border-brand-border rounded-md text-xs">
                      <div className="font-mono text-brand-primary font-semibold truncate mr-2 select-text">{key}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-brand-muted select-none font-mono">******</span>
                        <button 
                          className="text-brand-danger hover:text-brand-danger/80 cursor-pointer font-medium ml-1"
                          onClick={() => removeSecret(key)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Secret Form */}
              <div className="border-t border-brand-border pt-4 flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Add New Secret</span>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="SECRET_NAME"
                    value={newSecretKey}
                    onChange={(e) => setNewSecretKey(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-xs font-mono text-brand-text outline-none focus:border-brand-primary"
                  />
                  <input
                    type="password"
                    placeholder="Secret Value"
                    value={newSecretValue}
                    onChange={(e) => setNewSecretValue(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-xs font-mono text-brand-text outline-none focus:border-brand-primary"
                  />
                  <button
                    className="mt-1 w-full py-2 bg-brand-primary hover:bg-brand-primary-hover text-white font-medium text-xs rounded-md cursor-pointer transition-colors"
                    onClick={addSecret}
                    disabled={!newSecretKey.trim() || !newSecretValue.trim()}
                  >
                    Add Secret
                  </button>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-brand-panel-header border-t border-brand-border flex justify-end">
              <button
                className="py-1.5 px-4 bg-brand-primary hover:bg-brand-primary-hover text-white rounded font-medium text-xs cursor-pointer transition-colors"
                onClick={() => setIsSecretsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

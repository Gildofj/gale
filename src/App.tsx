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
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Dependency status
  const [dockerInstalled, setDockerInstalled] = useState<boolean>(false);
  const [actInstalled, setActInstalled] = useState<boolean>(false);
  const [checkingDeps, setCheckingDeps] = useState<boolean>(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Check dependencies on startup
  useEffect(() => {
    checkDependencies();
  }, []);

  // Set up listener for real-time runner logs
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<LogLine>("runner-log", (event) => {
      setLogs((prev) => [...prev, event.payload]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Scroll logs to bottom when new logs arrive
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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
      setLogs([]);
      setIsRunning(false);
    } catch (err) {
      console.error("Failed to list workflows:", err);
    }
  };

  const runJob = async () => {
    if (!repoPath || !activeWorkflow || !activeJob || isRunning) return;

    setIsRunning(true);
    setLogs([
      {
        job_id: activeJob.id,
        step_name: "client-system",
        message: `Starting local run for job: ${activeJob.id}...`,
        stream: "stdout",
        timestamp: Date.now(),
      },
    ]);

    try {
      await invoke("run_job_cmd", {
        repoPath,
        workflowFile: activeWorkflow.file_path,
        jobId: activeJob.id,
      });

      setLogs((prev) => [
        ...prev,
        {
          job_id: activeJob.id,
          step_name: "client-system",
          message: "Job completed successfully!",
          stream: "stdout",
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          job_id: activeJob.id,
          step_name: "client-system",
          message: `Job failed/cancelled: ${err}`,
          stream: "stderr",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsRunning(false);
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
                  setLogs([]);
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  Select Workflow Job
                </div>
                <div className="flex gap-3 flex-wrap">
                  {activeWorkflow.jobs.map((job) => (
                    <div
                      key={job.id}
                      className={`p-3 bg-brand-bg border rounded-lg min-w-[160px] cursor-pointer transition-all duration-200 hover:border-brand-primary hover:-translate-y-0.5 ${activeJob?.id === job.id ? "border-brand-primary bg-brand-primary-light" : "border-brand-border"}`}
                      onClick={() => {
                        setActiveJob(job);
                        setLogs([]);
                      }}
                    >
                      <div className="font-semibold text-xs mb-1.5 text-brand-text truncate">{job.name || job.id}</div>
                      <div className="text-[10px] text-brand-muted">{job.steps.length} Steps</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Console logs */}
              <div className="flex-1 flex flex-col bg-brand-console font-mono overflow-hidden">
                <div className="flex justify-between items-center py-2.5 px-4 bg-black/20 border-b border-brand-border text-xs">
                  <div className="flex items-center gap-2 font-semibold text-brand-text">
                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                    <span>Terminal Logs: {activeJob?.name || activeJob?.id || "None"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={`py-1 px-3 text-xs text-white rounded font-medium cursor-pointer transition-all duration-150 active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none ${isRunning ? "bg-brand-danger hover:bg-brand-danger/90" : "bg-brand-success hover:bg-brand-success/90"}`}
                      onClick={runJob}
                      disabled={!activeJob || isRunning}
                    >
                      {isRunning ? "Running..." : "Run Job"}
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto text-[11px] leading-relaxed flex flex-col gap-1 select-text custom-scrollbar">
                  {logs.length === 0 ? (
                    <div className="text-brand-dark italic">
                      Click "Run Job" to execute this job locally.
                    </div>
                  ) : (
                    logs.map((log, index) => (
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
    </div>
  );
}

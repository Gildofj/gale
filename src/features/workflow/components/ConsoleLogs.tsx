import { useEffect, useRef } from "react";
import { useWorkflowStore, areDependenciesMet } from "../store/workflowStore";
import { Button } from "../../../shared/components/Button";

export function ConsoleLogs() {
  const {
    activeJob,
    logs,
    runningJobId,
    isWorkflowRunning,
    jobStatuses,
    runJob,
    stopJob,
  } = useWorkflowStore();

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const activeJobLogs = activeJob ? logs[activeJob.id] || [] : [];
  const depsMet = activeJob ? areDependenciesMet(activeJob, jobStatuses) : true;
  const isRunningThisJob = runningJobId === activeJob?.id;

  // Rola o terminal para o fim quando chegam novos logs ou muda o job ativo
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeJobLogs.length, activeJob?.id]);

  if (!activeJob) return null;

  const handleJobAction = () => {
    if (isRunningThisJob) {
      stopJob();
    } else {
      runJob();
    }
  };

  const isJobButtonDisabled = 
    isWorkflowRunning || 
    (runningJobId !== null && !isRunningThisJob) || 
    !depsMet;

  return (
    <div className="flex-1 flex flex-col bg-brand-console font-mono overflow-hidden">
      {/* Alerta de Dependências Pendentes */}
      {!depsMet && (
        <div className="bg-brand-warning-light border-b border-brand-warning/20 px-4 py-2 text-xs text-brand-warning flex items-center gap-2 select-none">
          <span>⚠️</span>
          <span>
            This job requires the following jobs to succeed first:{" "}
            <strong>{activeJob.needs?.join(", ")}</strong>
          </span>
        </div>
      )}

      {/* Terminal Title & Controls */}
      <div className="flex justify-between items-center py-2.5 px-4 bg-black/20 border-b border-brand-border text-xs select-none">
        <div className="flex items-center gap-2 font-semibold text-brand-text">
          {isRunningThisJob && (
            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
          )}
          <span>Terminal Logs: {activeJob.name || activeJob.id}</span>
        </div>
        <div>
          <Button
            variant={isRunningThisJob ? "danger" : "success"}
            onClick={handleJobAction}
            disabled={isJobButtonDisabled}
            size="sm"
          >
            {isRunningThisJob ? "Stop Job" : "Run Job"}
          </Button>
        </div>
      </div>

      {/* Real-time Logs Console */}
      <div className="flex-1 p-4 overflow-y-auto text-[11px] leading-relaxed flex flex-col gap-1 select-text custom-scrollbar">
        {activeJobLogs.length === 0 ? (
          <div className="text-brand-dark italic select-none">
            Click "Run Job" to execute this job locally.
          </div>
        ) : (
          activeJobLogs.map((log, index) => (
            <div key={index} className="flex gap-3 py-0.5 px-1 rounded hover:bg-white/5">
              <div className="text-brand-dark min-w-[70px] select-none">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-brand-primary min-w-[95px] font-semibold select-none truncate max-w-[120px]" title={log.step_name}>
                [{log.step_name}]
              </div>
              <div 
                className={`flex-1 whitespace-pre-wrap break-all ${
                  log.stream === "stderr" ? "text-brand-danger" : "text-brand-text"
                }`}
              >
                {log.message}
              </div>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}

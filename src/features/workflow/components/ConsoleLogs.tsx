import { useEffect, useRef, useState } from "react";
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const activeJobIdRef = useRef<string | undefined>(undefined);

  const activeJobLogs = activeJob ? logs[activeJob.id] || [] : [];
  const depsMet = activeJob ? areDependenciesMet(activeJob, jobStatuses) : true;
  const isRunningThisJob = runningJobId === activeJob?.id;

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 35;
    
    if (isAtBottomRef.current !== atBottom) {
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;
    }
  };

  const scrollToBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const isJobChange = activeJobIdRef.current !== activeJob?.id;
    activeJobIdRef.current = activeJob?.id;

    if (isJobChange) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setIsAtBottom(true);
      isAtBottomRef.current = true;
      return;
    }

    if (isAtBottomRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
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
    <div className="flex-1 flex flex-col bg-brand-console font-mono overflow-hidden relative">
      {!depsMet && (
        <div className="bg-brand-warning-light border-b border-brand-warning/20 px-4 py-2 text-xs text-brand-warning flex items-center gap-2 select-none">
          <span>⚠️</span>
          <span>
            This job requires the following jobs to succeed first:{" "}
            <strong>{activeJob.needs?.join(", ")}</strong>
          </span>
        </div>
      )}

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

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto text-[11px] leading-relaxed flex flex-col gap-1 select-text custom-scrollbar"
      >
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
      </div>

      {!isAtBottom && activeJobLogs.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 z-10"
        >
          <span>⬇️</span>
          <span className="font-sans font-semibold">Follow Logs</span>
        </button>
      )}
    </div>
  );
}


import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Job } from "../../../entities/pipeline";

interface JobNodeData {
  job: Job;
  status: "pending" | "running" | "success" | "error";
  isActive: boolean;
  isWorkflowRunning: boolean;
  runningJobId: string | null;
  depsMet: boolean;
  onSelect: (job: Job) => void;
  onRun: (job: Job) => void;
  onStop: () => void;
}

export const JobNode = memo(({ data }: { data: JobNodeData }) => {
  const {
    job,
    status,
    isActive,
    isWorkflowRunning,
    runningJobId,
    depsMet,
    onSelect,
    onRun,
    onStop,
  } = data;

  const isRunningThis = runningJobId === job.id;
  const isButtonDisabled = isWorkflowRunning || (runningJobId !== null && !isRunningThis) || !depsMet;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunningThis) {
      onStop();
    } else {
      onRun(job);
    }
  };

  // Status visual styles
  const statusStyles = {
    pending: {
      border: isActive ? "border-brand-primary" : "border-brand-border",
      bg: "bg-brand-panel",
      badge: "bg-brand-dark/40 text-brand-muted",
      light: "bg-brand-dark",
      glow: "",
    },
    running: {
      border: "border-brand-primary animate-pulse",
      bg: "bg-brand-panel-header/90",
      badge: "bg-brand-primary-light text-brand-primary",
      light: "bg-brand-primary animate-ping",
      glow: "shadow-[0_0_10px_rgba(224,90,71,0.4)]",
    },
    success: {
      border: isActive ? "border-brand-success" : "border-brand-border",
      bg: "bg-brand-panel",
      badge: "bg-brand-success-light text-brand-success",
      light: "bg-brand-success",
      glow: "",
    },
    error: {
      border: "border-brand-danger",
      bg: "bg-brand-panel",
      badge: "bg-brand-danger-light text-brand-danger",
      light: "bg-brand-danger",
      glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]",
    },
  };

  const currentStyle = statusStyles[status] || statusStyles.pending;

  return (
    <div
      onClick={() => onSelect(job)}
      className={`px-4 py-3 rounded-lg border-2 text-left min-w-[200px] select-none transition-all duration-200 hover:shadow-lg ${
        currentStyle.bg
      } ${currentStyle.border} ${currentStyle.glow} ${
        isActive ? "shadow-[0_0_12px_rgba(224,90,71,0.15)] scale-[1.02]" : "hover:border-brand-muted/40"
      } ${!depsMet ? "opacity-60 border-dashed" : ""}`}
    >
      {job.needs && job.needs.length > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 rounded-full border border-brand-bg bg-brand-border"
        />
      )}

      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-[10px] font-bold text-brand-muted uppercase tracking-wider">
          Job
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full relative flex items-center justify-center`}>
            {status === "running" && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75 animate-ping" />
            )}
            <span className={`w-1.5 h-1.5 rounded-full ${currentStyle.light}`} />
          </span>
          <span className="text-[10px] font-bold font-mono capitalize tracking-wide text-brand-text">
            {status}
          </span>
        </div>
      </div>

      <div className="font-semibold text-sm text-brand-text truncate pr-4 mb-2" title={job.name || job.id}>
        {job.name || job.id}
      </div>

      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-brand-border/60">
        <div className="text-[10px] text-brand-muted font-medium font-mono">
          {job.steps.length} {job.steps.length === 1 ? "step" : "steps"}
        </div>
        
        <button
          onClick={handleActionClick}
          disabled={isButtonDisabled}
          className={`flex items-center justify-center p-1.5 rounded-md border transition-all duration-150 cursor-pointer ${
            isRunningThis
              ? "bg-brand-danger-light text-brand-danger border-brand-danger/30 hover:bg-brand-danger hover:text-white"
              : "bg-brand-primary-light text-brand-primary border-brand-primary/30 hover:bg-brand-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          }`}
          title={isRunningThis ? "Stop Job" : "Run Job"}
        >
          {isRunningThis ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h12V5H6v14z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 rounded-full border border-brand-bg bg-brand-primary"
      />
    </div>
  );
});

JobNode.displayName = "JobNode";
